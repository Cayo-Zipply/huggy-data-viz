import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  RefreshCw,
  Trophy,
  Star,
  AlertTriangle,
  Sparkles,
  BookOpen,
  Gauge,
  ArrowUpDown,
  ChevronRight,
  Minus,
  Equal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ---------------- Types ---------------- */
type Avaliacao = {
  id: string;
  readai_meeting_id: string;
  lead_id: string | null;
  closer: string | null;
  nota_geral: number | null;
  nota_tecnica: number | null;
  notas_criterios: Record<string, number> | null;
  pontos_fortes: string[] | null;
  pontos_melhoria: string[] | null;
  gatilhos_detectados: string[] | null;
  alertas_compliance: string[] | null;
  resumo_treinador: string | null;
  status: "ok" | "erro" | "processando" | null;
  erro?: string | null;
  created_at: string;
};
type RubricaItem = {
  id: string;
  versao: number;
  tipo: "criterio" | "guardrail";
  codigo: string;
  titulo: string;
  descricao: string | null;
  como_pontuar: string | null;
  peso: number | null;
  penalidade: number | null;
  ativo: boolean;
};
type Ranking = {
  closer: string;
  reunioes_avaliadas: number;
  nota_media: number;
  nota_media_tecnica: number;
  reunioes_com_alerta: number;
  leads_com_outcome: number;
  leads_pagaram: number;
  leads_churnaram: number;
};
type Calibracao = {
  faixa: "0-49" | "50-69" | "70-84" | "85-100";
  reunioes: number;
  pagaram: number;
  churnaram: number;
  taxa_pagamento_pct: number;
};

