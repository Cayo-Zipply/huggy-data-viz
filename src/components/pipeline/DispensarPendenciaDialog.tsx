import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { dispensarPendencia } from "@/hooks/usePendenciasEmail";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  empresa?: string | null;
  onDone: () => void;
}

export function DispensarPendenciaDialog({ open, onOpenChange, leadId, empresa, onDone }: Props) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const valido = motivo.trim().length >= 10;

  const confirmar = async () => {
    if (!valido || !user?.id) return;
    setSaving(true);
    const { error } = await dispensarPendencia(leadId, user.id, motivo.trim());
    setSaving(false);
    if (error) {
      toast.error(error.message || "Não foi possível dispensar a pendência.");
      return;
    }
    toast.success("Pendência dispensada.");
    setMotivo("");
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Já enviei por fora</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Explique como os e-mails {empresa ? `de ${empresa} ` : ""}foram enviados. Mínimo de 10 caracteres.
          </p>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            placeholder="Ex.: enviei jurídico e financeiro pelo Gmail em 09/09 às 15h."
          />
          <p className="text-[11px] text-muted-foreground">{motivo.trim().length}/10</p>
        </div>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="text-sm px-3 py-2 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!valido || saving}
            className="text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Confirmar dispensa"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
