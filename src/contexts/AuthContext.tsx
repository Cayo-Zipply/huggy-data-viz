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

export interface UserProfile {
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

  const fetchProfile = useCallback(async (userId: string, email?: string) => {
    try {
      // Try by user_id first
      let { data, error } = await supabaseExt
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      // Fallback: try by email
      if (!data && email) {
        const res = await supabaseExt
          .from("user_profiles")
          .select("*")
          .eq("email", email.toLowerCase())
          .maybeSingle();
        data = res.data;
        error = res.error;

        // Link/fix user_id in profile when found by email
        if (data && data.user_id !== userId) {
          await supabaseExt
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
      setProfile(data as UserProfile | null);
    } catch (err) {
      console.error("Erro inesperado ao buscar perfil:", err);
      setProfile(null);
    }
  }, []);

  const applySession = useCallback(
    async (sess: Session | null) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        await fetchProfile(sess.user.id, sess.user.email);
      } else {
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
    } = supabaseExt.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      // Fire-and-forget to avoid blocking auth queue
      applySession(newSession).then(() => {
        if (mounted) setLoading(false);
      });
    });

    // 2) Then restore/process session (handles ?code= from OAuth)
    supabaseExt.auth
      .getSession()
      .then(async ({ data: { session: restored } }) => {
        if (!mounted) return;
        await applySession(restored);
        if (mounted) setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabaseExt.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) console.error("Erro no login:", error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabaseExt.auth.signOut();
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
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
