import { useState } from "react";
import { User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { InputMoedaBRL } from "@/components/ui/input-moeda-brl";
import { formatCurrency } from "@/data/marketingData";
import type { CloserBreakdown, MetaCloser } from "@/hooks/useMarketingLive";

interface Props {
  porCloser: CloserBreakdown[];
  metasCloser: MetaCloser[];
  investimento: number;
  totalReunioes: number;
  monthLabel: string;
  totalVendas: number;
  totalFaturamento: number;
}

function MetricItem({ label, value, accent }: { label: string; value: string; accent?: "positive" | "negative" }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
      <p
        className={
          "text-sm font-semibold mt-0.5 " +
          (accent === "positive"
            ? "text-emerald-600 dark:text-emerald-400"
            : accent === "negative"
            ? "text-red-600 dark:text-red-400"
            : "text-foreground")
        }
      >
        {value}
      </p>
    </div>
  );
}

// Normaliza nomes para tentar fazer o match entre `leads.closer` e `metas.closer`
// (que pode estar como nome completo). Compara pelo primeiro nome em lowercase.
function normalize(name: string): string {
  return (name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findMeta(metas: MetaCloser[], closer: string): MetaCloser | undefined {
  const target = normalize(closer);
  if (!target) return undefined;
  // 1) match exato
  let m = metas.find((x) => normalize(x.closer) === target);
  if (m) return m;
  // 2) match por primeiro nome (closer pode ser "Fillipe", meta "Fillipe Amorim Oliveira")
  const firstTarget = target.split(" ")[0];
  m = metas.find((x) => normalize(x.closer).split(" ")[0] === firstTarget);
  return m;
}

export function CloserCardsGrid({
  porCloser,
  metasCloser,
  investimento,
  totalReunioes,
  monthLabel,
  totalVendas,
  totalFaturamento,
}: Props) {
  const [comissoes, setComissoes] = useState<Record<string, number | null>>({});

  const ticketMedio = totalVendas > 0 ? totalFaturamento / totalVendas : 0;

  return (
    <div className="space-y-4">
      {/* Card de resumo */}
      <Card className="p-5 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <h3 className="font-semibold text-base mb-3 capitalize">
          Resumo Comercial — {monthLabel}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Vendas</p>
            <p className="text-2xl font-bold mt-1">{totalVendas}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Faturamento Total</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalFaturamento)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ticket Médio</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(ticketMedio)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Investimento Total</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(investimento)}</p>
          </div>
        </div>
      </Card>

      {/* Título da seção */}
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-foreground">Conversões Individuais</h3>
        <span className="text-xs text-muted-foreground">{porCloser.length} closer(s)</span>
      </div>

      {porCloser.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          Sem dados de closer no período.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {porCloser.map((c) => {
            const investProporcional =
              totalReunioes > 0 ? investimento * (c.reunioes / totalReunioes) : 0;
            const meta = findMeta(metasCloser, c.closer);
            const metaFaturamento = Number(meta?.meta_faturamento ?? 0);
            const convIndividual = c.reunioes > 0 ? (c.vendas / c.reunioes) * 100 : 0;
            const roiBase = investProporcional;
            const roiIndividual = roiBase > 0 ? ((c.faturamento - roiBase) / roiBase) * 100 : 0;
            const progressoMeta = metaFaturamento > 0 ? (c.faturamento / metaFaturamento) * 100 : 0;

            const comissao = comissoes[c.closer] ?? null;
            const custoReal = investProporcional + (comissao ?? 0);
            const roiComComissao = custoReal > 0 ? ((c.faturamento - custoReal) / custoReal) * 100 : 0;

            return (
              <Card key={c.closer} className="p-5 hover:shadow-md transition-shadow">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="font-semibold text-base text-foreground truncate">{c.closer}</h4>
                </div>

                {/* Grid de métricas */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
                  <MetricItem label="Contratos" value={String(c.vendas)} />
                  <MetricItem label="Reuniões" value={String(c.reunioes)} />
                  <MetricItem label="Conv. Individual" value={`${convIndividual.toFixed(1)}%`} />
                  <MetricItem label="Faturamento" value={formatCurrency(c.faturamento)} />
                  <MetricItem
                    label="Meta"
                    value={metaFaturamento > 0 ? formatCurrency(metaFaturamento) : "—"}
                  />
                  <MetricItem label="Custo Investido" value={formatCurrency(investProporcional)} />
                  <MetricItem
                    label="ROI Individual"
                    value={`${roiIndividual.toFixed(1)}%`}
                    accent={roiIndividual >= 0 ? "positive" : "negative"}
                  />
                  <MetricItem
                    label="ROI c/ Comissão"
                    value={comissao !== null && comissao > 0 ? `${roiComComissao.toFixed(1)}%` : "—"}
                    accent={
                      comissao !== null && comissao > 0
                        ? roiComComissao >= 0
                          ? "positive"
                          : "negative"
                        : undefined
                    }
                  />
                </div>

                {/* Comissão paga */}
                <div className="mb-4">
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium block mb-1">
                    Comissão Paga
                  </label>
                  <InputMoedaBRL
                    value={comissao}
                    onChange={(v) => setComissoes((prev) => ({ ...prev, [c.closer]: v }))}
                    placeholder="0,00"
                  />
                </div>

                {/* Barra de progresso */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Progresso da Meta</span>
                    <span className="font-semibold text-foreground">
                      {metaFaturamento > 0 ? `${progressoMeta.toFixed(0)}%` : "Não definida"}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(progressoMeta, 100)}
                    className={
                      "h-2 " +
                      (progressoMeta >= 100
                        ? "[&>div]:bg-emerald-500"
                        : progressoMeta >= 60
                        ? "[&>div]:bg-primary"
                        : "[&>div]:bg-amber-500")
                    }
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
