import { useState, useMemo, Fragment } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
import { useToast } from "@/hooks/use-toast";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Gauge,
  ArrowUpDown,
  BookOpen,
  Users,
  Star,
  DollarSign,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "@/components/PersonAvatar";
import {
  AssertividadeTab,
  DesfechoChip,
  fmtDiasAssinatura,
  type AssertividadeRow,
  type NotaXConversaoRow,
  type ReuniaoDesfechoRow,
} from "@/components/se/AssertividadeTab";
import { PlacarTab } from "@/components/se/PlacarTab";
import { useAuth } from "@/contexts/AuthContext";


/* ---------------- Types ---------------- */
type MesOption = { mes: string; is_atual: boolean | null };

type EvolucaoRow = {
  closer: string | null;
  mes: string | null;
  mes_ant: string | null;
  reunioes_notadas: number | null;
  tecnica_media: number | null;
  tecnica_ant: number | null;
  delta_tecnica: number | null;
  final_media: number | null;
  final_ant: number | null;
  delta_final: number | null;
  v2_media: number | null;
  v2_ant: number | null;
  delta_v2: number | null;
  melhor_crit: string | null;
  melhor_crit_nome: string | null;
  melhor_delta: number | null;
  pior_crit: string | null;
  pior_crit_nome: string | null;
  pior_delta: number | null;
  resumo: string | null;
};

type NotasMensaisRow = {
  closer: string | null;
  mes: string;
  reunioes_notadas: number | null;
  tecnica_media: number | null;
  final_media: number | null;
  v2_media: number | null;
} & Record<string, any>;

type DesempenhoMeta = {
  closer: string | null;
  mes: string | null;
  realizadas: number | null;
  meta_realizadas: number | null;
  vendas: number | null;
  meta_vendas: number | null;
  conversao: number | null;
  meta_conversao: number | null;
  faturamento: number | null;
  meta_faturamento: number | null;
  ticket_medio: number | null;
  meta_ticket_medio: number | null;
  tecnica_media: number | null;
  final_media: number | null;
  reunioes_notadas: number | null;
  dia_atual: number | null;
  dias_mes: number | null;
  investido: number | null;
  custo_por_venda: number | null;
  custo_reuniao: number | null;
  roi: number | null;
  posicao: number | null;
  medalha: string | null;
};

type Alerta = {
  closer: string | null;
  severidade: "critico" | "atencao" | "info" | "ok" | string | null;
  tipo: string | null;
  titulo: string | null;
  sugestao: string | null;
  ordem: number | null;
};

type ReuniaoSE = {
  reuniao_id: string;
  avaliacao_id: string | null;
  lead_id: string | null;
  meeting_date: string | null;
  quando_local: string | null;
  empresa: string | null;
  closer: string | null;
  etapa_atual: string | null;
  lead_status: string | null;
  nota_tecnica: number | null;
  nota_final: number | null;
  nota_v2: number | null;
  nota: number | null;
  penalidades: number | null;
  bonus_outcome: number | null;
  outcome_resultado: string | null;
  outcome_obs: string | null;
  outcome_em: string | null;
  guardrails: string[] | null;
  notas_criterios: Record<string, number> | null;
  pontos_fortes: string[] | null;
  pontos_melhoria: string[] | null;
  resumo_treinador: string | null;
  modelo: string | null;
  prompt_versao: string | null;
  rubrica_versao: string | null;
  ignorada?: boolean | null;
  ignorada_motivo?: string | null;
};

type RubricaRow = {
  tipo: string | null;
  codigo: string | null;
  titulo: string | null;
  peso: number | null;
  penalidade: number | null;
  descricao: string | null;
  como_pontuar: string | null;
  ativo?: boolean | null;
};

/* ---------------- Labels ---------------- */
const GUARDRAIL_LABELS: Record<string, string> = {
  g1_promete_70: "Prometeu 70% como certo",
  g2_sem_mensalidade: "Deu a entender que pode não pagar mensalidade",
  g3_modelo_nao_claro: "Modelo mensalidade+êxito não ficou claro",
  g4_rescisao_nao_clara: "Não esclareceu rescisão 30 dias",
  g5_sem_ancoragem: "Fechou sem ancorar valor cheio",
};

const CRITERIO_LABELS: Record<string, string> = {
  abertura: "Abertura & Rapport",
  diagnostico: "Diagnóstico",
  agitacao_urgencia: "Implicação",
  metodo_pqa: "Método PQA",
  ancoragem_valor: "Ancoragem",
  contorno_objecoes: "Objeções",
  fechamento_call: "Fechamento",
  jornada_confianca: "Jornada",
};

const CRITERIO_ORDER = [
  "abertura",
  "diagnostico",
  "agitacao_urgencia",
  "metodo_pqa",
  "ancoragem_valor",
  "contorno_objecoes",
  "fechamento_call",
  "jornada_confianca",
];

/* ---------------- Helpers ---------------- */
const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

function notaClass(n: number | null | undefined) {
  if (n === null || n === undefined) return "text-muted-foreground";
  if (n >= 70) return "text-emerald-500";
  if (n >= 50) return "text-yellow-500";
  if (n >= 35) return "text-orange-500";
  return "text-red-500";
}

function barColor(pct: number) {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 60) return "bg-yellow-500";
  return "bg-red-500";
}

function sevStyles(sev: string | null | undefined) {
  switch (sev) {
    case "critico":
      return { bar: "bg-red-500", text: "text-red-500" };
    case "atencao":
    case "warn":
      return { bar: "bg-yellow-500", text: "text-yellow-500" };
    case "ok":
      return { bar: "bg-emerald-500", text: "text-emerald-500" };
    default:
      return { bar: "bg-purple-500", text: "text-purple-500" };
  }
}

