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

/* ---------------- Design tokens (Cartografia Calibrada) ---------------- */
const SIG = {
  green: "#56B98A",
  teal: "#54A8B0",
  amber: "#E0A33E",
  red: "#D9594C",
  brass: "#C8A35B",
};
const SURFACE = {
  page: "bg-[#0E1726]",
  card: "bg-[#15223A] border border-[rgba(176,198,232,0.12)]",
  raised: "bg-[#1C2C49] border border-[rgba(176,198,232,0.12)]",
  text: "text-[#EAEFF8]",
  textMuted: "text-[#8595B4]",
};

function sigColor(n: number | null | undefined): string {
  if (n == null) return SIG.teal;
  if (n >= 85) return SIG.green;
  if (n >= 70) return SIG.teal;
  if (n >= 50) return SIG.amber;
  return SIG.red;
}
function sigBgBorder(n: number | null | undefined) {
  const c = sigColor(n);
  return { backgroundColor: `${c}22`, borderColor: `${c}66`, color: c };
}

/* ---------------- Notas ---------------- */
function NotaPill({ value, size = "md" }: { value: number | null; size?: "sm" | "md" | "lg" | "xl" }) {
  const sz =
    size === "xl"
      ? "text-4xl px-5 py-2 font-serif"
      : size === "lg"
      ? "text-2xl px-4 py-1.5 font-serif"
      : size === "sm"
      ? "text-xs px-2 py-0.5"
      : "text-base px-3 py-1";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border font-bold tabular-nums ${sz}`}
      style={sigBgBorder(value)}
    >
      {value == null ? "—" : Math.round(value)}
    </span>
  );
}

/* ---------------- KPI Card ---------------- */
function KpiCard({
  label,
  value,
  hint,
  accent = false,
  valueColor,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  accent?: boolean;
  valueColor?: string;
}) {
  return (
    <div
      className={`relative rounded-[14px] ${SURFACE.card} p-5 overflow-hidden`}
    >
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: accent ? SIG.brass : "rgba(200,163,91,0.35)" }}
      />
      <div
        className={`text-[10px] uppercase tracking-[0.18em] ${SURFACE.textMuted} font-medium`}
      >
        {label}
      </div>
      <div
        className="mt-2 text-3xl font-serif font-semibold tabular-nums"
        style={{ color: valueColor ?? "#EAEFF8" }}
      >
        {value}
      </div>
      <div className={`mt-3 text-[11px] leading-snug ${SURFACE.textMuted}`}>
        {hint}
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

  return (
    <div className={`min-h-screen ${SURFACE.page} ${SURFACE.text}`}>
      <main className="p-4 sm:p-6 lg:p-10">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3 pb-4 border-b border-[rgba(176,198,232,0.12)]">
            <div>
              <div
                className="text-[10px] uppercase tracking-[0.32em] font-medium"
                style={{ color: SIG.brass }}
              >
                Painel do Treinador · Pena Quadros
              </div>
              <h1 className="mt-1 text-4xl font-serif font-semibold text-[#EAEFF8] flex items-center gap-3">
                Sales Enablement
              </h1>
              <p className={`mt-1 text-sm ${SURFACE.textMuted} max-w-xl`}>
                Cada reunião realizada do mês recebe uma nota de 0 a 100 pela IA. O placar
                premia quem fecha certo — não só quem fecha.
              </p>
            </div>
            <Button
              onClick={refetchAll}
              variant="outline"
              size="sm"
              className="bg-transparent border-[rgba(200,163,91,0.4)] text-[#C8A35B] hover:bg-[rgba(200,163,91,0.08)] hover:text-[#C8A35B]"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Reuniões avaliadas"
              value={
                <span>
                  {totalAvaliadas}
                  <span className="text-xl text-[#8595B4]"> / {totalElegiveis}</span>
                </span>
              }
              hint="Elegíveis = realizadas do mês (Reunião Realizada → Contrato Assinado), com transcrição."
              accent
            />
            <KpiCard
              label="Nota média do time"
              value={totalAvaliadas > 0 ? Math.round(notaMediaGeral) : "—"}
              valueColor={sigColor(notaMediaGeral)}
              hint="Nota geral média = nota técnica − penalidades de compliance."
            />
            <KpiCard
              label="Índice de compliance"
              value={`${Math.round(complianceIdx)}%`}
              valueColor={complianceIdx >= 85 ? SIG.green : complianceIdx >= 70 ? SIG.amber : SIG.red}
              hint="Reuniões sem violação grave (g1/g2) ÷ total avaliadas."
            />
            <KpiCard
              label="Conversão calibrada"
              value={totalOutcomes > 0 ? `${Math.round(conversaoCalibrada)}%` : "—"}
              valueColor={sigColor(conversaoCalibrada)}
              hint={`Pagou ÷ reuniões com desfecho registrado (${totalPagaram}/${totalOutcomes}).`}
            />
          </div>

          {/* Como a nota é construída */}
          <div className={`rounded-[14px] ${SURFACE.card} p-5`}>
            <div
              className="text-[10px] uppercase tracking-[0.18em] font-medium mb-4"
              style={{ color: SIG.brass }}
            >
              Como a nota é construída
            </div>
            <div className="flex flex-col md:flex-row items-stretch gap-3">
              <FormulaBox
                step="1"
                title="Nota técnica"
                desc="Soma ponderada dos 8 critérios (cada um 0–10 × seu peso)."
                color={SIG.teal}
              />
              <FormulaOp icon={<Minus className="h-5 w-5" />} />
              <FormulaBox
                step="2"
                title="Penalidades · Guardrails"
                desc="Cada violação de compliance acionada subtrai pontos."
                color={SIG.red}
              />
              <FormulaOp icon={<Equal className="h-5 w-5" />} />
              <FormulaBox
                step="3"
                title="Nota geral"
                desc="O número que rankeia. Premia quem fecha certo, não só quem fecha."
                color={SIG.brass}
              />
            </div>
          </div>

          {totalAvaliadas === 0 && !isLoading && (
            <div className={`rounded-[14px] ${SURFACE.card} py-16 text-center`}>
              <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-40" style={{ color: SIG.brass }} />
              <p className={SURFACE.textMuted}>
                As notas aparecem automaticamente conforme as reuniões realizadas do mês são processadas.
              </p>
            </div>
          )}

          <Tabs defaultValue="placar" className="w-full">
            <TabsList className="bg-[#15223A] border border-[rgba(176,198,232,0.12)] p-1 h-auto">
              <TabsTrigger
                value="placar"
                className="data-[state=active]:bg-[#1C2C49] data-[state=active]:text-[#C8A35B] text-[#8595B4]"
              >
                <Trophy className="h-4 w-4 mr-1.5" />Placar
              </TabsTrigger>
              <TabsTrigger
                value="melhores"
                className="data-[state=active]:bg-[#1C2C49] data-[state=active]:text-[#C8A35B] text-[#8595B4]"
              >
                <Star className="h-4 w-4 mr-1.5" />Melhores
              </TabsTrigger>
              <TabsTrigger
                value="calibracao"
                className="data-[state=active]:bg-[#1C2C49] data-[state=active]:text-[#C8A35B] text-[#8595B4]"
              >
                <Gauge className="h-4 w-4 mr-1.5" />Calibração
              </TabsTrigger>
              <TabsTrigger
                value="biblioteca"
                className="data-[state=active]:bg-[#1C2C49] data-[state=active]:text-[#C8A35B] text-[#8595B4]"
              >
                <BookOpen className="h-4 w-4 mr-1.5" />Biblioteca
              </TabsTrigger>
            </TabsList>

            {/* PLACAR */}
            <TabsContent value="placar" className="space-y-4 mt-6">
              <div className={`rounded-[14px] ${SURFACE.card} overflow-hidden`}>
                <div className="flex items-center justify-between p-5 border-b border-[rgba(176,198,232,0.12)]">
                  <div>
                    <h2 className="text-base font-semibold text-[#EAEFF8]">Ranking de Closers</h2>
                    <p className={`text-xs ${SURFACE.textMuted} mt-0.5`}>
                      Ordene clicando nos cabeçalhos. O filtro atenua quem não foi selecionado.
                    </p>
                  </div>
                  <Select value={closerFilter || "__all"} onValueChange={(v) => setCloserFilter(v === "__all" ? "" : v)}>
                    <SelectTrigger className="w-48 bg-[#1C2C49] border-[rgba(176,198,232,0.12)] text-[#EAEFF8]">
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.14em] text-[#8595B4]">
                      <th className="text-left px-5 py-3 w-12">#</th>
                      <th className="text-left px-2 py-3">Closer</th>
                      <SortableTh
                        active={sortKey === "nota"}
                        onClick={() => setSortKey("nota")}
                      >
                        Nota média
                      </SortableTh>
                      <SortableTh
                        active={sortKey === "reunioes"}
                        onClick={() => setSortKey("reunioes")}
                      >
                        Reuniões
                      </SortableTh>
                      <SortableTh
                        active={sortKey === "alertas"}
                        onClick={() => setSortKey("alertas")}
                      >
                        Alertas
                      </SortableTh>
                      <SortableTh
                        active={sortKey === "conv"}
                        onClick={() => setSortKey("conv")}
                      >
                        Conversão real
                      </SortableTh>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingSorted.length === 0 && (
                      <tr>
                        <td colSpan={6} className={`px-5 py-8 text-center ${SURFACE.textMuted}`}>
                          Sem ranking ainda.
                        </td>
                      </tr>
                    )}
                    {rankingSorted.map((r, i) => {
                      const dim = closerFilter && r.closer !== closerFilter;
                      const conv = r.leads_com_outcome
                        ? (r.leads_pagaram / r.leads_com_outcome) * 100
                        : null;
                      return (
                        <tr
                          key={r.closer}
                          className={`border-t border-[rgba(176,198,232,0.08)] hover:bg-[#1C2C49]/60 transition-all ${
                            dim ? "opacity-30" : ""
                          }`}
                        >
                          <td className="px-5 py-4 font-serif text-lg text-[#8595B4] tabular-nums">
                            {i + 1}
                          </td>
                          <td className="px-2 py-4">
                            <div className="font-semibold text-[#EAEFF8]">{r.closer}</div>
                          </td>
                          <td className="px-2 py-4">
                            <NotaPill value={r.nota_media} />
                          </td>
                          <td className="px-2 py-4 tabular-nums text-[#EAEFF8]">
                            {r.reunioes_avaliadas}
                          </td>
                          <td className="px-2 py-4">
                            {r.reunioes_com_alerta > 0 ? (
                              <span
                                className="inline-flex items-center gap-1 font-semibold tabular-nums"
                                style={{ color: SIG.red }}
                              >
                                🚩 {r.reunioes_com_alerta}
                              </span>
                            ) : (
                              <span className={SURFACE.textMuted}>—</span>
                            )}
                          </td>
                          <td className="px-2 py-4 pr-5">
                            {conv == null ? (
                              <span className={SURFACE.textMuted}>—</span>
                            ) : (
                              <div className="flex items-center gap-2 min-w-[120px]">
                                <div className="flex-1 h-1.5 rounded-full bg-[#0E1726] overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(100, conv)}%`,
                                      backgroundColor: sigColor(conv),
                                    }}
                                  />
                                </div>
                                <span
                                  className="text-xs font-semibold tabular-nums w-10 text-right"
                                  style={{ color: sigColor(conv) }}
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
            </TabsContent>

            {/* MELHORES */}
            <TabsContent value="melhores" className="space-y-3 mt-6">
              <div className={`rounded-[14px] ${SURFACE.card} p-5`}>
                <h2 className="text-base font-semibold text-[#EAEFF8] mb-1">Top 20 Reuniões</h2>
                <p className={`text-xs ${SURFACE.textMuted} mb-4`}>
                  As maiores notas do período. Clique em uma linha para ver o detalhamento.
                </p>
                <div className="space-y-2">
                  {melhores.length === 0 && (
                    <div className={`text-sm ${SURFACE.textMuted}`}>Sem reuniões avaliadas.</div>
                  )}
                  {melhores.map((a) => {
                    const lead = a.lead_id ? leadById.get(a.lead_id) : null;
                    const meet = meetingById.get(a.readai_meeting_id);
                    const isGold = goldSet.has(a.readai_meeting_id);
                    return (
                      <div
                        key={a.id}
                        className={`flex items-center gap-3 p-3 rounded-lg ${SURFACE.raised} hover:border-[rgba(200,163,91,0.4)] transition-colors cursor-pointer`}
                        onClick={() => setDrillId(a.id)}
                      >
                        <NotaPill value={a.nota_geral} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[#EAEFF8] truncate flex items-center gap-2">
                            {lead?.empresa || lead?.nome || meet?.meeting_title || "Reunião"}
                            {isGold && (
                              <Star
                                className="h-3.5 w-3.5 fill-current"
                                style={{ color: SIG.brass }}
                              />
                            )}
                          </div>
                          <div className={`text-xs ${SURFACE.textMuted}`}>
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
                            className="bg-transparent border-[rgba(200,163,91,0.4)] text-[#C8A35B] hover:bg-[rgba(200,163,91,0.08)] hover:text-[#C8A35B]"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGold.mutate(a);
                            }}
                          >
                            {isGold ? "Remover gold" : "Marcar gold"}
                          </Button>
                        )}
                        <ChevronRight className="h-4 w-4 text-[#8595B4]" />
                      </div>
                    );
                  })}
                </div>
              </div>

              {isAdmin && errAvaliacoes.length > 0 && (
                <div className={`rounded-[14px] ${SURFACE.card} p-5`}>
                  <h3
                    className="text-sm font-semibold flex items-center gap-2 mb-3"
                    style={{ color: SIG.red }}
                  >
                    <AlertTriangle className="h-4 w-4" /> Avaliações com erro
                  </h3>
                  <div className="space-y-2">
                    {errAvaliacoes.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-sm">
                        <span className={`${SURFACE.textMuted} truncate flex-1 font-mono text-xs`}>
                          {a.readai_meeting_id} — {a.erro ?? "erro"}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-transparent border-[rgba(200,163,91,0.4)] text-[#C8A35B] hover:bg-[rgba(200,163,91,0.08)] hover:text-[#C8A35B]"
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
            <TabsContent value="calibracao" className="space-y-4 mt-6">
              <div className={`rounded-[14px] ${SURFACE.card} p-5`}>
                <h2 className="text-base font-semibold text-[#EAEFF8]">Calibração da nota</h2>
                <p className={`text-xs ${SURFACE.textMuted} mt-1 mb-4`}>
                  Se a barra sobe da esquerda p/ direita, a nota está prevendo bem o fechamento.
                </p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={calibracao.data ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(176,198,232,0.1)" />
                      <XAxis
                        dataKey="faixa"
                        tick={{ fill: "#8595B4", fontSize: 11 }}
                        axisLine={{ stroke: "rgba(176,198,232,0.2)" }}
                      />
                      <YAxis
                        tick={{ fill: "#8595B4", fontSize: 11 }}
                        axisLine={{ stroke: "rgba(176,198,232,0.2)" }}
                        unit="%"
                      />
                      <RTooltip
                        contentStyle={{
                          backgroundColor: "#1C2C49",
                          border: "1px solid rgba(176,198,232,0.2)",
                          borderRadius: 8,
                          color: "#EAEFF8",
                        }}
                        cursor={{ fill: "rgba(200,163,91,0.06)" }}
                      />
                      <Bar dataKey="taxa_pagamento_pct" radius={[6, 6, 0, 0]}>
                        {(calibracao.data ?? []).map((c, i) => {
                          const ref =
                            c.faixa === "85-100" ? 90 : c.faixa === "70-84" ? 77 : c.faixa === "50-69" ? 60 : 30;
                          return <Cell key={i} fill={sigColor(ref)} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {isAdmin && (
                <div className={`rounded-[14px] ${SURFACE.card} p-5`}>
                  <h3 className="text-base font-semibold text-[#EAEFF8] mb-1">Registrar resultado</h3>
                  <p className={`text-xs ${SURFACE.textMuted} mb-4`}>
                    Alimenta a calibração: cada desfecho registrado afina a previsão da nota.
                  </p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Select value={outcomeLeadId} onValueChange={setOutcomeLeadId}>
                        <SelectTrigger className="bg-[#1C2C49] border-[rgba(176,198,232,0.12)] text-[#EAEFF8]">
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
                        <SelectTrigger className="bg-[#1C2C49] border-[rgba(176,198,232,0.12)] text-[#EAEFF8]">
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
                        className="bg-[#1C2C49] border-[rgba(176,198,232,0.12)] text-[#EAEFF8]"
                      />
                      <Input
                        placeholder="Observação (opcional)"
                        value={outcomeObs}
                        onChange={(e) => setOutcomeObs(e.target.value)}
                        className="bg-[#1C2C49] border-[rgba(176,198,232,0.12)] text-[#EAEFF8]"
                      />
                    </div>
                    <Button
                      onClick={() => registrarOutcome.mutate()}
                      disabled={registrarOutcome.isPending}
                      style={{ backgroundColor: SIG.brass, color: "#0E1726" }}
                      className="hover:opacity-90"
                    >
                      Registrar
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* BIBLIOTECA */}
            <TabsContent value="biblioteca" className="space-y-4 mt-6">
              <div className={`rounded-[14px] ${SURFACE.card} p-5`}>
                <h2 className="text-base font-semibold text-[#EAEFF8]">Critérios</h2>
                <p className={`text-xs ${SURFACE.textMuted} mt-1 mb-4`}>
                  O manual do que conta como uma boa reunião. Pesos somam a nota técnica.
                </p>
                <div className="space-y-3">
                  {(rubrica.data ?? [])
                    .filter((r) => r.tipo === "criterio")
                    .sort((a, b) => (b.peso ?? 0) - (a.peso ?? 0))
                    .map((r) => (
                      <div key={r.id} className={`rounded-lg ${SURFACE.raised} p-4`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-[#EAEFF8]">{r.titulo}</div>
                          <Badge
                            variant="outline"
                            className="border-[rgba(200,163,91,0.4)] text-[#C8A35B] bg-transparent tabular-nums"
                          >
                            peso {r.peso ?? "—"}
                          </Badge>
                        </div>
                        {r.descricao && (
                          <p className={`text-sm ${SURFACE.textMuted} mt-2`}>{r.descricao}</p>
                        )}
                        {r.como_pontuar && (
                          <p className={`text-xs ${SURFACE.textMuted} mt-2 opacity-80`}>
                            <span className="font-medium">Como pontuar:</span> {r.como_pontuar}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              <div className={`rounded-[14px] ${SURFACE.card} p-5`}>
                <h2 className="text-base font-semibold mb-1" style={{ color: SIG.red }}>
                  O que NÃO fazer
                </h2>
                <p className={`text-xs ${SURFACE.textMuted} mb-4`}>
                  Guardrails de compliance. Cada violação subtrai da nota técnica.
                </p>
                <div className="space-y-2">
                  {(rubrica.data ?? [])
                    .filter((r) => r.tipo === "guardrail")
                    .map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg p-4 border"
                        style={{
                          borderColor: `${SIG.red}55`,
                          backgroundColor: `${SIG.red}0F`,
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-[#EAEFF8]">{r.titulo}</div>
                          {r.penalidade != null && (
                            <span
                              className="text-xs font-bold tabular-nums px-2 py-0.5 rounded"
                              style={{
                                color: SIG.red,
                                backgroundColor: `${SIG.red}22`,
                              }}
                            >
                              −{r.penalidade}
                            </span>
                          )}
                        </div>
                        {r.descricao && (
                          <p className={`text-sm ${SURFACE.textMuted} mt-2`}>{r.descricao}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              <div className={`rounded-[14px] ${SURFACE.card} p-5`}>
                <h2 className="text-base font-semibold text-[#EAEFF8] flex items-center gap-2">
                  Exemplos gold
                  <Star className="h-4 w-4 fill-current" style={{ color: SIG.brass }} />
                </h2>
                <p className={`text-xs ${SURFACE.textMuted} mt-1 mb-4`}>
                  Reuniões de referência para o time estudar.
                </p>
                <div className="space-y-1">
                  {(exemplosGold.data ?? []).length === 0 && (
                    <div className={`text-sm ${SURFACE.textMuted}`}>
                      Nenhum exemplo marcado ainda.
                    </div>
                  )}
                  {(exemplosGold.data ?? []).map((g) => {
                    const a = okAvaliacoes.find((x) => x.readai_meeting_id === g.readai_meeting_id);
                    const lead = g.lead_id ? leadById.get(g.lead_id) : null;
                    return (
                      <button
                        key={g.id}
                        onClick={() => a && setDrillId(a.id)}
                        className="w-full flex items-center justify-between text-sm py-2.5 px-3 rounded hover:bg-[#1C2C49] transition-colors"
                      >
                        <span className="text-[#EAEFF8]">
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#15223A] border-[rgba(176,198,232,0.12)] text-[#EAEFF8]">
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
        className={`inline-flex items-center gap-1 hover:text-[#C8A35B] transition-colors ${
          active ? "text-[#C8A35B]" : "text-[#8595B4]"
        }`}
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
  color,
}: {
  step: string;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <div
      className="flex-1 rounded-lg p-4 border"
      style={{
        borderColor: `${color}55`,
        backgroundColor: `${color}10`,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold tabular-nums"
          style={{ backgroundColor: color, color: "#0E1726" }}
        >
          {step}
        </span>
        <span className="font-semibold text-[#EAEFF8] text-sm">{title}</span>
      </div>
      <p className="text-xs leading-snug text-[#8595B4]">{desc}</p>
    </div>
  );
}

function FormulaOp({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center md:px-1">
      <div className="text-[#C8A35B]">{icon}</div>
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

  // Penalidade total (a partir dos alertas detectados × rubrica)
  const penalidadeTotal = (a.alertas_compliance ?? []).reduce((s, cod) => {
    const r = rubricaByCodigo.get(cod);
    return s + (r?.penalidade ?? 0);
  }, 0);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-left">
          <div
            className="text-[10px] uppercase tracking-[0.18em] font-medium mb-1"
            style={{ color: SIG.brass }}
          >
            Detalhamento da reunião
          </div>
          <div className="text-xl font-serif font-semibold text-[#EAEFF8]">
            {lead?.empresa || lead?.nome || meet?.meeting_title || "Reunião"}
          </div>
          <div className="text-xs text-[#8595B4] font-normal mt-0.5">
            {a.closer ?? "—"} ·{" "}
            {meet?.meeting_date
              ? new Date(meet.meeting_date).toLocaleString("pt-BR")
              : new Date(a.created_at).toLocaleString("pt-BR")}
          </div>
        </DialogTitle>
      </DialogHeader>

      {/* Equação da nota */}
      <div
        className="rounded-lg p-4 flex items-center justify-center gap-3 flex-wrap"
        style={{ backgroundColor: "#1C2C49", border: "1px solid rgba(176,198,232,0.12)" }}
      >
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-[0.18em] text-[#8595B4] mb-1">
            Técnica
          </div>
          <div className="text-3xl font-serif font-bold tabular-nums" style={{ color: SIG.teal }}>
            {a.nota_tecnica == null ? "—" : Math.round(a.nota_tecnica)}
          </div>
        </div>
        <Minus className="h-5 w-5 text-[#8595B4]" />
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-[0.18em] text-[#8595B4] mb-1">
            Penalidades
          </div>
          <div className="text-3xl font-serif font-bold tabular-nums" style={{ color: SIG.red }}>
            {penalidadeTotal > 0 ? penalidadeTotal : "0"}
          </div>
        </div>
        <Equal className="h-5 w-5 text-[#8595B4]" />
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-[0.18em] text-[#8595B4] mb-1">
            Nota geral
          </div>
          <div
            className="text-4xl font-serif font-bold tabular-nums"
            style={{ color: sigColor(a.nota_geral) }}
          >
            {a.nota_geral == null ? "—" : Math.round(a.nota_geral)}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Alertas */}
        {a.alertas_compliance && a.alertas_compliance.length > 0 && (
          <div
            className="rounded-lg p-4 border"
            style={{ borderColor: `${SIG.red}55`, backgroundColor: `${SIG.red}10` }}
          >
            <div
              className="flex items-center gap-2 font-semibold mb-2 text-sm"
              style={{ color: SIG.red }}
            >
              <AlertTriangle className="h-4 w-4" /> Alertas de compliance
            </div>
            <div className="flex flex-wrap gap-2">
              {a.alertas_compliance.map((cod) => {
                const r = rubricaByCodigo.get(cod);
                return (
                  <span
                    key={cod}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border tabular-nums"
                    style={{
                      borderColor: `${SIG.red}66`,
                      backgroundColor: `${SIG.red}22`,
                      color: "#EAEFF8",
                    }}
                  >
                    {r?.penalidade != null && (
                      <span style={{ color: SIG.red }} className="font-bold">
                        −{r.penalidade}
                      </span>
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
            <h3 className="text-sm font-semibold text-[#EAEFF8] mb-3">Breakdown por critério</h3>
            <div className="space-y-2.5">
              {criterios.map(([cod, nota]) => {
                const r = rubricaByCodigo.get(cod);
                const pct = Math.max(0, Math.min(100, (Number(nota) / 10) * 100));
                const c = sigColor(Number(nota) * 10);
                return (
                  <div key={cod}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[#EAEFF8]">
                        {r?.titulo ?? cod}
                        {r?.peso != null && (
                          <span className="text-[#8595B4]"> · peso {r.peso}</span>
                        )}
                      </span>
                      <span className="font-mono font-semibold tabular-nums" style={{ color: c }}>
                        {Number(nota).toFixed(1)}/10
                      </span>
                    </div>
                    <div className="h-2 bg-[#0E1726] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: c }}
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
          <div
            className="rounded-lg p-4 relative pl-5"
            style={{ backgroundColor: "#1C2C49" }}
          >
            <span
              className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
              style={{ backgroundColor: SIG.brass }}
            />
            <div
              className="text-[10px] uppercase tracking-[0.18em] mb-1.5"
              style={{ color: SIG.brass }}
            >
              Resumo do treinador
            </div>
            <p className="text-sm text-[#EAEFF8] whitespace-pre-wrap leading-relaxed">
              {a.resumo_treinador}
            </p>
          </div>
        )}

        {/* Fortes & melhorias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {a.pontos_fortes && a.pontos_fortes.length > 0 && (
            <div
              className="rounded-lg p-4 border"
              style={{ borderColor: `${SIG.green}55`, backgroundColor: `${SIG.green}10` }}
            >
              <div
                className="font-semibold mb-2 text-sm flex items-center gap-1.5"
                style={{ color: SIG.green }}
              >
                ▲ Pontos fortes
              </div>
              <ul className="space-y-1 text-sm text-[#EAEFF8]">
                {a.pontos_fortes.map((p, i) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            </div>
          )}
          {a.pontos_melhoria && a.pontos_melhoria.length > 0 && (
            <div
              className="rounded-lg p-4 border"
              style={{ borderColor: `${SIG.amber}55`, backgroundColor: `${SIG.amber}10` }}
            >
              <div
                className="font-semibold mb-2 text-sm flex items-center gap-1.5"
                style={{ color: SIG.amber }}
              >
                ▼ A treinar
              </div>
              <ul className="space-y-1 text-sm text-[#EAEFF8]">
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
            <h3 className="text-sm font-semibold text-[#EAEFF8] mb-2">Gatilhos detectados</h3>
            <div className="flex flex-wrap gap-2">
              {a.gatilhos_detectados.map((g, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-md border border-[rgba(176,198,232,0.2)] bg-[#1C2C49] text-[#EAEFF8]"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-[rgba(176,198,232,0.12)]">
          {meet && (meet.summary || meet.transcript) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTranscript((v) => !v)}
              className="bg-transparent border-[rgba(176,198,232,0.2)] text-[#EAEFF8] hover:bg-[#1C2C49]"
            >
              {showTranscript ? "Ocultar" : "Ver transcrição/resumo"}
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReavaliar}
              className="bg-transparent border-[rgba(200,163,91,0.4)] text-[#C8A35B] hover:bg-[rgba(200,163,91,0.08)] hover:text-[#C8A35B]"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Reavaliar
            </Button>
          )}
        </div>

        {showTranscript && meet && (
          <div className="space-y-2">
            {meet.summary && (
              <div className="rounded-lg p-3 text-sm whitespace-pre-wrap bg-[#1C2C49] border border-[rgba(176,198,232,0.12)] text-[#EAEFF8]">
                <div className="text-xs font-semibold mb-1 text-[#8595B4]">Resumo</div>
                {meet.summary}
              </div>
            )}
            {meet.transcript && (
              <div className="rounded-lg p-3 text-xs whitespace-pre-wrap max-h-96 overflow-y-auto bg-[#1C2C49] border border-[rgba(176,198,232,0.12)] text-[#EAEFF8]">
                <div className="text-xs font-semibold mb-1 text-[#8595B4]">Transcrição</div>
                {meet.transcript}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
