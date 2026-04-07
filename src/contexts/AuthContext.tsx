import {
  createContext,
  useContext,
  useEffect,
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
  role: "admin" | "sdr" | "closer";
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
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string, email: string) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();

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
        setProfile(null);
        return;
      }

      if (!data) {
        console.warn("Perfil não encontrado para:", normalizedEmail);
        setProfile(null);
        return;
      }

      setProfile(data as UserProfile);
    } catch (err) {
      console.error("Erro inesperado ao buscar perfil:", err);
      setProfile(null);
    }
  }, []);

  const applySession = useCallback(
    async (s: Session | null) => {
      if (s?.user) {
        setSession(s);
        setUser(s.user);
        if (s.user.email) {
          await fetchProfile(s.user.id, s.user.email);
        }
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    },
    [fetchProfile]
  );

  useEffect(() => {
    let mounted = true;

    // 1) Register listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      console.log("[Auth]", _event, newSession?.user?.email ?? "no user");

      if (_event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      await applySession(newSession);
      if (mounted) setLoading(false);
    });

    // 2) Then get initial session (processes ?code= from OAuth callback)
    supabase.auth.getSession().then(async ({ data: { session: restored } }) => {
      if (!mounted) return;
      await applySession(restored);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
          hd: "penaquadros.com",
        },
      },
    });
    if (error) {
      console.error("Erro no login:", error.message);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const isAdmin = profile?.role === "admin";
  const isSdr = profile?.role === "sdr";
  const isCloser = profile?.role === "closer";

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
        signInWithGoogle,
        signOut,
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
