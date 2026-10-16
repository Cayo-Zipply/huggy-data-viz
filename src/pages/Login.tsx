import { useState } from "react";
import { supabase } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  if (!authLoading && user) {
    return <Navigate to="/pipeline" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const normalizedEmail = email.toLowerCase().trim();
      if (!normalizedEmail.endsWith("@penaquadros.com")) {
        throw new Error("Apenas e-mails @penaquadros.com são permitidos.");
      }

      if (forgotMode) {
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage({
          type: "success",
          text: "Se o e-mail existir, enviamos um link de recuperação. Verifique sua caixa de entrada e spam.",
        });
      } else if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { full_name: nome },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro ao autenticar" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* L-frame bronze */}
      <div className="pointer-events-none absolute inset-6 sm:inset-10">
        <div className="absolute top-0 left-0 w-24 h-px bg-primary" />
        <div className="absolute top-0 left-0 h-24 w-px bg-primary" />
        <div className="absolute bottom-0 right-0 w-24 h-px bg-primary" />
        <div className="absolute bottom-0 right-0 h-24 w-px bg-primary" />
      </div>

      <div className="bg-card border border-primary/30 rounded-lg p-10 max-w-[420px] w-full mx-4 shadow-2xl relative">
        {/* Brand */}
        <img
          src="/brand/farol-icon.svg"
          alt="O Farol"
          className="w-16 h-16 mx-auto mb-6 dark:block hidden"
        />
        <img
          src="/brand/farol-icon-mono.svg"
          alt="O Farol"
          className="w-16 h-16 mx-auto mb-6 dark:hidden block"
        />

        <h1 className="font-serif-display text-3xl text-foreground text-center mb-2">
          O FAROL
        </h1>
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary text-center mb-2">
          Pena Quadros · Painel Comercial
        </p>
        <p className="text-sm text-muted-foreground text-center mb-8">
          {forgotMode
            ? "Informe seu e-mail para receber o link de recuperação"
            : isSignUp
              ? "Crie sua conta para acessar o painel"
              : "Acesse o painel com suas credenciais"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && !forgotMode && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Nome</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Seu nome completo"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="seu@email.com"
            />
          </div>

          {!forgotMode && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Mínimo 6 caracteres"
              />
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setMessage(null); }}
                  className="text-xs text-primary hover:underline font-medium mt-2"
                >
                  Esqueci minha senha
                </button>
              )}
            </div>
          )}

          {message && (
            <p className={`text-sm text-center ${message.type === "error" ? "text-destructive" : "text-green-600"}`}>
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading
              ? "Carregando..."
              : forgotMode
                ? "Enviar link de recuperação"
                : isSignUp
                  ? "Criar conta"
                  : "Entrar"}
          </button>
        </form>

        {!forgotMode && (
          <>
            <div className="flex items-center gap-2 my-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                setMessage(null);
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: {
                    redirectTo: `${window.location.origin}/pipeline`,
                    scopes: "openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events",
                    queryParams: { access_type: "offline", prompt: "consent", hd: "penaquadros.com" },
                  },
                });
                if (error) {
                  setMessage({ type: "error", text: error.message });
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="w-full py-2.5 rounded-lg border border-border bg-background text-foreground font-semibold text-sm hover:bg-muted transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Entrar com Google
            </button>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Recomendado: permite envio de e-mails pelo Gmail.
            </p>
          </>
        )}

        {forgotMode ? (
          <p className="text-sm text-muted-foreground text-center mt-6">
            <button
              onClick={() => { setForgotMode(false); setMessage(null); }}
              className="text-primary hover:underline font-medium"
            >
              Voltar para o login
            </button>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground text-center mt-6">
            {isSignUp ? "Já tem conta?" : "Não tem conta?"}{" "}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setMessage(null); }}
              className="text-primary hover:underline font-medium"
            >
              {isSignUp ? "Fazer login" : "Criar conta"}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
