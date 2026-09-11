import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, RotateCcw, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/data/marketingData";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Agrupamento,
  defaultPeriodoFunil,
  FilterOption,
  FunilCriativoFilters,
  PeriodoFunil,
} from "@/components/FunilCriativoFilters";

interface FunilCriativoRow {
  grupo: string;
  leads: number;
  fez_contato: number;
  conectado: number;
  sql: number;
  reuniao_agendada: number;
  reuniao_realizada: number;
  link_enviado: number;
  contrato_assinado: number;
  faturamento: number;
  gasto: number | null;
  cpl: number | null;
  cac: number | null;
  campanhas_distintas: number;
}

interface FunilFiltroRow {
  campanha: string | null;
  conjunto: string | null;
  criativo: string | null;
  leads: number;
  contratos: number;
}

const STAGES = [
  { key: "leads", label: "Leads" },
  { key: "fez_contato", label: "Fez Contato" },
  { key: "conectado", label: "Conectado" },
  { key: "sql", label: "SQL" },
  { key: "reuniao_agendada", label: "Reunião Agendada" },
  { key: "reuniao_realizada", label: "Reunião Realizada" },
  { key: "link_enviado", label: "Link Enviado" },
  { key: "contrato_assinado", label: "Contrato Assinado" },
] as const;

const SEM_ATRIBUICAO = "(sem atribuição de anúncio)";

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const fmtPct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

type SortKey = "grupo" | "leads" | "fez_contato" | "conectado" | "sql" | "reuniao_agendada" | "reuniao_realizada" | "link_enviado" | "contrato_assinado" | "conv" | "faturamento" | "gasto" | "cpl" | "cac" | "campanhas_distintas";

const readArrayParam = (value: string | null) => {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return value.split(",").filter(Boolean);
  }
};

const validDate = (value: string | null) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

const normalizeRow = (row: Record<string, unknown>): FunilCriativoRow => ({
  grupo: String(row.grupo ?? SEM_ATRIBUICAO),
  leads: Number(row.leads ?? 0),
  fez_contato: Number(row.fez_contato ?? 0),
  conectado: Number(row.conectado ?? 0),
  sql: Number(row.sql ?? 0),
  reuniao_agendada: Number(row.reuniao_agendada ?? 0),
  reuniao_realizada: Number(row.reuniao_realizada ?? 0),
  link_enviado: Number(row.link_enviado ?? 0),
  contrato_assinado: Number(row.contrato_assinado ?? 0),
  faturamento: Number(row.faturamento ?? 0),
  gasto: row.gasto == null ? null : Number(row.gasto),
  cpl: row.cpl == null ? null : Number(row.cpl),
  cac: row.cac == null ? null : Number(row.cac),
  campanhas_distintas: Number(row.campanhas_distintas ?? 0),
});

const emptyTotal = (): FunilCriativoRow => ({
  grupo: "TOTAL DA SELEÇÃO", leads: 0, fez_contato: 0, conectado: 0, sql: 0,
  reuniao_agendada: 0, reuniao_realizada: 0, link_enviado: 0, contrato_assinado: 0,
  faturamento: 0, gasto: 0, cpl: 0, cac: 0, campanhas_distintas: 0,
});

const totalRows = (rows: FunilCriativoRow[]) => {
  const total = emptyTotal();
  for (const row of rows) {
    for (const stage of STAGES) total[stage.key] += row[stage.key];
    total.faturamento += row.faturamento;
    total.gasto = Number(total.gasto ?? 0) + Number(row.gasto ?? 0);
  }
  total.cpl = total.leads > 0 ? Number(total.gasto) / total.leads : 0;
  total.cac = total.contrato_assinado > 0 ? Number(total.gasto) / total.contrato_assinado : 0;
  return total;
};

const makeOptions = (rows: FunilFiltroRow[], key: "campanha" | "conjunto" | "criativo"): FilterOption[] => {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const name = row[key];
    if (name) totals.set(name, (totals.get(name) ?? 0) + Number(row.leads ?? 0));
  }
  return [...totals].map(([name, leads]) => ({ name, leads })).sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name));
};

