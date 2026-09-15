import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PersonAvatar } from "@/components/PersonAvatar";

type PontualidadeConfig = {
  id: number;
  ativo: boolean;
  tolerancia_min: number;
  faixa1_ate_min: number;
  faixa1_penalidade: number;
  faixa2_ate_min: number;
  faixa2_penalidade: number;
  faixa3_penalidade: number;
  margem_ordem_seg: number;
  janela_max_min: number;
};

type PontualidadeRow = {
  readai_meeting_id: string;
  empresa: string | null;
  closer: string | null;
  quando_local: string | null;
  agendado: string | null;
  primeira_fala_closer: string | null;
  primeira_fala_cliente: string | null;
  atraso_min: number | null;
  veredicto_auto: string | null;
  veredicto_manual: string | null;
  veredicto: string | null;
  penalidade_atraso: number | null;
  ajuste_obs: string | null;
  nota_final: number | null;
  lead_status: string | null;
};

type RankingRow = {
  closer: string | null;
  mes?: string | null;
  quando_local?: string | null;
  pontualidade: string | null;
  atraso_closer_min: number | null;
  penalidade_atraso: number | null;
};

type ManualVerdict = "closer_atrasou" | "cliente_atrasou" | "desconsiderar" | "ok";
type Adjustment = { row: PontualidadeRow; verdict: ManualVerdict | "clear" };

const VERDICT_META: Record<string, { label: string; className: string }> = {
  closer_atrasou: {
    label: "Closer atrasou",
    className: "border-red-500/30 bg-red-500/15 text-red-500",
  },
  cliente_atrasou: {
    label: "Cliente atrasou",
    className: "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  ambiguo: {
    label: "Ambíguo",
    className: "border-border bg-muted text-muted-foreground",
  },
  ok: {
    label: "Pontual",
    className: "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  desconsiderar: {
    label: "Desconsiderado",
    className: "border-border bg-muted text-muted-foreground",
  },
};

const CONFIG_FIELDS: Array<{
  key: Exclude<keyof PontualidadeConfig, "id" | "ativo">;
  label: string;
  help?: string;
}> = [
  { key: "tolerancia_min", label: "Tolerância (minutos)", help: "Até aqui o closer é considerado pontual" },
  { key: "faixa1_ate_min", label: "Atraso leve até (min)" },
  { key: "faixa1_penalidade", label: "Penalidade do atraso leve", help: "Pontos descontados da nota" },
  { key: "faixa2_ate_min", label: "Atraso médio até (min)" },
  { key: "faixa2_penalidade", label: "Penalidade do atraso médio" },
  { key: "faixa3_penalidade", label: "Penalidade acima disso", help: "Aplicada a qualquer atraso maior que o atraso médio" },
  { key: "margem_ordem_seg", label: "Margem de ordem (segundos)", help: "Folga para considerar que o cliente falou antes do closer. Valor maior = mais generoso com o closer" },
  { key: "janela_max_min", label: "Janela máxima (minutos)", help: "Se o horário agendado divergir mais que isso da gravação, o caso é marcado como sem dados e não penaliza" },
];

const numberValue = (value: number | null | undefined, digits = 1) =>
  value == null ? "—" : Number(value).toLocaleString("pt-BR", { maximumFractionDigits: digits });

const monthFromLocal = (value: string | null) => value?.slice(0, 7) ?? "";

function localDate(value: string | null) {
  if (!value) return "—";
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "—";
}

function brasiliaTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function delayLabel(value: number | null) {
  if (value == null) return "—";
  const formatted = Math.abs(Number(value)).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return Number(value) < 0 ? `${formatted} min adiantado` : `${formatted} min`;
}

