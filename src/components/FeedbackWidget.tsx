import { useState, useRef } from "react";
import { MessageSquarePlus, Bug, Lightbulb, Send, X, Image, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function FeedbackWidget() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"bug" | "melhoria">("bug");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (!description.trim()) {
      toast.error("Descreva o problema ou sugestão");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-feedback", {
        body: {
          type,
          description: description.trim(),
          screenshot,
          user_name: profile?.nome || "Anônimo",
          user_email: profile?.email || "",
          page: window.location.pathname,
        },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Erro");
      toast.success("Feedback enviado! Obrigado 🙏");
      setDescription("");
      setScreenshot(null);
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar feedback");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
        title="Relatar bug ou sugestão"
      >
        <MessageSquarePlus size={22} />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4 animate-in slide-in-from-bottom-4 fade-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Enviar Feedback</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

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

            {/* Description */}
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={type === "bug" ? "Descreva o problema que encontrou..." : "Descreva sua sugestão de melhoria..."}
              className="w-full min-h-[100px] text-sm bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />

            {/* Screenshot */}
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

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={sending || !description.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {sending ? "Enviando..." : "Enviar Feedback"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
