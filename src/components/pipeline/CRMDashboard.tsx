import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Users, Trophy, XCircle, TrendingUp, DollarSign, Clock, Target, ChevronDown, Tag } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import type { PipelineCard } from "./types";
import { STAGE_ORDER, STAGE_CONFIG, LOSS_CATEGORIES, formatBRL, cardsReachedStage, daysDiff } from "./types";
import { useLabels } from "@/hooks/useLabels";

interface Props {
  cards: PipelineCard[];
  activeUser: string;
  canViewAll: boolean;
  owners: string[];
}

function MetricBox({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: any; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", color)}><Icon size={14} className="text-foreground" /></div>
        <span className="text-[10px] sm:text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg sm:text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
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

export function CRMDashboard({ cards, activeUser, canViewAll, owners }: Props) {
  const showAll = canViewAll && activeUser === "all";
  const vis = showAll ? cards : cards.filter(c => c.owner === activeUser);
  const { labels, getCardLabels } = useLabels();

  const now = new Date();
  const [compareMonth, setCompareMonth] = useState(() => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d;
  });

  const currentMonth = now;
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
  const monthCompData = useMemo(() => {
    const curLabel = getMonthLabel(currentMonth);
    const prevLabel = getMonthLabel(compareMonth);
    const curGanhos = currentCards.filter(c => c.lead_status === "ganho");
    const prevGanhos = prevCards.filter(c => c.lead_status === "ganho");
    return [
      { metric: "Leads Criados", [curLabel]: currentCards.length, [prevLabel]: prevCards.length },
      { metric: "Ganhos", [curLabel]: curGanhos.length, [prevLabel]: prevGanhos.length },
      { metric: "Faturamento (R$)", [curLabel]: curGanhos.reduce((s, c) => s + (c.deal_value || 0), 0), [prevLabel]: prevGanhos.reduce((s, c) => s + (c.deal_value || 0), 0) },
      { metric: "Perdidos", [curLabel]: currentCards.filter(c => c.lead_status === "perdido").length, [prevLabel]: prevCards.filter(c => c.lead_status === "perdido").length },
    ];
  }, [currentCards, prevCards, currentMonth, compareMonth]);

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

  // Available months for comparison
  const availableMonths = useMemo(() => {
    const months: Date[] = [];
    for (let i = 1; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d);
    }
    return months;
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground">Dashboard CRM</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Visão {showAll ? "geral" : `de ${activeUser}`}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <MetricBox label="Leads Ativos" value={ativos.length.toString()} icon={Users} color="bg-primary/20" />
        <MetricBox label="Valor Bruto" value={formatBRL(valorBrutoPipe)} icon={DollarSign} color="bg-emerald-400/20" />
        <MetricBox label="Valor Ponderado" value={formatBRL(valorPondPipe)} icon={Target} color="bg-yellow-400/20" />
        <MetricBox label="Ganhos" value={ganhos.length.toString()} sub={formatBRL(valorGanhos)} icon={Trophy} color="bg-green-500/20" />
        <MetricBox label="Perdidos" value={perdidos.length.toString()} sub={`${taxaPerda}% de perda`} icon={XCircle} color="bg-destructive/20" />
        <MetricBox label="Conversão" value={`${taxaConv}%`} icon={TrendingUp} color="bg-primary/20" />
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
              {availableMonths.map(m => (
                <option key={m.toISOString()} value={m.toISOString()}>{getMonthLabel(m)}</option>
              ))}
            </select>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={monthCompData} margin={{ left: 10, right: 10 }}>
            <XAxis dataKey="metric" tick={{ fill: "hsl(215,20%,55%)", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(222,47%,16%)", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey={curLabel} fill="hsl(207,90%,54%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey={prevLabel} fill="hsl(25,95%,53%)" radius={[4, 4, 0, 0]} opacity={0.7} />
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
              <ResponsiveContainer width="100%" height={Math.max(sellerData.sellers.length * 40, 120)}>
                <BarChart data={sellerData.leads} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "hsl(210,40%,98%)", fontSize: 11 }} width={75} />
                  <Tooltip contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(222,47%,16%)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {sellerData.leads.map((_, i) => <Cell key={i} fill={SELLER_COLORS[i % SELLER_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Conversion % - vertical bars */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Conversão (%)</p>
              <ResponsiveContainer width="100%" height={Math.max(sellerData.sellers.length * 40, 120)}>
                <BarChart data={sellerData.conversao} margin={{ left: 10 }}>
                  <XAxis dataKey="name" tick={{ fill: "hsl(215,20%,55%)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(222,47%,16%)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {sellerData.conversao.map((_, i) => <Cell key={i} fill={SELLER_COLORS[i % SELLER_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Ganhos - horizontal bars */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Vendas (Ganhos)</p>
              <ResponsiveContainer width="100%" height={Math.max(sellerData.sellers.length * 40, 120)}>
                <BarChart data={sellerData.ganhos} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "hsl(210,40%,98%)", fontSize: 11 }} width={75} />
                  <Tooltip contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(222,47%,16%)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {sellerData.ganhos.map((_, i) => <Cell key={i} fill={SELLER_COLORS[i % SELLER_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Faturamento - vertical bars */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Faturamento (R$)</p>
              <ResponsiveContainer width="100%" height={Math.max(sellerData.sellers.length * 40, 120)}>
                <BarChart data={sellerData.faturamento} margin={{ left: 10 }}>
                  <XAxis dataKey="name" tick={{ fill: "hsl(215,20%,55%)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(222,47%,16%)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {sellerData.faturamento.map((_, i) => <Cell key={i} fill={SELLER_COLORS[i % SELLER_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {lossData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">Motivos de Perda</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={lossData} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "hsl(210,40%,98%)", fontSize: 11 }} width={75} />
                <Tooltip contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(222,47%,16%)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {lossData.map((_, i) => <Cell key={i} fill="hsl(0,72%,51%)" fillOpacity={0.7} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">Tempo Médio por Etapa (dias)</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={timeData} margin={{ left: 10 }}>
              <XAxis dataKey="name" tick={{ fill: "hsl(215,20%,55%)", fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(222,47%,16%)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="dias" radius={[4, 4, 0, 0]}>
                {timeData.map((_, i) => <Cell key={i} fill={barColors[i % barColors.length]} fillOpacity={0.7} />)}
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
            const convRate = i > 0 && funnelData[i - 1].count > 0
              ? ((d.count / funnelData[i - 1].count) * 100).toFixed(0) : null;
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
