import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseExternal";
import { Navigate } from "react-router-dom";
import { Bug, Lightbulb, Clock, CheckCircle2, Loader2, MessageSquare, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Tabela real: public.feedback_reports
// Colunas: id, type, description, user_name, user_email, page_url, has_screenshot, resolved, created_at
interface FeedbackReport {
  id: string;
  type: string;
  description: string;
  user_name: string | null;
  user_email: string | null;
  page_url: string | null;
  has_screenshot: boolean | null;
  resolved: boolean;
  created_at: string;
}

type StatusFilter = "todos" | "pendente" | "concluido";

const STATUS_CONFIG = {
  pendente: { label: "Pendente", icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  concluido: { label: "Concluído", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
} as const;

export default function Feedbacks() {
  const { isAdmin } = useAuth();
  const [feedbacks, setFeedbacks] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("todos");
  const [typeFilter, setTypeFilter] = useState<"todos" | "bug" | "melhoria">("todos");
  const [saving, setSaving] = useState<string | null>(null);

  const fetchFeedbacks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("feedback_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar feedbacks: " + error.message);
    setFeedbacks((data as FeedbackReport[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchFeedbacks(); }, []);

  if (!isAdmin) return <Navigate to="/pipeline" replace />;

  const toggleResolved = async (id: string, resolved: boolean) => {
    setSaving(id);
    const { error } = await supabase.from("feedback_reports").update({ resolved }).eq("id", id);
    if (error) toast.error("Erro ao atualizar");
    else {
      setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, resolved } : f));
      toast.success(resolved ? "Marcado como concluído" : "Marcado como pendente");
    }
    setSaving(null);
  };

  const filtered = feedbacks.filter(f => {
    if (filter === "pendente" && f.resolved) return false;
    if (filter === "concluido" && !f.resolved) return false;
    if (typeFilter !== "todos" && f.type !== typeFilter) return false;
    return true;
  });

  const counts = {
    todos: feedbacks.length,
    pendente: feedbacks.filter(f => !f.resolved).length,
    concluido: feedbacks.filter(f => f.resolved).length,
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Feedbacks & Sugestões</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie os feedbacks enviados pela equipe</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {(["todos", "pendente", "concluido"] as const).map(key => {
          const isActive = filter === key;
          const cfg = key === "todos"
            ? { label: "Todos", icon: MessageSquare, color: "text-foreground", bg: "bg-muted" }
            : STATUS_CONFIG[key];
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
            const cfg = fb.resolved ? STATUS_CONFIG.concluido : STATUS_CONFIG.pendente;
            const Icon = cfg.icon;
            return (
              <div key={fb.id} className="border border-border rounded-xl p-4 space-y-3 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${fb.type === "bug" ? "bg-red-500/10 text-red-400" : "bg-primary/10 text-primary"}`}>
                        {fb.type === "bug" ? <><Bug size={10} className="inline mr-1" />Bug</> : <><Lightbulb size={10} className="inline mr-1" />Melhoria</>}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {fb.user_name || "Anônimo"} · {fb.user_email}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(fb.created_at).toLocaleDateString("pt-BR")} {new Date(fb.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {fb.page_url && (
                        <a href={fb.page_url} target="_blank" rel="noreferrer" className="text-[10px] text-muted-foreground hover:text-foreground underline">
                          📍 {fb.page_url.replace(/^https?:\/\//, "").slice(0, 40)}
                        </a>
                      )}
                      {fb.has_screenshot && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <ImageIcon size={10} /> screenshot
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{fb.description}</p>
                  </div>

                  <Select
                    value={fb.resolved ? "concluido" : "pendente"}
                    onValueChange={(v) => toggleResolved(fb.id, v === "concluido")}
                    disabled={saving === fb.id}
                  >
                    <SelectTrigger className={`w-32 h-8 text-xs ${cfg.bg} ${cfg.color} border-none`}>
                      <Icon size={12} className="mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente"><Clock size={12} className="inline mr-1" />Pendente</SelectItem>
                      <SelectItem value="concluido"><CheckCircle2 size={12} className="inline mr-1" />Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
