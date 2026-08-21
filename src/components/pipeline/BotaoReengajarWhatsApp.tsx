import { useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Lead {
  id: string;
  nome: string;
  closer: string | null;
  etapa_atual: string;
  mensagem_recuperacao_enviada_em: string | null;
}

interface Props {
  lead: Lead;
  onSuccess?: () => void;
}

const ETAPAS_PERMITIDAS = ["Reunião Realizada", "Link Enviado"];
const EDGE_URL = "https://riyfdcmmabvpcubusujw.supabase.co/functions/v1/enviar-msg-recuperacao";

export function BotaoReengajarWhatsApp({ lead, onSuccess }: Props) {
  const { user, profile } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const userNome = profile?.nome ?? user?.email?.split("@")[0] ?? "Usuário";
  const userId = user?.id ?? "";

  const etapaOk = ETAPAS_PERMITIDAS.includes(lead.etapa_atual);
  const jaEnviado = !!lead.mensagem_recuperacao_enviada_em;
  const ehResponsavel = lead.closer === userNome;

  if (!etapaOk) return null;

  if (jaEnviado) {
    const dataFmt = new Date(lead.mensagem_recuperacao_enviada_em!).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 text-emerald-500 text-xs font-medium">
        <span>✓ Mensagem de recuperação enviada em {dataFmt}</span>
      </div>
    );
  }

  if (!ehResponsavel) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        title={`Apenas ${lead.closer} pode enviar esta mensagem`}
        className="gap-2 text-xs opacity-60 cursor-not-allowed"
      >
        <MessageCircle size={14} />
        Reengajar via WhatsApp
      </Button>
    );
  }

  const handleEnviar = async () => {
    if (!userId) {
      toast.error("Usuário não identificado. Faça login novamente.");
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id, usuario_id: userId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.error) {
        throw new Error(data?.error ?? `Erro HTTP ${r.status}`);
      }
      toast.success("Mensagem de recuperação enviada!");
      setShowConfirm(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar mensagem");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowConfirm(true)}
        className="gap-2 text-xs bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20 hover:text-amber-600"
      >
        <MessageCircle size={14} />
        Reengajar via WhatsApp
      </Button>

      <Dialog open={showConfirm} onOpenChange={(open) => !enviando && setShowConfirm(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar mensagem de recuperação</DialogTitle>
            <DialogDescription>
              Você vai enviar a mensagem de recuperação para <strong>{lead.nome}</strong>.
              Uma vez enviada, não dá pra desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirm(false)}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleEnviar}
              disabled={enviando}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {enviando ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1" />
                  Enviando...
                </>
              ) : (
                "Enviar agora"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