/* ---------------- Sinal de nota (cores semânticas + Tailwind) ---------------- */
function notaTone(n: number | null | undefined) {
  if (n == null) return { text: "text-muted-foreground", bg: "bg-muted", border: "border-border", hex: "hsl(var(--muted-foreground))" };
  if (n >= 85) return { text: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/30", hex: "#22c55e" };
  if (n >= 70) return { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", hex: "#34d399" };
  if (n >= 50) return { text: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30", hex: "#eab308" };
  return { text: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", hex: "#ef4444" };
}

function NotaPill({ value, size = "md" }: { value: number | null; size?: "sm" | "md" | "lg" }) {
  const sz =
    size === "lg" ? "text-xl px-3.5 py-1.5" : size === "sm" ? "text-xs px-2 py-0.5" : "text-base px-3 py-1";
  const t = notaTone(value);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-bold tabular-nums",
        sz,
        t.text,
        t.bg,
        t.border
      )}
    >
      {value == null ? "—" : Math.round(value)}
    </span>
  );
}

/* ---------------- KPI Card (mesmo estilo do FarolPanel) ---------------- */
function KpiCard({
  label,
  value,
  hint,
  accent = false,
  toneClass,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  accent?: boolean;
  toneClass?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        {icon && (
          <span className="shrink-0 w-8 h-8 rounded-lg bg-muted/60 text-primary flex items-center justify-center">
            {icon}
          </span>
        )}
      </div>
      <div>
        <div
          className={cn(
            "text-3xl font-bold tracking-tight leading-none tabular-nums truncate",
            toneClass ?? (accent ? "text-primary" : "text-foreground")
          )}
        >
          {value}
        </div>
        <div className="text-[11px] text-muted-foreground/90 mt-3 leading-snug">
          {hint}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function SalesEnablement() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const qc = useQueryClient();
  const [drillId, setDrillId] = useState<string | null>(null);
  const [closerFilter, setCloserFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<"nota" | "reunioes" | "alertas" | "conv">("nota");

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ["se"] });
    toast.success("Atualizando dados…");
  };

  const ranking = useQuery({
    queryKey: ["se", "ranking"],
    queryFn: async (): Promise<Ranking[]> => {
      const { data, error } = await (supabase as any).from("vw_se_ranking_closers").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const avaliacoes = useQuery({
    queryKey: ["se", "avaliacoes"],
    queryFn: async (): Promise<Avaliacao[]> => {
      const { data, error } = await (supabase as any)
        .from("se_avaliacoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rubrica = useQuery({
    queryKey: ["se", "rubrica"],
    queryFn: async (): Promise<RubricaItem[]> => {
      const { data, error } = await (supabase as any)
        .from("se_rubrica")
        .select("*")
        .eq("ativo", true);
      if (error) throw error;
      const max = Math.max(0, ...(data ?? []).map((r: RubricaItem) => r.versao ?? 0));
      return (data ?? []).filter((r: RubricaItem) => r.versao === max);
    },
  });

  const exemplosGold = useQuery({
    queryKey: ["se", "exemplos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("se_exemplos_gold")
        .select("*")
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        readai_meeting_id: string;
        lead_id: string | null;
        motivo: string | null;
        ativo: boolean;
      }>;
    },
  });

  const calibracao = useQuery({
    queryKey: ["se", "calibracao"],
    queryFn: async (): Promise<Calibracao[]> => {
      const { data, error } = await (supabase as any).from("vw_se_calibracao").select("*");
      if (error) throw error;
      const ordem = ["0-49", "50-69", "70-84", "85-100"];
      return (data ?? []).sort(
        (a: Calibracao, b: Calibracao) => ordem.indexOf(a.faixa) - ordem.indexOf(b.faixa)
      );
    },
  });

  const leadIds = useMemo(
    () => [...new Set((avaliacoes.data ?? []).map((a) => a.lead_id).filter(Boolean))] as string[],
    [avaliacoes.data]
  );
  const meetingIds = useMemo(
    () => [...new Set((avaliacoes.data ?? []).map((a) => a.readai_meeting_id).filter(Boolean))] as string[],
    [avaliacoes.data]
  );

  const leads = useQuery({
    queryKey: ["se", "leads", leadIds],
    enabled: leadIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("leads")
        .select("id, nome, empresa, closer, valor_negocio, etapa_atual, status")
        .in("id", leadIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const meetings = useQuery({
    queryKey: ["se", "meetings", meetingIds],
    enabled: meetingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("readai_meetings")
        .select("id, meeting_title, meeting_date, duration, summary, transcript")
        .in("id", meetingIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const leadById = useMemo(() => {
    const m = new Map<string, any>();
    (leads.data ?? []).forEach((l: any) => m.set(l.id, l));
    return m;
  }, [leads.data]);
  const meetingById = useMemo(() => {
    const m = new Map<string, any>();
    (meetings.data ?? []).forEach((m2: any) => m.set(m2.id, m2));
    return m;
  }, [meetings.data]);
  const rubricaByCodigo = useMemo(() => {
    const m = new Map<string, RubricaItem>();
    (rubrica.data ?? []).forEach((r) => m.set(r.codigo, r));
    return m;
  }, [rubrica.data]);

  const goldSet = useMemo(
    () => new Set((exemplosGold.data ?? []).map((e) => e.readai_meeting_id)),
    [exemplosGold.data]
  );

  /* --------- Mutations --------- */
  const toggleGold = useMutation({
    mutationFn: async (a: Avaliacao) => {
      const isGold = goldSet.has(a.readai_meeting_id);
      const { error } = await (supabase as any)
        .from("se_exemplos_gold")
        .upsert(
          {
            readai_meeting_id: a.readai_meeting_id,
            lead_id: a.lead_id,
            ativo: !isGold,
            motivo: null,
          },
          { onConflict: "readai_meeting_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["se", "exemplos"] });
      toast.success("Atualizado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const reavaliar = useMutation({
    mutationFn: async (readai_meeting_id: string) => {
      const { error } = await (supabase as any).functions.invoke("avaliar-reuniao", {
        body: { readai_meeting_id, force: true },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["se"] });
      toast.success("Reavaliação solicitada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao reavaliar"),
  });

  /* --------- Derived --------- */
  const okAvaliacoes = (avaliacoes.data ?? []).filter((a) => a.status === "ok");
  const errAvaliacoes = (avaliacoes.data ?? []).filter((a) => a.status === "erro");
  const totalAvaliadas = okAvaliacoes.length;
  const totalElegiveis = (avaliacoes.data ?? []).length;
  const notaMediaGeral =
    totalAvaliadas > 0
      ? okAvaliacoes.reduce((s, a) => s + (a.nota_geral ?? 0), 0) / totalAvaliadas
      : 0;
  const semAlerta = okAvaliacoes.filter(
    (a) => !a.alertas_compliance || a.alertas_compliance.length === 0
  ).length;
  const complianceIdx = totalAvaliadas > 0 ? (semAlerta / totalAvaliadas) * 100 : 0;

  const totalOutcomes = (ranking.data ?? []).reduce((s, r) => s + (r.leads_com_outcome ?? 0), 0);
  const totalPagaram = (ranking.data ?? []).reduce((s, r) => s + (r.leads_pagaram ?? 0), 0);
  const conversaoCalibrada = totalOutcomes > 0 ? (totalPagaram / totalOutcomes) * 100 : 0;

  const rankingSorted = useMemo(() => {
    const arr = (ranking.data ?? []).slice();
    arr.sort((a, b) => {
      if (sortKey === "reunioes") return (b.reunioes_avaliadas ?? 0) - (a.reunioes_avaliadas ?? 0);
      if (sortKey === "alertas") return (b.reunioes_com_alerta ?? 0) - (a.reunioes_com_alerta ?? 0);
      if (sortKey === "conv") {
        const ca = a.leads_com_outcome ? (a.leads_pagaram / a.leads_com_outcome) : -1;
        const cb = b.leads_com_outcome ? (b.leads_pagaram / b.leads_com_outcome) : -1;
        return cb - ca;
      }
      return (b.nota_media ?? 0) - (a.nota_media ?? 0);
    });
    return arr;
  }, [ranking.data, sortKey]);

  const closersList = useMemo(
    () => [...new Set((ranking.data ?? []).map((r) => r.closer).filter(Boolean))] as string[],
    [ranking.data]
  );

  const melhores = okAvaliacoes
    .slice()
    .sort((a, b) => (b.nota_geral ?? 0) - (a.nota_geral ?? 0))
    .slice(0, 20);

  const drill = drillId ? okAvaliacoes.find((a) => a.id === drillId) : null;

  /* ---------- Outcome form ---------- */
  const [outcomeLeadId, setOutcomeLeadId] = useState<string>("");
  const [outcomeResultado, setOutcomeResultado] = useState<string>("");
  const [outcomeValor, setOutcomeValor] = useState<string>("");
  const [outcomeObs, setOutcomeObs] = useState<string>("");

  const registrarOutcome = useMutation({
    mutationFn: async () => {
      if (!outcomeLeadId || !outcomeResultado) throw new Error("Selecione lead e resultado");
      const { error } = await (supabase as any).from("se_outcomes").insert({
        lead_id: outcomeLeadId,
        resultado: outcomeResultado,
        valor: outcomeValor ? Number(outcomeValor) : null,
        observacao: outcomeObs || null,
        registrado_por: profile?.user_id ?? null,
        registrado_em: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["se", "ranking"] });
      qc.invalidateQueries({ queryKey: ["se", "calibracao"] });
      toast.success("Resultado registrado");
      setOutcomeLeadId("");
      setOutcomeResultado("");
      setOutcomeValor("");
      setOutcomeObs("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const leadsComAvaliacao = useMemo(() => {
    const ids = new Set(okAvaliacoes.map((a) => a.lead_id).filter(Boolean));
    return (leads.data ?? []).filter((l: any) => ids.has(l.id));
  }, [okAvaliacoes, leads.data]);

  const isLoading =
    avaliacoes.isLoading || ranking.isLoading || rubrica.isLoading || calibracao.isLoading;

  const notaMediaTone = notaTone(notaMediaGeral);
  const complianceTone =
    complianceIdx >= 85 ? "text-green-500" : complianceIdx >= 70 ? "text-yellow-500" : "text-red-500";
  const conversaoTone = notaTone(conversaoCalibrada);

  return (
    <div className="min-h-screen bg-background">
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-4xl font-bold text-foreground tracking-tight">
                Sales Enablement
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Cada reunião realizada do mês recebe uma nota de 0 a 100 pela IA. O placar premia quem fecha certo — não só quem fecha.
              </p>
            </div>
            <Button onClick={refetchAll} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>

          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Visão Geral
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Reuniões avaliadas"
              icon={<Sparkles className="h-4 w-4" />}
              value={
                <span>
                  {totalAvaliadas}
                  <span className="text-xl text-muted-foreground"> / {totalElegiveis}</span>
                </span>
              }
              hint="Elegíveis = realizadas do mês (Reunião Realizada → Contrato Assinado), com transcrição."
              accent
            />
            <KpiCard
              label="Nota média do time"
              icon={<Gauge className="h-4 w-4" />}
              value={totalAvaliadas > 0 ? Math.round(notaMediaGeral) : "—"}
              toneClass={totalAvaliadas > 0 ? notaMediaTone.text : undefined}
              hint="Nota geral média = nota técnica − penalidades de compliance."
            />
            <KpiCard
              label="Índice de compliance"
              icon={<AlertTriangle className="h-4 w-4" />}
              value={`${Math.round(complianceIdx)}%`}
              toneClass={complianceTone}
              hint="Reuniões sem violação grave (g1/g2) ÷ total avaliadas."
            />
            <KpiCard
              label="Conversão calibrada"
              icon={<Trophy className="h-4 w-4" />}
              value={totalOutcomes > 0 ? `${Math.round(conversaoCalibrada)}%` : "—"}
              toneClass={totalOutcomes > 0 ? conversaoTone.text : undefined}
              hint={`Pagou ÷ reuniões com desfecho registrado (${totalPagaram}/${totalOutcomes}).`}
            />
          </div>

          {/* Como a nota é construída */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">
              Como a nota é construída
            </div>
            <div className="flex flex-col md:flex-row items-stretch gap-3">
              <FormulaBox
                step="1"
                title="Nota técnica"
                desc="Soma ponderada dos 8 critérios (cada um 0–10 × seu peso)."
                tone="emerald"
              />
              <FormulaOp icon={<Minus className="h-5 w-5" />} />
              <FormulaBox
                step="2"
                title="Penalidades · Guardrails"
                desc="Cada violação de compliance acionada subtrai pontos."
                tone="red"
              />
              <FormulaOp icon={<Equal className="h-5 w-5" />} />
              <FormulaBox
                step="3"
                title="Nota geral"
                desc="O número que rankeia. Premia quem fecha certo, não só quem fecha."
                tone="primary"
              />
            </div>
          </div>

          {totalAvaliadas === 0 && !isLoading && (
            <div className="rounded-xl border border-border bg-card py-16 text-center">
              <Sparkles className="h-10 w-10 mx-auto mb-3 text-primary/60" />
              <p className="text-muted-foreground">
                As notas aparecem automaticamente conforme as reuniões realizadas do mês são processadas.
              </p>
            </div>
          )}

          <Tabs defaultValue="placar" className="w-full">
            <TabsList className="grid grid-cols-4 w-full max-w-2xl">
              <TabsTrigger value="placar"><Trophy className="h-4 w-4 mr-1.5" />Placar</TabsTrigger>
              <TabsTrigger value="melhores"><Star className="h-4 w-4 mr-1.5" />Melhores</TabsTrigger>
              <TabsTrigger value="calibracao"><Gauge className="h-4 w-4 mr-1.5" />Calibração</TabsTrigger>
              <TabsTrigger value="biblioteca"><BookOpen className="h-4 w-4 mr-1.5" />Biblioteca</TabsTrigger>
            </TabsList>

            {/* PLACAR */}
            <TabsContent value="placar" className="space-y-4 mt-4">
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-border">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Ranking de Closers</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ordene clicando nos cabeçalhos. O filtro atenua quem não foi selecionado.
                    </p>
                  </div>
                  <Select value={closerFilter || "__all"} onValueChange={(v) => setCloserFilter(v === "__all" ? "" : v)}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Todos os closers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Todos os closers</SelectItem>
                      {closersList.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        <th className="text-left px-5 py-3 w-12">#</th>
                        <th className="text-left px-2 py-3">Closer</th>
                        <SortableTh active={sortKey === "nota"} onClick={() => setSortKey("nota")}>
                          Nota média
                        </SortableTh>
                        <SortableTh active={sortKey === "reunioes"} onClick={() => setSortKey("reunioes")}>
                          Reuniões
                        </SortableTh>
                        <SortableTh active={sortKey === "alertas"} onClick={() => setSortKey("alertas")}>
                          Alertas
                        </SortableTh>
                        <SortableTh active={sortKey === "conv"} onClick={() => setSortKey("conv")}>
                          Conversão real
                        </SortableTh>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingSorted.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                            Sem ranking ainda.
                          </td>
                        </tr>
                      )}
                      {rankingSorted.map((r, i) => {
                        const dim = closerFilter && r.closer !== closerFilter;
                        const conv = r.leads_com_outcome
                          ? (r.leads_pagaram / r.leads_com_outcome) * 100
                          : null;
                        const convTone = conv != null ? notaTone(conv) : null;
                        return (
                          <tr
                            key={r.closer}
                            className={cn(
                              "border-t border-border/60 hover:bg-muted/30 transition-all",
                              dim && "opacity-30"
                            )}
                          >
                            <td className="px-5 py-4 text-base font-bold text-muted-foreground tabular-nums">
                              {i + 1}
                            </td>
                            <td className="px-2 py-4">
                              <div className="font-semibold text-foreground">{r.closer}</div>
                            </td>
                            <td className="px-2 py-4">
                              <NotaPill value={r.nota_media} />
                            </td>
                            <td className="px-2 py-4 tabular-nums text-foreground">
                              {r.reunioes_avaliadas}
                            </td>
                            <td className="px-2 py-4">
                              {r.reunioes_com_alerta > 0 ? (
                                <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-red-500">
                                  🚩 {r.reunioes_com_alerta}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-2 py-4 pr-5">
                              {conv == null || !convTone ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <div className="flex items-center gap-2 min-w-[120px]">
                                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${Math.min(100, conv)}%`, backgroundColor: convTone.hex }}
                                    />
                                  </div>
                                  <span
                                    className={cn("text-xs font-semibold tabular-nums w-10 text-right", convTone.text)}
                                  >
                                    {Math.round(conv)}%
                                  </span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* MELHORES */}
            <TabsContent value="melhores" className="space-y-3 mt-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold text-foreground mb-1">Top 20 Reuniões</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  As maiores notas do período. Clique em uma linha para ver o detalhamento.
                </p>
                <div className="space-y-2">
                  {melhores.length === 0 && (
                    <div className="text-sm text-muted-foreground">Sem reuniões avaliadas.</div>
                  )}
                  {melhores.map((a) => {
                    const lead = a.lead_id ? leadById.get(a.lead_id) : null;
                    const meet = meetingById.get(a.readai_meeting_id);
                    const isGold = goldSet.has(a.readai_meeting_id);
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:border-primary/40 transition-colors cursor-pointer"
                        onClick={() => setDrillId(a.id)}
                      >
                        <NotaPill value={a.nota_geral} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate flex items-center gap-2">
                            {lead?.empresa || lead?.nome || meet?.meeting_title || "Reunião"}
                            {isGold && (
                              <Star className="h-3.5 w-3.5 fill-current text-primary" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {a.closer ?? "—"} ·{" "}
                            {meet?.meeting_date
                              ? new Date(meet.meeting_date).toLocaleDateString("pt-BR")
                              : new Date(a.created_at).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGold.mutate(a);
                            }}
                          >
                            {isGold ? "Remover gold" : "Marcar gold"}
                          </Button>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    );
                  })}
                </div>
              </div>

              {isAdmin && errAvaliacoes.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-red-500">
                    <AlertTriangle className="h-4 w-4" /> Avaliações com erro
                  </h3>
                  <div className="space-y-2">
                    {errAvaliacoes.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground truncate flex-1 font-mono text-xs">
                          {a.readai_meeting_id} — {a.erro ?? "erro"}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reavaliar.mutate(a.readai_meeting_id)}
                        >
                          Reavaliar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* CALIBRAÇÃO */}
            <TabsContent value="calibracao" className="space-y-4 mt-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold text-foreground">Calibração da nota</h2>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Se a barra sobe da esquerda p/ direita, a nota está prevendo bem o fechamento.
                </p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={calibracao.data ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="faixa"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                      />
                      <YAxis
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                        unit="%"
                      />
                      <RTooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          color: "hsl(var(--popover-foreground))",
                        }}
                        cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                      />
                      <Bar dataKey="taxa_pagamento_pct" radius={[6, 6, 0, 0]}>
                        {(calibracao.data ?? []).map((c, i) => {
                          const ref =
                            c.faixa === "85-100" ? 90 : c.faixa === "70-84" ? 77 : c.faixa === "50-69" ? 60 : 30;
                          return <Cell key={i} fill={notaTone(ref).hex} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {isAdmin && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-base font-semibold text-foreground mb-1">Registrar resultado</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Alimenta a calibração: cada desfecho registrado afina a previsão da nota.
                  </p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Select value={outcomeLeadId} onValueChange={setOutcomeLeadId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o lead" />
                        </SelectTrigger>
                        <SelectContent>
                          {leadsComAvaliacao.map((l: any) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.empresa || l.nome} — {l.closer ?? "?"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={outcomeResultado} onValueChange={setOutcomeResultado}>
                        <SelectTrigger>
                          <SelectValue placeholder="Resultado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pagou">Pagou</SelectItem>
                          <SelectItem value="churnou">Churnou</SelectItem>
                          <SelectItem value="continuou">Continuou</SelectItem>
                          <SelectItem value="perdido">Perdido</SelectItem>
                          <SelectItem value="ganho_pendente">Ganho pendente</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Valor (opcional)"
                        value={outcomeValor}
                        onChange={(e) => setOutcomeValor(e.target.value)}
                      />
                      <Input
                        placeholder="Observação (opcional)"
                        value={outcomeObs}
                        onChange={(e) => setOutcomeObs(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={() => registrarOutcome.mutate()}
                      disabled={registrarOutcome.isPending}
                    >
                      Registrar
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* BIBLIOTECA */}
            <TabsContent value="biblioteca" className="space-y-4 mt-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold text-foreground">Critérios</h2>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  O manual do que conta como uma boa reunião. Pesos somam a nota técnica.
                </p>
                <div className="space-y-3">
                  {(rubrica.data ?? [])
                    .filter((r) => r.tipo === "criterio")
                    .sort((a, b) => (b.peso ?? 0) - (a.peso ?? 0))
                    .map((r) => (
                      <div key={r.id} className="rounded-lg border border-border bg-background p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-foreground">{r.titulo}</div>
                          <Badge variant="outline" className="text-primary border-primary/40 tabular-nums">
                            peso {r.peso ?? "—"}
                          </Badge>
                        </div>
                        {r.descricao && (
                          <p className="text-sm text-muted-foreground mt-2">{r.descricao}</p>
                        )}
                        {r.como_pontuar && (
                          <p className="text-xs text-muted-foreground/80 mt-2">
                            <span className="font-medium">Como pontuar:</span> {r.como_pontuar}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold text-red-500 mb-1">O que NÃO fazer</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Guardrails de compliance. Cada violação subtrai da nota técnica.
                </p>
                <div className="space-y-2">
                  {(rubrica.data ?? [])
                    .filter((r) => r.tipo === "guardrail")
                    .map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg p-4 border border-red-500/30 bg-red-500/5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-foreground">{r.titulo}</div>
                          {r.penalidade != null && (
                            <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded text-red-500 bg-red-500/10">
                              −{r.penalidade}
                            </span>
                          )}
                        </div>
                        {r.descricao && (
                          <p className="text-sm text-muted-foreground mt-2">{r.descricao}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  Exemplos gold
                  <Star className="h-4 w-4 fill-current text-primary" />
                </h2>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Reuniões de referência para o time estudar.
                </p>
                <div className="space-y-1">
                  {(exemplosGold.data ?? []).length === 0 && (
                    <div className="text-sm text-muted-foreground">Nenhum exemplo marcado ainda.</div>
                  )}
                  {(exemplosGold.data ?? []).map((g) => {
                    const a = okAvaliacoes.find((x) => x.readai_meeting_id === g.readai_meeting_id);
                    const lead = g.lead_id ? leadById.get(g.lead_id) : null;
                    return (
                      <button
                        key={g.id}
                        onClick={() => a && setDrillId(a.id)}
                        className="w-full flex items-center justify-between text-sm py-2.5 px-3 rounded hover:bg-muted/40 transition-colors"
                      >
                        <span className="text-foreground">
                          {lead?.empresa || lead?.nome || g.readai_meeting_id}
                        </span>
                        {a && <NotaPill value={a.nota_geral} size="sm" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Drill-down */}
      <Dialog open={!!drillId} onOpenChange={(o) => !o && setDrillId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {drill && <DrillContent
            a={drill}
            lead={drill.lead_id ? leadById.get(drill.lead_id) : null}
            meet={meetingById.get(drill.readai_meeting_id)}
            rubricaByCodigo={rubricaByCodigo}
            isAdmin={isAdmin}
            onReavaliar={() => reavaliar.mutate(drill.readai_meeting_id)}
          />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Sub-components ---------------- */
function SortableTh({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <th className="text-left px-2 py-3">
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 hover:text-primary transition-colors",
          active ? "text-primary" : "text-muted-foreground"
        )}
      >
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );
}

function FormulaBox({
  step,
  title,
  desc,
  tone,
}: {
  step: string;
  title: string;
  desc: string;
  tone: "emerald" | "red" | "primary";
}) {
  const tones = {
    emerald: { border: "border-emerald-500/30", bg: "bg-emerald-500/5", chip: "bg-emerald-500 text-background" },
    red: { border: "border-red-500/30", bg: "bg-red-500/5", chip: "bg-red-500 text-background" },
    primary: { border: "border-primary/40", bg: "bg-primary/5", chip: "bg-primary text-primary-foreground" },
  }[tone];
  return (
    <div className={cn("flex-1 rounded-lg p-4 border", tones.border, tones.bg)}>
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn(
            "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold tabular-nums",
            tones.chip
          )}
        >
          {step}
        </span>
        <span className="font-semibold text-foreground text-sm">{title}</span>
      </div>
      <p className="text-xs leading-snug text-muted-foreground">{desc}</p>
    </div>
  );
}

function FormulaOp({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center md:px-1">
      <div className="text-primary">{icon}</div>
    </div>
  );
}

/* ---------------- Drill-down content ---------------- */
function DrillContent({
  a,
  lead,
  meet,
  rubricaByCodigo,
  isAdmin,
  onReavaliar,
}: {
  a: Avaliacao;
  lead: any;
  meet: any;
  rubricaByCodigo: Map<string, RubricaItem>;
  isAdmin: boolean;
  onReavaliar: () => void;
}) {
  const [showTranscript, setShowTranscript] = useState(false);
  const criterios = Object.entries(a.notas_criterios ?? {});

  const penalidadeTotal = (a.alertas_compliance ?? []).reduce((s, cod) => {
    const r = rubricaByCodigo.get(cod);
    return s + (r?.penalidade ?? 0);
  }, 0);

  const geralTone = notaTone(a.nota_geral);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-left">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-1">
            Detalhamento da reunião
          </div>
          <div className="text-xl font-bold text-foreground">
            {lead?.empresa || lead?.nome || meet?.meeting_title || "Reunião"}
          </div>
          <div className="text-xs text-muted-foreground font-normal mt-0.5">
            {a.closer ?? "—"} ·{" "}
            {meet?.meeting_date
              ? new Date(meet.meeting_date).toLocaleString("pt-BR")
              : new Date(a.created_at).toLocaleString("pt-BR")}
          </div>
        </DialogTitle>
      </DialogHeader>

      {/* Equação da nota */}
      <div className="rounded-lg p-4 flex items-center justify-center gap-3 flex-wrap border border-border bg-muted/30">
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Técnica</div>
          <div className="text-3xl font-bold tabular-nums text-emerald-400">
            {a.nota_tecnica == null ? "—" : Math.round(a.nota_tecnica)}
          </div>
        </div>
        <Minus className="h-5 w-5 text-muted-foreground" />
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Penalidades</div>
          <div className="text-3xl font-bold tabular-nums text-red-500">
            {penalidadeTotal > 0 ? penalidadeTotal : "0"}
          </div>
        </div>
        <Equal className="h-5 w-5 text-muted-foreground" />
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Nota geral</div>
          <div className={cn("text-4xl font-bold tabular-nums", geralTone.text)}>
            {a.nota_geral == null ? "—" : Math.round(a.nota_geral)}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Alertas */}
        {a.alertas_compliance && a.alertas_compliance.length > 0 && (
          <div className="rounded-lg p-4 border border-red-500/30 bg-red-500/5">
            <div className="flex items-center gap-2 font-semibold mb-2 text-sm text-red-500">
              <AlertTriangle className="h-4 w-4" /> Alertas de compliance
            </div>
            <div className="flex flex-wrap gap-2">
              {a.alertas_compliance.map((cod) => {
                const r = rubricaByCodigo.get(cod);
                return (
                  <span
                    key={cod}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-red-500/40 bg-red-500/10 text-foreground tabular-nums"
                  >
                    {r?.penalidade != null && (
                      <span className="text-red-500 font-bold">−{r.penalidade}</span>
                    )}
                    {r?.titulo ?? cod}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Breakdown */}
        {criterios.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Breakdown por critério</h3>
            <div className="space-y-2.5">
              {criterios.map(([cod, nota]) => {
                const r = rubricaByCodigo.get(cod);
                const pct = Math.max(0, Math.min(100, (Number(nota) / 10) * 100));
                const t = notaTone(Number(nota) * 10);
                return (
                  <div key={cod}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-foreground">
                        {r?.titulo ?? cod}
                        {r?.peso != null && (
                          <span className="text-muted-foreground"> · peso {r.peso}</span>
                        )}
                      </span>
                      <span className={cn("font-mono font-semibold tabular-nums", t.text)}>
                        {Number(nota).toFixed(1)}/10
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: t.hex }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Resumo do treinador */}
        {a.resumo_treinador && (
          <div className="rounded-lg p-4 relative pl-5 bg-muted/30 border border-border">
            <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-primary" />
            <div className="text-[10px] uppercase tracking-[0.18em] mb-1.5 text-primary font-semibold">
              Resumo do treinador
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {a.resumo_treinador}
            </p>
          </div>
        )}

        {/* Fortes & melhorias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {a.pontos_fortes && a.pontos_fortes.length > 0 && (
            <div className="rounded-lg p-4 border border-emerald-500/30 bg-emerald-500/5">
              <div className="font-semibold mb-2 text-sm text-emerald-400 flex items-center gap-1.5">
                ▲ Pontos fortes
              </div>
              <ul className="space-y-1 text-sm text-foreground">
                {a.pontos_fortes.map((p, i) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            </div>
          )}
          {a.pontos_melhoria && a.pontos_melhoria.length > 0 && (
            <div className="rounded-lg p-4 border border-yellow-500/30 bg-yellow-500/5">
              <div className="font-semibold mb-2 text-sm text-yellow-500 flex items-center gap-1.5">
                ▼ A treinar
              </div>
              <ul className="space-y-1 text-sm text-foreground">
                {a.pontos_melhoria.map((p, i) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Gatilhos */}
        {a.gatilhos_detectados && a.gatilhos_detectados.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Gatilhos detectados</h3>
            <div className="flex flex-wrap gap-2">
              {a.gatilhos_detectados.map((g, i) => (
                <Badge key={i} variant="secondary">{g}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
          {meet && (meet.summary || meet.transcript) && (
            <Button variant="outline" size="sm" onClick={() => setShowTranscript((v) => !v)}>
              {showTranscript ? "Ocultar" : "Ver transcrição/resumo"}
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={onReavaliar}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Reavaliar
            </Button>
          )}
        </div>

        {showTranscript && meet && (
          <div className="space-y-2">
            {meet.summary && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap text-foreground">
                <div className="text-xs font-semibold mb-1 text-muted-foreground">Resumo</div>
                {meet.summary}
              </div>
            )}
            {meet.transcript && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap max-h-96 overflow-y-auto text-foreground">
                <div className="text-xs font-semibold mb-1 text-muted-foreground">Transcrição</div>
                {meet.transcript}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
