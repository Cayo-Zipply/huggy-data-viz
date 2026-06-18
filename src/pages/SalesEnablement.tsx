import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
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
} from "recharts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RefreshCw,
  Trophy,
  Star,
  AlertTriangle,
  Sparkles,
  BookOpen,
  Gauge,
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

/* ---------------- Helpers ---------------- */
function notaColor(n: number | null | undefined) {
  if (n == null) return "bg-muted text-muted-foreground";
  if (n >= 85) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  if (n >= 70) return "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30";
  if (n >= 50) return "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30";
  return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
}

function NotaBadge({ value, size = "md" }: { value: number | null; size?: "sm" | "md" | "lg" }) {
  const sz =
    size === "lg" ? "text-2xl px-4 py-2" : size === "sm" ? "text-xs px-2 py-0.5" : "text-base px-3 py-1";
  return (
    <span className={`inline-flex items-center justify-center rounded-md border font-bold ${sz} ${notaColor(value)}`}>
      {value == null ? "—" : Math.round(value)}
    </span>
  );
}

/* ---------------- Page ---------------- */
export default function SalesEnablement() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const qc = useQueryClient();
  const [drillId, setDrillId] = useState<string | null>(null);

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
      // pick highest versao only
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

  // leads + readai for joining
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
  const notaMediaGeral =
    totalAvaliadas > 0
      ? okAvaliacoes.reduce((s, a) => s + (a.nota_geral ?? 0), 0) / totalAvaliadas
      : 0;
  const totalAlertas = okAvaliacoes.reduce(
    (s, a) => s + (a.alertas_compliance?.length ?? 0),
    0
  );

  const rankingSorted = (ranking.data ?? [])
    .slice()
    .sort((a, b) => (b.nota_media ?? 0) - (a.nota_media ?? 0));
  const rankingMain = rankingSorted.filter((r) => r.reunioes_avaliadas >= 2);
  const rankingPoucos = rankingSorted.filter((r) => r.reunioes_avaliadas < 2);

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
    <div className="min-h-screen bg-background">
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Sales Enablement
              </h1>
              <p className="text-sm text-muted-foreground">
                Notas, ranking e dicas de cada reunião realizada (avaliadas por IA).
              </p>
            </div>
            <Button onClick={refetchAll} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-6">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Reuniões avaliadas
                </div>
                <div className="text-3xl font-bold text-foreground">{totalAvaliadas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Nota média geral
                </div>
                <div className="mt-1">
                  <NotaBadge value={notaMediaGeral} size="lg" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Alertas de compliance
                </div>
                <div className={`text-3xl font-bold ${totalAlertas > 0 ? "text-red-500" : "text-foreground"}`}>
                  {totalAlertas}
                </div>
              </CardContent>
            </Card>
          </div>

          {totalAvaliadas === 0 && !isLoading && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-40" />
                Nenhuma reunião avaliada ainda. As notas aparecem automaticamente conforme o
                Read.ai grava as reuniões.
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="placar" className="w-full">
            <TabsList className="grid grid-cols-4 w-full max-w-2xl">
              <TabsTrigger value="placar"><Trophy className="h-4 w-4 mr-1" />Placar</TabsTrigger>
              <TabsTrigger value="melhores"><Star className="h-4 w-4 mr-1" />Melhores</TabsTrigger>
              <TabsTrigger value="calibracao"><Gauge className="h-4 w-4 mr-1" />Calibração</TabsTrigger>
              <TabsTrigger value="biblioteca"><BookOpen className="h-4 w-4 mr-1" />Biblioteca</TabsTrigger>
            </TabsList>

            {/* PLACAR */}
            <TabsContent value="placar" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ranking de Closers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {rankingMain.length === 0 && (
                    <div className="text-sm text-muted-foreground">Sem closers com 2+ reuniões avaliadas ainda.</div>
                  )}
                  {rankingMain.map((r, i) => (
                    <div
                      key={r.closer}
                      className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                    >
                      <div className="w-8 text-center font-bold text-muted-foreground">
                        {i + 1}º
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground truncate">{r.closer}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                          <span>{r.reunioes_avaliadas} reuniões</span>
                          {r.leads_com_outcome > 0 && (
                            <span>
                              · {r.leads_pagaram}/{r.leads_com_outcome} pagaram
                            </span>
                          )}
                        </div>
                      </div>
                      {r.reunioes_com_alerta > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          🚩 {r.reunioes_com_alerta}
                        </Badge>
                      )}
                      <NotaBadge value={r.nota_media} size="lg" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {rankingPoucos.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">Poucos dados (1 reunião)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {rankingPoucos.map((r) => (
                      <div key={r.closer} className="flex items-center justify-between text-sm py-1">
                        <span className="text-foreground">{r.closer}</span>
                        <NotaBadge value={r.nota_media} size="sm" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* MELHORES */}
            <TabsContent value="melhores" className="space-y-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top 20 Reuniões</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
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
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors cursor-pointer"
                        onClick={() => setDrillId(a.id)}
                      >
                        <NotaBadge value={a.nota_geral} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate flex items-center gap-2">
                            {lead?.empresa || lead?.nome || meet?.meeting_title || "Reunião"}
                            {isGold && <span title="Exemplo gold">⭐</span>}
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
                            variant={isGold ? "secondary" : "outline"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGold.mutate(a);
                            }}
                          >
                            {isGold ? "Remover gold" : "Marcar gold"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {isAdmin && errAvaliacoes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm text-red-500 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> Avaliações com erro
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {errAvaliacoes.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground truncate flex-1">
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
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* CALIBRAÇÃO */}
            <TabsContent value="calibracao" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Calibração da nota</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={calibracao.data ?? []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="faixa" className="text-xs" />
                        <YAxis className="text-xs" />
                        <RTooltip />
                        <Bar dataKey="taxa_pagamento_pct" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Se a taxa de pagamento sobe junto com a faixa de nota, o treinador está calibrado.
                  </p>
                </CardContent>
              </Card>

              {isAdmin && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Registrar resultado</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
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
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* BIBLIOTECA */}
            <TabsContent value="biblioteca" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Critérios (o que é uma boa reunião)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(rubrica.data ?? [])
                    .filter((r) => r.tipo === "criterio")
                    .map((r) => (
                      <div key={r.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-foreground">{r.titulo}</div>
                          <Badge variant="outline">peso {r.peso ?? "—"}</Badge>
                        </div>
                        {r.descricao && (
                          <p className="text-sm text-muted-foreground mt-1">{r.descricao}</p>
                        )}
                        {r.como_pontuar && (
                          <p className="text-xs text-muted-foreground/80 mt-2">
                            <span className="font-medium">Como pontuar:</span> {r.como_pontuar}
                          </p>
                        )}
                      </div>
                    ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-red-500">O que NÃO fazer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(rubrica.data ?? [])
                    .filter((r) => r.tipo === "guardrail")
                    .map((r) => (
                      <div key={r.id} className="border border-red-500/30 rounded-lg p-3 bg-red-500/5">
                        <div className="font-semibold text-foreground">{r.titulo}</div>
                        {r.descricao && (
                          <p className="text-sm text-muted-foreground mt-1">{r.descricao}</p>
                        )}
                        {r.penalidade != null && (
                          <div className="text-xs text-red-500 mt-1">Penalidade: −{r.penalidade}</div>
                        )}
                      </div>
                    ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Exemplos gold ⭐</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
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
                        className="w-full flex items-center justify-between text-sm py-2 px-2 rounded hover:bg-accent/30"
                      >
                        <span className="text-foreground">
                          {lead?.empresa || lead?.nome || g.readai_meeting_id}
                        </span>
                        {a && <NotaBadge value={a.nota_geral} size="sm" />}
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
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

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-start justify-between gap-3 pr-6">
          <div className="min-w-0">
            <div className="text-lg font-bold text-foreground truncate">
              {lead?.empresa || lead?.nome || meet?.meeting_title || "Reunião"}
            </div>
            <div className="text-xs text-muted-foreground font-normal">
              {a.closer ?? "—"} ·{" "}
              {meet?.meeting_date
                ? new Date(meet.meeting_date).toLocaleString("pt-BR")
                : new Date(a.created_at).toLocaleString("pt-BR")}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <NotaBadge value={a.nota_geral} size="lg" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <NotaBadge value={a.nota_tecnica} size="sm" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>antes das penalidades de compliance</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* Alertas */}
        {a.alertas_compliance && a.alertas_compliance.length > 0 && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <div className="flex items-center gap-2 font-semibold text-red-600 dark:text-red-400 mb-2">
              <AlertTriangle className="h-4 w-4" /> Alertas de compliance
            </div>
            <ul className="space-y-1 text-sm">
              {a.alertas_compliance.map((cod) => {
                const r = rubricaByCodigo.get(cod);
                return (
                  <li key={cod} className="text-foreground">
                    • {r?.titulo ?? cod}
                    {r?.penalidade != null && (
                      <span className="text-red-500 ml-2 text-xs">−{r.penalidade}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Breakdown */}
        {criterios.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Breakdown por critério</h3>
            <div className="space-y-2">
              {criterios.map(([cod, nota]) => {
                const r = rubricaByCodigo.get(cod);
                const pct = Math.max(0, Math.min(100, (Number(nota) / 10) * 100));
                return (
                  <div key={cod}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-foreground">
                        {r?.titulo ?? cod}
                        {r?.peso != null && (
                          <span className="text-muted-foreground"> · peso {r.peso}</span>
                        )}
                      </span>
                      <span className="font-mono font-semibold">{Number(nota).toFixed(1)}/10</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Fortes & melhorias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {a.pontos_fortes && a.pontos_fortes.length > 0 && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="font-semibold text-emerald-600 dark:text-emerald-400 mb-2 text-sm">
                Pontos fortes
              </div>
              <ul className="space-y-1 text-sm">
                {a.pontos_fortes.map((p, i) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            </div>
          )}
          {a.pontos_melhoria && a.pontos_melhoria.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="font-semibold text-amber-600 dark:text-amber-400 mb-2 text-sm">
                Pontos a melhorar
              </div>
              <ul className="space-y-1 text-sm">
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

        {/* Resumo */}
        {a.resumo_treinador && (
          <div className="rounded-lg border bg-accent/30 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Resumo do treinador
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{a.resumo_treinador}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
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
              <div className="rounded border p-3 text-sm whitespace-pre-wrap">
                <div className="text-xs font-semibold mb-1 text-muted-foreground">Resumo</div>
                {meet.summary}
              </div>
            )}
            {meet.transcript && (
              <div className="rounded border p-3 text-xs whitespace-pre-wrap max-h-96 overflow-y-auto">
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
