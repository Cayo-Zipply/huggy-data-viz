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
import { TrendingUp, TrendingDown, Minus, BarChart3, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const months = [
  { key: "novembro", label: "Novembro 2024" },
  { key: "dezembro", label: "Dezembro 2024" },
  { key: "janeiro", label: "Janeiro 2025" },
  { key: "fevereiro", label: "Fevereiro 2025" },
];

// Get all unique sellers across all months
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

const InsightBadge = ({ value, invertColors = false }: { value: number; invertColors?: boolean }) => {
  const isPositive = invertColors ? value < 0 : value > 0;
  const isNeutral = Math.abs(value) < 0.01;

  if (isNeutral) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
        <Minus size={10} /> Igual
      </span>
    );
  }

  return (
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
};

interface ComparisonRowProps {
  label: string;
  valueA: string;
  valueB: string;
  variation: number;
  invertColors?: boolean;
}

const ComparisonRow = ({ label, valueA, valueB, variation, invertColors = false }: ComparisonRowProps) => (
  <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
    <span className="text-sm text-muted-foreground w-1/4">{label}</span>
    <span className="text-sm font-semibold text-foreground w-1/4 text-center">{valueA}</span>
    <span className="text-sm font-semibold text-foreground w-1/4 text-center">{valueB}</span>
    <div className="w-1/4 flex justify-end">
      <InsightBadge value={variation} invertColors={invertColors} />
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

  const labelA = months.find((m) => m.key === monthA)?.label || monthA;
  const labelB = months.find((m) => m.key === monthB)?.label || monthB;

  const metrics = [
    { label: "Investimento", a: formatCurrency(dataA.investimento), b: formatCurrency(dataB.investimento), var: calcVariation(dataB.investimento, dataA.investimento), invert: true },
    { label: "Impressões", a: formatNumber(dataA.impressoes), b: formatNumber(dataB.impressoes), var: calcVariation(dataB.impressoes, dataA.impressoes) },
    { label: "CTR", a: formatPercent(dataA.ctr), b: formatPercent(dataB.ctr), var: calcVariation(dataB.ctr, dataA.ctr) },
    { label: "CPC", a: formatCurrency(dataA.cpc), b: formatCurrency(dataB.cpc), var: calcVariation(dataB.cpc, dataA.cpc), invert: true },
    { label: "Mensagens", a: formatNumber(dataA.mensagens), b: formatNumber(dataB.mensagens), var: calcVariation(dataB.mensagens, dataA.mensagens) },
    { label: "CPA", a: formatCurrency(dataA.cpa), b: formatCurrency(dataB.cpa), var: calcVariation(dataB.cpa, dataA.cpa), invert: true },
    { label: "CPM", a: formatCurrency(dataA.cpm), b: formatCurrency(dataB.cpm), var: calcVariation(dataB.cpm, dataA.cpm), invert: true },
    { label: "Vendas", a: String(dataA.vendas), b: String(dataB.vendas), var: calcVariation(dataB.vendas, dataA.vendas) },
    { label: "Faturamento", a: formatCurrency(dataA.faturamento), b: formatCurrency(dataB.faturamento), var: calcVariation(dataB.faturamento, dataA.faturamento) },
    { label: "Reuniões", a: String(reunioesA), b: String(reunioesB), var: calcVariation(reunioesB, reunioesA) },
    { label: "Custo/Reunião", a: custoReunA > 0 ? formatCurrency(custoReunA) : "N/A", b: custoReunB > 0 ? formatCurrency(custoReunB) : "N/A", var: calcVariation(custoReunB, custoReunA), invert: true },
    { label: "Conv. Reuniões", a: convReunA > 0 ? `${convReunA.toFixed(1)}%` : "N/A", b: convReunB > 0 ? `${convReunB.toFixed(1)}%` : "N/A", var: calcVariation(convReunB, convReunA) },
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

      {/* Header */}
      <div className="flex items-center justify-between py-2 border-b-2 border-border mb-1">
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
          <div className="flex items-center justify-between py-2 border-b-2 border-border mb-1">
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
    <div className="bg-card rounded-xl p-6 border border-border animate-fade-in">
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
