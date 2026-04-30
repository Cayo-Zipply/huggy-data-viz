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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--primary)/0.1)] to-background">
      <div className="bg-card border border-border rounded-2xl p-10 max-w-[420px] w-full mx-4 shadow-xl">
        {/* Brand */}
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary-foreground text-2xl font-bold">
              OF
        </div>

        <h1 className="text-2xl font-bold text-foreground text-center mb-1">
            O Farol
        </h1>
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
            {loading ? "Carregando..." : isSignUp ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          {isSignUp ? "Já tem conta?" : "Não tem conta?"}{" "}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setMessage(null); }}
            className="text-primary hover:underline font-medium"
          >
            {isSignUp ? "Fazer login" : "Criar conta"}
          </button>
        </p>
      </div>
    </div>
  );
}
