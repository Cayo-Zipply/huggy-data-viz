import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ConfirmarGanhoDialogProps = {
  open: boolean;
  leadNome: string;
  onConfirm: (dataVenda: string) => void;
  onCancel: () => void;
};

/**
 * Modal de confirmação ao mover um lead para "Contrato Assinado".
 * Permite escolher a data da venda (default: hoje) — útil para vendas retroativas.
 * A data escolhida é gravada em `leads.data_venda` e determina em qual mês
 * a venda aparece no dashboard.
 */
export function ConfirmarGanhoDialog({
  open,
  leadNome,
  onConfirm,
  onCancel,
}: ConfirmarGanhoDialogProps) {
  const hoje = new Date().toISOString().split("T")[0];
  const [dataVenda, setDataVenda] = useState(hoje);

  // Reset to today every time the dialog opens
  useEffect(() => {
    if (open) setDataVenda(new Date().toISOString().split("T")[0]);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar Venda</DialogTitle>
          <DialogDescription>
            O lead <span className="font-medium text-foreground">{leadNome}</span> será marcado como ganho.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2">
          <Label htmlFor="data-venda" className="text-xs uppercase tracking-wider text-muted-foreground">
            Data da venda
          </Label>
          <Input
            id="data-venda"
            type="date"
            value={dataVenda}
            max={hoje}
            onChange={(e) => setDataVenda(e.target.value)}
            className="w-full"
          />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Use uma data anterior para vendas retroativas. O dashboard contabiliza a venda no mês desta data.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(dataVenda)}
            disabled={!dataVenda}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Confirmar Venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
