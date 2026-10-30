import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Sparkles, AlertTriangle } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentChat } from "@/components/agentes/AgentesContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MetricBar } from "@/components/MetricBar";

type Criativo = Record<string, any> & { nome: string; ad_id: string };

import { brlKpi, numKpi, brlFull, numFull, KPI_VALUE_STYLE, KPI_VALUE_CLASS } from "@/lib/kpiFormat";
const brl = (v: any) => (v == null || isNaN(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const num = (v: any) => (v == null ? "—" : Number(v).toLocaleString("pt-BR"));
const dec = (v: any, d = 2) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pctf = (v: any) => (v == null ? "—" : `${dec(v)}%`);
const compact = (v: any) => {
  const n = Number(v ?? 0);
  if (n >= 1e6) return `${dec(n / 1e6, 1)}mi`;
  if (n >= 1e3) return `${dec(n / 1e3, 1)}k`;
  return num(n);
};
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hojeSP = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return new Date(Number(p.year), Number(p.month) - 1, Number(p.day));
};
const br = (s: string) => s.split("-").reverse().join("/");

type Atalho = "7" | "14" | "30" | "mes" | "anterior";
const periodoDe = (a: Atalho) => {
  const t = hojeSP();
  if (a === "mes") return { ini: iso(new Date(t.getFullYear(), t.getMonth(), 1)), fim: iso(t) };
  if (a === "anterior") return { ini: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), fim: iso(new Date(t.getFullYear(), t.getMonth(), 0)) };
  const s = new Date(t); s.setDate(s.getDate() - (Number(a) - 1));
  return { ini: iso(s), fim: iso(t) };
};

const SORTS = {
  gasto: { label: "Gasto", fn: (c: Criativo) => -Number(c.gasto ?? 0) },
  roas: { label: "ROAS", fn: (c: Criativo) => -Number(c.roas ?? -1) },
  cac: { label: "CAC (menor primeiro)", fn: (c: Criativo) => (c.cac ? Number(c.cac) : Infinity) },
  contratos: { label: "Contratos", fn: (c: Criativo) => -Number(c.contratos ?? 0) },
  custo_conversa: { label: "Custo/conversa (menor primeiro)", fn: (c: Criativo) => (c.custo_conversa ? Number(c.custo_conversa) : Infinity) },
  hook: { label: "Hook rate", fn: (c: Criativo) => -Number(c.hook_rate_pct ?? -1) },
} as const;

/** verde = melhor que média; âmbar = até 20% pior; vermelho = >20% pior */
const sinal = (v: number | null, media: number, menorMelhor: boolean) => {
  if (v == null || !media) return "bg-muted-foreground/40";
  const pior = menorMelhor ? (v - media) / media : (media - v) / media;
  if (pior <= 0) return "bg-success";
  if (pior <= 0.2) return "bg-warning";
  return "bg-destructive";
};

const roasPill = (r: any) => {
  if (r == null || Number(r) === 0) return <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-muted text-muted-foreground">—</span>;
  const n = Number(r);
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", n >= 2 ? "bg-success/20 text-success" : n >= 1 ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive")}>{dec(n)}x</span>;
};

