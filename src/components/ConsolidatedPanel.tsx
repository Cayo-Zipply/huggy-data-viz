import { useState } from "react";
import { marketingData, formatCurrency, formatNumber, formatPercent } from "@/data/marketingData";
import { salesData } from "@/data/salesData";
import { revenueData } from "@/data/revenueData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

const periods = {
  tri1: { label: "1º Trimestre (Set–Nov/24)", months: ["setembro", "outubro", "novembro"] },
  tri2: { label: "2º Trimestre (Dez–Fev/25)", months: ["dezembro", "janeiro", "fevereiro"] },
  semestral: { label: "Semestral (Set/24–Fev/25)", months: ["setembro", "outubro", "novembro", "dezembro", "janeiro", "fevereiro"] },
};

interface ConsolidatedMetrics {
  investimento: number;
  impressoes: number;
  ctrMedio: number;
  cpcMedio: number;
  mensagens: number;
  mensagensEfetivas: number;
  cpaMedio: number;
  cpmMedio: number;
  frequenciaMedia: number;
  vendas: number;
  faturamento: number;
  reunioes: number;
  contratos: number;
  metaFaturamento: number;
  metaContratos: number;
  metaReunioes: number;
  valorDeixado: number;
  roiAds: number;
  roiReal: number;
  lucroReal: number;
  ticketMedioInicial: number;
  ticketMedioReal: number;
  conversaoGeralVendas: number;
  conversaoReunioes: number;
  custoPorReuniao: number;
}

const calcPeriod = (months: string[]): ConsolidatedMetrics => {
  let investimento = 0, impressoes = 0, mensagens = 0, mensagensEfetivas = 0;
  let vendas = 0, faturamento = 0, reunioes = 0, contratos = 0;
  let metaFaturamento = 0, metaContratos = 0, metaReunioes = 0, valorDeixado = 0;
  let ctrSum = 0, cpcSum = 0, cpaSum = 0, cpmSum = 0, freqSum = 0;
  let count = 0;

  months.forEach((m) => {
    const mkt = marketingData[m];
    const sales = salesData[m];
    const rev = revenueData[m];
    if (!mkt) return;
    count++;
    investimento += mkt.investimento;
    impressoes += mkt.impressoes;
    mensagens += mkt.mensagens;
    mensagensEfetivas += mkt.mensagensEfetivas;
    vendas += mkt.vendas;
    faturamento += mkt.faturamento;
    ctrSum += mkt.ctr;
    cpcSum += mkt.cpc;
    cpaSum += mkt.cpa;
    cpmSum += mkt.cpm;
    freqSum += mkt.frequencia;
    if (sales) {
      reunioes += sales.funnel.reunioes.realizado;
      contratos += sales.funnel.contratos.realizado;
      metaFaturamento += sales.funnel.faturamento.meta;
      metaContratos += sales.funnel.contratos.meta;
      metaReunioes += sales.funnel.reunioes.meta;
    }
    if (rev) valorDeixado += rev.valorDeixado;
  });

  const roiAds = investimento > 0 ? ((faturamento - investimento) / investimento) * 100 : 0;
  const roiReal = investimento > 0 ? ((valorDeixado - investimento) / investimento) * 100 : 0;
  const lucroReal = valorDeixado - investimento;
  const ticketMedioInicial = vendas > 0 ? faturamento / vendas : 0;
  const ticketMedioReal = vendas > 0 ? valorDeixado / vendas : 0;
  const conversaoGeralVendas = mensagensEfetivas > 0 ? (vendas / mensagensEfetivas) * 100 : 0;
  const conversaoReunioes = reunioes > 0 ? (contratos / reunioes) * 100 : 0;
  const custoPorReuniao = reunioes > 0 ? investimento / reunioes : 0;

  return {
    investimento, impressoes, mensagens, mensagensEfetivas, vendas, faturamento,
    reunioes, contratos, metaFaturamento, metaContratos, metaReunioes, valorDeixado,
    roiAds, roiReal, lucroReal, ticketMedioInicial, ticketMedioReal,
    conversaoGeralVendas, conversaoReunioes, custoPorReuniao,
    ctrMedio: count > 0 ? ctrSum / count : 0,
    cpcMedio: count > 0 ? cpcSum / count : 0,
    cpaMedio: count > 0 ? cpaSum / count : 0,
    cpmMedio: count > 0 ? cpmSum / count : 0,
    frequenciaMedia: count > 0 ? freqSum / count : 0,
  };
};

interface MetricRowProps {
  label: string;
  value: string;
  meta?: string;
  atingimento?: number;
}

