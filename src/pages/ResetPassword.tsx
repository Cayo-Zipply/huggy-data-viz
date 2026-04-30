import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // Detecta o token de recuperação no hash da URL e cria a sessão temporária.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      // Supabase já processa o hash automaticamente via detectSessionInUrl
      setReady(true);
      return;
    }
    // Se já existe sessão (clicou no link e voltou), permite trocar
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else setMessage({ type: "error", text: "Link de recuperação inválido ou expirado. Solicite um novo." });
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (password.length < 6) {
      setMessage({ type: "error", text: "A senha precisa ter no mínimo 6 caracteres." });
      return;
    }
    if (password !== confirm) {
      setMessage({ type: "error", text: "As senhas não coincidem." });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage({ type: "success", text: "Senha atualizada! Redirecionando..." });
      setTimeout(() => navigate("/pipeline", { replace: true }), 1200);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro ao atualizar senha" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--primary)/0.1)] to-background">
      <div className="bg-card border border-border rounded-2xl p-10 max-w-[420px] w-full mx-4 shadow-xl">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary-foreground text-2xl font-bold">
          OF
        </div>
        <h1 className="text-2xl font-bold text-foreground text-center mb-1">Definir nova senha</h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          Escolha uma nova senha para acessar O Farol
        </p>

        {ready ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Nova senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Confirmar senha</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Repita a nova senha"
              />
            </div>

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
              {loading ? "Salvando..." : "Atualizar senha"}
            </button>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            {message && (
              <p className={`text-sm ${message.type === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                {message.text}
              </p>
            )}
            <button
              onClick={() => navigate("/login")}
              className="text-sm text-primary hover:underline font-medium"
            >
              Voltar para o login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