const useDebounced = <T,>(value: T, delay: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

export const FunilCriativo = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaults = useMemo(defaultPeriodoFunil, []);
  const initialDesde = searchParams.get("desde");
  const initialAte = searchParams.get("ate");
  const [periodo, setPeriodo] = useState<PeriodoFunil>({
    desde: validDate(initialDesde) && String(initialDesde) >= "2026-04-01" ? String(initialDesde) : defaults.desde,
    ate: validDate(initialAte) && String(initialAte) >= "2026-04-01" ? String(initialAte) : defaults.ate,
  });
  const [campanhas, setCampanhas] = useState(() => readArrayParam(searchParams.get("camp")));
  const [conjuntos, setConjuntos] = useState(() => readArrayParam(searchParams.get("conj")));
  const [criativos, setCriativos] = useState(() => readArrayParam(searchParams.get("cri")));
  const initialAgrupar = searchParams.get("agrupar");
  const [agrupamento, setAgrupamento] = useState<Agrupamento>(initialAgrupar === "campanha" || initialAgrupar === "conjunto" ? initialAgrupar : "criativo");
  const [focused, setFocused] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("leads");
  const [sortAsc, setSortAsc] = useState(false);

  const filterState = useMemo(() => ({ campanhas, conjuntos, criativos }), [campanhas, conjuntos, criativos]);
  const debouncedFilters = useDebounced(filterState, 300);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set("desde", periodo.desde);
    next.set("ate", periodo.ate);
    next.set("agrupar", agrupamento);
    const setArray = (key: string, values: string[]) => values.length ? next.set(key, JSON.stringify(values)) : next.delete(key);
    setArray("camp", campanhas);
    setArray("conj", conjuntos);
    setArray("cri", criativos);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [agrupamento, campanhas, conjuntos, criativos, periodo, searchParams, setSearchParams]);

  const optionsQuery = useQuery({
    queryKey: ["funil-criativo-filtros", periodo.desde, periodo.ate],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("fn_funil_criativo_filtros", { p_desde: periodo.desde, p_ate: periodo.ate });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as FunilFiltroRow[];
    },
    staleTime: 60_000,
  });

  const rowsQuery = useQuery({
    queryKey: ["funil-criativo-v2", periodo.desde, periodo.ate, debouncedFilters.campanhas, debouncedFilters.conjuntos, debouncedFilters.criativos, agrupamento],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("fn_funil_criativo_v2", {
        p_desde: periodo.desde,
        p_ate: periodo.ate,
        p_campanhas: debouncedFilters.campanhas.length ? debouncedFilters.campanhas : null,
        p_conjuntos: debouncedFilters.conjuntos.length ? debouncedFilters.conjuntos : null,
        p_criativos: debouncedFilters.criativos.length ? debouncedFilters.criativos : null,
        p_agrupar: agrupamento,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data : []).map(normalizeRow);
    },
    staleTime: 60_000,
  });

  const optionRows = optionsQuery.data ?? [];
  const campaignOptions = useMemo(() => makeOptions(optionRows, "campanha"), [optionRows]);
  const cascadeByCampaign = useMemo(() => optionRows.filter((row) => campanhas.length === 0 || (row.campanha && campanhas.includes(row.campanha))), [optionRows, campanhas]);
  const setOptions = useMemo(() => makeOptions(cascadeByCampaign, "conjunto"), [cascadeByCampaign]);
  const cascadeBySet = useMemo(() => cascadeByCampaign.filter((row) => conjuntos.length === 0 || (row.conjunto && conjuntos.includes(row.conjunto))), [cascadeByCampaign, conjuntos]);
  const creativeOptions = useMemo(() => makeOptions(cascadeBySet, "criativo"), [cascadeBySet]);

  useEffect(() => {
    if (!optionsQuery.data) return;
    const validCampaigns = new Set(campaignOptions.map((option) => option.name));
    const validSets = new Set(setOptions.map((option) => option.name));
    const validCreatives = new Set(creativeOptions.map((option) => option.name));
    setCampanhas((current) => current.filter((item) => validCampaigns.has(item)));
    setConjuntos((current) => current.filter((item) => validSets.has(item)));
    setCriativos((current) => current.filter((item) => validCreatives.has(item)));
  }, [campaignOptions, creativeOptions, optionsQuery.data, setOptions]);

  useEffect(() => setFocused(null), [agrupamento, debouncedFilters, periodo]);

  const rows = rowsQuery.data ?? [];

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (a.grupo === SEM_ATRIBUICAO && b.grupo === SEM_ATRIBUICAO) return 0;
      if (a.grupo === SEM_ATRIBUICAO) return 1;
      if (b.grupo === SEM_ATRIBUICAO) return -1;
      if (sortKey === "grupo") {
        av = a.grupo ?? "";
        bv = b.grupo ?? "";
        return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      }
      if (sortKey === "conv") {
        av = pct(a.contrato_assinado, a.leads);
        bv = pct(b.contrato_assinado, b.leads);
      } else {
        av = Number(a[sortKey] ?? 0);
        bv = Number(b[sortKey] ?? 0);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [rows, sortKey, sortAsc]);

  const totals = useMemo(() => totalRows(rows), [rows]);

  const active: FunilCriativoRow | null = useMemo(() => {
    if (!focused) return totals;
    return rows.find((row) => row.grupo === focused) ?? totals;
  }, [focused, rows, totals]);

  const funnel = useMemo(() => {
    const topo = Number(active.leads ?? 0);
    return STAGES.map((s, i) => {
      const value = Number(active[s.key] ?? 0);
      const prev = i === 0 ? value : Number(active[STAGES[i - 1].key] ?? 0);
      return {
        label: s.label,
        value,
        pctTopo: pct(value, topo),
        pctStep: i === 0 ? 100 : pct(value, prev),
      };
    });
  }, [active]);

  // Maior gargalo: menor taxa step-to-step (ignora a primeira etapa)
  const gargaloIdx = useMemo(() => {
    let idx = -1;
    let worst = Infinity;
    funnel.forEach((f, i) => {
      if (i === 0) return;
      if (f.pctStep < worst) {
        worst = f.pctStep;
        idx = i;
      }
    });
    return idx;
  }, [funnel]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "grupo");
    }
  };

  const Th = ({ k, label, align = "right" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <th
      className={cn("h-10 whitespace-nowrap px-2 py-2 font-medium cursor-pointer select-none hover:text-foreground", align === "left" ? "text-left" : "text-right")}
      onClick={() => toggleSort(k)}
    >
      {label}
      {sortKey === k ? (sortAsc ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />) : <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />}
    </th>
  );

  const coverage = useMemo(() => {
    const total = optionRows.reduce((sum, row) => sum + Number(row.leads ?? 0), 0);
    const attributed = optionRows.reduce((sum, row) => sum + (row.criativo ? Number(row.leads ?? 0) : 0), 0);
    return total > 0 ? (attributed / total) * 100 : 0;
  }, [optionRows]);

  const recent = useMemo(() => {
    const end = new Date(`${periodo.ate}T12:00:00`);
    const nowParts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const current = Object.fromEntries(nowParts.map((part) => [part.type, part.value]));
    const today = new Date(`${current.year}-${current.month}-${current.day}T12:00:00`);
    return (today.getTime() - end.getTime()) / 86_400_000 < 15;
  }, [periodo.ate]);

  const hasSpendData = rows.some((row) => row.gasto != null);

  const clearFilters = () => {
    setCampanhas([]);
    setConjuntos([]);
    setCriativos([]);
    setFocused(null);
  };

  const metricCell = (value: number, currency = false) => currency ? formatCurrency(value) : formatNumber(value);
  const optionalCurrency = (value: number | null) => value == null ? "—" : formatCurrency(value);

  const loading = rowsQuery.isLoading || rowsQuery.isFetching;

  return (
    <section className="bg-card border border-border rounded-lg p-4 sm:p-6">
      <div className="mb-4 space-y-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Funil por Criativo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Leads que entraram de {new Date(`${periodo.desde}T12:00:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })} a {new Date(`${periodo.ate}T12:00:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · atribuição via Tintim</p>
        </div>
        <FunilCriativoFilters
          periodo={periodo}
          onPeriodoChange={setPeriodo}
          campanhas={campaignOptions}
          conjuntos={setOptions}
          criativos={creativeOptions}
          selectedCampanhas={campanhas}
          selectedConjuntos={conjuntos}
          selectedCriativos={criativos}
          onCampanhasChange={setCampanhas}
          onConjuntosChange={setConjuntos}
          onCriativosChange={setCriativos}
          agrupamento={agrupamento}
          onAgrupamentoChange={setAgrupamento}
        />
        <div className="space-y-1 text-[11px] text-muted-foreground">
          {optionsQuery.isLoading ? <Skeleton className="h-4 w-48" /> : (
            <p className={cn(coverage < 90 && "text-warning font-medium")}>
              {coverage < 90
                ? `Atribuição incompleta neste período — números por criativo podem estar distorcidos (${fmtPct(coverage)}).`
                : `Atribuição: ${fmtPct(coverage)} dos leads.`}
            </p>
          )}
          {recent && <p className="text-warning font-medium"><AlertTriangle className="mr-1 inline h-3 w-3" />Período recente: cerca de 1 em cada 5 vendas acontece mais de 7 dias depois da entrada do lead. A conversão deste recorte ainda vai subir.</p>}
          {agrupamento !== "campanha" && <p>Gasto disponível apenas por campanha.</p>}
          {agrupamento === "campanha" && !loading && !hasSpendData && <p className="text-warning font-medium">Não há dados de gasto disponíveis para este período.</p>}
        </div>
      </div>

      {rowsQuery.isError || optionsQuery.isError ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">Não foi possível carregar o funil.</p>
          <Button variant="outline" size="sm" onClick={() => { void rowsQuery.refetch(); void optionsQuery.refetch(); }}><RotateCcw />Tentar de novo</Button>
        </div>
      ) : !loading && rows.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">Nenhum lead de anúncio neste período com esses filtros.</p>
          <Button variant="outline" size="sm" onClick={clearFilters}>Limpar filtros</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)] gap-6">
          <div className="relative overflow-auto max-h-[500px] border border-border rounded-md">
            {loading ? (
              <div className="space-y-2 p-3">{Array.from({ length: 10 }, (_, index) => <Skeleton key={index} className="h-8 w-full" />)}</div>
            ) : (
            <table className="w-full min-w-[1160px] text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-muted-foreground text-xs">
                <tr>
                  <Th k="grupo" label={agrupamento === "campanha" ? "Campanha" : agrupamento === "conjunto" ? "Conjunto" : "Criativo"} align="left" />
                  <Th k="leads" label="Leads" />
                  <Th k="fez_contato" label="Contatados" />
                  <Th k="conectado" label="Conectados" />
                  <Th k="sql" label="SQL" />
                  <Th k="reuniao_agendada" label="Reuniões agendadas" />
                  <Th k="reuniao_realizada" label="Reuniões realizadas" />
                  <Th k="link_enviado" label="Links enviados" />
                  <Th k="contrato_assinado" label="Contratos" />
                  <Th k="conv" label="Conv." />
                  <Th k="faturamento" label="Faturamento" />
                  {agrupamento !== "campanha" && <Th k="campanhas_distintas" label="Campanhas" />}
                  {agrupamento === "campanha" && <><Th k="gasto" label="Gasto" /><Th k="cpl" label="CPL" /><Th k="cac" label="CAC" /></>}
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => {
                  const isSel = focused === r.grupo;
                  const neutro = r.grupo === SEM_ATRIBUICAO;
                  return (
                    <tr
                      key={r.grupo}
                      onClick={() => setFocused(isSel ? null : r.grupo)}
                      className={cn("border-t border-border cursor-pointer hover:bg-muted/40", isSel && "bg-muted/70")}
                    >
                      <td className={cn("px-2 py-2 max-w-[260px] truncate", neutro ? "text-muted-foreground italic" : "text-foreground")} title={r.grupo}>
                        {r.grupo}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{metricCell(r.leads)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{metricCell(r.fez_contato)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{metricCell(r.conectado)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{metricCell(r.sql)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{metricCell(r.reuniao_agendada)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{metricCell(r.reuniao_realizada)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{metricCell(r.link_enviado)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{metricCell(r.contrato_assinado)}</td>
                      <td className="px-2 py-2 text-right tabular-nums font-semibold">{fmtPct(pct(r.contrato_assinado, r.leads))}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{metricCell(r.faturamento, true)}</td>
                      {agrupamento !== "campanha" && <td className="px-2 py-2 text-right tabular-nums">{metricCell(r.campanhas_distintas)}</td>}
                      {agrupamento === "campanha" && <><td className="px-2 py-2 text-right tabular-nums">{optionalCurrency(r.gasto)}</td><td className="px-2 py-2 text-right tabular-nums">{optionalCurrency(r.cpl)}</td><td className="px-2 py-2 text-right tabular-nums">{optionalCurrency(r.cac)}</td></>}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 border-t bg-muted font-semibold">
                <tr>
                  <td className="px-2 py-2">Total</td>
                  <td className="px-2 py-2 text-right tabular-nums">{metricCell(totals.leads)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{metricCell(totals.fez_contato)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{metricCell(totals.conectado)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{metricCell(totals.sql)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{metricCell(totals.reuniao_agendada)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{metricCell(totals.reuniao_realizada)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{metricCell(totals.link_enviado)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{metricCell(totals.contrato_assinado)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtPct(pct(totals.contrato_assinado, totals.leads))}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{metricCell(totals.faturamento, true)}</td>
                  {agrupamento !== "campanha" && <td className="px-2 py-2 text-right text-muted-foreground">—</td>}
                  {agrupamento === "campanha" && <><td className="px-2 py-2 text-right tabular-nums">{metricCell(Number(totals.gasto), true)}</td><td className="px-2 py-2 text-right tabular-nums">{metricCell(Number(totals.cpl), true)}</td><td className="px-2 py-2 text-right tabular-nums">{metricCell(Number(totals.cac), true)}</td></>}
                </tr>
              </tfoot>
            </table>
            )}
          </div>

          <div className="min-w-0">
            {loading ? <div className="space-y-2">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className={cn("h-8", index === 0 ? "w-full" : `w-[${100 - index * 8}%]`)} />)}</div> : <>
            <div className="mb-3 flex items-center gap-2">
              <p className="min-w-0 truncate text-xs font-semibold uppercase text-muted-foreground">{focused ?? "TOTAL DA SELEÇÃO"}</p>
              {focused && <Button variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-xs" onClick={() => setFocused(null)}><X className="h-3 w-3" />limpar</Button>}
            </div>
            <div className="space-y-1.5">
              {funnel.map((f, i) => {
                const isGargalo = i === gargaloIdx;
                const width = Math.max(f.pctTopo, 6);
                return (
                  <div key={f.label} className="flex items-center gap-2">
                    <span className="w-[132px] shrink-0 text-[11px] text-muted-foreground text-right">{f.label}</span>
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn("h-8 min-w-[74px] rounded-sm flex items-center justify-between px-2", isGargalo ? "bg-destructive" : "bg-success")}
                        style={{ width: `${width}%` }}
                      >
                        <span className={cn("text-xs font-bold tabular-nums", isGargalo ? "text-destructive-foreground" : "text-success-foreground")}>{formatNumber(f.value)}</span>
                        <span className={cn("text-[10px] tabular-nums opacity-80", isGargalo ? "text-destructive-foreground" : "text-success-foreground")}>{fmtPct(f.pctTopo)}</span>
                      </div>
                    </div>
                    <span
                      className={`w-[64px] shrink-0 text-[11px] text-right tabular-nums ${isGargalo ? "text-destructive font-semibold" : "text-muted-foreground"}`}
                    >
                      {i === 0 ? "—" : fmtPct(f.pctStep)}
                    </span>
                  </div>
                );
              })}
            </div>
            {gargaloIdx > 0 && (
              <p className="text-[11px] text-muted-foreground mt-3">
                Maior gargalo: <span className="text-destructive font-semibold">{funnel[gargaloIdx].label}</span>{" "}
                ({fmtPct(funnel[gargaloIdx].pctStep)} da etapa anterior). Coluna à direita = conversão etapa a etapa.
              </p>
            )}
            {agrupamento === "campanha" && (
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                <span>Gasto <strong className="text-foreground">{formatCurrency(Number(active.gasto ?? 0))}</strong></span>
                <span>CPL <strong className="text-foreground">{formatCurrency(Number(active.cpl ?? 0))}</strong></span>
                <span>CAC <strong className="text-foreground">{formatCurrency(Number(active.cac ?? 0))}</strong></span>
              </div>
            )}
            </>}
          </div>
        </div>
      )}
    </section>
  );
};
