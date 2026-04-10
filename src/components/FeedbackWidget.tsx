import { useState, useRef, useEffect } from "react";
import { MessageSquarePlus, Bug, Lightbulb, Send, X, Image, Loader2, ChevronDown, ChevronUp, Clock, Eye, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { supabaseExt } from "@/lib/supabaseExternal";

type FeedbackStatus = "pendente" | "visto" | "concluido";

interface Feedback {
  id: string;
  tipo: string;
  descricao: string;
  status: FeedbackStatus;
  resposta_admin: string | null;
  created_at: string;
  pagina: string | null;
}

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; icon: typeof Clock; color: string }> = {
  pendente: { label: "Pendente", icon: Clock, color: "text-yellow-500" },
  visto: { label: "Visto", icon: Eye, color: "text-blue-500" },
  concluido: { label: "Concluído", icon: CheckCircle2, color: "text-green-500" },
};

const EXTERNAL_URL = "https://riyfdcmmabvpcubusujw.supabase.co";
const EXTERNAL_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpeWZkY21tYWJ2cGN1YnVzdWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NTMyMDMsImV4cCI6MjA5MDIyOTIwM30.pCRIa4UEC9WQiBP8EwzVrO73qS1FbsQ9fvKzlUPD1Gc";

export function FeedbackWidget() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"novo" | "historico">("novo");
  const [type, setType] = useState<"bug" | "melhoria">("bug");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [myFeedbacks, setMyFeedbacks] = useState<Feedback[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchMyFeedbacks = async () => {
    if (!user) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from("feedbacks")
      .select("id, tipo, descricao, status, resposta_admin, created_at, pagina")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setMyFeedbacks((data as Feedback[]) ?? []);
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (open && tab === "historico") fetchMyFeedbacks();
  }, [open, tab]);

  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setScreenshot(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if (!description.trim() || !user) {
      toast.error("Descreva o problema ou sugestão");
      return;
    }
    setSending(true);
    try {
      // 1) Save to Lovable Cloud feedbacks table for tracking
      const { error: dbError } = await supabase.from("feedbacks").insert({
        tipo: type,
        descricao: description.trim(),
        screenshot_url: screenshot,
        pagina: window.location.pathname,
        user_id: user.id,
        user_name: profile?.nome || "Anônimo",
        user_email: profile?.email || "",
      });
      if (dbError) throw dbError;

      // 2) Call external edge function feedback-report (Slack notification)
      try {
        const userName = profile?.nome || user.email || "Anônimo";
        await fetch(`${EXTERNAL_URL}/functions/v1/feedback-report`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": EXTERNAL_ANON_KEY,
          },
          body: JSON.stringify({
            type,
            description: description.trim(),
            user_name: userName,
            user_email: profile?.email || user.email || "",
            page_url: window.location.href,
            screenshot: screenshot ?? null,
          }),
        });
      } catch (slackErr) {
        // Slack notification is best-effort, don't fail the whole flow
        console.warn("feedback-report edge function error:", slackErr);
      }

      toast.success("Feedback enviado! Obrigado 🙏");
      setDescription("");
      setScreenshot(null);
      setTab("historico");
      fetchMyFeedbacks();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar feedback");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
        title="Feedback e sugestões"
      >
        <MessageSquarePlus size={22} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md animate-in slide-in-from-bottom-4 fade-in duration-200 flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 pb-2">
              <h3 className="text-base font-semibold text-foreground">Feedback</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mx-4 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setTab("novo")}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${tab === "novo" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                Novo
              </button>
              <button
                onClick={() => setTab("historico")}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${tab === "historico" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                Meus envios
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 pt-3 space-y-3">
              {tab === "novo" ? (
                <>
                  {/* Type selector */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setType("bug")}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${type === "bug" ? "border-red-500 bg-red-500/10 text-red-400" : "border-border text-muted-foreground hover:border-border/80"}`}
                    >
                      <Bug size={16} /> Bug
                    </button>
                    <button
                      onClick={() => setType("melhoria")}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${type === "melhoria" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-border/80"}`}
                    >
                      <Lightbulb size={16} /> Melhoria
                    </button>
                  </div>

                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={type === "bug" ? "Descreva o problema que encontrou..." : "Descreva sua sugestão de melhoria..."}
                    className="w-full min-h-[100px] text-sm bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />

                  <div>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleScreenshot} className="hidden" />
                    {screenshot ? (
                      <div className="relative">
                        <img src={screenshot} alt="Screenshot" className="w-full h-32 object-cover rounded-lg border border-border" />
                        <button onClick={() => setScreenshot(null)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-2 border border-dashed border-border rounded-lg w-full justify-center"
                      >
                        <Image size={14} /> Anexar print (opcional)
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleSend}
                    disabled={sending || !description.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {sending ? "Enviando..." : "Enviar Feedback"}
                  </button>
                </>
              ) : (
                <>
                  {loadingHistory ? (
                    <div className="flex justify-center py-8">
                      <Loader2 size={20} className="animate-spin text-muted-foreground" />
                    </div>
                  ) : myFeedbacks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum feedback enviado ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {myFeedbacks.map((fb) => {
                        const cfg = STATUS_CONFIG[fb.status as FeedbackStatus] ?? STATUS_CONFIG.pendente;
                        const Icon = cfg.icon;
                        return (
                          <FeedbackHistoryItem key={fb.id} fb={fb} cfg={cfg} Icon={Icon} />
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FeedbackHistoryItem({ fb, cfg, Icon }: { fb: Feedback; cfg: { label: string; color: string }; Icon: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-border rounded-lg p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${fb.tipo === "bug" ? "bg-red-500/10 text-red-400" : "bg-primary/10 text-primary"}`}>
              {fb.tipo === "bug" ? "Bug" : "Melhoria"}
            </span>
            <span className={`flex items-center gap-1 text-[10px] font-medium ${cfg.color}`}>
              <Icon size={10} /> {cfg.label}
            </span>
          </div>
          <p className="text-sm text-foreground mt-1 line-clamp-2">{fb.descricao}</p>
        </div>
        {expanded ? <ChevronUp size={14} className="text-muted-foreground mt-1 shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground mt-1 shrink-0" />}
      </div>
      {expanded && (
        <div className="space-y-1.5 pt-1 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground">
            {new Date(fb.created_at).toLocaleDateString("pt-BR")} · {fb.pagina || "—"}
          </p>
          {fb.resposta_admin && (
            <div className="bg-muted/50 rounded-md p-2">
              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Resposta:</p>
              <p className="text-xs text-foreground">{fb.resposta_admin}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
