import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  email: string;
  nome: string;
  role: "admin" | "sdr" | "closer" | null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const profileRequestRef = useRef(0);

  const fetchProfile = useCallback(async (userId: string, email: string) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const fallbackName = normalizedEmail
        .split("@")[0]
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

      // Try by user_id first
      let { data, error } = await (supabase as any)
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      // Fallback: try by email
      if (!data && !error) {
        const res = await (supabase as any)
          .from("user_profiles")
          .select("*")
          .eq("email", normalizedEmail)
          .maybeSingle();
        data = res.data;
        error = res.error;

        // Auto-link user_id if found by email
        if (data && data.user_id !== userId) {
          await (supabase as any)
            .from("user_profiles")
            .update({ user_id: userId })
            .eq("id", data.id);
          data = { ...data, user_id: userId };
        }
      }

      if (error) {
        console.error("Erro ao buscar perfil:", error.message);
        return null;
      }

      if (!data) {
        // Profile should have been auto-created by trigger, wait a moment and retry
        await new Promise((r) => setTimeout(r, 1000));
        const retry = await (supabase as any)
          .from("user_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (retry.data) {
          return retry.data as UserProfile;
        } else {
          const created = await (supabase as any)
            .from("user_profiles")
            .insert({
              user_id: userId,
              email: normalizedEmail,
              nome: fallbackName || "Usuário",
              role: null,
            })
            .select("*")
            .maybeSingle();

          if (created.data) {
            return created.data as UserProfile;
          } else {
            console.warn("Perfil não encontrado para:", normalizedEmail, created.error?.message);
            return null;
          }
        }
      } else {
        return data as UserProfile;
      }
    } catch (err) {
      console.error("Erro inesperado ao buscar perfil:", err);
      return null;
    }
  }, []);

  const clearAuthState = useCallback(() => {
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
      const nextProfile = await fetchProfile(userId, email);

      if (!mountedRef.current || requestId !== profileRequestRef.current) {
        return;
      }

      setProfile(nextProfile);
      setLoading(false);
    },
    [fetchProfile]
  );

  useEffect(() => {
    mountedRef.current = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mountedRef.current) return;

      if (event === "SIGNED_OUT" || !newSession?.user) {
        profileRequestRef.current += 1;
        clearAuthState();
        setLoading(false);
        return;
      }

      applySessionState(newSession);

      if (event === "TOKEN_REFRESHED") {
        setLoading(false);
        return;
      }

      if (!newSession.user.email) {
        setProfile(null);
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
  }, [applySessionState, clearAuthState, loadProfile]);

  const signOut = useCallback(async () => {
    try {
      profileRequestRef.current += 1;
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    }
    clearAuthState();
    setLoading(false);
  }, [clearAuthState]);

  const refreshProfile = useCallback(async () => {
    if (user?.email) {
      await fetchProfile(user.id, user.email);
    }
  }, [user, fetchProfile]);

  const isAdmin = profile?.role === "admin";
  const primaryRole = profile?.role;
  const secondaryRole = profile?.secondary_role;
  const hasRole = (r: string) => primaryRole === r || secondaryRole === r;
  const isSdr = hasRole("sdr");
  const isCloser = hasRole("closer");
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
      {children}
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