const MetricRow = ({ label, value, meta, atingimento }: MetricRowProps) => (
  <div className="flex items-center justify-between py-2.5 border-b border-border/50">
    <span className="text-sm text-muted-foreground">{label}</span>
    <div className="flex items-center gap-3">
      <span className="text-sm font-semibold text-foreground">{value}</span>
      {meta && (
        <span className="text-xs text-muted-foreground">Meta: {meta}</span>
      )}
      {atingimento !== undefined && (
        <span className={cn(
          "text-xs font-medium px-1.5 py-0.5 rounded",
          atingimento >= 100 ? "text-emerald-400 bg-emerald-400/10" : "text-amber-400 bg-amber-400/10"
        )}>
          {atingimento.toFixed(0)}%
        </span>
      )}
    </div>
  </div>
);

const PeriodCard = ({ data, label }: { data: ConsolidatedMetrics; label: string }) => (
  <div className="space-y-6">
    <h3 className="text-lg font-bold text-foreground">{label}</h3>

    {/* Marketing */}
    <div className="bg-card border border-border rounded-xl p-4">
      <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
        📊 Marketing
      </h4>
      <MetricRow label="Investimento Total" value={formatCurrency(data.investimento)} />
      <MetricRow label="Impressões" value={formatNumber(data.impressoes)} />
      <MetricRow label="CTR Médio" value={formatPercent(data.ctrMedio)} />
      <MetricRow label="CPC Médio" value={formatCurrency(data.cpcMedio)} />
      <MetricRow label="CPA Médio" value={formatCurrency(data.cpaMedio)} />
      <MetricRow label="CPM Médio" value={formatCurrency(data.cpmMedio)} />
      <MetricRow label="Frequência Média" value={data.frequenciaMedia.toFixed(2)} />
      <MetricRow label="Mensagens" value={formatNumber(data.mensagens)} />
      <MetricRow label="Mensagens Efetivas" value={formatNumber(data.mensagensEfetivas)} />
    </div>

    {/* Comercial */}
    <div className="bg-card border border-border rounded-xl p-4">
      <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
        👥 Comercial
      </h4>
      <MetricRow label="Vendas / Contratos" value={String(data.vendas)}
        meta={data.metaContratos > 0 ? String(data.metaContratos) : undefined}
        atingimento={data.metaContratos > 0 ? (data.contratos / data.metaContratos) * 100 : undefined}
      />
      <MetricRow label="Reuniões Realizadas" value={String(data.reunioes)}
        meta={data.metaReunioes > 0 ? String(data.metaReunioes) : undefined}
        atingimento={data.metaReunioes > 0 ? (data.reunioes / data.metaReunioes) * 100 : undefined}
      />
      <MetricRow label="Faturamento" value={formatCurrency(data.faturamento)}
        meta={data.metaFaturamento > 0 ? formatCurrency(data.metaFaturamento) : undefined}
        atingimento={data.metaFaturamento > 0 ? (data.faturamento / data.metaFaturamento) * 100 : undefined}
      />
      <MetricRow label="Conversão Geral (Msg → Venda)" value={formatPercent(data.conversaoGeralVendas)} />
      <MetricRow label="Conversão Reuniões → Contratos" value={formatPercent(data.conversaoReunioes)} />
      <MetricRow label="Custo por Reunião" value={formatCurrency(data.custoPorReuniao)} />
      <MetricRow label="Ticket Médio Inicial" value={formatCurrency(data.ticketMedioInicial)} />
    </div>

    {/* Rentabilidade */}
    <div className="bg-card border border-border rounded-xl p-4">
      <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
        💰 Rentabilidade
      </h4>
      <MetricRow label="Valor Deixado (Acumulado)" value={formatCurrency(data.valorDeixado)} />
      <MetricRow label="Ticket Médio Real" value={formatCurrency(data.ticketMedioReal)} />
      <MetricRow label="ROI Inicial (Ads)" value={`${data.roiAds.toFixed(0)}%`} />
      <MetricRow label="ROI Real (Acumulado)" value={`${data.roiReal.toFixed(0)}%`} />
      <div className="flex items-center justify-between py-2.5">
        <span className="text-sm text-muted-foreground">Lucro Real</span>
        <span className={cn(
          "text-sm font-bold",
          data.lucroReal > 0 ? "text-emerald-400" : "text-red-400"
        )}>
          {formatCurrency(data.lucroReal)}
        </span>
      </div>
    </div>
  </div>
);

export const ConsolidatedPanel = () => {
  const tri1 = calcPeriod(periods.tri1.months);
  const tri2 = calcPeriod(periods.tri2.months);
  const semestral = calcPeriod(periods.semestral.months);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="semestral">
        <TabsList className="mb-4">
          <TabsTrigger value="tri1">1º Trimestre</TabsTrigger>
          <TabsTrigger value="tri2">2º Trimestre</TabsTrigger>
          <TabsTrigger value="semestral">Semestral</TabsTrigger>
        </TabsList>

        <TabsContent value="tri1">
          <PeriodCard data={tri1} label={periods.tri1.label} />
        </TabsContent>
        <TabsContent value="tri2">
          <PeriodCard data={tri2} label={periods.tri2.label} />
        </TabsContent>
        <TabsContent value="semestral">
          <PeriodCard data={semestral} label={periods.semestral.label} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
