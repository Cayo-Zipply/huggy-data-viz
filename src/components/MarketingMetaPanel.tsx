import { useState, useMemo } from "react";
import { useMetaAds, CampaignSummary } from "@/hooks/useMetaAds";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ArrowUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#8884d8", "#82ca9d", "#ffc658"];

const MONTHS = [
  { label: "Março 2026", year: 2026, month: 3 },
  { label: "Abril 2026", year: 2026, month: 4 },
];

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtN = (v: number) => new Intl.NumberFormat("pt-BR").format(v);
const fmtP = (v: number) => `${v.toFixed(2)}%`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" && p.name.toLowerCase().includes("ctr") ? fmtP(p.value) : fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

type SortKey = keyof CampaignSummary;

export const MarketingMetaPanel = () => {
  const [selected, setSelected] = useState("2026-4");
  const [year, month] = selected.split("-").map(Number);
  const { loading, kpis, variations, dailyData, campaigns } = useMetaAds(year, month);
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const va = a[sortKey] as number;
      const vb = b[sortKey] as number;
      return sortAsc ? va - vb : vb - va;
    });
  }, [campaigns, sortKey, sortAsc]);

  const top5 = campaigns.slice(0, 5);
  const pieData = campaigns.slice(0, 6).map((c) => ({ name: c.campaign_name.length > 25 ? c.campaign_name.slice(0, 25) + "…" : c.campaign_name, value: c.spend }));

  const dailyFormatted = dailyData.map((d) => ({
    ...d,
    dia: d.date.slice(8),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const noData = !campaigns.length && !dailyData.length;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-3">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">vs mês anterior</span>
      </div>

      {noData && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum dado encontrado para o período selecionado. Verifique se a tabela <code>meta_ads_daily</code> possui registros e se o RLS permite leitura.
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-4">
        <MetricCard title="Gasto Total" value={fmt(kpis.spend)} variation={variations.spend} invertColors delay={0} />
        <MetricCard title="Impressões" value={fmtN(kpis.impressions)} variation={variations.impressions} delay={50} />
        <MetricCard title="Cliques" value={fmtN(kpis.clicks)} variation={variations.clicks} delay={100} />
        <MetricCard title="CTR Médio" value={fmtP(kpis.ctr)} variation={variations.ctr} delay={150} />
        <MetricCard title="CPC Médio" value={fmt(kpis.cpc)} variation={variations.cpc} invertColors delay={200} />
        <MetricCard title="Conversões" value={fmtN(kpis.conversions)} variation={variations.conversions} delay={250} />
        <MetricCard title="ROAS" value={kpis.roas.toFixed(2) + "x"} variation={variations.roas} delay={300} />
      </div>

      {/* Charts row 1 */}
      {dailyFormatted.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Gasto Diário</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={dailyFormatted}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="spend" name="Gasto" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 5 Campanhas por Gasto</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={top5} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="campaign_name" width={150} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 20) + "…" : v} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="spend" name="Gasto" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts row 2 */}
      {dailyFormatted.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">CTR Diário (%)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={dailyFormatted}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v.toFixed(1)}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="ctr" name="CTR" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Distribuição de Gasto por Campanha</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Campaigns table */}
      {sortedCampaigns.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Campanhas Detalhadas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    {([
                      ["spend", "Gasto"],
                      ["impressions", "Impressões"],
                      ["clicks", "Cliques"],
                      ["ctr", "CTR"],
                      ["cpc", "CPC"],
                      ["conversions", "Conversões"],
                      ["roas", "ROAS"],
                    ] as [SortKey, string][]).map(([key, label]) => (
                      <TableHead key={key} className="cursor-pointer select-none" onClick={() => toggleSort(key)}>
                        <div className="flex items-center gap-1">
                          {label}
                          <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCampaigns.map((c) => (
                    <TableRow key={c.campaign_name}>
                      <TableCell className="font-medium max-w-[200px] truncate" title={c.campaign_name}>{c.campaign_name}</TableCell>
                      <TableCell>{fmt(c.spend)}</TableCell>
                      <TableCell>{fmtN(c.impressions)}</TableCell>
                      <TableCell>{fmtN(c.clicks)}</TableCell>
                      <TableCell>{fmtP(c.ctr)}</TableCell>
                      <TableCell>{fmt(c.cpc)}</TableCell>
                      <TableCell>{fmtN(c.conversions)}</TableCell>
                      <TableCell>{c.roas.toFixed(2)}x</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
