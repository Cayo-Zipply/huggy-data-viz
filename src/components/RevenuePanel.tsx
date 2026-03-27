import { useState } from "react";
import { revenueData } from "@/data/revenueData";
import { marketingData, formatCurrency, monthOrder, calculateVariation } from "@/data/marketingData";
import { salesData } from "@/data/salesData";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Info } from "lucide-react";

const monthLabels: Record<string, string> = {
  setembro: "Setembro/24",
  outubro: "Outubro/24",
  novembro: "Novembro/24",
  dezembro: "Dezembro/24",
  janeiro: "Janeiro/25",
  fevereiro: "Fevereiro/25",
};

const InsightBadge = ({ value, invertColors = false }: { value: number; invertColors?: boolean }) => {
  const isPositive = invertColors ? value < 0 : value > 0;
  return (
    <span className={cn(
      "text-xs font-medium px-1.5 py-0.5 rounded",
      isPositive ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"
    )}>
      {value > 0 ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
};

interface RevenueCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  tooltip?: string;
  sub?: string;
}

const RevenueCard = ({ label, value, icon, tooltip, sub }: RevenueCardProps) => (
  <div className="bg-card border border-border rounded-xl p-4">
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <span className="text-xs text-muted-foreground">{label}</span>
      {tooltip && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info size={12} className="text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
    <p className="text-lg font-bold text-foreground">{value}</p>
    {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
  </div>
);

interface ComparisonRowProps {
  label: string;
  valueA: string;
  valueB: string;
  variation: number;
  invertColors?: boolean;
}

const ComparisonRow = ({ label, valueA, valueB, variation, invertColors }: ComparisonRowProps) => (
  <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-border/50 gap-1 sm:gap-0">
    <span className="text-xs sm:text-sm text-muted-foreground font-medium sm:font-normal sm:w-1/4">{label}</span>
    <div className="flex items-center justify-between sm:justify-around flex-1 gap-2">
      <span className="text-xs sm:text-sm text-foreground">{valueA}</span>
      <span className="text-xs sm:text-sm text-foreground">{valueB}</span>
      <div className="flex justify-end min-w-[60px]">
        <InsightBadge value={variation} invertColors={invertColors} />
      </div>
    </div>
  </div>
);

export const RevenuePanel = () => {
  const [selectedMonth, setSelectedMonth] = useState("janeiro");
  const [custoTotal, setCustoTotal] = useState<Record<string, string>>({});
  const [compareA, setCompareA] = useState("dezembro");
  const [compareB, setCompareB] = useState("janeiro");

  const getMonthMetrics = (month: string) => {
    const mkt = marketingData[month];
    const rev = revenueData[month];
    const sales = salesData[month];
    if (!mkt || !rev) return null;

    const investimento = mkt.investimento;
    const faturamentoInicial = mkt.faturamento;
    const valorDeixado = rev.valorDeixado;
    const custoStr = custoTotal[month];
    const custo = custoStr ? parseFloat(custoStr.replace(",", ".")) : null;

    const roiInicial = investimento > 0 ? ((faturamentoInicial - investimento) / investimento) * 100 : 0;
    const roiReal = investimento > 0 ? ((valorDeixado - investimento) / investimento) * 100 : 0;
    const lucroReal = valorDeixado - investimento;
    const lucroComCusto = custo !== null ? valorDeixado - investimento - custo : null;
    const roiComCusto = custo !== null && (investimento + custo) > 0
      ? ((valorDeixado - investimento - custo) / (investimento + custo)) * 100
      : null;

    const idx = monthOrder.indexOf(month);
    const mesesDecorridos = monthOrder.length - idx;

    return {
      investimento,
      faturamentoInicial,
      valorDeixado,
      custo,
      roiInicial,
      roiReal,
      lucroReal,
      lucroComCusto,
      roiComCusto,
      mesesDecorridos,
      vendas: mkt.vendas,
      ticketMedio: mkt.vendas > 0 ? valorDeixado / mkt.vendas : 0,
    };
  };

  const current = getMonthMetrics(selectedMonth);

  const metricsA = getMonthMetrics(compareA);
  const metricsB = getMonthMetrics(compareB);

  const calc = (a: number, b: number) => b === 0 ? 0 : ((a - b) / b) * 100;

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-base sm:text-lg font-bold text-foreground">Rentabilidade Real</h2>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOrder.map((m) => (
                <SelectItem key={m} value={m}>{monthLabels[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {current && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <RevenueCard
                label="Investimento Ads"
                value={formatCurrency(current.investimento)}
                icon={<DollarSign size={14} className="text-muted-foreground" />}
              />
              <RevenueCard
                label="Faturamento Inicial"
                value={formatCurrency(current.faturamentoInicial)}
                icon={<BarChart3 size={14} className="text-muted-foreground" />}
                tooltip="Valor faturado no fechamento do mês"
              />
              <RevenueCard
                label="Valor Deixado (Acumulado)"
                value={formatCurrency(current.valorDeixado)}
                icon={<TrendingUp size={14} className="text-emerald-400" />}
                tooltip="Total que os clientes desse mês já pagaram até hoje. Inclui MRR acumulado — quanto mais antigo o mês, maior tende a ser."
                sub={`${current.mesesDecorridos} meses de recorrência`}
              />
              <RevenueCard
                label="ROI Real (Ads)"
                value={`${current.roiReal.toFixed(0)}%`}
                icon={current.roiReal > 0
                  ? <TrendingUp size={14} className="text-emerald-400" />
                  : <TrendingDown size={14} className="text-red-400" />}
                tooltip="Retorno real sobre o investimento em Ads considerando todo valor já recebido dos clientes daquele mês"
                sub={`Lucro: ${formatCurrency(current.lucroReal)}`}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <RevenueCard
                label="Ticket Médio Real"
                value={formatCurrency(current.ticketMedio)}
                icon={<DollarSign size={14} className="text-muted-foreground" />}
                tooltip="Valor total deixado dividido pelo número de vendas do mês"
              />
              <RevenueCard
                label="ROI Inicial (no mês)"
                value={`${current.roiInicial.toFixed(0)}%`}
                icon={<BarChart3 size={14} className="text-muted-foreground" />}
                tooltip="ROI calculado apenas com o faturamento do fechamento"
              />
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={14} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Custo Total do Mês</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info size={12} className="text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Custo total da operação no mês (folha, comissões, ferramentas, etc). Preencha para calcular a rentabilidade líquida.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  type="text"
                  placeholder="Ex: 15000"
                  value={custoTotal[selectedMonth] || ""}
                  onChange={(e) => setCustoTotal(prev => ({ ...prev, [selectedMonth]: e.target.value }))}
                  className="mt-1 h-8 text-sm"
                />
                {current.roiComCusto !== null && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      ROI Líquido: <span className={cn("font-bold", current.roiComCusto > 0 ? "text-emerald-400" : "text-red-400")}>
                        {current.roiComCusto.toFixed(0)}%
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Lucro Líquido: <span className={cn("font-bold", (current.lucroComCusto || 0) > 0 ? "text-emerald-400" : "text-red-400")}>
                        {formatCurrency(current.lucroComCusto || 0)}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Comparison */}
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
        <h3 className="text-sm font-bold text-foreground mb-4">Comparativo de Rentabilidade</h3>
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Select value={compareA} onValueChange={setCompareA}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOrder.map((m) => (
                  <SelectItem key={m} value={m}>{monthLabels[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground self-center text-sm">vs</span>
            <Select value={compareB} onValueChange={setCompareB}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOrder.map((m) => (
                  <SelectItem key={m} value={m}>{monthLabels[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {metricsA && metricsB && (
          <div>
            <div className="hidden sm:grid grid-cols-4 items-center py-2 border-b border-border text-xs text-muted-foreground font-medium">
              <span>Métrica</span>
              <span className="text-center">{monthLabels[compareA]}</span>
              <span className="text-center">{monthLabels[compareB]}</span>
              <span className="text-center">Variação</span>
            </div>
            <ComparisonRow label="Investimento" valueA={formatCurrency(metricsA.investimento)} valueB={formatCurrency(metricsB.investimento)} variation={calc(metricsB.investimento, metricsA.investimento)} invertColors />
            <ComparisonRow label="Fat. Inicial" valueA={formatCurrency(metricsA.faturamentoInicial)} valueB={formatCurrency(metricsB.faturamentoInicial)} variation={calc(metricsB.faturamentoInicial, metricsA.faturamentoInicial)} />
            <ComparisonRow label="Valor Deixado" valueA={formatCurrency(metricsA.valorDeixado)} valueB={formatCurrency(metricsB.valorDeixado)} variation={calc(metricsB.valorDeixado, metricsA.valorDeixado)} />
            <ComparisonRow label="Lucro Real" valueA={formatCurrency(metricsA.lucroReal)} valueB={formatCurrency(metricsB.lucroReal)} variation={calc(metricsB.lucroReal, metricsA.lucroReal)} />
            <ComparisonRow label="ROI Real" valueA={`${metricsA.roiReal.toFixed(0)}%`} valueB={`${metricsB.roiReal.toFixed(0)}%`} variation={metricsB.roiReal - metricsA.roiReal} />
            <ComparisonRow label="ROI Inicial" valueA={`${metricsA.roiInicial.toFixed(0)}%`} valueB={`${metricsB.roiInicial.toFixed(0)}%`} variation={metricsB.roiInicial - metricsA.roiInicial} />
            <ComparisonRow label="Ticket Médio Real" valueA={formatCurrency(metricsA.ticketMedio)} valueB={formatCurrency(metricsB.ticketMedio)} variation={calc(metricsB.ticketMedio, metricsA.ticketMedio)} />
            <ComparisonRow label="Vendas" valueA={String(metricsA.vendas)} valueB={String(metricsB.vendas)} variation={calc(metricsB.vendas, metricsA.vendas)} />
            <ComparisonRow label="Meses Recorrência" valueA={String(metricsA.mesesDecorridos)} valueB={String(metricsB.mesesDecorridos)} variation={0} />
          </div>
        )}
      </div>
    </div>
  );
};
