import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary text-center mb-8">
          Pena Quadros · Painel Comercial
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
