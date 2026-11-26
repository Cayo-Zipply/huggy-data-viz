import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabaseExternal";
import { useQueryClient } from "@tanstack/react-query";
import { clearPersistedData } from "@/lib/clearLocalData";
import { presenceOffline } from "@/hooks/usePresenceHeartbeat";
import type { User, Session } from "@supabase/supabase-js";
import { findExistingProfile } from "@/lib/userProfileAccess";
import { Button } from "@/components/ui/button";

interface UserProfile {
  id: string;
  email: string;
  nome: string;
  role: "admin" | "sdr" | "closer" | null;
  funcoes: ("sdr" | "closer")[];
  secondary_role: "sdr" | "closer" | null;
  user_id: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSdr: boolean;
  isCloser: boolean;
  isDual: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setRole: (role: "sdr" | "closer") => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Grava tokens do Google APENAS quando vêm de um login Google recém-realizado.
 * Nunca sobrescreve token/refresh_token existente com valor vazio e nunca
 * inventa `expires_at` — só usa o `expires_in` real devolvido pelo Google.
 */
async function persistGoogleToken(session: Session | null) {
  if (!session?.user?.id) return;
  const provider = (session.user.app_metadata as any)?.provider;
  if (provider !== "google") return;

  const providerToken = (session as any).provider_token as string | undefined;
  const refreshToken = (session as any).provider_refresh_token as string | undefined;
  const expiresIn = (session as any).provider_token_expires_in as number | undefined;
  if (!providerToken || !providerToken.trim()) return;

  const payload: any = {
    user_id: session.user.id,
    email: session.user.email,
    access_token: providerToken,
  };
  if (typeof expiresIn === "number" && expiresIn > 0) {
    payload.expires_at = new Date(Date.now() + expiresIn * 1000).toISOString();
  }
  if (refreshToken && refreshToken.trim()) {
    payload.refresh_token = refreshToken;
  }

  const { error } = await (supabase as any)
    .from("user_google_tokens")
    .upsert(payload, { onConflict: "user_id" });
  if (error) console.error("[persistGoogleToken] erro:", error.message);
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const mountedRef = useRef(true);
  const profileRef = useRef<UserProfile | null>(null);
  const profileRequestRef = useRef(0);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const fetchProfile = useCallback(async (userId: string, email: string) => {
    return await findExistingProfile(supabase, userId, email) as UserProfile | null;
  }, []);

  const clearAuthState = useCallback(() => {
    profileRef.current = null;
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const applySessionState = useCallback(
    (nextSession: Session | null) => {
      if (nextSession?.user) {
        setSession(nextSession);
        setUser(nextSession.user);
        return;
      }

      clearAuthState();
    },
    [clearAuthState]
  );

  const loadProfile = useCallback(
    async (userId: string, email: string) => {
      const requestId = ++profileRequestRef.current;
      try {
        const nextProfile = await fetchProfile(userId, email);
        if (!mountedRef.current || requestId !== profileRequestRef.current) return;
        if (!nextProfile) {
          setAccessDenied(true);
          clearAuthState();
          setLoading(false);
          await clearPersistedData(queryClient);
          await supabase.auth.signOut();
          return;
        }
        profileRef.current = nextProfile;
        setProfile(nextProfile);
        setAccessDenied(false);
        setLoading(false);
      } catch (error) {
        if (!mountedRef.current || requestId !== profileRequestRef.current) return;
        console.error("Erro ao buscar perfil:", error);
        // A failed request is not proof that the profile was deleted.
        setProfile(null);
        profileRef.current = null;
        setLoading(false);
      }
    },
    [fetchProfile, clearAuthState, queryClient]
  );

  useEffect(() => {
    mountedRef.current = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mountedRef.current) return;

      if (event === "SIGNED_OUT" || !newSession?.user) {
        profileRequestRef.current += 1;
        // Sessão encerrada/expirada: nada do usuário anterior fica no navegador.
        void clearPersistedData(queryClient);
        clearAuthState();
        setLoading(false);
        return;
      }

      applySessionState(newSession);

      if (event === "SIGNED_IN" && newSession) {
        void persistGoogleToken(newSession);
      }

      if (event === "TOKEN_REFRESHED") {
        window.setTimeout(() => {
          if (mountedRef.current && newSession.user.email) void loadProfile(newSession.user.id, newSession.user.email);
        }, 0);
        return;
      }

      if (!newSession.user.email) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const currentProfile = profileRef.current;
      const sameUserProfile = currentProfile?.user_id === newSession.user.id || currentProfile?.email === newSession.user.email;
      if (sameUserProfile) {
        setLoading(false);
        return;
      }

      setLoading(true);
      window.setTimeout(() => {
        if (!mountedRef.current || !newSession.user.email) return;
        void loadProfile(newSession.user.id, newSession.user.email);
      }, 0);
    });

    void supabase.auth.getSession().then(async ({ data: { session: restored } }) => {
      if (!mountedRef.current) return;

      if (!restored?.user) {
        clearAuthState();
        setLoading(false);
        return;
      }

      applySessionState(restored);


      if (!restored.user.email) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      await loadProfile(restored.user.id, restored.user.email);
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [applySessionState, clearAuthState, loadProfile, queryClient]);

  const signOut = useCallback(async () => {
    try {
      profileRequestRef.current += 1;
      await presenceOffline();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    }
    await clearPersistedData(queryClient);
    clearAuthState();
    setLoading(false);
  }, [clearAuthState, queryClient]);

  const refreshProfile = useCallback(async () => {
    if (user?.email) {
      await loadProfile(user.id, user.email);
    }
  }, [user, loadProfile]);

  useEffect(() => {
    if (!user?.email) return;
    const recheck = () => { if (document.visibilityState === "visible") void refreshProfile(); };
    window.addEventListener("focus", recheck);
    return () => window.removeEventListener("focus", recheck);
  }, [user?.id, user?.email, refreshProfile]);

  const isAdmin = profile?.role === "admin";
  // Fonte de verdade para gating no pipe: coluna `funcoes` (array). `role`
  // segue existindo mas só é usada para distinguir admin. Admin enxerga tudo.
  const funcoes = profile?.funcoes || [];
  const hasFuncao = (f: "sdr" | "closer") =>
    isAdmin || funcoes.includes(f) || profile?.role === f || profile?.secondary_role === f;
  const isSdr = hasFuncao("sdr");
  const isCloser = hasFuncao("closer");
  const isDual = isSdr && isCloser;

  const setRole = useCallback(async (role: "sdr" | "closer") => {
    if (!profile) return false;
    const { error } = await (supabase as any)
      .from("user_profiles")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) {
      console.error("Erro ao definir papel:", error.message);
      return false;
    }
    setProfile({ ...profile, role });
    return true;
  }, [profile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isAdmin,
        isSdr,
        isCloser,
        isDual,
        signOut,
        refreshProfile,
        setRole,
      }}
    >
      {accessDenied ? (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-xl font-semibold text-foreground">Acesso não autorizado — fale com o administrador</h1>
            <Button variant="outline" onClick={() => setAccessDenied(false)}>Voltar ao login</Button>
          </div>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
