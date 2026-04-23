import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Users, Trophy, XCircle, TrendingUp, DollarSign, Clock, Target, ChevronDown, Tag, Calendar, Briefcase } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend, LabelList } from "recharts";
import type { PipelineCard } from "./types";
import { STAGE_ORDER, STAGE_CONFIG, LOSS_CATEGORIES, formatBRL, cardsReachedStage, daysDiff } from "./types";
import { useLabels } from "@/hooks/useLabels";
import { MetricasTipoDocumentoCard } from "./MetricasTipoDocumentoCard";

/** Formata BRL compacto: R$ 36,7 mil / R$ 1,2 mi — ideal para eixos e labels de barra */
function formatBRLCompact(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "R$ 0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${sign}R$ ${abs.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

/** Formata número compacto: 1,2 mil / 32 */
function formatNumCompact(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs >= 1_000) return `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return value.toLocaleString("pt-BR");
}

interface Props {
  cards: PipelineCard[];
  activeUser: string;
  canViewAll: boolean;
  owners: string[];
}

function MetricBox({ label, value, sub }: { label: string; value: string; sub?: string; icon?: any; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] min-w-0 overflow-hidden">
      <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">{label}</p>
      <p className="text-base sm:text-lg lg:text-xl font-bold text-foreground mt-1.5 tabular-nums truncate" title={value}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

const SELLER_COLORS = [
  "hsl(25,95%,53%)",   // orange
  "hsl(207,90%,54%)",  // blue
  "hsl(142,76%,40%)",  // green
  "hsl(270,70%,60%)",  // purple
  "hsl(340,82%,52%)",  // pink
];

function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function filterByMonth(cards: PipelineCard[], date: Date): PipelineCard[] {
  const { start, end } = getMonthRange(date);
  return cards.filter(c => {
    const d = new Date(c.created_at);
    return d >= start && d <= end;
  });
}

/**
 * Filtra leads ganhos pelo MÊS DA VENDA (`data_venda`).
 * Usado no dashboard para que vendas retroativas apareçam no mês correto,
 * e não no mês em que o card foi criado ou em que a etapa mudou.
 * Fallback para `stage_changed_at` se `data_venda` não existir (leads antigos).
 */
function filterGanhosByMonth(cards: PipelineCard[], date: Date): PipelineCard[] {
  const { start, end } = getMonthRange(date);
  return cards.filter(c => {
    if (c.lead_status !== "ganho") return false;
    const ref = c.data_venda || c.stage_changed_at;
    const d = new Date(ref);
    return d >= start && d <= end;
  });
}

function TagConversion({ cards, labels, getCardLabels }: { cards: PipelineCard[]; labels: any[]; getCardLabels: (id: string) => any[] }) {
  const data = useMemo(() => {
    return labels.map(label => {
      const tagged = cards.filter(c => getCardLabels(c.id).some((l: any) => l.id === label.id));
      const total = tagged.length;
      const ganhos = tagged.filter(c => c.lead_status === "ganho").length;
      const conv = total > 0 ? Math.round((ganhos / total) * 100) : 0;
      return { name: label.name, total, ganhos, conv, color: label.color };
    }).filter(d => d.total > 0);
  }, [cards, labels, getCardLabels]);

  // Also show "Sem tag"
  const untagged = cards.filter(c => getCardLabels(c.id).length === 0);
  const untaggedGanhos = untagged.filter(c => c.lead_status === "ganho").length;
  const allData = [
    ...data,
    { name: "Sem tag", total: untagged.length, ganhos: untaggedGanhos, conv: untagged.length > 0 ? Math.round((untaggedGanhos / untagged.length) * 100) : 0, color: "hsl(215,20%,55%)" },
  ].filter(d => d.total > 0);

  if (allData.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Tag size={14} className="text-muted-foreground" />
        <h4 className="text-sm font-semibold text-foreground">Conversão por Etiqueta</h4>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {allData.map(d => (
          <div key={d.name} className="bg-muted/20 rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full" style={{ background: d.color }} />
              <span className="text-xs font-medium text-foreground">{d.name}</span>
            </div>
            <p className="text-lg font-bold text-foreground">{d.conv}%</p>
            <p className="text-[10px] text-muted-foreground">{d.ganhos}/{d.total} leads</p>
          </div>
        ))}
      </div>
    </div>
  );
}
function WeekendConversionCard({ cards }: { cards: PipelineCard[] }) {
  const stats = useMemo(() => {
    const compute = (filter: boolean) => {
      const subset = cards.filter(c => c.fim_de_semana === filter);
      const ganhos = subset.filter(c => c.lead_status === "ganho");
      const perdidos = subset.filter(c => c.lead_status === "perdido");
      const fechados = ganhos.length + perdidos.length;
      const receita = ganhos.reduce((s, c) => s + (c.deal_value || 0), 0);
      const ticket = ganhos.length > 0 ? receita / ganhos.length : 0;
      const taxa = fechados > 0 ? Math.round((ganhos.length / fechados) * 10000) / 100 : 0;
      return { total: subset.length, ganhos: ganhos.length, taxa, ticket, receita };
    };
    return { diaUtil: compute(false), fds: compute(true) };
  }, [cards]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="relative pl-3 space-y-1.5">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded bg-slate-400 dark:bg-slate-600" />
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Dia útil</p>
        <p className="text-2xl font-bold text-foreground tabular-nums">{stats.diaUtil.taxa}%</p>
        <p className="text-[11px] text-muted-foreground">{stats.diaUtil.total} leads · {stats.diaUtil.ganhos} ganhos</p>
        <p className="text-[11px] text-muted-foreground">Ticket: <span className="text-foreground font-medium">{formatBRL(stats.diaUtil.ticket)}</span></p>
        <p className="text-xs text-foreground font-semibold tabular-nums">{formatBRL(stats.diaUtil.receita)}</p>
      </div>
      <div className="relative pl-3 space-y-1.5">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded bg-amber-500" />
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Fim de semana</p>
        <p className="text-2xl font-bold text-foreground tabular-nums">{stats.fds.taxa}%</p>
        <p className="text-[11px] text-muted-foreground">{stats.fds.total} leads · {stats.fds.ganhos} ganhos</p>
        <p className="text-[11px] text-muted-foreground">Ticket: <span className="text-foreground font-medium">{formatBRL(stats.fds.ticket)}</span></p>
        <p className="text-xs text-foreground font-semibold tabular-nums">{formatBRL(stats.fds.receita)}</p>
      </div>
    </div>
  );
}

export function CRMDashboard({ cards, activeUser, canViewAll, owners }: Props) {

  const showAll = canViewAll && activeUser === "all";
  const vis = showAll ? cards : cards.filter(c => c.owner === activeUser);
  const { labels, getCardLabels } = useLabels();

  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [compareMonth, setCompareMonth] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d;
  });

  const currentCards = useMemo(() => filterByMonth(vis, currentMonth), [vis, currentMonth]);
  const prevCards = useMemo(() => filterByMonth(vis, compareMonth), [vis, compareMonth]);

  const ativos = vis.filter(c => c.lead_status === "aberto");
  const ganhos = vis.filter(c => c.lead_status === "ganho");
  const perdidos = vis.filter(c => c.lead_status === "perdido");
  const valorGanhos = ganhos.reduce((s, c) => s + (c.deal_value || 0), 0);
  const valorBrutoPipe = ativos.reduce((s, c) => s + (c.deal_value || 0), 0);
  const valorPondPipe = ativos.reduce((s, c) => s + (c.deal_value || 0) * (STAGE_CONFIG[c.stage]?.probability || 0), 0);
  const taxaPerda = vis.length ? ((perdidos.length / vis.length) * 100).toFixed(1) : "0";
  const taxaConv = vis.length ? ((ganhos.length / vis.length) * 100).toFixed(1) : "0";

  const lossData = useMemo(() => {
    const counts: Record<string, number> = {};
    perdidos.forEach(c => { const k = c.loss_category || "outro"; counts[k] = (counts[k] || 0) + 1; });
    return LOSS_CATEGORIES.map(l => ({ name: l.label, value: counts[l.key] || 0 })).filter(d => d.value > 0);
  }, [perdidos]);

  const timeData = useMemo(() => {
    return STAGE_ORDER.map(s => {
      const durations: number[] = [];
      vis.forEach(c => {
        c.history.filter(h => h.from === s && h.duration_days != null).forEach(h => durations.push(h.duration_days!));
        if (c.stage === s && c.lead_status === "aberto") durations.push(daysDiff(c.stage_changed_at));
      });
      const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      return { name: STAGE_CONFIG[s].label, dias: Math.round(avg * 10) / 10 };
    });
  }, [vis]);

  const funnelData = useMemo(() => {
    return STAGE_ORDER.map(s => ({
      stage: STAGE_CONFIG[s].label,
      count: cardsReachedStage(vis, s).length,
    }));
  }, [vis]);
  const maxFunnel = funnelData[0]?.count || 1;

  const barColors = ["hsl(207,90%,54%)", "hsl(270,70%,60%)", "hsl(142,76%,36%)", "hsl(207,90%,54%)", "hsl(45,93%,47%)", "hsl(25,95%,53%)", "hsl(142,76%,50%)"];

  // Month comparison data
  // IMPORTANTE: ganhos e faturamento usam `data_venda` (não data de criação),
  // para que vendas retroativas apareçam no mês correto.
  const monthCompData = useMemo(() => {
    const curLabel = getMonthLabel(currentMonth);
    const prevLabel = getMonthLabel(compareMonth);
    const curGanhos = filterGanhosByMonth(vis, currentMonth);
    const prevGanhos = filterGanhosByMonth(vis, compareMonth);
    return [
      { metric: "Leads Criados", [curLabel]: currentCards.length, [prevLabel]: prevCards.length },
      { metric: "Ganhos", [curLabel]: curGanhos.length, [prevLabel]: prevGanhos.length },
      { metric: "Faturamento (R$)", [curLabel]: curGanhos.reduce((s, c) => s + (c.deal_value || 0), 0), [prevLabel]: prevGanhos.reduce((s, c) => s + (c.deal_value || 0), 0) },
      { metric: "Perdidos", [curLabel]: currentCards.filter(c => c.lead_status === "perdido").length, [prevLabel]: prevCards.filter(c => c.lead_status === "perdido").length },
    ];
  }, [vis, currentCards, prevCards, currentMonth, compareMonth]);

  const curLabel = getMonthLabel(currentMonth);
  const prevLabel = getMonthLabel(compareMonth);

  // Seller comparison (HubSpot-style)
  const sellerData = useMemo(() => {
    const sellers = owners.filter(o => o && o !== "SDR");
    if (sellers.length === 0) return { leads: [], ganhos: [], faturamento: [], conversao: [], sellers };

    const leads = sellers.map(s => ({
      name: s,
      value: vis.filter(c => c.owner === s).length,
    }));
    const ganhosArr = sellers.map(s => ({
      name: s,
      value: vis.filter(c => c.owner === s && c.lead_status === "ganho").length,
    }));
    const fatArr = sellers.map(s => ({
      name: s,
      value: vis.filter(c => c.owner === s && c.lead_status === "ganho").reduce((sum, c) => sum + (c.deal_value || 0), 0),
    }));
    const convArr = sellers.map(s => {
      const total = vis.filter(c => c.owner === s).length;
      const won = vis.filter(c => c.owner === s && c.lead_status === "ganho").length;
      return { name: s, value: total > 0 ? Math.round((won / total) * 100) : 0 };
    });

    return { leads, ganhos: ganhosArr, faturamento: fatArr, conversao: convArr, sellers };
  }, [vis, owners]);

  // Available months selector: mês atual + 23 meses anteriores
  const availableMonths = useMemo(() => {
    const months: Date[] = [];
    for (let i = 0; i <= 23; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d);
    }
    return months;
  }, []);

  const currentMonthKey = currentMonth.toISOString();
  const compareOptions = availableMonths.filter(m => m.toISOString() !== currentMonthKey);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">Dashboard CRM</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Visão {showAll ? "geral" : `de ${activeUser}`} · {getMonthLabel(currentMonth)}</p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground self-start sm:self-auto">
          <Calendar size={14} className="text-primary" />
          <span>Mês:</span>
          <select
            value={currentMonthKey}
            onChange={e => setCurrentMonth(new Date(e.target.value))}
            className="bg-transparent text-foreground outline-none capitalize"
          >
            {availableMonths.map(m => (
              <option key={m.toISOString()} value={m.toISOString()}>{getMonthLabel(m)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <MetricBox label="Leads Ativos" value={ativos.length.toString()} />
        <MetricBox label="Valor Bruto" value={formatBRL(valorBrutoPipe)} />
        <MetricBox label="Valor Ponderado" value={formatBRL(valorPondPipe)} />
        <MetricBox label="Ganhos" value={ganhos.length.toString()} sub={formatBRL(valorGanhos)} />
        <MetricBox label="Perdidos" value={perdidos.length.toString()} sub={`${taxaPerda}% de perda`} />
        <MetricBox label="Conversão" value={`${taxaConv}%`} />
      </div>

      {/* Month comparison */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-foreground">Comparação Mensal</h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Comparar com:</span>
            <select
              value={compareMonth.toISOString()}
              onChange={e => setCompareMonth(new Date(e.target.value))}
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
            >
              {compareOptions.map(m => (
                <option key={m.toISOString()} value={m.toISOString()}>{getMonthLabel(m)}</option>
              ))}
            </select>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthCompData} margin={{ left: 10, right: 20, top: 20 }}>
            <XAxis dataKey="metric" tick={{ fill: "hsl(215,20%,55%)", fontSize: 11 }} />
            <YAxis
              tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }}
              width={70}
              tickFormatter={(v: number) => v >= 1000 ? formatBRLCompact(v) : v.toLocaleString("pt-BR")}
            />
            <Tooltip
              contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(222,47%,16%)", borderRadius: 8, fontSize: 12, color: "hsl(210,40%,98%)" }}
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
              formatter={(value: number, _name, ctx: any) => {
                const isMoney = ctx?.payload?.metric === "Faturamento (R$)";
                return isMoney ? formatBRL(value) : value.toLocaleString("pt-BR");
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey={curLabel} fill="hsl(207,90%,54%)" radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey={curLabel}
                position="top"
                style={{ fill: "hsl(var(--foreground))", fontSize: 10, fontWeight: 600 }}
                formatter={(value: number, _n: any, _i: any, idx: number) => {
                  const metric = monthCompData[idx]?.metric;
                  return metric === "Faturamento (R$)" ? formatBRLCompact(value) : formatNumCompact(value);
                }}
              />
            </Bar>
            <Bar dataKey={prevLabel} fill="hsl(25,95%,53%)" radius={[4, 4, 0, 0]} opacity={0.7}>
              <LabelList
                dataKey={prevLabel}
                position="top"
                style={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 600 }}
                formatter={(value: number, _n: any, _i: any, idx: number) => {
                  const metric = monthCompData[idx]?.metric;
                  return metric === "Faturamento (R$)" ? formatBRLCompact(value) : formatNumCompact(value);
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Seller comparison - HubSpot style */}
      {showAll && sellerData.sellers.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="text-sm font-semibold text-foreground mb-4">Comparação por Vendedor</h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leads by seller - horizontal bars */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Leads Totais</p>
              <ResponsiveContainer width="100%" height={Math.max(sellerData.sellers.length * 44, 130)}>
                <BarChart data={sellerData.leads} layout="vertical" margin={{ left: 80, right: 40 }}>
                  <XAxis type="number" tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} width={75} />
                  <Tooltip contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(222,47%,16%)", borderRadius: 8, fontSize: 12, color: "hsl(210,40%,98%)" }} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} formatter={(v: number) => v.toLocaleString("pt-BR")} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {sellerData.leads.map((_, i) => <Cell key={i} fill={SELLER_COLORS[i % SELLER_COLORS.length]} />)}
                    <LabelList dataKey="value" position="right" style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }} formatter={(v: number) => v.toLocaleString("pt-BR")} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Conversion % - vertical bars */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Conversão (%)</p>
              <ResponsiveContainer width="100%" height={Math.max(sellerData.sellers.length * 44, 130)}>
                <BarChart data={sellerData.conversao} margin={{ left: 10, right: 10, top: 20 }}>
                  <XAxis dataKey="name" tick={{ fill: "hsl(215,20%,55%)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(222,47%,16%)", borderRadius: 8, fontSize: 12, color: "hsl(210,40%,98%)" }} formatter={(v: number) => `${v}%`} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {sellerData.conversao.map((_, i) => <Cell key={i} fill={SELLER_COLORS[i % SELLER_COLORS.length]} />)}
                    <LabelList dataKey="value" position="top" style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }} formatter={(v: number) => `${v}%`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Ganhos - horizontal bars */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Vendas (Ganhos)</p>
              <ResponsiveContainer width="100%" height={Math.max(sellerData.sellers.length * 44, 130)}>
                <BarChart data={sellerData.ganhos} layout="vertical" margin={{ left: 80, right: 40 }}>
                  <XAxis type="number" tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} width={75} />
                  <Tooltip contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(222,47%,16%)", borderRadius: 8, fontSize: 12, color: "hsl(210,40%,98%)" }} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} formatter={(v: number) => v.toLocaleString("pt-BR")} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {sellerData.ganhos.map((_, i) => <Cell key={i} fill={SELLER_COLORS[i % SELLER_COLORS.length]} />)}
                    <LabelList dataKey="value" position="right" style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }} formatter={(v: number) => v.toLocaleString("pt-BR")} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Faturamento - vertical bars */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Faturamento (R$)</p>
              <ResponsiveContainer width="100%" height={Math.max(sellerData.sellers.length * 44, 130)}>
                <BarChart data={sellerData.faturamento} margin={{ left: 10, right: 10, top: 20 }}>
                  <XAxis dataKey="name" tick={{ fill: "hsl(215,20%,55%)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} width={70} tickFormatter={(v: number) => formatBRLCompact(v)} />
                  <Tooltip contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(222,47%,16%)", borderRadius: 8, fontSize: 12, color: "hsl(210,40%,98%)" }} formatter={(v: number) => formatBRL(v)} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {sellerData.faturamento.map((_, i) => <Cell key={i} fill={SELLER_COLORS[i % SELLER_COLORS.length]} />)}
                    <LabelList dataKey="value" position="top" style={{ fill: "hsl(var(--foreground))", fontSize: 10, fontWeight: 600 }} formatter={(v: number) => formatBRLCompact(v)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Weekend conversion card */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">Conversão: Dia útil vs. Fim de semana</h4>
        <WeekendConversionCard cards={vis} />
      </div>

      {/* CPF vs CNPJ metrics */}
      <MetricasTipoDocumentoCard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {lossData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">Motivos de Perda</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={lossData} layout="vertical" margin={{ left: 80, right: 40 }}>
                <XAxis type="number" tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} width={75} />
                <Tooltip contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(222,47%,16%)", borderRadius: 8, fontSize: 12, color: "hsl(210,40%,98%)" }} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {lossData.map((_, i) => <Cell key={i} fill="hsl(0,72%,51%)" fillOpacity={0.7} />)}
                  <LabelList dataKey="value" position="right" style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">Tempo Médio por Etapa (dias)</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={timeData} margin={{ left: 10, right: 10, top: 20 }}>
              <XAxis dataKey="name" tick={{ fill: "hsl(215,20%,55%)", fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(222,47%,16%)", borderRadius: 8, fontSize: 12, color: "hsl(210,40%,98%)" }} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} formatter={(v: number) => `${v} dias`} />
              <Bar dataKey="dias" radius={[4, 4, 0, 0]}>
                {timeData.map((_, i) => <Cell key={i} fill={barColors[i % barColors.length]} fillOpacity={0.7} />)}
                <LabelList dataKey="dias" position="top" style={{ fill: "hsl(var(--foreground))", fontSize: 10, fontWeight: 600 }} formatter={(v: number) => v > 0 ? `${v}d` : ""} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Funnel */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h4 className="text-sm font-semibold text-foreground mb-4">Funil de Conversão por Etapa</h4>
        <div className="space-y-2">
        {funnelData.map((d, i) => {
            const pct = maxFunnel > 0 ? (d.count / maxFunnel) * 100 : 0;
            const prevCount = i > 0 ? funnelData[i - 1].count : 0;
            const convRate = i > 0 && prevCount > 0
              ? Math.min((d.count / prevCount) * 100, 100).toFixed(0) : (i > 0 ? "—" : null);
            return (
              <div key={d.stage} className="flex items-center gap-3">
                <span className="text-xs w-28 sm:w-36 text-right text-muted-foreground truncate">{d.stage}</span>
                <div className="flex-1 h-7 bg-muted/30 rounded-lg overflow-hidden relative">
                  <div className="h-full rounded-lg flex items-center px-3 transition-all"
                    style={{ width: `${Math.max(pct, 4)}%`, background: barColors[i % barColors.length], opacity: 0.7 }}>
                    <span className="text-xs font-medium text-white">{d.count}</span>
                  </div>
                </div>
                {convRate && <span className="text-[10px] text-muted-foreground w-10 text-right">{convRate}%</span>}
              </div>
            );
          })}
      </div>

      {/* Tag conversion */}
      {labels.length > 0 && (
        <TagConversion cards={vis} labels={labels} getCardLabels={getCardLabels} />
      )}
      </div>

      {showAll && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Por Closer</h4>
          {owners.map(closer => {
            const cc = cards.filter(c => c.owner === closer);
            const a = cc.filter(c => c.lead_status === "aberto").length;
            const g = cc.filter(c => c.lead_status === "ganho");
            const vf = g.reduce((s, c) => s + (c.deal_value || 0), 0);
            return (
              <div key={closer} className="bg-card/50 border border-border rounded-xl p-4">
                <h5 className="text-sm font-semibold text-foreground mb-2">{closer}</h5>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><p className="text-[10px] text-muted-foreground">Ativos</p><p className="text-lg font-bold">{a}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Ganhos</p><p className="text-lg font-bold text-green-400">{g.length}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Valor Fechado</p><p className="text-lg font-bold text-emerald-400">{formatBRL(vf)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Conversão</p><p className="text-lg font-bold">{cc.length ? ((g.length / cc.length) * 100).toFixed(1) : 0}%</p></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