export default function Criativos() {
  const { isAdmin } = useAuth();
  const { openChat } = useAgentChat();
  const [atalho, setAtalho] = useState<Atalho>("mes");
  const { ini, fim } = useMemo(() => periodoDe(atalho), [atalho]);
  const [campanha, setCampanha] = useState<string>("__all");
  const [ordem, setOrdem] = useState<keyof typeof SORTS>("gasto");
  const [soAtivos, setSoAtivos] = useState(false);
  const [aberto, setAberto] = useState<Criativo | null>(null);
  const pCamp = campanha === "__all" ? null : campanha;

  const resumoQ = useQuery({
    placeholderData: keepPreviousData,
    queryKey: ["mkt-criativos-resumo", ini, fim, pCamp],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("mkt_criativos_resumo", { p_inicio: ini, p_fim: fim, p_campanha: pCamp });
      if (error) throw error;
      return data as { totais: Record<string, any>; serie_diaria: any[]; campanhas: any[] };
    },
  });
  const listQ = useQuery({
    placeholderData: keepPreviousData,
    queryKey: ["mkt-criativos", ini, fim, pCamp],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("mkt_criativos", { p_inicio: ini, p_fim: fim, p_campanha: pCamp });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as Criativo[];
    },
  });

  const t = resumoQ.data?.totais ?? {};
  const campanhas: string[] = (resumoQ.data?.campanhas ?? []).map((c: any) => (typeof c === "string" ? c : c?.campanha ?? c?.nome)).filter(Boolean);

  const lista = useMemo(() => {
    let l = [...(listQ.data ?? [])];
    if (soAtivos) l = l.filter((c) => c.status === "ACTIVE");
    return l.sort((a, b) => SORTS[ordem].fn(a) - SORTS[ordem].fn(b));
  }, [listQ.data, soAtivos, ordem]);

  // médias ponderadas da seleção
  const medias = useMemo(() => {
    const l = listQ.data ?? [];
    const s = (k: string) => l.reduce((a, c) => a + Number(c[k] ?? 0), 0);
    const imp = s("impressoes"), gasto = s("gasto"), conv = s("conversas");
    const vids = l.filter((c) => c.formato === "video");
    const impV = vids.reduce((a, c) => a + Number(c.impressoes ?? 0), 0);
    return {
      cpm: imp ? (gasto / imp) * 1000 : 0,
      ctr: imp ? l.reduce((a, c) => a + Number(c.ctr_pct ?? 0) * Number(c.impressoes ?? 0), 0) / imp : 0,
      hook: impV ? vids.reduce((a, c) => a + Number(c.hook_rate_pct ?? 0) * Number(c.impressoes ?? 0), 0) / impV : 0,
      cc: conv ? gasto / conv : 0,
    };
  }, [listQ.data]);

  const kpis: { l: string; v: string; full?: string; sub?: string; real?: boolean }[] = [
    { l: "Gasto", v: brlKpi(t.gasto), full: brlFull(t.gasto) },
    { l: "Conversas", v: numKpi(t.conversas), full: numFull(t.conversas) },
    { l: "Custo/conversa", v: brlKpi(t.custo_conversa), full: brlFull(t.custo_conversa) },
    { l: "Leads (Farol)", v: numKpi(t.leads), full: numFull(t.leads) },
    { l: "Reuniões realizadas", v: numKpi(t.reunioes_realizadas), full: numFull(t.reunioes_realizadas) },
    { l: "Custo/reunião", v: brlKpi(t.custo_reuniao), full: brlFull(t.custo_reuniao) },
    { l: "Contratos", v: numKpi(t.contratos), full: numFull(t.contratos), real: true },
    { l: "CAC", v: brlKpi(t.cac), full: brlFull(t.cac), real: true },
    { l: "Faturamento", v: brlKpi(t.faturamento), full: brlFull(t.faturamento), real: true },
    { l: "ROAS", v: t.roas ? `${dec(t.roas)}x` : "—", real: true, sub: t.roas_atribuido != null ? `Atribuído a anúncio: ${dec(t.roas_atribuido)}x · ${num(t.contratos_de_anuncio ?? 0)} contratos · ${brlKpi(t.faturamento_de_anuncio)}` : undefined },
  ];

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-serif-display text-2xl text-foreground">Criativos</h1>
            <p className="text-xs text-muted-foreground">{br(ini)} – {br(fim)} · Meta + Farol</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-border p-0.5">
              {([["7", "7d"], ["14", "14d"], ["30", "30d"], ["mes", "Mês"], ["anterior", "Mês anterior"]] as [Atalho, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setAtalho(k)} className={cn("px-2.5 py-1 text-xs rounded", atalho === k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>{l}</button>
              ))}
            </div>
            <Select value={campanha} onValueChange={setCampanha}>
              <SelectTrigger className="h-9 w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas as campanhas</SelectItem>
                {campanhas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs */}
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {kpis.map((k) => (
              <div key={k.l} className={cn("rounded-lg border p-3", k.real ? "bg-primary/10 border-primary/30" : "bg-card border-border")}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.l}</p>
                {resumoQ.isLoading ? <Skeleton className="h-6 w-20 mt-1" /> : <p title={k.full ?? k.v} style={KPI_VALUE_STYLE} className={cn("font-semibold", KPI_VALUE_CLASS, k.real ? "text-primary" : "text-foreground")}>{k.v}</p>}
                {k.sub && !resumoQ.isLoading && <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{k.sub}</p>}
              </div>
            ))}
          </div>
          {t.aviso && <p className="mt-2 text-[11px] text-muted-foreground">{t.aviso}</p>}
        </div>

        {/* Série diária */}
        <div className="rounded-lg border border-border bg-card p-4 h-64">
          {resumoQ.isLoading ? <Skeleton className="h-full w-full" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={resumoQ.data?.serie_diaria ?? []}>
                <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="dia" tickFormatter={(d) => String(d).slice(8, 10) + "/" + String(d).slice(5, 7)} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis yAxisId="g" tickFormatter={(v) => `R$ ${compact(v)}`} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis yAxisId="c" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: any, n: any) => (n === "Gasto" ? brl(v) : num(v))} labelFormatter={(d) => br(String(d))} />
                <Bar yAxisId="g" dataKey="gasto" name="Gasto" fill="hsl(var(--primary))" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
                <Line yAxisId="c" dataKey="conversas" name="Conversas" stroke="hsl(var(--foreground))" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Controles do grid */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">Ordenar por</span>
          <Select value={ordem} onValueChange={(v) => setOrdem(v as keyof typeof SORTS)}>
            <SelectTrigger className="h-9 w-[230px]"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(SORTS).map(([k, s]) => <SelectItem key={k} value={k}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={soAtivos} onCheckedChange={setSoAtivos} /> Só ativos</label>
          <span className="ml-auto text-xs text-muted-foreground">{lista.length} criativos</span>
        </div>

        {listQ.isError ? (
          <div className="text-center py-10 space-y-2"><p className="text-sm text-muted-foreground">Não foi possível carregar os criativos.</p><Button size="sm" variant="outline" onClick={() => listQ.refetch()}>Tentar de novo</Button></div>
        ) : listQ.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[520px]" />)}</div>
        ) : lista.length === 0 ? (
          <p className="text-center py-10 text-sm text-muted-foreground">Nenhum criativo no período.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {lista.map((c) => <CriativoCard key={c.ad_id ?? c.nome} c={c} medias={medias} onClick={() => setAberto(c)} />)}
          </div>
        )}
      </div>

      <CriativoModal c={aberto} onClose={() => setAberto(null)} ini={ini} fim={fim} isAdmin={isAdmin}
        onEcho={(c) => { setAberto(null); openChat("marketing", `Analise o criativo '${c.nome}' no período ${br(ini)}–${br(fim)}: o que manter, o que mudar e se devo escalar ou pausar.`); }} />
    </div>
  );
}

