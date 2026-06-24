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
import { InputMoedaBRL } from "@/components/ui/input-moeda-brl";

const RESPONSAVEIS_JURIDICOS = [
  "Clara Nolasco",
  "Maria Eduarda",
  "Lorelayne Morais",
] as const;

type ConfirmarGanhoDialogProps = {
  open: boolean;
  leadNome: string;
  valorDividaAtual?: number | null;
  responsavelJuridicoAtual?: string | null;
  onConfirm: (dataVenda: string, valorDivida: number, responsavelJuridico: string) => void;
  onCancel: () => void;
};

/**
 * Modal de confirmação ao mover um lead para "Contrato Assinado".
 * Exige data da venda, valor da dívida (> 0) e responsável jurídico.
 * O responsável jurídico é gravado em leads.responsavel_juridico e usado
 * pelo backend para o onboarding.
 */
export function ConfirmarGanhoDialog({
  open,
  leadNome,
  valorDividaAtual,
  responsavelJuridicoAtual,
  onConfirm,
  onCancel,
}: ConfirmarGanhoDialogProps) {
  const hoje = new Date().toISOString().split("T")[0];
  const [dataVenda, setDataVenda] = useState(hoje);
  const [valorDivida, setValorDivida] = useState<number | null>(valorDividaAtual ?? null);
  const [responsavelJuridico, setResponsavelJuridico] = useState<string>(responsavelJuridicoAtual ?? "");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setDataVenda(new Date().toISOString().split("T")[0]);
      setValorDivida(valorDividaAtual ?? null);
      setResponsavelJuridico(responsavelJuridicoAtual ?? "");
      setTouched(false);
    }
  }, [open, valorDividaAtual, responsavelJuridicoAtual]);

  const valorValido = valorDivida != null && valorDivida > 0;
  const respValido = !!responsavelJuridico;
  const podeConfirmar = !!dataVenda && valorValido && respValido;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar Venda</DialogTitle>
          <DialogDescription>
            O lead <span className="font-medium text-foreground">{leadNome}</span> será marcado como ganho.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <div className="space-y-2">
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

          <div className="space-y-2">
            <Label htmlFor="valor-divida" className="text-xs uppercase tracking-wider text-muted-foreground">
              Valor da dívida <span className="text-red-500">*</span>
            </Label>
            <InputMoedaBRL
              id="valor-divida"
              value={valorDivida}
              onChange={setValorDivida}
              hasError={!valorValido}
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Obrigatório. Alimenta o painel "Fechamentos por Valor da Dívida".
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resp-juridico" className="text-xs uppercase tracking-wider text-muted-foreground">
              Responsável Jurídico <span className="text-red-500">*</span>
            </Label>
            <select
              id="resp-juridico"
              value={responsavelJuridico}
              onChange={(e) => setResponsavelJuridico(e.target.value)}
              onBlur={() => setTouched(true)}
              className={`w-full text-sm border rounded-md px-3 py-2 bg-background text-foreground ${
                touched && !respValido ? "border-red-500" : "border-border"
              }`}
            >
              <option value="">Selecione...</option>
              {RESPONSAVEIS_JURIDICOS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {touched && !respValido && (
              <p className="text-[11px] text-red-500 leading-relaxed">
                Selecione um responsável jurídico para concluir o fechamento.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Obrigatório. Será gravado no lead e usado no onboarding.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              setTouched(true);
              if (podeConfirmar) onConfirm(dataVenda, valorDivida as number, responsavelJuridico);
            }}
            disabled={!podeConfirmar}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Confirmar Venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