function VerdictBadge({ row }: { row: PontualidadeRow }) {
  const meta = VERDICT_META[row.veredicto ?? ""] ?? VERDICT_META.ambiguo;
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className={cn("whitespace-nowrap text-[10px]", meta.className)}>
        {meta.label}
      </Badge>
      {row.veredicto_manual && (
        <Tooltip>
          <TooltipTrigger asChild>
            <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" aria-label="Conferido manualmente" />
          </TooltipTrigger>
          <TooltipContent>{row.ajuste_obs || "Conferido manualmente"}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
        {detail && <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

export function PontualidadeTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [configDraft, setConfigDraft] = useState<PontualidadeConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [closer, setCloser] = useState("all");
  const [verdict, setVerdict] = useState("all");
  const [month, setMonth] = useState("all");
  const [onlyPending, setOnlyPending] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState<Adjustment | null>(null);
  const [observation, setObservation] = useState("");
  const [manualDelay, setManualDelay] = useState("");
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  const configQuery = useQuery({
    queryKey: ["se-pontualidade-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("se_pontualidade_config")
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data as PontualidadeConfig;
    },
  });

  const queueQuery = useQuery({
    queryKey: ["se-pontualidade-revisar"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vw_se_pontualidade_revisar")
        .select("*")
        .order("quando_local", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PontualidadeRow[];
    },
  });

  const rankingQuery = useQuery({
    queryKey: ["se-pontualidade-ranking"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vw_se_reunioes")
        .select("closer,mes,quando_local,pontualidade,atraso_closer_min,penalidade_atraso");
      if (error) throw error;
      return (data ?? []) as RankingRow[];
    },
  });

  useEffect(() => {
    if (configQuery.data) setConfigDraft(configQuery.data);
  }, [configQuery.data]);

  const rows = queueQuery.data ?? [];
  const months = useMemo(
    () => Array.from(new Set(rows.map((row) => monthFromLocal(row.quando_local)).filter(Boolean))).sort().reverse(),
    [rows]
  );
  const closers = useMemo(
    () => Array.from(new Set(rows.map((row) => row.closer).filter((name): name is string => Boolean(name)))).sort(),
    [rows]
  );

  const periodRows = useMemo(
    () => rows.filter((row) => (month === "all" || monthFromLocal(row.quando_local) === month) && (closer === "all" || row.closer === closer)),
    [closer, month, rows]
  );

  const filteredRows = useMemo(
    () => periodRows.filter((row) => (verdict === "all" || row.veredicto === verdict) && (!onlyPending || row.veredicto_manual == null)),
    [onlyPending, periodRows, verdict]
  );

  const summary = useMemo(() => {
    const confirmed = periodRows.filter((row) => row.veredicto === "closer_atrasou");
    const greatest = [...confirmed].sort((a, b) => Number(b.atraso_min ?? 0) - Number(a.atraso_min ?? 0))[0];
    return {
      pending: periodRows.filter((row) => row.veredicto_manual == null).length,
      confirmed: confirmed.length,
      greatest,
      lost: periodRows.reduce((total, row) => total + Number(row.penalidade_atraso ?? 0), 0),
    };
  }, [periodRows]);

  const ranking = useMemo(() => {
    const map = new Map<string, { total: number; delays: number; minutes: number }>();
    for (const row of rankingQuery.data ?? []) {
      const rowMonth = row.mes ?? monthFromLocal(row.quando_local ?? null);
      if (month !== "all" && rowMonth !== month) continue;
      if (closer !== "all" && row.closer !== closer) continue;
      if (!row.closer) continue;
      const current = map.get(row.closer) ?? { total: 0, delays: 0, minutes: 0 };
      current.total += 1;
      if (row.pontualidade === "closer_atrasou") {
        current.delays += 1;
        current.minutes += Number(row.atraso_closer_min ?? 0);
      }
      map.set(row.closer, current);
    }
    return Array.from(map, ([name, values]) => ({
      name,
      ...values,
      percentage: values.total ? (values.delays / values.total) * 100 : 0,
      average: values.delays ? values.minutes / values.delays : 0,
    })).sort((a, b) => b.percentage - a.percentage);
  }, [closer, month, rankingQuery.data]);

  async function invalidateBlackOps() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["se-pontualidade-revisar"] }),
      queryClient.invalidateQueries({ queryKey: ["se-pontualidade-ranking"] }),
      queryClient.invalidateQueries({ queryKey: ["se-reunioes"] }),
      queryClient.invalidateQueries({ queryKey: ["se-desempenho-meta"] }),
      queryClient.invalidateQueries({ queryKey: ["prod-score"] }),
      queryClient.invalidateQueries({ queryKey: ["prod-score-all"] }),
    ]);
  }

  async function saveConfig() {
    if (!configDraft) return;
    setSavingConfig(true);
    const payload = Object.fromEntries(
      Object.entries(configDraft).filter(([key]) => key !== "id")
    );
    const { error } = await (supabase as any)
      .from("se_pontualidade_config")
      .update(payload)
      .eq("id", 1);
    setSavingConfig(false);
    if (error) {
      toast.error("Não foi possível salvar a calibração.");
      return;
    }
    await invalidateBlackOps();
    toast.success("Calibração salva.");
  }

  function openAdjustment(row: PontualidadeRow, nextVerdict: Adjustment["verdict"]) {
    setAdjustment({ row, verdict: nextVerdict });
    setObservation(nextVerdict === "clear" ? "" : row.ajuste_obs ?? "");
    setManualDelay("");
  }

  async function saveAdjustment() {
    if (!adjustment) return;
    setSavingAdjustment(true);
    if (adjustment.verdict === "clear") {
      const { error } = await (supabase as any)
        .from("se_pontualidade_ajuste")
        .delete()
        .eq("readai_meeting_id", adjustment.row.readai_meeting_id);
      setSavingAdjustment(false);
      if (error) {
        toast.error("Não foi possível limpar o ajuste.");
        return;
      }
      setAdjustment(null);
      await invalidateBlackOps();
      toast.success("Ajuste removido.");
      return;
    }

    const payload: Record<string, string | number | null> = {
      readai_meeting_id: adjustment.row.readai_meeting_id,
      veredicto_manual: adjustment.verdict,
      observacao: observation.trim() || null,
      ajustado_por: user?.email ?? null,
      ajustado_em: new Date().toISOString(),
    };
    if (adjustment.verdict === "closer_atrasou") {
      payload.atraso_min_manual = manualDelay.trim() === "" ? null : Number(manualDelay);
    }
    const { error } = await (supabase as any)
      .from("se_pontualidade_ajuste")
      .upsert(payload, { onConflict: "readai_meeting_id" });
    setSavingAdjustment(false);
    if (error) {
      toast.error("Não foi possível salvar a conferência.");
      return;
    }
    setAdjustment(null);
    await invalidateBlackOps();
    toast.success("Conferência salva.");
  }

  if (configQuery.isLoading || queueQuery.isLoading || rankingQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando pontualidade…</p>;
  }

  if (configQuery.isError || queueQuery.isError || rankingQuery.isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">Não foi possível carregar os dados de pontualidade.</p>
        <Button className="mt-3" size="sm" variant="outline" onClick={() => void Promise.all([configQuery.refetch(), queueQuery.refetch(), rankingQuery.refetch()])}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {configDraft && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Calibração</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Alterar esses valores recalcula as notas imediatamente. Nenhuma reunião precisa ser reavaliada.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <Label htmlFor="pontualidade-ativa">Penalizar atraso</Label>
                  <p className="mt-1 max-w-64 text-xs text-muted-foreground">Desligado, o atraso continua sendo calculado e exibido, mas não desconta nota</p>
                </div>
                <Switch id="pontualidade-ativa" checked={configDraft.ativo} onCheckedChange={(ativo) => setConfigDraft((current) => current ? { ...current, ativo } : current)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {CONFIG_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    type="number"
                    step="any"
                    value={configDraft[field.key]}
                    onChange={(event) => setConfigDraft((current) => current ? { ...current, [field.key]: Number(event.target.value) } : current)}
                  />
                  {field.help && <p className="text-xs leading-4 text-muted-foreground">{field.help}</p>}
                </div>
              ))}
            </div>
            <Button onClick={() => void saveConfig()} disabled={savingConfig}>
              {savingConfig ? "Salvando…" : "Salvar calibração"}
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Fila de conferência</h2>
          <p className="text-xs text-muted-foreground">Revise os casos detectados automaticamente pelo Read.ai.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="Casos pendentes" value={String(summary.pending)} detail="aguardando conferência" />
          <SummaryCard label="Atrasos confirmados" value={String(summary.confirmed)} />
          <SummaryCard label="Maior atraso" value={delayLabel(summary.greatest?.atraso_min ?? null)} detail={summary.greatest?.closer ?? undefined} />
          <SummaryCard label="Pontos perdidos" value={numberValue(summary.lost)} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={closer} onValueChange={setCloser}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Closer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os closers</SelectItem>
              {closers.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={verdict} onValueChange={setVerdict}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Veredicto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os veredictos</SelectItem>
              {Object.entries(VERDICT_META).map(([value, meta]) => <SelectItem key={value} value={value}>{meta.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {months.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <Switch id="only-pending" checked={onlyPending} onCheckedChange={setOnlyPending} />
            <Label htmlFor="only-pending" className="whitespace-nowrap">Mostrar só não conferidos</Label>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="w-9 px-3 py-2" />
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Closer</th>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Agendado</th>
                <th className="px-3 py-2 text-left">Atraso</th>
                <th className="px-3 py-2 text-left">Veredicto atual</th>
                <th className="px-3 py-2 text-right">Penalidade</th>
                <th className="px-3 py-2 text-right">Nota final</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const isOpen = expanded === row.readai_meeting_id;
                return (
                  <Fragment key={row.readai_meeting_id}>
                    <tr className="cursor-pointer border-t border-border hover:bg-muted/30" onClick={() => setExpanded(isOpen ? null : row.readai_meeting_id)}>
                      <td className="px-3 py-2">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                      <td className="px-3 py-2 font-medium text-foreground">{row.empresa ?? "—"}</td>
                      <td className="px-3 py-2"><div className="flex items-center gap-2"><PersonAvatar name={row.closer} className="h-6 w-6" /><span>{row.closer ?? "—"}</span></div></td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{localDate(row.quando_local)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{brasiliaTime(row.agendado)}</td>
                      <td className={cn("px-3 py-2 whitespace-nowrap font-medium", Number(row.atraso_min ?? 0) > 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400")}>{delayLabel(row.atraso_min)}</td>
                      <td className="px-3 py-2"><VerdictBadge row={row} /></td>
                      <td className="px-3 py-2 text-right">{numberValue(row.penalidade_atraso)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{numberValue(row.nota_final)}</td>
                      <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => openAdjustment(row, "closer_atrasou")}>Foi o closer</Button>
                          <Button size="sm" variant="outline" onClick={() => openAdjustment(row, "cliente_atrasou")}>Foi o cliente</Button>
                          <Button size="sm" variant="outline" onClick={() => openAdjustment(row, "desconsiderar")}>Desconsiderar</Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Mais ações"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => openAdjustment(row, "ok")}>Marcar como pontual</DropdownMenuItem>
                              <DropdownMenuItem disabled={!row.veredicto_manual} onSelect={() => openAdjustment(row, "clear")}>Limpar ajuste</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-border bg-muted/10">
                        <td colSpan={10} className="px-5 py-5">
                          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
                            {[
                              ["Agendado", brasiliaTime(row.agendado)],
                              ["Primeira fala do closer", brasiliaTime(row.primeira_fala_closer)],
                              ["Primeira fala do cliente", brasiliaTime(row.primeira_fala_cliente)],
                            ].map(([label, value], index) => (
                              <Fragment key={label}>
                                <div className="rounded-md border border-border bg-background p-3 text-center">
                                  <Clock3 className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                                  <p className="text-xs text-muted-foreground">{label}</p>
                                  <p className="mt-1 font-mono text-sm font-semibold">{value}</p>
                                </div>
                                {index < 2 && <ChevronRight className="hidden h-4 w-4 text-muted-foreground sm:block" />}
                              </Fragment>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!filteredRows.length && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum caso encontrado com estes filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Ranking de pontualidade</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr><th className="px-3 py-2 text-left">Closer</th><th className="px-3 py-2 text-right">Reuniões</th><th className="px-3 py-2 text-right">Atrasos</th><th className="px-3 py-2 text-right">% atraso</th><th className="px-3 py-2 text-right">Atraso médio</th></tr>
            </thead>
            <tbody>
              {ranking.map((row) => (
                <tr key={row.name} className="border-t border-border">
                  <td className="px-3 py-2"><div className="flex items-center gap-2"><PersonAvatar name={row.name} className="h-6 w-6" />{row.name}</div></td>
                  <td className="px-3 py-2 text-right">{row.total}</td>
                  <td className="px-3 py-2 text-right">{row.delays}</td>
                  <td className="px-3 py-2 text-right font-medium">{numberValue(row.percentage)}%</td>
                  <td className="px-3 py-2 text-right">{delayLabel(row.average)}</td>
                </tr>
              ))}
              {!ranking.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Sem reuniões no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={Boolean(adjustment)} onOpenChange={(open) => !open && setAdjustment(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{adjustment?.verdict === "clear" ? "Limpar ajuste" : "Conferir pontualidade"}</DialogTitle>
            <DialogDescription>
              {adjustment?.verdict === "clear" ? "O veredicto voltará a seguir a detecção automática." : `Registre sua conferência para ${adjustment?.row.empresa ?? "esta reunião"}.`}
            </DialogDescription>
          </DialogHeader>
          {adjustment?.verdict !== "clear" && (
            <div className="space-y-4">
              {adjustment?.verdict === "closer_atrasou" && (
                <div className="space-y-1.5">
                  <Label htmlFor="manual-delay">Atraso real em minutos (opcional)</Label>
                  <Input id="manual-delay" type="number" step="any" value={manualDelay} onChange={(event) => setManualDelay(event.target.value)} placeholder="Ex.: 4,5" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="adjustment-observation">Observação (opcional)</Label>
                <Textarea id="adjustment-observation" value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Contexto da conferência" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustment(null)}>Cancelar</Button>
            <Button onClick={() => void saveAdjustment()} disabled={savingAdjustment}>
              {savingAdjustment ? "Salvando…" : adjustment?.verdict === "clear" ? "Limpar ajuste" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}