function CriativoCard({ c, medias, onClick }: { c: Criativo; medias: any; onClick: () => void }) {
  const ativo = c.status === "ACTIVE";
  const nz = (v: any) => (v == null ? null : Number(v));
  return (
    <button onClick={onClick} className="text-left rounded-lg border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors">
      <div className="relative aspect-[4/5] bg-muted">
        {c.thumb_url && <img src={c.thumb_url} alt={c.nome} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
        {c.formato === "video" && <>
          <div className="absolute inset-0 flex items-center justify-center"><div className="rounded-full bg-background/60 p-3"><Play className="h-6 w-6 text-foreground" fill="currentColor" /></div></div>
          <span className="absolute top-2 right-2 rounded bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-foreground">VÍDEO</span>
        </>}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/80 to-transparent p-3 pt-10">
          <p className="text-sm font-medium text-foreground line-clamp-2">{c.nome}</p>
          <div className="mt-1.5 flex gap-1.5">
            <span className="max-w-[60%] truncate rounded-full bg-muted/80 px-2 py-0.5 text-[10px] text-muted-foreground">{c.campanha ?? "—"}</span>
            <span className="flex items-center gap-1 rounded-full bg-muted/80 px-2 py-0.5 text-[10px] text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", ativo ? "bg-success" : "bg-muted-foreground")} />{ativo ? "ATIVO" : "PAUSADO"}</span>
          </div>
        </div>
      </div>
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gasto</p><p className="font-semibold tabular-nums">{brl(c.gasto)}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Impressões</p><p className="font-semibold tabular-nums">{compact(c.impressoes)}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-md bg-primary/10 border border-primary/20 p-2">
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">ROAS</p>{roasPill(c.roas)}</div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">CAC</p><p className="text-sm font-semibold tabular-nums">{c.cac ? brl(c.cac) : "—"}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Contratos</p><p className="text-sm font-semibold tabular-nums">{num(c.contratos ?? 0)}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Reuniões</p><p className="text-sm font-semibold tabular-nums">{num(c.reunioes_realizadas ?? 0)}</p></div>
        </div>
        <div className="space-y-1.5">
          <MetricBar label="CPM" valor={nz(c.cpm)} texto={brl(c.cpm)} media={medias.cpm} menorMelhor />
          <MetricBar label="CTR" valor={nz(c.ctr_pct)} texto={pctf(c.ctr_pct)} media={medias.ctr} menorMelhor={false} />
          {c.formato === "video" && <MetricBar label="Hook rate" valor={nz(c.hook_rate_pct)} texto={pctf(c.hook_rate_pct)} media={medias.hook} menorMelhor={false} />}
          <MetricBar label="Custo/conv." valor={nz(c.custo_conversa)} texto={brl(c.custo_conversa)} media={medias.cc} menorMelhor />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
          <span>{num(c.leads ?? 0)} leads · {c.custo_lead ? brl(c.custo_lead) : "—"}/lead</span>
          {Number(c.leads ?? 0) < 10 && <span className="flex items-center gap-1 text-warning"><AlertTriangle className="h-3 w-3" />amostra pequena</span>}
        </div>
      </div>
    </button>
  );
}