function fmtQuando(iso: string | null) {
  if (!iso) return "—";
  const s = iso.length <= 10 ? `${iso}T00:00:00` : iso;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function isToday(iso: string | null) {
  if (!iso) return false;
  const s = iso.length <= 10 ? `${iso}T00:00:00` : iso;
  const d = new Date(s);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ---------------- Small UI ---------------- */
function KpiCard({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span className="truncate">{label}</span>
      </div>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function MetaBar({
  label,
  atual,
  meta,
  format = (n: number) => String(Math.round(n)),
  pace,
}: {
  label: string;
  atual: number;
  meta: number;
  format?: (n: number) => string;
  /** quando informado, o alvo até hoje (ritmo esperado) */
  pace?: number | null;
}) {
  const alvo = pace ?? meta;
  const pct = alvo > 0 ? (atual / alvo) * 100 : atual > 0 ? 100 : 0;
  const width = Math.min(100, Math.max(0, pct));
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">
          {format(atual)}{" "}
          <span className="text-muted-foreground font-normal">
            / {format(meta)}
          </span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor(pct))}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{Math.round(pct)}% do alvo</span>
        {pace != null && <span>ritmo esperado hoje: {format(pace)}</span>}
      </div>
    </div>
  );
}

function MiniCriterio({ code, value }: { code: string; value: number }) {
  const color =
    value >= 8 ? "bg-emerald-500" : value >= 6 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">
          {CRITERIO_LABELS[code] ?? code}
        </span>
        <span className="text-foreground font-medium">{value}/10</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${Math.min(100, (value / 10) * 100)}%` }}
        />
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function SalesEnablement() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [mesSelecionado, setMesSelecionado] = useState<string>("");

  const { data: meses = [] } = useQuery({
    queryKey: ["se-meses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_se_meses").select("*");
      if (error) throw error;
      return (data ?? []) as MesOption[];
    },
  });

  // seleciona por padrão o mês is_atual (fallback: primeiro da lista)
  const mes =
    mesSelecionado ||
    meses.find((m) => m.is_atual)?.mes ||
    meses[0]?.mes ||
    currentMonth();

  const enabled = !!mes;

  const { data: desempenho = [], isLoading: loadingDes } = useQuery({
    queryKey: ["se-desempenho-meta", mes],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_se_desempenho_meta")
        .select("*")
        .eq("mes", mes);
      if (error) throw error;
      return (data ?? []) as DesempenhoMeta[];
    },
  });

  const { data: alertas = [] } = useQuery({
    queryKey: ["se-alertas", mes],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_se_alertas")
        .select("*")
        .eq("mes", mes)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Alerta[];
    },
  });

  const { data: reunioes = [], isLoading: loadingReu } = useQuery({
    queryKey: ["se-reunioes", mes],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_se_reunioes")
        .select("*")
        .eq("mes", mes);
      if (error) throw error;
      return (data ?? []) as ReuniaoSE[];
    },
  });

  const { data: evolucao = [], isLoading: loadingEvo } = useQuery({
    queryKey: ["se-evolucao", mes],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_se_evolucao")
        .select("*")
        .eq("mes", mes);
      if (error) throw error;
      return (data ?? []) as EvolucaoRow[];
    },
  });

  const { data: notasMensais = [] } = useQuery({
    queryKey: ["se-notas-mensais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_se_notas_mensais")
        .select("*")
        .order("mes", { ascending: true });
      if (error) throw error;
      return (data ?? []) as NotasMensaisRow[];
    },
  });

  const { data: rubrica = [] } = useQuery({
    queryKey: ["se-rubrica"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("se_rubrica")
        .select("*")
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as RubricaRow[];
    },
  });

  /* ----- Assertividade do link (views somente leitura) ----- */
  const { data: assertividade = [], isLoading: loadingAss } = useQuery({
    queryKey: ["se-assertividade", mes],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_se_assertividade")
        .select("*")
        .eq("mes", mes);
      if (error) throw error;
      return (data ?? []) as AssertividadeRow[];
    },
  });

  const { data: notaConversao = [] } = useQuery({
    queryKey: ["se-nota-x-conversao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_se_nota_x_conversao")
        .select("*");
      if (error) throw error;
      return (data ?? []) as NotaXConversaoRow[];
    },
  });

  const { data: desfechos = [] } = useQuery({
    queryKey: ["se-reuniao-desfecho", mes],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_se_reuniao_desfecho")
        .select("*")
        .eq("mes", mes);
      if (error) throw error;
      return (data ?? []) as ReuniaoDesfechoRow[];
    },
  });

  const { data: alertasAss = [] } = useQuery({
    queryKey: ["se-alertas-assertividade", mes],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_se_alertas_assertividade")
        .select("*")
        .eq("mes", mes);
      if (error) throw error;
      return (data ?? []) as Alerta[];
    },
  });

  const SEV_ORDER: Record<string, number> = {
    critico: 0,
    atencao: 1,
    info: 2,
    ok: 3,
  };
  const alertasTodos = useMemo(
    () =>
      [...alertas, ...alertasAss].sort(
        (a, b) =>
          (a.ordem ?? 999) - (b.ordem ?? 999) ||
          (SEV_ORDER[a.severidade ?? ""] ?? 9) -
            (SEV_ORDER[b.severidade ?? ""] ?? 9)
      ),
    [alertas, alertasAss]
  );

  const desfechoPorLead = useMemo(() => {
    const m = new Map<string, ReuniaoDesfechoRow>();
    for (const d of desfechos) if (d.lead_id) m.set(d.lead_id, d);
    return m;
  }, [desfechos]);



  /* KPIs — sempre do mês selecionado */
  const kpis = useMemo(() => {
    const avg = (arr: (number | null)[]) => {
      const v = arr.filter((n): n is number => typeof n === "number");
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    };
    return {
      total: reunioes.length,
      tecnica: avg(reunioes.map((r) => r.nota_tecnica)),
      final: avg(reunioes.map((r) => r.nota_final)),
      vendas: desempenho.reduce((a, d) => a + (d.vendas ?? 0), 0),
      faturamento: desempenho.reduce((a, d) => a + (d.faturamento ?? 0), 0),
    };
  }, [reunioes, desempenho]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.5} />
            Sales Enablement
          </h1>
          <p className="text-sm text-muted-foreground">
            Desempenho vs meta, reuniões avaliadas, evolução e rubrica
          </p>
        </div>
        <Select value={mes} onValueChange={setMesSelecionado}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            {meses.map((m) => (
              <SelectItem key={m.mes} value={m.mes}>
                {m.mes}
                {m.is_atual ? " · atual" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={Users} label="Reuniões notadas" value={String(kpis.total)} />
        <KpiCard
          icon={Gauge}
          label="Média técnica"
          value={kpis.tecnica.toFixed(1)}
        />
        <KpiCard icon={Star} label="Média final" value={kpis.final.toFixed(1)} />
        <KpiCard icon={Sparkles} label="Vendas" value={String(kpis.vendas)} />
        <KpiCard
          icon={DollarSign}
          label="Faturamento"
          value={brl(kpis.faturamento)}
        />
      </div>

      <Tabs defaultValue="desempenho">
        <TabsList>
          <TabsTrigger value="desempenho">Desempenho vs Meta</TabsTrigger>
          <TabsTrigger value="assertividade">Assertividade</TabsTrigger>
          {isAdmin && <TabsTrigger value="placar">Placar</TabsTrigger>}
          <TabsTrigger value="reunioes">Reuniões</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
          <TabsTrigger value="rubrica">Rubrica</TabsTrigger>
        </TabsList>

        <TabsContent value="desempenho" className="mt-4">
          <DesempenhoTab
            rows={desempenho.filter((d) => (d.meta_realizadas ?? 0) > 0)}
            alertas={alertasTodos}
            loading={loadingDes}
          />
        </TabsContent>

        <TabsContent value="assertividade" className="mt-4">
          <AssertividadeTab
            rows={assertividade}
            notaConversao={notaConversao}
            loading={loadingAss}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="placar" className="mt-4">
            <PlacarTab meses={meses} />
          </TabsContent>
        )}

        <TabsContent value="reunioes" className="mt-4">
          <ReunioesTab
            rows={reunioes}
            loading={loadingReu}
            desfechos={desfechoPorLead}
          />
        </TabsContent>


        <TabsContent value="evolucao" className="mt-4">
          <EvolucaoTab
            rows={evolucao}
            notas={notasMensais}
            loading={loadingEvo}
          />
        </TabsContent>

        <TabsContent value="rubrica" className="mt-4">
          <RubricaTab rows={rubrica} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Evolução ---------------- */
function DeltaBadge({ v }: { v: number | null }) {
  if (v == null) return null;
  const up = v >= 0;
  return (
    <span
      className={cn(
        "text-[10px] font-semibold px-1.5 py-0.5 rounded",
        up
          ? "bg-emerald-500/15 text-emerald-500"
          : "bg-red-500/15 text-red-500"
      )}
    >
      {up ? "+" : ""}
      {v.toFixed(1)}
    </span>
  );
}

function EvolucaoTab({
  rows,
  notas,
  loading,
}: {
  rows: EvolucaoRow[];
  notas: NotasMensaisRow[];
  loading: boolean;
}) {
  const visiveis = useMemo(
    () => rows.filter((r) => (r.reunioes_notadas ?? 0) >= 3),
    [rows]
  );

  const closersVisiveis = useMemo(
    () => new Set(visiveis.map((r) => r.closer ?? "")),
    [visiveis]
  );

  const notasFiltradas = useMemo(
    () =>
      notas.filter(
        (n) =>
          closersVisiveis.has(n.closer ?? "") && (n.reunioes_notadas ?? 0) >= 3
      ),
    [notas, closersVisiveis]
  );

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (!visiveis.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem dados de evolução com volume suficiente (mín. 3 reuniões notadas)
        para este mês.
      </p>
    );
  }

  const porCloser = Array.from(
    new Set(notasFiltradas.map((n) => n.closer ?? ""))
  ).sort();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        {visiveis.map((r) => (
          <div
            key={`${r.closer}-${r.mes}`}
            className="bg-card border border-border rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center gap-3">
              <PersonAvatar name={r.closer} className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">
                  {r.closer ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.mes_ant ?? "—"} → {r.mes ?? "—"} ·{" "}
                  {r.reunioes_notadas ?? 0} reuniões notadas
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-md p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground mb-1">
                  Técnica
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {r.tecnica_ant ?? "—"}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      notaClass(r.tecnica_media)
                    )}
                  >
                    {r.tecnica_media ?? "—"}
                  </span>
                  <DeltaBadge v={r.delta_tecnica} />
                </div>
              </div>
              <div className="bg-muted/40 rounded-md p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground mb-1">
                  V2
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {r.v2_ant ?? "—"}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      notaClass(r.v2_media)
                    )}
                  >
                    {r.v2_media ?? "—"}
                  </span>
                  <DeltaBadge v={r.delta_v2} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Mais subiu</p>
                <p className="text-emerald-500 font-medium">
                  {r.melhor_crit_nome ??
                    CRITERIO_LABELS[r.melhor_crit ?? ""] ??
                    "—"}{" "}
                  {r.melhor_delta != null &&
                    `(${r.melhor_delta >= 0 ? "+" : ""}${r.melhor_delta.toFixed(1)})`}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Mais caiu</p>
                <p className="text-red-500 font-medium">
                  {r.pior_crit_nome ??
                    CRITERIO_LABELS[r.pior_crit ?? ""] ??
                    "—"}{" "}
                  {r.pior_delta != null &&
                    `(${r.pior_delta >= 0 ? "+" : ""}${r.pior_delta.toFixed(1)})`}
                </p>
              </div>
            </div>

            {r.resumo && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2.5">
                {r.resumo}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">
          Evolução por etapa da call (todos os meses)
        </h3>
        {porCloser.map((c) => {
          const linhas = notasFiltradas
            .filter((n) => (n.closer ?? "") === c)
            .sort((a, b) => (a.mes ?? "").localeCompare(b.mes ?? ""));
          return (
            <div
              key={c}
              className="bg-card border border-border rounded-lg overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <PersonAvatar name={c} className="h-6 w-6" />
                <p className="text-sm font-medium text-foreground">{c}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Mês</th>
                      {CRITERIO_ORDER.map((code) => (
                        <th
                          key={code}
                          className="text-left px-3 py-2 font-medium whitespace-nowrap"
                        >
                          {CRITERIO_LABELS[code]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((n) => (
                      <tr key={n.mes} className="border-t border-border">
                        <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                          {n.mes}
                        </td>
                        {CRITERIO_ORDER.map((code) => {
                          const v = (n as any)[code] as number | null;
                          return (
                            <td key={code} className="px-3 py-2 min-w-[90px]">
                              <div className="flex items-center gap-1.5">
                                <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      (v ?? 0) >= 8
                                        ? "bg-emerald-500"
                                        : (v ?? 0) >= 6
                                        ? "bg-yellow-500"
                                        : "bg-red-500"
                                    )}
                                    style={{
                                      width: `${Math.min(100, ((v ?? 0) / 10) * 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-foreground">
                                  {v ?? "—"}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* ---------------- Tab 1 — Leaderboard ---------------- */
type LbSort = "nota" | "roi" | "conversao" | "faturamento" | "vendas";

const LB_SORTS: { key: LbSort; label: string }[] = [
  { key: "nota", label: "Nota" },
  { key: "roi", label: "ROI" },
  { key: "conversao", label: "Conversão" },
  { key: "faturamento", label: "Faturamento" },
  { key: "vendas", label: "Vendas" },
];

function brlK(n: number | null | undefined) {
  if (n == null) return "—";
  if (Math.abs(n) >= 1000)
    return `R$${(n / 1000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })}k`;
  return brl(n);
}

function roiFmt(roi: number | null | undefined) {
  if (roi == null) return "—";
  return `${roi.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}×`;
}

type Status = "ok" | "warn" | "crit" | "none";

function statusPace(
  atual: number | null,
  meta: number | null,
  elapsed: number,
): Status {
  if (!meta || meta <= 0) return "none";
  const alvo = meta * Math.max(0.01, Math.min(1, elapsed));
  const pace = (atual ?? 0) / alvo;
  if (pace >= 1) return "ok";
  if (pace >= 0.7) return "warn";
  return "crit";
}

function statusTaxa(atual: number | null, meta: number | null): Status {
  if (!meta || meta <= 0) return "none";
  const v = atual ?? 0;
  if (v >= meta) return "ok";
  if (v >= meta * 0.8) return "warn";
  return "crit";
}

function statusRoi(roi: number | null): Status {
  if (roi == null) return "none";
  if (roi >= 3) return "ok";
  if (roi >= 2) return "warn";
  return "crit";
}

const DOT: Record<Status, string> = {
  ok: "bg-emerald-500",
  warn: "bg-yellow-500",
  crit: "bg-red-500",
  none: "bg-muted-foreground/40",
};

function StatusDot({ s }: { s: Status }) {
  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", DOT[s])}
    />
  );
}

function LbChip({
  label,
  value,
  sub,
  status,
}: {
  label: string;
  value: string;
  sub?: string;
  status: Status;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
        {label}
      </p>
      <p className="text-[13px] font-semibold text-foreground tabular-nums truncate flex items-center gap-1.5">
        {value}
        <StatusDot s={status} />
      </p>
      {sub && (
        <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
      )}
    </div>
  );
}

function DesempenhoTab({
  rows,
  alertas,
  loading,
}: {
  rows: DesempenhoMeta[];
  alertas: Alerta[];
  loading: boolean;
}) {
  const [ordenarPor, setOrdenarPor] = useState<LbSort>("nota");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const totais = useMemo(() => {
    const rois = rows.map((r) => r.roi).filter((r): r is number => r != null);
    return {
      reunioes: rows.reduce((a, r) => a + (r.realizadas ?? 0), 0),
      vendas: rows.reduce((a, r) => a + (r.vendas ?? 0), 0),
      faturamento: rows.reduce((a, r) => a + (r.faturamento ?? 0), 0),
      roi: rois.length ? rois.reduce((a, b) => a + b, 0) / rois.length : null,
    };
  }, [rows]);

  const ordered = useMemo(() => {
    const arr = [...rows];
    const key = (r: DesempenhoMeta) =>
      ordenarPor === "nota"
        ? r.final_media ?? r.tecnica_media
        : ordenarPor === "roi"
        ? r.roi
        : ordenarPor === "conversao"
        ? r.conversao
        : ordenarPor === "faturamento"
        ? r.faturamento
        : r.vendas;
    arr.sort((a, b) => (key(b) ?? -Infinity) - (key(a) ?? -Infinity));
    return arr;
  }, [rows, ordenarPor]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum dado de desempenho para o mês.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Faixa de totais + ordenação */}
      <div className="bg-card border border-border rounded-lg px-4 py-3 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-6">
          {[
            { l: "Reuniões", v: String(totais.reunioes) },
            { l: "Vendas", v: String(totais.vendas) },
            { l: "Faturamento", v: brlK(totais.faturamento) },
            { l: "ROI médio", v: roiFmt(totais.roi) },
          ].map((k) => (
            <div key={k.l}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {k.l}
              </p>
              <p className="text-base font-semibold text-foreground tabular-nums">
                {k.v}
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {LB_SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setOrdenarPor(s.key)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
                ordenarPor === s.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 text-muted-foreground border-border hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Linhas */}
      <div className="space-y-2">
        {ordered.map((d, idx) => {
          const medalha = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
          const id = `${d.closer}-${d.mes}`;
          const isOpen = !!open[id];
          const elapsed =
            d.dias_mes && d.dias_mes > 0
              ? Math.min(1, (d.dia_atual ?? 0) / d.dias_mes)
              : 1;
          const ratio = elapsed;
          const sRoi = statusRoi(d.roi);
          const meus = alertas
            .filter((a) => (a.closer ?? "") === (d.closer ?? ""))
            .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

          return (
            <div
              key={id}
              className="bg-card border border-border rounded-xl overflow-hidden transition-colors hover:border-primary/40"
            >
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}
                className="w-full text-left px-3 sm:px-4 py-2.5 flex items-center gap-3"
              >
                <span className="w-7 text-center text-lg shrink-0">
                  {medalha ? (
                    medalha
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {idx + 1}
                    </span>
                  )}
                </span>

                <div className="flex items-center gap-2.5 min-w-0 w-[190px] shrink-0">
                  <PersonAvatar name={d.closer} className="h-8 w-8" />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate text-sm">
                      {d.closer ?? "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {d.reunioes_notadas ?? 0} reuniões notadas
                    </p>
                  </div>
                </div>

                <div className="w-14 text-center shrink-0">
                  <p
                    className={cn(
                      "text-lg font-semibold tabular-nums leading-none",
                      notaClass(d.final_media),
                    )}
                  >
                    {d.final_media ?? "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">nota</p>
                </div>

                <div className="hidden md:grid flex-1 grid-cols-4 gap-3 min-w-0">
                  <LbChip
                    label="Reuniões"
                    value={`${d.realizadas ?? 0}/${d.meta_realizadas ?? 0}`}
                    status={statusPace(d.realizadas, d.meta_realizadas, elapsed)}
                  />
                  <LbChip
                    label="Conversão"
                    value={`${Math.round(d.conversao ?? 0)}%`}
                    sub={`meta ${Math.round(d.meta_conversao ?? 0)}%`}
                    status={statusTaxa(d.conversao, d.meta_conversao)}
                  />
                  <LbChip
                    label="Faturamento"
                    value={brlK(d.faturamento)}
                    sub={`de ${brlK(d.meta_faturamento)}`}
                    status={statusPace(
                      d.faturamento,
                      d.meta_faturamento,
                      elapsed,
                    )}
                  />
                  <LbChip
                    label="Custo/venda"
                    value={
                      d.custo_por_venda != null ? brlK(d.custo_por_venda) : "—"
                    }
                    status="none"
                  />
                </div>

                <span
                  className={cn(
                    "shrink-0 px-2.5 py-1 rounded-lg text-[13px] font-bold tabular-nums",
                    sRoi === "ok"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : sRoi === "warn"
                      ? "bg-yellow-500/15 text-yellow-500"
                      : sRoi === "crit"
                      ? "bg-red-500/15 text-red-500"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {roiFmt(d.roi)}
                </span>

                <span
                  className={cn(
                    "shrink-0 text-muted-foreground transition-transform text-xs w-4 text-center",
                    isOpen && "rotate-90",
                  )}
                >
                  ▶
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-border px-3 sm:px-4 py-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetaBar
                      label="Reuniões realizadas"
                      atual={d.realizadas ?? 0}
                      meta={d.meta_realizadas ?? 0}
                      pace={(d.meta_realizadas ?? 0) * ratio}
                    />
                    <MetaBar
                      label="Vendas"
                      atual={d.vendas ?? 0}
                      meta={d.meta_vendas ?? 0}
                      pace={(d.meta_vendas ?? 0) * ratio}
                    />
                    <MetaBar
                      label="Conversão"
                      atual={d.conversao ?? 0}
                      meta={d.meta_conversao ?? 0}
                      format={(n) => `${Math.round(n)}%`}
                    />
                    <MetaBar
                      label="Ticket médio"
                      atual={d.ticket_medio ?? 0}
                      meta={d.meta_ticket_medio ?? 0}
                      format={brl}
                    />
                    <MetaBar
                      label="Faturamento"
                      atual={d.faturamento ?? 0}
                      meta={d.meta_faturamento ?? 0}
                      format={brl}
                      pace={(d.meta_faturamento ?? 0) * ratio}
                    />
                  </div>

                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Eficiência
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {[
                        {
                          l: "Custo/reunião",
                          v: d.custo_reuniao != null ? brl(d.custo_reuniao) : "—",
                        },
                        {
                          l: "Investido",
                          v: d.investido != null ? brl(d.investido) : "—",
                        },
                        {
                          l: "Custo/venda",
                          v:
                            d.custo_por_venda != null
                              ? brl(d.custo_por_venda)
                              : "—",
                        },
                        { l: "ROI", v: roiFmt(d.roi) },
                        { l: "Nota final", v: String(d.final_media ?? "—") },
                      ].map((x) => (
                        <div key={x.l}>
                          <p className="text-[11px] text-muted-foreground">
                            {x.l}
                          </p>
                          <p className="text-sm font-semibold text-foreground tabular-nums">
                            {x.v}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {meus.length > 0 && (
                    <div className="space-y-2">
                      {meus.map((a, i) => {
                        const s = sevStyles(a.severidade);
                        return (
                          <div
                            key={i}
                            className="flex gap-3 bg-muted/40 rounded-md p-2.5"
                          >
                            <div
                              className={cn("w-1 rounded-full shrink-0", s.bar)}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground">
                                {a.titulo}
                              </p>
                              {a.sugestao && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {a.sugestao}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground pt-1">
        🟢 na meta/ritmo · 🟡 atenção · 🔴 abaixo
      </p>
    </div>
  );
}

/* ---------------- Tab 2 ---------------- */
type SortKey =
  | "quando_local"
  | "empresa"
  | "closer"
  | "etapa_atual"
  | "nota";

const OUTCOME_META: Record<
  string,
  { label: string; emoji: string; cls: string }
> = {
  pagou: {
    label: "Pagou",
    emoji: "💰",
    cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  },
  continuou: {
    label: "Continuou",
    emoji: "🔁",
    cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  },
  churnou: {
    label: "Churn",
    emoji: "⚠️",
    cls: "bg-red-500/15 text-red-500 border-red-500/30",
  },
  perdido: {
    label: "Perdido",
    emoji: "🚫",
    cls: "bg-muted text-muted-foreground border-border",
  },
  apresentacao_boa: {
    label: "Apresentação boa",
    emoji: "📊",
    cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  },
  apresentacao_ruim: {
    label: "Apresentação ruim",
    emoji: "📉",
    cls: "bg-red-500/15 text-red-500 border-red-500/30",
  },
};

const OUTCOME_BOTOES: {
  key: string;
  label: string;
  variant: "ok" | "bad" | "neutral";
}[] = [
  { key: "pagou", label: "Pagou", variant: "ok" },
  { key: "continuou", label: "Continuou", variant: "ok" },
  { key: "churnou", label: "Churn", variant: "bad" },
  { key: "perdido", label: "Perdido", variant: "neutral" },
  { key: "apresentacao_boa", label: "Apresentação boa", variant: "ok" },
  { key: "apresentacao_ruim", label: "Apresentação ruim", variant: "bad" },
];

function ReunioesTab({
  rows,
  loading,
  desfechos,
}: {
  rows: ReuniaoSE[];
  loading: boolean;
  desfechos: Map<string, ReuniaoDesfechoRow>;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busca, setBusca] = useState("");
  const [closer, setCloser] = useState("all");
  const [desfechoFiltro, setDesfechoFiltro] = useState("all");
  const [soHoje, setSoHoje] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("quando_local");
  const [sortAsc, setSortAsc] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);


  const closers = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.closer).filter((c): c is string => !!c))
      ).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (q && !(r.empresa ?? "").toLowerCase().includes(q)) return false;
      if (closer !== "all" && (r.closer ?? "") !== closer) return false;
      if (soHoje && !isToday(r.quando_local ?? r.meeting_date)) return false;
      if (desfechoFiltro !== "all") {
        const d = r.lead_id ? desfechos.get(r.lead_id) : undefined;
        if ((d?.desfecho ?? "") !== desfechoFiltro) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "pt-BR");
      return sortAsc ? cmp : -cmp;
    });
    return out;
  }, [rows, busca, closer, soHoje, sortKey, sortAsc, desfechoFiltro, desfechos]);


  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(k);
      setSortAsc(k === "empresa" || k === "closer" || k === "etapa_atual");
    }
  };

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="text-left px-3 py-2 font-medium whitespace-nowrap">
      <button
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        <ArrowUpDown
          className={cn(
            "h-3 w-3",
            sortKey === k ? "text-primary" : "text-muted-foreground/50"
          )}
        />
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar empresa…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full sm:w-64"
        />
        <Select value={closer} onValueChange={setCloser}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Closer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os closers</SelectItem>
            {closers.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={desfechoFiltro} onValueChange={setDesfechoFiltro}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Desfecho" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os desfechos</SelectItem>
            <SelectItem value="assinou">assinou</SelectItem>
            <SelectItem value="link na janela">link na janela</SelectItem>
            <SelectItem value="link morto">link morto</SelectItem>
            <SelectItem value="sem link">sem link</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={soHoje ? "default" : "outline"}
          size="sm"
          onClick={() => setSoHoje((v) => !v)}
        >
          Só hoje
        </Button>
        <span className="text-xs text-muted-foreground self-center ml-auto">
          {filtered.length} reuniões
        </span>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border">
            <tr>
              <th className="w-8" />
              <Th k="quando_local">Quando</Th>
              <Th k="empresa">Empresa</Th>
              <Th k="closer">Closer</Th>
              <Th k="etapa_atual">Etapa</Th>
              <Th k="nota">Nota</Th>
              <th className="text-left px-3 py-2 font-medium">Desfecho</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap">
                Tempo até assinar
              </th>
              <th className="text-left px-3 py-2 font-medium">Guardrails</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-muted-foreground">
                  Nenhuma reunião encontrada.
                </td>
              </tr>
            )}

            {filtered.map((r) => {
              const open = aberta === r.reuniao_id;
              const oc = r.outcome_resultado
                ? OUTCOME_META[r.outcome_resultado]
                : null;
              const df = r.lead_id ? desfechos.get(r.lead_id) : undefined;

              return (
                <Fragment key={r.reuniao_id}>
                  <tr
                    onClick={() => setAberta(open ? null : r.reuniao_id)}
                    className={cn(
                      "border-b border-border/50 hover:bg-muted/40 cursor-pointer",
                      open && "bg-muted/30"
                    )}
                  >
                    <td className="pl-3 text-muted-foreground">
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 transition-transform",
                          open && "rotate-90 text-primary"
                        )}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {fmtQuando(r.quando_local ?? r.meeting_date)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-foreground">
                          {r.empresa ?? "—"}
                        </span>
                        {r.lead_status === "ganho" && (
                          <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px]">
                            ganho
                          </Badge>
                        )}
                        {oc && (
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap",
                              oc.cls
                            )}
                          >
                            {oc.emoji} {oc.label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.closer ? (
                        <div className="flex items-center gap-2">
                          <PersonAvatar name={r.closer} className="h-6 w-6" />
                          <span className="text-foreground">{r.closer}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {r.etapa_atual ?? "—"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 font-semibold",
                        notaClass(r.nota)
                      )}
                    >
                      {r.nota ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <DesfechoChip desfecho={df?.desfecho ?? null} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {fmtDiasAssinatura(df?.dias_link_ate_assinatura)}
                    </td>
                    <td className="px-3 py-2">

                      <div className="flex flex-wrap gap-1">
                        {(r.guardrails ?? []).map((g) => (
                          <span
                            key={g}
                            title={GUARDRAIL_LABELS[g] ?? g}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 whitespace-nowrap"
                          >
                            {g.split("_")[0]}
                          </span>
                        ))}
                        {!(r.guardrails ?? []).length && (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-border/50">
                      <td colSpan={9} className="px-4 py-4 bg-muted/10">
                        <ReuniaoDetalhe
                          r={r}
                          onSaved={() => {
                            void queryClient.invalidateQueries({
                              queryKey: ["se-reunioes"],
                            });
                            void queryClient.invalidateQueries({
                              queryKey: ["se-desempenho-meta"],
                            });
                          }}
                          toast={toast}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Nota ≥70 🟢 · 50–69 🟡 · 35–49 🟠 · &lt;35 🔴
      </p>
    </div>
  );
}

function ReuniaoDetalhe({
  r,
  onSaved,
  toast,
}: {
  r: ReuniaoSE;
  onSaved: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [obs, setObs] = useState(r.outcome_obs ?? "");
  const [saving, setSaving] = useState<string | null>(null);
  const [motivoIgnorar, setMotivoIgnorar] = useState("");
  const [ignorando, setIgnorando] = useState(false);
  const ignorada = !!r.ignorada;

  const toggleIgnorar = async (ignorar: boolean) => {
    setIgnorando(true);
    const { error } = await (supabase as any).rpc("se_ignorar_reuniao", {
      p_reuniao_id: r.reuniao_id,
      p_ignorar: ignorar,
      p_motivo: ignorar && motivoIgnorar.trim() ? motivoIgnorar.trim() : null,
    });
    setIgnorando(false);
    if (error) {
      toast({
        title: "Não foi possível atualizar",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: ignorar ? "Reunião excluída da conta" : "Reunião restaurada",
    });
    onSaved();
  };

  const registrar = async (resultado: string) => {
    setSaving(resultado);
    const { error } = await (supabase as any).rpc("se_registrar_outcome", {
      p_lead_id: r.lead_id,
      p_resultado: resultado,
      p_observacao: obs.trim() ? obs.trim() : null,
      p_readai_meeting_id: r.reuniao_id,
      p_valor: null,
    });
    setSaving(null);
    if (error) {
      toast({
        title: "Não foi possível registrar",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Resultado registrado",
      description: OUTCOME_META[resultado]?.label ?? resultado,
    });
    onSaved();
  };

  const partes: string[] = [`Técnica ${r.nota_tecnica ?? 0}`];
  if ((r.penalidades ?? 0) !== 0)
    partes.push(`− ${Math.abs(r.penalidades ?? 0)} penalidades`);
  if ((r.bonus_outcome ?? 0) !== 0)
    partes.push(
      `${(r.bonus_outcome ?? 0) > 0 ? "+" : "−"} ${Math.abs(r.bonus_outcome ?? 0)} resultado`
    );

  const ocAtual = r.outcome_resultado ? OUTCOME_META[r.outcome_resultado] : null;

  return (
    <div className="space-y-5">
      {/* Cabeçalho + nota */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-foreground">
              {r.empresa ?? "Reunião"}
            </h3>
            {r.lead_status === "ganho" && (
              <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px]">
                ganho
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {fmtQuando(r.quando_local ?? r.meeting_date)} ·{" "}
            {r.closer ?? "sem closer"} · {r.etapa_atual ?? "—"}
          </p>
        </div>
        <div className="text-right">
          <p className={cn("text-3xl font-semibold", notaClass(r.nota))}>
            {r.nota ?? "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {partes.join(" ")} = {r.nota ?? "—"}
          </p>
        </div>
      </div>

      {/* Critérios */}
      {r.notas_criterios && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Critérios</h4>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {CRITERIO_ORDER.filter((c) => r.notas_criterios?.[c] != null).map(
              (c) => (
                <MiniCriterio
                  key={c}
                  code={c}
                  value={Number(r.notas_criterios![c])}
                />
              )
            )}
          </div>
        </div>
      )}

      {/* Guardrails */}
      {(r.guardrails ?? []).length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            Guardrails acionados
          </h4>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-0.5">
            {(r.guardrails ?? []).map((g) => (
              <li key={g}>{GUARDRAIL_LABELS[g] ?? g}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {(r.pontos_fortes ?? []).length > 0 && (
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">
              Pontos fortes
            </h4>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-0.5">
              {(r.pontos_fortes ?? []).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {(r.pontos_melhoria ?? []).length > 0 && (
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">
              Pontos de melhoria
            </h4>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-0.5">
              {(r.pontos_melhoria ?? []).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {r.resumo_treinador && (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground">
            Resumo do treinador
          </h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {r.resumo_treinador}
          </p>
        </div>
      )}

      {/* Calibragem */}
      <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-sm font-semibold text-foreground">Calibragem</h4>
          {ocAtual ? (
            <span
              className={cn(
                "text-[11px] px-2 py-0.5 rounded border",
                ocAtual.cls
              )}
            >
              {ocAtual.emoji} {ocAtual.label}
              {r.outcome_em ? ` · ${fmtQuando(r.outcome_em)}` : ""}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              Sem resultado registrado
            </span>
          )}
        </div>
        {r.outcome_obs && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {r.outcome_obs}
          </p>
        )}
        <Input
          placeholder="Observação (opcional)"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          className="h-9"
        />
        <div className="flex flex-wrap gap-2">
          {OUTCOME_BOTOES.map((b) => (
            <Button
              key={b.key}
              size="sm"
              variant="outline"
              disabled={!!saving || !r.lead_id}
              onClick={() => void registrar(b.key)}
              className={cn(
                b.variant === "ok" &&
                  "border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10",
                b.variant === "bad" &&
                  "border-red-500/40 text-red-500 hover:bg-red-500/10",
                b.variant === "neutral" && "text-muted-foreground"
              )}
            >
              {saving === b.key ? "Salvando…" : b.label}
            </Button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Pagou/Continuou +15 · Apresentação boa +5 · Apresentação ruim −5 ·
          Churn −8. Apenas staff pode registrar.
        </p>
      </div>

      {/* Excluir da conta */}
      <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-sm font-semibold text-foreground">
            Excluir da conta
          </h4>
          {ignorada && (
            <span className="text-[11px] px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-500">
              excluída{r.ignorada_motivo ? ` · ${r.ignorada_motivo}` : ""}
            </span>
          )}
        </div>
        {ignorada ? (
          <Button
            size="sm"
            variant="outline"
            disabled={ignorando}
            onClick={() => void toggleIgnorar(false)}
          >
            {ignorando ? "Salvando…" : "Trazer de volta"}
          </Button>
        ) : (
          <>
            <Input
              placeholder="Motivo (opcional): no-show, não é call de closer…"
              value={motivoIgnorar}
              onChange={(e) => setMotivoIgnorar(e.target.value)}
              className="h-9"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={ignorando}
              onClick={() => void toggleIgnorar(true)}
              className="border-red-500/40 text-red-500 hover:bg-red-500/10"
            >
              {ignorando ? "Salvando…" : "Excluir da conta"}
            </Button>
          </>
        )}
        <p className="text-[10px] text-muted-foreground">
          Remove a reunião das contagens e médias. Reversível. Apenas staff.
        </p>
      </div>



      <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
        {[r.modelo, r.prompt_versao, r.rubrica_versao].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}


/* ---------------- Tab 3 ---------------- */
function RubricaTab({ rows }: { rows: RubricaRow[] }) {
  const criterios = rows.filter(
    (r) => (r.tipo ?? "").toLowerCase() !== "guardrail"
  );
  const guardrails = rows.filter(
    (r) => (r.tipo ?? "").toLowerCase() === "guardrail"
  );

  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma rubrica ativa encontrada.
      </p>
    );
  }

  const Table = ({
    title,
    data,
    valueLabel,
    valueKey,
  }: {
    title: string;
    data: RubricaRow[];
    valueLabel: string;
    valueKey: "peso" | "penalidade";
  }) => (
    <div className="bg-card border border-border rounded-lg overflow-x-auto">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" strokeWidth={1.5} />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b border-border">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Código</th>
            <th className="text-left px-3 py-2 font-medium">Título</th>
            <th className="text-left px-3 py-2 font-medium">{valueLabel}</th>
            <th className="text-left px-3 py-2 font-medium">Descrição</th>
            <th className="text-left px-3 py-2 font-medium">Como pontuar</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr
              key={`${r.codigo}-${i}`}
              className="border-b border-border/50 last:border-0"
            >
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                {r.codigo ?? "—"}
              </td>
              <td className="px-3 py-2 text-foreground">{r.titulo ?? "—"}</td>
              <td className="px-3 py-2 font-medium whitespace-nowrap">
                {r[valueKey] ?? "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {r.descricao ?? "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {r.como_pontuar ?? "—"}
              </td>
            </tr>
          ))}
          {!data.length && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                Nada por aqui.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <Table
        title="Critérios"
        data={criterios}
        valueLabel="Peso"
        valueKey="peso"
      />
      <Table
        title="Guardrails"
        data={guardrails}
        valueLabel="Penalidade"
        valueKey="penalidade"
      />
    </div>
  );
}
