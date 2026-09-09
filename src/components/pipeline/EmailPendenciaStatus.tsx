import { useState } from "react";
import { AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  fmtDataHora,
  labelFaltando,
  reabrirPendencia,
  usePendenciaLead,
} from "@/hooks/usePendenciasEmail";
import { DispensarPendenciaDialog } from "./DispensarPendenciaDialog";

interface Props {
  leadId: string;
  isWon: boolean;
  empresa?: string | null;
}

export function EmailPendenciaStatus({ leadId, isWon, empresa }: Props) {
  const { pendencia, refetch } = usePendenciaLead(isWon ? leadId : null);
  const [dispensaOpen, setDispensaOpen] = useState(false);

  if (!isWon || !pendencia) return null;

  const { situacao, diagnostico, ultimo_erro, prazo, faltando } = pendencia;
  const falta = labelFaltando(faltando);

  const reabrir = async () => {
    const { error } = await reabrirPendencia(leadId);
    if (error) {
      toast.error(error.message || "Não foi possível reabrir.");
      return;
    }
    toast.success("Pendência reaberta.");
    refetch();
  };

  if (situacao === "ok") {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
        <CheckCircle2 size={14} /> E-mails enviados ✓
      </div>
    );
  }

  if (situacao === "dispensado") {
    return (
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg px-3 py-2">
        <MinusCircle size={14} className="mt-0.5 shrink-0" />
        <div className="flex-1">
          <p>Pendência dispensada — {pendencia.email_pendencia_dispensa_motivo || "sem motivo registrado"}</p>
          <button onClick={reabrir} className="mt-1.5 text-[11px] underline hover:text-foreground">
            Reabrir pendência
          </button>
        </div>
      </div>
    );
  }

  const vencido = situacao === "vencido";

  return (
    <>
      <div
        className={cn(
          "flex items-start gap-2 text-xs rounded-lg px-3 py-2 border",
          vencido
            ? "text-red-500 bg-destructive/10 border-destructive/30"
            : "text-amber-600 bg-amber-400/10 border-amber-400/30"
        )}
      >
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <div className="flex-1 space-y-1">
          <p className="font-medium">
            {vencido
              ? `E-mails ${falta} vencidos — prazo era ${fmtDataHora(prazo)}`
              : `Faltam os e-mails ${falta} — prazo até ${fmtDataHora(prazo)}`}
          </p>
          {diagnostico === "rascunho_nao_gerado" && (
            <p className="opacity-80">O rascunho ainda não foi gerado — clique em Gerar e-mails.</p>
          )}
          {diagnostico === "erro_envio" && ultimo_erro && (
            <p className="opacity-80">Erro no último envio: {ultimo_erro}</p>
          )}
          <button
            onClick={() => setDispensaOpen(true)}
            className="mt-1 text-[11px] px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/70"
          >
            Já enviei por fora
          </button>
        </div>
      </div>
      <DispensarPendenciaDialog
        open={dispensaOpen}
        onOpenChange={setDispensaOpen}
        leadId={leadId}
        empresa={empresa}
        onDone={refetch}
      />
    </>
  );
}
