import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Bug, Lightbulb, Clock, Eye, CheckCircle2, Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FeedbackStatus = "pendente" | "visto" | "concluido";

interface Feedback {
  id: string;
  tipo: string;
  descricao: string;
  screenshot_url: string | null;
  pagina: string | null;
  status: FeedbackStatus;
  resposta_admin: string | null;
  user_name: string | null;
  user_email: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  pendente: { label: "Pendente", icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  visto: { label: "Visto", icon: Eye, color: "text-blue-500", bg: "bg-blue-500/10" },
  concluido: { label: "Concluído", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
};

export default function Feedbacks() {
  const { isAdmin } = useAuth();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | FeedbackStatus>("todos");
  const [typeFilter, setTypeFilter] = useState<"todos" | "bug" | "melhoria">("todos");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  if (!isAdmin) return <Navigate to="/pipeline" replace />;

  const fetchFeedbacks = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("feedbacks")
      .select("*")
      .order("created_at", { ascending: false });
    setFeedbacks((data as Feedback[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchFeedbacks(); }, []);

  const updateStatus = async (id: string, status: FeedbackStatus) => {
    setSaving(id);
    const { error } = await supabase.from("feedbacks").update({ status }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); }
    else {
      setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, status } : f));
      toast.success(`Status atualizado para "${STATUS_CONFIG[status].label}"`);
    }
    setSaving(null);
  };

  const sendResponse = async (id: string) => {
    const text = responses[id]?.trim();
    if (!text) return;
    setSaving(id);
    const { error } = await supabase.from("feedbacks").update({ resposta_admin: text }).eq("id", id);
    if (error) { toast.error("Erro ao salvar resposta"); }
    else {
      setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, resposta_admin: text } : f));
      setResponses(prev => { const n = { ...prev }; delete n[id]; return n; });
      toast.success("Resposta salva!");
    }
    setSaving(null);
  };

  const filtered = feedbacks.filter(f => {
    if (filter !== "todos" && f.status !== filter) return false;
    if (typeFilter !== "todos" && f.tipo !== typeFilter) return false;
    return true;
  });

  const counts = {
    todos: feedbacks.length,
    pendente: feedbacks.filter(f => f.status === "pendente").length,
    visto: feedbacks.filter(f => f.status === "visto").length,
    concluido: feedbacks.filter(f => f.status === "concluido").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Feedbacks & Sugestões</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie os feedbacks enviados pela equipe</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {(["todos", "pendente", "visto", "concluido"] as const).map(key => {
          const isActive = filter === key;
          const cfg = key === "todos" ? { label: "Todos", icon: MessageSquare, color: "text-foreground", bg: "bg-muted" } : STATUS_CONFIG[key];
          const Icon = cfg.icon;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isActive ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}
            >
              <div className={`p-2 rounded-lg ${cfg.bg}`}>
                <Icon size={16} className={cfg.color} />
              </div>
              <div className="text-left">
                <p className="text-lg font-bold text-foreground">{counts[key]}</p>
                <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Type filter */}
      <div className="flex items-center gap-2">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="bug">🐛 Bugs</SelectItem>
            <SelectItem value="melhoria">💡 Melhorias</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} resultado(s)</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum feedback encontrado.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(fb => {
            const cfg = STATUS_CONFIG[fb.status] ?? STATUS_CONFIG.pendente;
            const Icon = cfg.icon;
            return (
              <div key={fb.id} className="border border-border rounded-xl p-4 space-y-3 bg-card">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${fb.tipo === "bug" ? "bg-red-500/10 text-red-400" : "bg-primary/10 text-primary"}`}>
                        {fb.tipo === "bug" ? <><Bug size={10} className="inline mr-1" />Bug</> : <><Lightbulb size={10} className="inline mr-1" />Melhoria</>}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {fb.user_name || "Anônimo"} · {fb.user_email}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(fb.created_at).toLocaleDateString("pt-BR")} {new Date(fb.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {fb.pagina && <span className="text-[10px] text-muted-foreground">📍 {fb.pagina}</span>}
                    </div>
                    <p className="text-sm text-foreground">{fb.descricao}</p>
                  </div>

                  {/* Status selector */}
                  <Select
                    value={fb.status}
                    onValueChange={(v) => updateStatus(fb.id, v as FeedbackStatus)}
                    disabled={saving === fb.id}
                  >
                    <SelectTrigger className={`w-32 h-8 text-xs ${cfg.bg} ${cfg.color} border-none`}>
                      <Icon size={12} className="mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente"><Clock size={12} className="inline mr-1" />Pendente</SelectItem>
                      <SelectItem value="visto"><Eye size={12} className="inline mr-1" />Visto</SelectItem>
                      <SelectItem value="concluido"><CheckCircle2 size={12} className="inline mr-1" />Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Screenshot */}
                {fb.screenshot_url && (
                  <img src={fb.screenshot_url} alt="Screenshot" className="max-h-48 rounded-lg border border-border object-contain" />
                )}

                {/* Admin response */}
                {fb.resposta_admin ? (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Sua resposta:</p>
                    <p className="text-xs text-foreground">{fb.resposta_admin}</p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={responses[fb.id] ?? ""}
                      onChange={e => setResponses(prev => ({ ...prev, [fb.id]: e.target.value }))}
                      placeholder="Responder ao feedback..."
                      className="flex-1 text-xs bg-muted/50 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      onKeyDown={e => e.key === "Enter" && sendResponse(fb.id)}
                    />
                    <button
                      onClick={() => sendResponse(fb.id)}
                      disabled={!responses[fb.id]?.trim() || saving === fb.id}
                      className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      <Send size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