const FORMATOS = [
  { k: "INSTAGRAM_REELS", l: "Reels" },
  { k: "MOBILE_FEED_STANDARD", l: "Feed" },
  { k: "INSTAGRAM_STORY", l: "Stories" },
  { k: "INSTAGRAM_STANDARD", l: "Instagram" },
];

function CriativoModal({ c, onClose, ini, fim, isAdmin, onEcho }: { c: Criativo | null; onClose: () => void; ini: string; fim: string; isAdmin: boolean; onEcho: (c: Criativo) => void }) {
  const [fmt, setFmt] = useState("MOBILE_FEED_STANDARD");
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => { if (c) setFmt(c.formato === "video" ? "INSTAGRAM_REELS" : "MOBILE_FEED_STANDARD"); }, [c]);
  useEffect(() => {
    if (!c) return;
    let cancel = false;
    setLoading(true); setErro(false); setSrc(null);
    supabase.functions.invoke("meta-ad-preview", { body: { ad_id: c.ad_id, formato: fmt } }).then(({ data, error }) => {
      if (cancel) return;
      if (error || !data?.iframe_src) setErro(true); else setSrc(data.iframe_src);
      setLoading(false);
    });
    return () => { cancel = true; };
  }, [c, fmt]);

  if (!c) return null;
  const Row = ({ l, v }: { l: string; v: string }) => <div className="flex justify-between py-1 text-sm border-b border-border/50"><span className="text-muted-foreground">{l}</span><span className="tabular-nums text-foreground">{v}</span></div>;
  const etapas = [["Conversas", c.conversas], ["Leads", c.leads], ["Reuniões realizadas", c.reunioes_realizadas], ["Contratos", c.contratos]] as [string, any][];
  const max = Math.max(1, ...etapas.map((e) => Number(e[1] ?? 0)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[1100px] w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogTitle className="font-serif-display text-lg pr-8">{c.nome}</DialogTitle>
        <div className="grid gap-6 md:grid-cols-[380px_1fr]">
          <div className="space-y-2">
            <div className="flex gap-1">
              {FORMATOS.map((f) => <button key={f.k} onClick={() => setFmt(f.k)} className={cn("px-2.5 py-1 text-xs rounded", fmt === f.k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>{f.l}</button>)}
            </div>
            <div className="relative h-[600px] rounded-md border border-border bg-muted overflow-hidden">
              {loading && <Skeleton className="absolute inset-0" />}
              {!loading && src && <iframe src={src} allow="autoplay" className="h-full w-full border-0" title="Preview do anúncio" />}
              {!loading && erro && (
                <div className="relative h-full">
                  {c.thumb_url && <img src={c.thumb_url} alt="" className="h-full w-full object-cover opacity-60" />}
                  <p className="absolute inset-x-0 bottom-4 text-center text-xs text-muted-foreground">Preview indisponível neste formato</p>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            {isAdmin && <Button size="sm" variant="outline" className="border-primary/40 text-primary" onClick={() => onEcho(c)}><Sparkles /> Perguntar ao Echo</Button>}
            <Tabs defaultValue="metricas">
              <TabsList><TabsTrigger value="metricas">Métricas</TabsTrigger><TabsTrigger value="copy">Copy</TabsTrigger></TabsList>
              <TabsContent value="metricas" className="space-y-4">
                <div className="space-y-2">
                  {etapas.map(([l, v], i) => {
                    const prev = i > 0 ? Number(etapas[i - 1][1] ?? 0) : 0;
                    return (
                      <div key={l} className="flex items-center gap-2 text-xs">
                        <span className="w-32 text-muted-foreground">{l}</span>
                        <div className="flex-1 h-5 bg-muted rounded"><div className="h-full rounded bg-primary/60" style={{ width: `${(Number(v ?? 0) / max) * 100}%` }} /></div>
                        <span className="w-12 text-right tabular-nums">{num(v ?? 0)}</span>
                        <span className="w-14 text-right tabular-nums text-muted-foreground">{i > 0 ? (prev > 0 ? `${dec((Number(v ?? 0) / prev) * 100, 1)}%` : "—") : ""}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div><p className="text-[10px] uppercase tracking-wider text-primary mb-1">Atenção</p>
                    <Row l="Impressões" v={num(c.impressoes)} /><Row l="Alcance" v={num(c.alcance)} /><Row l="Frequência" v={c.frequencia ? `${dec(c.frequencia)}x` : "—"} /><Row l="CPM" v={brl(c.cpm)} /><Row l="CTR" v={pctf(c.ctr_pct)} /><Row l="CTR link" v={pctf(c.ctr_link_pct)} /><Row l="Hook rate" v={pctf(c.hook_rate_pct)} /><Row l="Hold rate" v={pctf(c.hold_rate_pct)} />
                  </div>
                  <div><p className="text-[10px] uppercase tracking-wider text-primary mb-1">Conversa</p>
                    <Row l="Conversas" v={num(c.conversas)} /><Row l="Custo/conversa" v={brl(c.custo_conversa)} /><Row l="Leads" v={num(c.leads)} /><Row l="Custo/lead" v={brl(c.custo_lead)} />
                  </div>
                  <div><p className="text-[10px] uppercase tracking-wider text-primary mb-1">Resultado</p>
                    <Row l="Reuniões agendadas" v={num(c.reunioes_agendadas)} /><Row l="Reuniões realizadas" v={num(c.reunioes_realizadas)} /><Row l="Custo/reunião" v={brl(c.custo_reuniao)} /><Row l="Contratos" v={num(c.contratos)} /><Row l="Faturamento" v={brl(c.faturamento)} /><Row l="CAC" v={brl(c.cac)} /><Row l="ROAS" v={c.roas ? `${dec(c.roas)}x` : "—"} />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">{num(c.dias_ativos)} dias ativos · último gasto em {c.ultimo_dia_com_gasto ? br(String(c.ultimo_dia_com_gasto).slice(0, 10)) : "—"} · {c.conjunto ?? ""}</p>
              </TabsContent>
              <TabsContent value="copy" className="space-y-3">
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Título</p><p className="text-sm whitespace-pre-line">{c.titulo || "—"}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Texto</p><p className="text-sm whitespace-pre-line">{c.texto || "—"}</p></div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
