import { marketingData, formatCurrency } from "@/data/marketingData";
import { revenueData } from "@/data/revenueData";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Area
} from "recharts";

const monthOrder = ["setembro", "outubro", "novembro", "dezembro", "janeiro", "fevereiro"];
const monthLabels: Record<string, string> = {
  setembro: "Set", outubro: "Out", novembro: "Nov",
  dezembro: "Dez", janeiro: "Jan", fevereiro: "Fev",
};

const buildChartData = (months: string[]) =>
  months
    .filter((m) => marketingData[m])
    .map((m) => {
      const mkt = marketingData[m];
      const rev = revenueData[m];
      const roiAds = mkt.investimento > 0 ? ((mkt.faturamento - mkt.investimento) / mkt.investimento) * 100 : 0;
      const roiReal = mkt.investimento > 0 && rev ? ((rev.valorDeixado - mkt.investimento) / mkt.investimento) * 100 : 0;
      return {
        name: monthLabels[m] || m,
        investimento: mkt.investimento,
        faturamento: mkt.faturamento,
        valorDeixado: rev?.valorDeixado ?? 0,
        roiAds: Math.round(roiAds),
        roiReal: Math.round(roiReal),
        vendas: mkt.vendas,
      };
    });

const currencyFormatter = (v: number) => formatCurrency(v);
const pctFormatter = (v: number) => `${v}%`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" && p.dataKey?.includes("roi") ? `${p.value}%` : formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

interface Props {
  months: string[];
}

export const ConsolidatedCharts = ({ months }: Props) => {
  const data = buildChartData(months);

  return (
    <div className="space-y-4 sm:space-y-6 mt-6">
      <h3 className="text-base sm:text-lg font-bold text-foreground">📈 Evolução Mensal</h3>

      {/* Investimento vs Faturamento vs Valor Deixado */}
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
        <h4 className="text-xs sm:text-sm font-bold text-foreground mb-3 sm:mb-4">Investimento × Faturamento × Valor Deixado</h4>
        <div className="-mx-2 sm:mx-0">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={data} margin={{ left: -10, right: 5, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={35} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="investimento" name="Investimento" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} opacity={0.8} />
              <Bar dataKey="faturamento" name="Faturamento" fill="hsl(210 80% 55%)" radius={[4, 4, 0, 0]} opacity={0.8} />
              <Area dataKey="valorDeixado" name="Valor Deixado" fill="hsl(142 70% 45% / 0.15)" stroke="hsl(142 70% 45%)" type="monotone" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ROI */}
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
        <h4 className="text-xs sm:text-sm font-bold text-foreground mb-3 sm:mb-4">ROI Mensal (%)</h4>
        <div className="-mx-2 sm:mx-0">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ left: -10, right: 5, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={pctFormatter} width={35} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line dataKey="roiAds" name="ROI Ads" stroke="hsl(210 80% 55%)" strokeWidth={2} dot={{ r: 3 }} />
              <Line dataKey="roiReal" name="ROI Real" stroke="hsl(142 70% 45%)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Vendas */}
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
        <h4 className="text-xs sm:text-sm font-bold text-foreground mb-3 sm:mb-4">Vendas por Mês</h4>
        <div className="-mx-2 sm:mx-0">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} margin={{ left: -10, right: 5, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={30} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="vendas" name="Vendas" fill="hsl(280 70% 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
