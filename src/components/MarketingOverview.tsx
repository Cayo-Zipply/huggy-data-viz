import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowRight } from "lucide-react";
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useFarolMetricasTime } from "@/hooks/useFarolRpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeriodPicker, type PeriodoFunil } from "@/components/FunilCriativoFilters";
import { cn } from "@/lib/utils";

const GOLD = "hsl(var(--mkt-gold))";
const TEXT = "hsl(var(--mkt-text))";
const MUTED = "hsl(var(--mkt-muted))";
const TRACK = "hsl(var(--mkt-track))";

import { brlKpi, numKpi, brlFull, numFull, KPI_VALUE_STYLE, KPI_VALUE_CLASS } from "@/lib/kpiFormat";
const n = (v: any) => Number(v ?? 0) || 0;
const brl = (v: any) => (v == null || !isFinite(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const dec = (v: number, d = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const compact = (v: number) => (v >= 1e6 ? `${dec(v / 1e6, 1)} mi` : v >= 1e3 ? `${dec(v / 1e3, 1)} mil` : v.toLocaleString("pt-BR"));
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const diaLabel = (s: string) => { const d = parse(String(s).slice(0, 10)); return `${String(d.getDate()).padStart(2, "0")} ${MESES[d.getMonth()]}`; };

const hojeSP = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return new Date(Number(p.year), Number(p.month) - 1, Number(p.day));
};
const atalho = (k: "7" | "14" | "mes" | "anterior"): PeriodoFunil => {
  const t = hojeSP();
  if (k === "mes") return { desde: iso(new Date(t.getFullYear(), t.getMonth(), 1)), ate: iso(t) };
  if (k === "anterior") return { desde: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), ate: iso(new Date(t.getFullYear(), t.getMonth(), 0)) };
  const s = new Date(t); s.setDate(s.getDate() - (Number(k) - 1));
  return { desde: iso(s), ate: iso(t) };
};
const anterior = (p: PeriodoFunil): PeriodoFunil => {
  const a = parse(p.desde), b = parse(p.ate);
  const dias = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  const fim = new Date(a); fim.setDate(fim.getDate() - 1);
  const ini = new Date(fim); ini.setDate(ini.getDate() - (dias - 1));
  return { desde: iso(ini), ate: iso(fim) };
};

const useResumo = (p: PeriodoFunil, camp: string | null, enabled = true) => useQuery({
  queryKey: ["mkt-criativos-resumo", p.desde, p.ate, camp],
  enabled,
  queryFn: async () => {
    const { data, error } = await (supabase as any).rpc("mkt_criativos_resumo", { p_inicio: p.desde, p_fim: p.ate, p_campanha: camp });
    if (error) throw error;
    return data as { totais: Record<string, any>; serie_diaria: any[]; campanhas: any[] };
  },
});

// Mês inteiro: começa no dia 1 e termina no último dia do mês (ou hoje, no mês atual).
const mesInteiro = (p: PeriodoFunil): string | null => {
  const a = parse(p.desde), b = parse(p.ate);
  if (a.getDate() !== 1 || a.getMonth() !== b.getMonth() || a.getFullYear() !== b.getFullYear()) return null;
  const ultimo = new Date(a.getFullYear(), a.getMonth() + 1, 0);
  const fimOk = iso(b) === iso(ultimo) || iso(b) === iso(hojeSP());
  return fimOk ? p.desde.slice(0, 7) : null;
};
const mesAnteriorDe = (mes: string) => {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const periodoDoMes = (mes: string): PeriodoFunil => {
  const [y, m] = mes.split("-").map(Number);
  return { desde: `${mes}-01`, ate: iso(new Date(y, m, 0)) };
};
// Reuniões realizadas oficiais (regra no banco): soma de reunioes_realizadas de farol_metricas_time.
const useReunioesTime = (mes: string | null) => {
  const q = useFarolMetricasTime(mes);
  const total = q.data ? q.data.reduce((s: number, r: any) => s + n(r.reunioes_realizadas), 0) : undefined;
  return { ...q, data: total as number | undefined };
};

type Tile = { l: string; v: string; cur: number; prev: number; inverso?: boolean; real?: boolean; full?: string; sub?: string; semSeta?: boolean };

function Chip({ cur, prev, inverso }: { cur: number; prev: number; inverso?: boolean }) {
  if (!prev || !cur) return <span className="text-[11px] text-mkt-muted">—</span>;
  const varPct = ((cur - prev) / prev) * 100;
  const bom = inverso ? varPct < 0 : varPct > 0;
  const Icon = varPct >= 0 ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums", bom ? "bg-mkt-good/10 text-mkt-good" : "bg-mkt-bad/10 text-mkt-bad")}>
      <Icon className="h-3 w-3" />{dec(Math.abs(varPct), 1)}%
    </span>
  );
}

export function MarketingOverview() {
  const [periodo, setPeriodo] = useState<PeriodoFunil>(() => atalho("mes"));
  const [camp, setCamp] = useState("__all");
  const pCamp = camp === "__all" ? null : camp;
  const prevP = useMemo(() => anterior(periodo), [periodo]);
  const cur = useResumo(periodo, pCamp);
  const prev = useResumo(prevP, pCamp);
  // Custo/reunião: só em mês inteiro e sem filtro de campanha (reuniões são do time todo).
  const mesSel = pCamp ? null : mesInteiro(periodo);
  const mesPrev = mesSel ? mesAnteriorDe(mesSel) : null;
  const rrMes = useReunioesTime(mesSel);
  const rrPrev = useReunioesTime(mesPrev);
  const prevMesResumo = useResumo(mesPrev ? periodoDoMes(mesPrev) : { desde: "", ate: "" }, null, !!mesPrev);
  const lista = useQuery({
    queryKey: ["mkt-criativos", periodo.desde, periodo.ate, pCamp],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("mkt_criativos", { p_inicio: periodo.desde, p_fim: periodo.ate, p_campanha: pCamp });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as Record<string, any>[];
    },
  });

  const t = cur.data?.totais ?? {};
  const pt = prev.data?.totais ?? {};
  const custoReuniao = mesSel && rrMes.data ? n(t.gasto) / rrMes.data : null;
  const gastoPrevMes = n(prevMesResumo.data?.totais?.gasto);
  const custoReuniaoPrev = mesPrev && rrPrev.data && gastoPrevMes ? gastoPrevMes / rrPrev.data : null;
  const campanhas: string[] = (cur.data?.campanhas ?? []).map((c: any) => (typeof c === "string" ? c : c?.campanha ?? c?.nome)).filter(Boolean);
  const loading = cur.isLoading;
  const semDados = !loading && n(t.gasto) === 0;

  const roasSub = t.roas_atribuido != null ? `Atribuído a anúncio: ${dec(n(t.roas_atribuido))}x · ${n(t.contratos_de_anuncio).toLocaleString("pt-BR")} contratos · ${brlKpi(t.faturamento_de_anuncio)}` : undefined;
  const tiles: Tile[] = [
    { l: "Gasto", v: brlKpi(t.gasto), full: brlFull(t.gasto), cur: n(t.gasto), prev: n(pt.gasto), inverso: true },
    { l: "CPM", v: brlKpi(t.cpm), full: brlFull(t.cpm), cur: n(t.cpm), prev: n(pt.cpm), inverso: true },
    { l: "CTR", v: t.ctr_pct != null ? `${dec(n(t.ctr_pct))}%` : "—", cur: n(t.ctr_pct), prev: n(pt.ctr_pct) },
    { l: "Conversas", v: numKpi(t.conversas), full: numFull(t.conversas), cur: n(t.conversas), prev: n(pt.conversas) },
    { l: "Custo/conversa", v: brlKpi(t.custo_conversa), full: brlFull(t.custo_conversa), cur: n(t.custo_conversa), prev: n(pt.custo_conversa), inverso: true },
    { l: "Custo/lead", v: brlKpi(t.custo_lead), full: brlFull(t.custo_lead), cur: n(t.custo_lead), prev: n(pt.custo_lead), inverso: true },
    {
      l: "Custo/reunião",
      v: custoReuniao != null ? brlKpi(custoReuniao) : "—",
      full: custoReuniao != null
        ? `${brlFull(custoReuniao)} · gasto do período ÷ reuniões realizadas do mês (pela data da reunião realizada, ou da reunião, ou da última mudança de etapa)`
        : pCamp ? "Disponível só sem filtro de campanha" : "Disponível só no mês",
      cur: custoReuniao ?? 0,
      prev: custoReuniaoPrev ?? 0,
      inverso: true,
      semSeta: custoReuniao == null || custoReuniaoPrev == null,
    },
    { l: "Leads", v: numKpi(t.leads), full: numFull(t.leads), cur: n(t.leads), prev: n(pt.leads) },
    { l: "Contratos", v: numKpi(t.contratos), full: numFull(t.contratos), cur: n(t.contratos), prev: n(pt.contratos), real: true },
    { l: "CAC", v: n(t.cac) ? brlKpi(t.cac) : "—", full: brlFull(t.cac), cur: n(t.cac), prev: n(pt.cac), inverso: true, real: true },
    { l: "Faturamento", v: brlKpi(t.faturamento), full: brlFull(t.faturamento), cur: n(t.faturamento), prev: n(pt.faturamento), real: true },
    { l: "ROAS", v: n(t.roas) ? `${dec(n(t.roas))}x` : "—", cur: n(t.roas), prev: n(pt.roas), real: true, sub: roasSub },
  ];

  // Funil
  const cliques = t.cliques != null ? n(t.cliques) : Math.round(n(t.impressoes) * n(t.ctr_pct) / 100);
  const etapas = [
    { l: "Impressões", v: n(t.impressoes) },
    { l: "Cliques", v: cliques },
    { l: "Conversas", v: n(t.conversas) },
    { l: "Leads", v: n(t.leads) },
    { l: "Reuniões marcadas", v: n(t.reunioes_agendadas) },
    { l: "Reuniões realizadas", v: n(t.reunioes_realizadas) },
    { l: "Contratos", v: n(t.contratos) },
  ];
  const first = etapas[0].v, last = etapas[etapas.length - 1].v;
  const useLog = last > 0 ? first / last > 50 : first > 50;
  const widthOf = (v: number) => {
    if (!first || !v) return 0;
    return useLog ? Math.max(4, (Math.log10(v + 1) / Math.log10(first + 1)) * 100) : Math.max(4, (v / first) * 100);
  };
  const passagens = etapas.slice(0, -1).map((e, i) => (e.v > 0 ? etapas[i + 1].v / e.v : null));
  let gargalo = -1, pior = Infinity;
  passagens.forEach((p, i) => { if (p != null && p < pior) { pior = p; gargalo = i; } });

  const invest = n(t.gasto), fat = n(t.faturamento);
  const lucro = fat - invest;
  const roi = invest > 0 ? (lucro / invest) * 100 : 0;
  const maxIF = Math.max(invest, fat, 1);

  const criativos = lista.data ?? [];
  const melhores = [...criativos].filter((c) => n(c.contratos) >= 1).sort((a, b) => n(b.roas) - n(a.roas)).slice(0, 3);
  const piores = [...criativos].filter((c) => n(c.contratos) === 0 && n(c.gasto) > 0).sort((a, b) => n(b.gasto) - n(a.gasto)).slice(0, 3);

  return (
    <section className="mkt-section space-y-5">
      {/* A. Título + filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="mkt-title">Marketing</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-foreground/10 p-0.5">
            {([["7", "7d"], ["14", "14d"], ["mes", "Mês"], ["anterior", "Mês anterior"]] as const).map(([k, l]) => {
              const p = atalho(k);
              const on = p.desde === periodo.desde && p.ate === periodo.ate;
              return <button key={k} onClick={() => setPeriodo(p)} className={cn("px-2.5 py-1 text-xs rounded", on ? "bg-mkt-gold/15 text-mkt-gold" : "text-mkt-muted hover:text-mkt-text")}>{l}</button>;
            })}
          </div>
          <PeriodPicker value={periodo} onChange={setPeriodo} />
          <Select value={camp} onValueChange={setCamp}>
            <SelectTrigger className="h-9 w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas as campanhas</SelectItem>
              {campanhas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* B. KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {tiles.map((k) => (
          <div key={k.l} className={cn(k.real ? "mkt-card-gold" : "mkt-card", "!p-4")}>
            <p className="mkt-label">{k.l}</p>
            {loading ? <Skeleton className="h-8 w-24 mt-2" /> : <p title={k.full ?? k.v} style={KPI_VALUE_STYLE} className={cn("mkt-value mt-1", KPI_VALUE_CLASS, k.real && "text-mkt-gold")}>{k.v}</p>}
            {k.sub && !loading && <p className="text-[10px] text-mkt-muted mt-0.5 leading-snug">{k.sub}</p>}
            <div className="mt-1.5 h-5">{!loading && !prev.isLoading && !k.semSeta && <Chip cur={k.cur} prev={k.prev} inverso={k.inverso} />}</div>
          </div>
        ))}
      </div>
      {t.aviso && <p className="text-[11px] text-mkt-muted -mt-2">{t.aviso}</p>}

      {/* C. Gráfico diário */}
      <div className="mkt-card">
        <div className="h-[220px] sm:h-[280px]">
          {loading ? <Skeleton className="h-full w-full" /> : semDados ? (
            <div className="flex h-full items-center justify-center text-sm text-mkt-muted">Sem gasto no período</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={(cur.data?.serie_diaria ?? []).map((d: any) => ({ ...d, cc: n(d.conversas) ? n(d.gasto) / n(d.conversas) : null }))}>
                <defs>
                  <linearGradient id="mktConv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TEXT} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={TEXT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={TRACK} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dia" tickFormatter={diaLabel} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: MUTED }} />
                <YAxis yAxisId="g" axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${compact(v)}`} tick={{ fontSize: 11, fill: MUTED }} />
                <YAxis yAxisId="c" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: MUTED }} />
                <Legend verticalAlign="top" align="right" height={24} iconSize={8} wrapperStyle={{ fontSize: 11, color: MUTED }} />
                <Tooltip
                  cursor={{ fill: "hsl(0 0% 100% / 0.03)" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-md border border-mkt-gold/40 bg-mkt-track px-3 py-2 text-xs text-mkt-text space-y-0.5">
                        <p className="text-mkt-muted">{diaLabel(String(label))}</p>
                        <p>Gasto: <b>{brl(d.gasto)}</b></p>
                        <p>Conversas: <b>{n(d.conversas).toLocaleString("pt-BR")}</b></p>
                        <p>Custo/conversa: <b>{d.cc ? brl(d.cc) : "—"}</b></p>
                      </div>
                    );
                  }}
                />
                <Bar yAxisId="g" dataKey="gasto" name="Gasto" fill={GOLD} fillOpacity={0.7} radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Area yAxisId="c" dataKey="conversas" type="monotone" stroke="none" fill="url(#mktConv)" legendType="none" tooltipType="none" />
                <Line yAxisId="c" dataKey="conversas" name="Conversas" type="monotone" stroke={TEXT} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* D. Funil + Retorno */}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="mkt-card">
          <p className="mkt-label mb-4">Funil</p>
          {loading ? <div className="space-y-2">{etapas.map((e) => <Skeleton key={e.l} className="h-7 w-full" />)}</div> : semDados ? (
            <p className="py-10 text-center text-sm text-mkt-muted">Sem gasto no período</p>
          ) : (
            <div className="space-y-2">
              {etapas.map((e, i) => {
                const isG = i === gargalo + 1 && gargalo >= 0;
                return (
                  <div key={e.l} className="flex items-center gap-3">
                    <span className="w-24 sm:w-36 shrink-0 text-xs text-mkt-muted">{e.l}</span>
                    <div className="flex-1 min-w-0">
                      <div className={cn("h-7 rounded-md flex items-center px-2 min-w-[56px]", isG ? "bg-mkt-bad" : "bg-mkt-gold/80")} style={{ width: `${widthOf(e.v)}%` }}>
                        <span className="text-xs font-semibold tabular-nums text-mkt-bg" style={{ color: "hsl(var(--mkt-bg))" }}>{compact(e.v)}</span>
                      </div>
                    </div>
                    <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-mkt-muted">
                      {isG && <span className="mr-1 rounded bg-mkt-bad/15 px-1 text-[9px] font-semibold tracking-wider text-mkt-bad">GARGALO</span>}
                      {i < passagens.length && passagens[i] != null ? `${dec(passagens[i]! * 100, 1)}%` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mkt-card-gold flex flex-col justify-between gap-5">
          <div>
            <p className="mkt-label">Retorno</p>
            {loading ? <Skeleton className="h-12 w-32 mt-2" /> : <p className="mkt-value text-[48px] leading-none mt-2 text-mkt-gold">{n(t.roas) ? `${dec(n(t.roas))}x` : "—"}</p>}
            <p className="text-[11px] text-mkt-muted mt-1">ROAS geral</p>
            {roasSub && <p className="text-[11px] text-mkt-muted mt-1">{roasSub}</p>}
          </div>
          <div className="space-y-2">
            <p className="mkt-label">Investimento x Faturamento</p>
            {[{ l: "Investimento", v: invest, c: "bg-mkt-muted" }, { l: "Faturamento", v: fat, c: "bg-mkt-gold" }].map((b) => (
              <div key={b.l} className="space-y-1">
                <div className="flex justify-between text-xs"><span className="text-mkt-muted">{b.l}</span><span className="mkt-value">{brl(b.v)}</span></div>
                <div className="h-1.5 rounded-full bg-mkt-track overflow-hidden"><div className={cn("h-full rounded-full", b.c)} style={{ width: `${(b.v / maxIF) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-t border-mkt-gold/20 pt-3 text-sm">
            <span className="text-mkt-muted">Lucro bruto: <b className={cn("tabular-nums", lucro >= 0 ? "text-mkt-text" : "text-mkt-bad")}>{brl(lucro)}</b></span>
            <span className="text-mkt-muted">ROI <b className="tabular-nums text-mkt-text">{invest > 0 ? `${dec(roi, 0)}%` : "—"}</b></span>
          </div>
        </div>
      </div>

      {/* E. Top e piores */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[{ t: "Melhores do período", l: melhores }, { t: "Gastando sem retorno", l: piores }].map((g) => (
          <div key={g.t} className="mkt-card">
            <div className="mb-3 flex items-center justify-between">
              <p className="mkt-label">{g.t}</p>
              <Link to="/criativos" className="flex items-center gap-1 text-xs text-mkt-gold hover:underline">Ver todos os criativos <ArrowRight className="h-3 w-3" /></Link>
            </div>
            {lista.isLoading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div> : g.l.length === 0 ? (
              <p className="py-6 text-center text-xs text-mkt-muted">Nenhum criativo nesta faixa.</p>
            ) : (
              <div className="space-y-2">
                {g.l.map((c) => (
                  <div key={c.ad_id ?? c.nome} className="flex items-center gap-3 rounded-lg border border-foreground/5 p-2">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-mkt-track">{c.thumb_url && <img src={c.thumb_url} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-mkt-text" title={c.nome}>{c.nome}</p>
                      <p className="text-[11px] text-mkt-muted">Gasto {brl(c.gasto)}</p>
                    </div>
                    <div className="text-right text-xs tabular-nums">
                      <p className="text-mkt-muted">CAC <span className="text-mkt-text">{n(c.cac) ? brl(c.cac) : "—"}</span></p>
                      <p className="text-mkt-muted">ROAS <span className={n(c.roas) >= 2 ? "text-mkt-good" : n(c.roas) >= 1 ? "text-mkt-warn" : n(c.roas) > 0 ? "text-mkt-bad" : "text-mkt-muted"}>{n(c.roas) ? `${dec(n(c.roas))}x` : "—"}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
