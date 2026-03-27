import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { marketingData, formatCurrency, formatNumber, formatPercent } from "@/data/marketingData";
import { salesData } from "@/data/salesData";
import { TrendingUp, TrendingDown, Minus, BarChart3, Users, HelpCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { months } from "./MonthSelector";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const getAllSellers = () => {
  const sellers = new Set<string>();
  Object.values(salesData).forEach((monthData) => {
    monthData.individuais.forEach((p) => sellers.add(p.nome));
  });
  return Array.from(sellers);
};

const calcVariation = (a: number, b: number) => {
  if (b === 0) return a > 0 ? 100 : 0;
  return ((a - b) / b) * 100;
};

const generateInsight = (
  metricLabel: string,
  valueA: number,
  valueB: number,
  dataA: any,
  dataB: any,
  salesA: any,
  salesB: any
): string => {
  const variation = calcVariation(valueB, valueA);
  const direction = variation > 0 ? "aumentou" : "diminuiu";
  const abs = Math.abs(variation).toFixed(1);

  switch (metricLabel) {
    case "Investimento":
      return `O investimento ${direction} ${abs}%. ${variation > 0 ? "Maior investimento pode ampliar alcance, mas precisa ser acompanhado de performance." : "Redução no investimento pode impactar o volume de leads."}`;
    case "Impressões":
      return `As impressões ${direction}ram ${abs}%. ${variation > 0 ? "O alcance cresceu, possivelmente por mais investimento ou melhor segmentação." : "Queda pode indicar saturação de audiência ou redução de budget."}`;
    case "CTR":
      return `O CTR ${direction} ${abs}%. ${variation > 0 ? "Criativos e segmentação estão mais relevantes para o público." : "Os anúncios podem estar perdendo relevância — revise criativos e copy."}`;
    case "CPC":
      return `O CPC ${direction} ${abs}%. ${variation > 0 ? "O custo por clique subiu, possível aumento de concorrência ou queda de relevância." : "Cliques mais baratos indicam melhor performance dos anúncios."}`;
    case "CPA":
      return `O CPA ${direction} ${abs}%. ${variation > 0 ? "Leads estão mais caros. Verifique se a qualidade dos leads justifica o custo." : "Leads mais baratos é um bom sinal de eficiência."}`;
    case "CPM":
      return `O CPM ${direction} ${abs}%. ${variation > 0 ? "O custo para alcançar 1.000 pessoas aumentou, possivelmente por alta concorrência no leilão." : "Mais barato alcançar o público — bom momento para escalar."}`;
    case "Mensagens":
      return `As mensagens ${direction}ram ${abs}%. ${variation > 0 ? "Mais leads chegando — verifique capacidade comercial para absorver." : "Menos leads podem significar problema no tráfego ou saturação."}`;
    case "Vendas":
      return `As vendas ${direction}ram ${abs}%. ${variation > 0 ? "Crescimento nas vendas! Verifique se o ticket médio também cresceu." : "Queda nas vendas pode ser reflexo de menor volume ou pior conversão."}`;
    case "Faturamento":
      return `O faturamento ${direction} ${abs}%. ${variation > 0 ? "Boa evolução! ROI tende a melhorar se custos se mantiveram." : "Queda no faturamento precisa de atenção — verifique ticket médio e volume."}`;
    case "Custo/Reunião": {
      const reunA = salesA?.funnel.reunioes.realizado || 0;
      const reunB = salesB?.funnel.reunioes.realizado || 0;
      return `O custo por reunião ${direction} ${abs}%. ${variation > 0 
        ? `Possível causa: ${reunB < reunA ? "o número de reuniões caiu" : "o investimento subiu"} sem acompanhar proporcionalmente.` 
        : "Reuniões saindo mais baratas — eficiência comercial melhorando."}`;
    }
    case "Conv. Reuniões":
      return `A conversão de reuniões para contratos ${direction} ${abs}%. ${variation > 0 ? "Vendedores estão fechando mais — qualidade das reuniões melhorando." : "Menos reuniões estão virando contratos — revise abordagem e qualificação."}`;
    case "Conv. Msg→Venda":
      return `A conversão de mensagem para venda ${direction} ${abs}%. ${variation > 0 ? "Funil mais eficiente do topo ao fundo." : "Mais mensagens estão sendo perdidas no caminho — revise o funil."}`;
    case "Conv. Msg→Reunião":
      return `A conversão de mensagem para reunião ${direction} ${abs}%. ${variation > 0 ? "SDR/pré-vendas está conseguindo agendar mais." : "Menos mensagens virando reuniões — verifique o script de qualificação."}`;
    default:
      return `Esta métrica ${direction} ${abs}% na comparação.`;
  }
};

const InsightBadge = ({ value, invertColors = false, insight }: { value: number; invertColors?: boolean; insight?: string }) => {
  const isPositive = invertColors ? value < 0 : value > 0;
  const isNeutral = Math.abs(value) < 0.01;

  const badge = isNeutral ? (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
      <Minus size={10} /> Igual
    </span>
  ) : (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
        isPositive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
      }`}
    >
      {value > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );

  if (!insight) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-help">
          {badge}
          <HelpCircle size={12} className="text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[320px] text-xs leading-relaxed">
        {insight}
      </TooltipContent>
    </Tooltip>
  );
};

interface ComparisonRowProps {
  label: string;
  valueA: string;
  valueB: string;
  variation: number;
  invertColors?: boolean;
  insight?: string;
}

const ComparisonRow = ({ label, valueA, valueB, variation, invertColors = false, insight }: ComparisonRowProps) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 sm:py-3 border-b border-border last:border-0 gap-1 sm:gap-0">
    <span className="text-xs sm:text-sm text-muted-foreground font-medium sm:font-normal sm:w-1/4">{label}</span>
    <div className="flex items-center justify-between sm:justify-around flex-1 gap-2">
      <span className="text-xs sm:text-sm font-semibold text-foreground">{valueA}</span>
      <span className="text-xs sm:text-sm font-semibold text-foreground">{valueB}</span>
      <div className="flex justify-end min-w-[80px]">
        <InsightBadge value={variation} invertColors={invertColors} insight={insight} />
      </div>
    </div>
  </div>
);

const MonthComparison = () => {
  const [monthA, setMonthA] = useState("janeiro");
  const [monthB, setMonthB] = useState("fevereiro");

  const dataA = marketingData[monthA];
  const dataB = marketingData[monthB];
  const salesA = salesData[monthA];
  const salesB = salesData[monthB];

  const reunioesA = salesA?.funnel.reunioes.realizado || 0;
  const reunioesB = salesB?.funnel.reunioes.realizado || 0;
  const custoReunA = reunioesA > 0 ? dataA.investimento / reunioesA : 0;
  const custoReunB = reunioesB > 0 ? dataB.investimento / reunioesB : 0;
  const convReunA = reunioesA > 0 ? (salesA.funnel.contratos.realizado / reunioesA) * 100 : 0;
  const convReunB = reunioesB > 0 ? (salesB.funnel.contratos.realizado / reunioesB) * 100 : 0;
  const convMsgVendaA = dataA.mensagens > 0 ? (salesA?.funnel.contratos.realizado / dataA.mensagens) * 100 : 0;
  const convMsgVendaB = dataB.mensagens > 0 ? (salesB?.funnel.contratos.realizado / dataB.mensagens) * 100 : 0;
  const convMsgReunA = dataA.mensagens > 0 && reunioesA > 0 ? (reunioesA / dataA.mensagens) * 100 : 0;
  const convMsgReunB = dataB.mensagens > 0 && reunioesB > 0 ? (reunioesB / dataB.mensagens) * 100 : 0;

  const labelA = months.find((m) => m.key === monthA)?.label || monthA;
  const labelB = months.find((m) => m.key === monthB)?.label || monthB;

  const makeInsight = (label: string, a: number, b: number) =>
    generateInsight(label, a, b, dataA, dataB, salesA, salesB);

  const metrics = [
    { label: "Investimento", a: formatCurrency(dataA.investimento), b: formatCurrency(dataB.investimento), var: calcVariation(dataB.investimento, dataA.investimento), invert: true, numA: dataA.investimento, numB: dataB.investimento },
    { label: "Impressões", a: formatNumber(dataA.impressoes), b: formatNumber(dataB.impressoes), var: calcVariation(dataB.impressoes, dataA.impressoes), numA: dataA.impressoes, numB: dataB.impressoes },
    { label: "CTR", a: formatPercent(dataA.ctr), b: formatPercent(dataB.ctr), var: calcVariation(dataB.ctr, dataA.ctr), numA: dataA.ctr, numB: dataB.ctr },
    { label: "CPC", a: formatCurrency(dataA.cpc), b: formatCurrency(dataB.cpc), var: calcVariation(dataB.cpc, dataA.cpc), invert: true, numA: dataA.cpc, numB: dataB.cpc },
    { label: "Mensagens", a: formatNumber(dataA.mensagens), b: formatNumber(dataB.mensagens), var: calcVariation(dataB.mensagens, dataA.mensagens), numA: dataA.mensagens, numB: dataB.mensagens },
    { label: "CPA", a: formatCurrency(dataA.cpa), b: formatCurrency(dataB.cpa), var: calcVariation(dataB.cpa, dataA.cpa), invert: true, numA: dataA.cpa, numB: dataB.cpa },
    { label: "CPM", a: formatCurrency(dataA.cpm), b: formatCurrency(dataB.cpm), var: calcVariation(dataB.cpm, dataA.cpm), invert: true, numA: dataA.cpm, numB: dataB.cpm },
    { label: "Vendas", a: String(dataA.vendas), b: String(dataB.vendas), var: calcVariation(dataB.vendas, dataA.vendas), numA: dataA.vendas, numB: dataB.vendas },
    { label: "Faturamento", a: formatCurrency(dataA.faturamento), b: formatCurrency(dataB.faturamento), var: calcVariation(dataB.faturamento, dataA.faturamento), numA: dataA.faturamento, numB: dataB.faturamento },
    { label: "Reuniões", a: String(reunioesA), b: String(reunioesB), var: calcVariation(reunioesB, reunioesA), numA: reunioesA, numB: reunioesB },
    { label: "Custo/Reunião", a: custoReunA > 0 ? formatCurrency(custoReunA) : "N/A", b: custoReunB > 0 ? formatCurrency(custoReunB) : "N/A", var: calcVariation(custoReunB, custoReunA), invert: true, numA: custoReunA, numB: custoReunB },
    { label: "Conv. Reuniões", a: convReunA > 0 ? `${convReunA.toFixed(1)}%` : "N/A", b: convReunB > 0 ? `${convReunB.toFixed(1)}%` : "N/A", var: calcVariation(convReunB, convReunA), numA: convReunA, numB: convReunB },
    { label: "Conv. Msg→Venda", a: convMsgVendaA > 0 ? `${convMsgVendaA.toFixed(2)}%` : "N/A", b: convMsgVendaB > 0 ? `${convMsgVendaB.toFixed(2)}%` : "N/A", var: calcVariation(convMsgVendaB, convMsgVendaA), numA: convMsgVendaA, numB: convMsgVendaB },
    { label: "Conv. Msg→Reunião", a: convMsgReunA > 0 ? `${convMsgReunA.toFixed(1)}%` : "N/A", b: convMsgReunB > 0 ? `${convMsgReunB.toFixed(1)}%` : "N/A", var: calcVariation(convMsgReunB, convMsgReunA), numA: convMsgReunA, numB: convMsgReunB },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Select value={monthA} onValueChange={setMonthA}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground self-center text-sm">vs</span>
        <Select value={monthB} onValueChange={setMonthB}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="hidden sm:flex items-center justify-between py-2 border-b-2 border-border mb-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase w-1/4">Métrica</span>
        <span className="text-xs font-semibold text-primary uppercase w-1/4 text-center">{labelA}</span>
        <span className="text-xs font-semibold text-primary uppercase w-1/4 text-center">{labelB}</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase w-1/4 text-right">Variação</span>
      </div>

      {metrics.map((m) => (
        <ComparisonRow
          key={m.label}
          label={m.label}
          valueA={m.a}
          valueB={m.b}
          variation={m.var}
          invertColors={m.invert}
          insight={makeInsight(m.label, m.numA, m.numB)}
        />
      ))}
    </div>
  );
};

const SellerComparison = () => {
  const allSellers = getAllSellers();
  const [sellerA, setSellerA] = useState(allSellers[0] || "");
  const [sellerB, setSellerB] = useState(allSellers[1] || "");
  const [month, setMonth] = useState("fevereiro");

  const salesMonth = salesData[month];
  const personA = salesMonth?.individuais.find((p) => p.nome === sellerA);
  const personB = salesMonth?.individuais.find((p) => p.nome === sellerB);

  const reunioesTotal = salesMonth?.funnel.reunioes.realizado || 0;
  const investimento = marketingData[month]?.investimento || 0;
  const custoPorReuniao = reunioesTotal > 0 ? investimento / reunioesTotal : 0;

  const getSellerMetrics = (person: typeof personA) => {
    if (!person) return null;
    const conv = person.reunioes > 0 ? (person.contratos / person.reunioes) * 100 : 0;
    const custo = custoPorReuniao * person.reunioes;
    const roi = custo > 0 ? (person.faturamento / custo) * 100 : 0;
    return { ...person, conversao: conv, custoInvestido: custo, roi, lucro: person.faturamento - custo };
  };

  const mA = getSellerMetrics(personA);
  const mB = getSellerMetrics(personB);

  const monthLabel = months.find((m) => m.key === month)?.label || month;

  const rows = mA && mB ? [
    { label: "Contratos", a: String(mA.contratos), b: String(mB.contratos), var: calcVariation(mB.contratos, mA.contratos) },
    { label: "Reuniões", a: String(mA.reunioes), b: String(mB.reunioes), var: calcVariation(mB.reunioes, mA.reunioes) },
    { label: "Conversão", a: `${mA.conversao.toFixed(1)}%`, b: `${mB.conversao.toFixed(1)}%`, var: calcVariation(mB.conversao, mA.conversao) },
    { label: "Faturamento", a: formatCurrency(mA.faturamento), b: formatCurrency(mB.faturamento), var: calcVariation(mB.faturamento, mA.faturamento) },
    { label: "Meta", a: formatCurrency(mA.meta), b: formatCurrency(mB.meta), var: calcVariation(mB.meta, mA.meta) },
    { label: "% da Meta", a: `${((mA.faturamento / mA.meta) * 100).toFixed(1)}%`, b: `${((mB.faturamento / mB.meta) * 100).toFixed(1)}%`, var: calcVariation((mB.faturamento / mB.meta) * 100, (mA.faturamento / mA.meta) * 100) },
    { label: "Custo Investido", a: formatCurrency(mA.custoInvestido), b: formatCurrency(mB.custoInvestido), var: calcVariation(mB.custoInvestido, mA.custoInvestido), invert: true },
    { label: "ROI", a: `${mA.roi.toFixed(0)}%`, b: `${mB.roi.toFixed(0)}%`, var: calcVariation(mB.roi, mA.roi) },
    { label: "Lucro", a: formatCurrency(mA.lucro), b: formatCurrency(mB.lucro), var: calcVariation(mB.lucro, mA.lucro) },
  ] : [];

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-3 items-center flex-1">
          <Select value={sellerA} onValueChange={setSellerA}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allSellers.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-sm">vs</span>
          <Select value={sellerB} onValueChange={setSellerB}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allSellers.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!mA || !mB ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {!salesMonth?.individuais.length 
            ? `Não há dados individuais para ${monthLabel}.`
            : `Selecione vendedores disponíveis em ${monthLabel}: ${salesMonth.individuais.map(p => p.nome).join(', ')}`
          }
        </div>
      ) : (
        <>
          <div className="hidden sm:flex items-center justify-between py-2 border-b-2 border-border mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase w-1/4">Métrica</span>
            <span className="text-xs font-semibold text-primary uppercase w-1/4 text-center">{sellerA}</span>
            <span className="text-xs font-semibold text-primary uppercase w-1/4 text-center">{sellerB}</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase w-1/4 text-right">Diferença</span>
          </div>
          {rows.map((r) => (
            <ComparisonRow
              key={r.label}
              label={r.label}
              valueA={r.a}
              valueB={r.b}
              variation={r.var}
              invertColors={r.invert}
            />
          ))}
        </>
      )}
    </div>
  );
};

export const ComparisonPanel = () => {
  return (
    <div className="bg-card rounded-xl p-3 sm:p-6 border border-border animate-fade-in">
      <h3 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
        <BarChart3 className="text-primary" size={20} />
        Comparativo
      </h3>

      <Tabs defaultValue="months">
        <TabsList className="mb-4">
          <TabsTrigger value="months" className="flex items-center gap-1.5">
            <BarChart3 size={14} />
            Meses
          </TabsTrigger>
          <TabsTrigger value="sellers" className="flex items-center gap-1.5">
            <Users size={14} />
            Vendedores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="months">
          <MonthComparison />
        </TabsContent>

        <TabsContent value="sellers">
          <SellerComparison />
        </TabsContent>
      </Tabs>
    </div>
  );
};
