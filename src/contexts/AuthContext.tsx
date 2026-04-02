import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabaseExt } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  nome: string | null;
  avatar_url: string | null;
  role: "admin" | "sdr" | "closer";
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (email: string) => {
    try {
      const { data, error } = await supabaseExt
        .from("user_profiles")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar perfil:", error.message);
        setProfile(null);
        return;
      }
      setProfile(data as UserProfile | null);
    } catch (err) {
      console.error("Erro inesperado ao buscar perfil:", err);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // 1) Tenta recuperar a sessão existente (ou trocar o ?code= por sessão no PKCE)
    supabaseExt.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      if (!mounted) return;

      if (error) {
        console.error("Erro ao recuperar sessão:", error.message);
        // Limpa dados stale para evitar loop
        supabaseExt.auth.signOut().catch(() => {});
        setUser(null);
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (currentSession?.user) {
        setUser(currentSession.user);
        setSession(currentSession);
        fetchProfile(currentSession.user.email!).then(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setUser(null);
        setSession(null);
        setProfile(null);
        setLoading(false);
      }
    });

    // 2) Escuta mudanças de auth (login, logout, refresh)
    const {
      data: { subscription },
    } = supabaseExt.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      console.log("Auth event:", event);

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (newSession?.user) {
          setUser(newSession.user);
          setSession(newSession);
          await fetchProfile(newSession.user.email!);
        }
        setLoading(false);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setSession(null);
        setProfile(null);
        setLoading(false);
      } else if (event === "INITIAL_SESSION") {
        // Já tratado pelo getSession acima
        // Apenas garante que loading sai de true
        if (!newSession) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(async () => {
    const redirectUrl = `${window.location.origin}/pipeline`;
    const { error } = await supabaseExt.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    if (error) {
      console.error("Erro no login:", error.message);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabaseExt.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
