import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
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
  isAdmin: boolean;
  isSdr: boolean;
  isCloser: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabaseExt
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    setProfile(data as UserProfile | null);
  }, []);

  useEffect(() => {
    // 1. Set up listener FIRST so we catch the token exchange event
    const { data: { subscription } } = supabaseExt.auth.onAuthStateChange(
      (_event, sess) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          // Use setTimeout to avoid Supabase deadlock on async calls inside callback
          setTimeout(() => fetchProfile(sess.user.id), 0);
        } else {
          setProfile(null);
        }
      }
    );

    // 2. THEN call getSession — this processes the ?code= in the URL
    supabaseExt.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signInWithGoogle = async () => {
    await supabaseExt.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { hd: "penaquadros.com" },
      },
    });
  };

  const signOut = async () => {
    await supabaseExt.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const isAdmin = profile?.role === "admin";
  const isSdr = profile?.role === "sdr";
  const isCloser = profile?.role === "closer";

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, isAdmin, isSdr, isCloser, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
