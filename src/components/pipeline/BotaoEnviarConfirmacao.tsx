import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Reuniao {
  id: string;
  data_inicio: string;
  meet_link: string | null;
  status: string;
  confirmacao_manual_enviada_em: string | null;
}

interface Lead {
  closer: string | null;
}

interface Props {
  reuniao: Reuniao;
  lead: Lead;
  userNome: string;
  userId: string;
  userRole?: string;
  onSuccess?: () => void;
}

const EDGE_URL =
  "https://riyfdcmmabvpcubusujw.supabase.co/functions/v1/enviar-confirmacao-manual";

export function BotaoEnviarConfirmacao({ reuniao, lead, userNome, userId, userRole, onSuccess }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (reuniao.status !== "agendada") return null;

  const jaEnviado = !!reuniao.confirmacao_manual_enviada_em;
  const ehResponsavel = lead.closer === userNome || userRole === "admin";

  if (jaEnviado) {
    const dataFmt = new Date(reuniao.confirmacao_manual_enviada_em!).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 font-medium">
        ✓ Confirmação enviada em {dataFmt}
      </span>
    );
  }

  if (!ehResponsavel) {
    return (
      <button
        disabled
        title={`Apenas ${lead.closer ?? "o responsável"} pode enviar`}
        className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground opacity-60 cursor-not-allowed flex items-center gap-1"
      >
        <Send size={11} />Enviar confirmação
      </button>
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
        body: JSON.stringify({ reuniao_id: reuniao.id, usuario_id: userId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.error) throw new Error(data?.error ?? `Erro HTTP ${r.status}`);
      toast.success("Confirmação enviada!");
      setShowConfirm(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar confirmação");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="text-xs px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 flex items-center gap-1"
      >
        <Send size={11} />Enviar confirmação
      </button>

      <Dialog open={showConfirm} onOpenChange={(o) => !enviando && setShowConfirm(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar mensagem de confirmação?</DialogTitle>
            <DialogDescription>
              Vai chegar no WhatsApp do lead a mensagem completa (logo PQA + dados da reunião +
              link do Meet). Não dá pra desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleEnviar}
              disabled={enviando}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
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
