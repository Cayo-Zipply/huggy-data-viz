import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonAvatar } from "@/components/PersonAvatar";

/* ---------------- Types ---------------- */
type ScoreRow = {
  closer: string | null;
  mes: string | null;
  indice: number | null;
  faixa: string | null;
  eixo_resultado: number | null;
  eixo_qualidade: number | null;
  eixo_assertividade: number | null;
  eixo_processamento: number | null;
  eixo_registro: number | null;
  bonus_resgate: number | null;
  pontos: number | null;
  pontos_disponiveis: number | null;
  trava_nota_baixa: boolean | null;
  trava_cobertura_readai: boolean | null;
  cobertura_readai: number | null;
  p_vendas: number | null;
  p_ticket: number | null;
  p_nota: number | null;
  p_evolucao: number | null;
  p_guardrail: number | null;
  p_conversao: number | null;
  p_48h: number | null;
  p_envio: number | null;
  p_processamento: number | null;
  p_sem_parada: number | null;
  p_declarado: number | null;
};

type CargaRow = {
  closer: string | null;
  mes: string | null;
  carga: number | null;
  processados: number | null;
  pct_processamento: number | null;
  ganhos: number | null;
  perdidos_com_motivo: number | null;
  perdidos_sem_motivo: number | null;
  vivos_com_proxima_tarefa: number | null;
  parados_sem_proximo_passo: number | null;
  encalhados_14d: number | null;
};

type ResgateMesRow = {
  closer: string | null;
  mes: string | null;
  resgates_realizados: number | null;
  resgates_ganhos: number | null;
  dias_medios_no_pipe: number | null;
  receita_resgatada: number | null;
  bonus_resgate: number | null;
};

type ResgateRow = {
  lead_id: string | null;
  empresa: string | null;
  closer: string | null;
  mes: string | null;
  data_reuniao: string | null;
  dias_no_pipe: number | null;
  virou_venda: boolean | null;
  valor: number | null;
};

/* ---------------- Helpers ---------------- */
const brl = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const num = (n: number | null | undefined, d = 0) =>
  n == null ? "—" : Number(n).toFixed(d);

const pct = (n: number | null | undefined) =>
  n == null ? "—" : `${Number(n).toFixed(0)}%`;

export function previousMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const FAIXA_CLS: Record<string, string> = {
  Ouro: "bg-amber-400/20 text-amber-400 border-amber-400/40",
  Prata: "bg-slate-400/20 text-slate-300 border-slate-400/40",
  Bronze: "bg-amber-700/20 text-amber-600 border-amber-700/40",
  Abaixo: "bg-red-500/15 text-red-500 border-red-500/30",
};

const EIXOS: { key: keyof ScoreRow; label: string; peso: number }[] = [
  { key: "eixo_resultado", label: "Resultado", peso: 30 },
  { key: "eixo_qualidade", label: "Qualidade", peso: 25 },
  { key: "eixo_assertividade", label: "Assertividade", peso: 15 },
  { key: "eixo_processamento", label: "Processamento", peso: 20 },
];

const CRITERIOS: { key: keyof ScoreRow; label: string }[] = [
  { key: "p_vendas", label: "Vendas vs meta" },
  { key: "p_ticket", label: "Ticket médio" },
  { key: "p_nota", label: "Nota média das reuniões" },
  { key: "p_evolucao", label: "Evolução da nota" },
  { key: "p_guardrail", label: "Guardrail de qualidade" },
  { key: "p_conversao", label: "Reunião → contrato" },
  { key: "p_48h", label: "Assinatura em 48h" },
  { key: "p_envio", label: "Envio do contrato" },
  { key: "p_processamento", label: "Taxa de processamento da carga" },
  { key: "p_sem_parada", label: "Cards sem parada" },
  { key: "p_declarado", label: "Desfecho declarado" },
];

function Card({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "green" | "amber" | "red";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xl font-semibold",
          tone === "green" && "text-emerald-500",
          tone === "amber" && "text-amber-500",
          tone === "red" && "text-red-500",
          !tone && "text-foreground"
        )}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Vazio({ texto = "sem dado para o período" }: { texto?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {texto}
    </div>
  );
}

function EixoBar({
  label,
  valor,
  peso,
  indisponivel,
}: {
  label: string;
  valor: number | null;
  peso: number;
  indisponivel?: boolean;
}) {
  const p = indisponivel || valor == null ? 0 : (valor / peso) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn(indisponivel ? "text-muted-foreground" : "text-foreground")}>
          {indisponivel ? "indisponível" : `${num(valor, 1)} / ${peso}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
            indisponivel
              ? "bg-muted-foreground/30"
              : p >= 80
              ? "bg-emerald-500"
              : p >= 50
              ? "bg-amber-500"
              : "bg-red-500"
          )}
          style={{ width: `${indisponivel ? 100 : Math.min(100, p)}%` }}
        />
      </div>
    </div>
  );
}

/* ---------------- Main ---------------- */
export function PlacarTab({
  meses,
}: {
  meses: { mes: string; is_atual: boolean | null }[];
}) {
  const fechado = previousMonth();
  const [mesSel, setMesSel] = useState<string>("");
  const mes = mesSel || fechado;
  const [detalhe, setDetalhe] = useState<ScoreRow | null>(null);

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ["prod-score", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_prod_score")
        .select("*")
        .eq("mes", mes);
      if (error) throw error;
      return (data ?? []) as ScoreRow[];
    },
  });

  const { data: scoresTodos = [] } = useQuery({
    queryKey: ["prod-score-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_prod_score").select("*");
      if (error) throw error;
      return (data ?? []) as ScoreRow[];
    },
  });

  const { data: carga = [] } = useQuery({
    queryKey: ["prod-carga", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_prod_carga")
        .select("*")
        .eq("mes", mes);
      if (error) throw error;
      return (data ?? []) as CargaRow[];
    },
  });

  const { data: resgateMes = [] } = useQuery({
    queryKey: ["prod-resgate-mes", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_prod_resgate_mes")
        .select("*")
        .eq("mes", mes);
      if (error) throw error;
      return (data ?? []) as ResgateMesRow[];
    },
  });

  const { data: resgates = [] } = useQuery({
    queryKey: ["prod-resgate", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_prod_resgate")
        .select("*")
        .eq("mes", mes);
      if (error) throw error;
      return (data ?? []) as ResgateRow[];
    },
  });

  const scoresOrd = useMemo(
    () => [...scores].sort((a, b) => (b.indice ?? 0) - (a.indice ?? 0)),
    [scores]
  );

  const evolucao = useMemo(
    () =>
      [...scoresTodos].sort(
        (a, b) =>
          String(b.mes ?? "").localeCompare(String(a.mes ?? "")) ||
          (b.indice ?? 0) - (a.indice ?? 0)
      ),
    [scoresTodos]
  );

  const cargaTot = useMemo(() => {
    const sum = (f: (r: CargaRow) => number | null) =>
      carga.reduce((a, r) => a + (f(r) ?? 0), 0);
    const c = sum((r) => r.carga);
    const p = sum((r) => r.processados);
    return {
      carga: c,
      processados: p,
      taxa: c > 0 ? (p / c) * 100 : null,
      semProximo: sum((r) => r.parados_sem_proximo_passo),
      encalhados: sum((r) => r.encalhados_14d),
    };
  }, [carga]);

  const resgTot = useMemo(() => {
    const sum = (f: (r: ResgateMesRow) => number | null) =>
      resgateMes.reduce((a, r) => a + (f(r) ?? 0), 0);
    const dias = resgateMes
      .map((r) => r.dias_medios_no_pipe)
      .filter((n): n is number => typeof n === "number");
    return {
      realizados: sum((r) => r.resgates_realizados),
      ganhos: sum((r) => r.resgates_ganhos),
      dias: dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : null,
      receita: sum((r) => r.receita_resgatada),
    };
  }, [resgateMes]);

  const taxaTone =
    cargaTot.taxa == null
      ? undefined
      : cargaTot.taxa >= 85
      ? "green"
      : cargaTot.taxa >= 50
      ? "amber"
      : ("red" as const);

  return (
    <div className="space-y-6">
      {/* Avisos fixos */}
      <div className="space-y-2">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
          Índice parcial: 90 dos 100 pontos. O eixo Registro &amp; disciplina entra
          quando a tarefa tiver tipo, observação e resultado.
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Compare mês fechado com mês fechado. O mês corrente sempre parece melhor
          porque os cards ainda não tiveram tempo de encalhar.
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          Placar de produtividade
        </h2>
        <Select value={mes} onValueChange={setMesSel}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            {(meses.some((m) => m.mes === fechado)
              ? meses
              : [{ mes: fechado, is_atual: false }, ...meses]
            ).map((m) => (
              <SelectItem key={m.mes} value={m.mes}>
                {m.mes}
                {m.mes === fechado ? " · fechado" : m.is_atual ? " · atual" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* A. Cartões por closer */}
      {isLoading ? (
        <Vazio texto="carregando…" />
      ) : scoresOrd.length === 0 ? (
        <Vazio />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scoresOrd.map((s) => (
            <button
              key={`${s.closer}-${s.mes}`}
              onClick={() => setDetalhe(s)}
              className="text-left rounded-lg border border-border bg-card p-4 space-y-3 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <PersonAvatar name={s.closer} className="h-7 w-7" />
                  <span className="text-sm font-medium truncate">
                    {s.closer ?? "—"}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={cn("text-xs", FAIXA_CLS[s.faixa ?? ""] ?? "")}
                >
                  {s.faixa ?? "—"}
                </Badge>
              </div>

              <div className="flex items-end gap-2">
                <span className="text-3xl font-semibold leading-none">
                  {num(s.indice, 0)}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="mb-0.5 inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      <Info className="h-3 w-3" />
                      parcial — {s.pontos_disponiveis ?? 90} de 100 pontos
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[260px] text-xs">
                    o eixo Registro &amp; disciplina depende dos campos novos da
                    tarefa
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="space-y-2">
                {EIXOS.map((e) => (
                  <EixoBar
                    key={e.key as string}
                    label={e.label}
                    valor={s[e.key] as number | null}
                    peso={e.peso}
                  />
                ))}
                <EixoBar label="Registro" valor={null} peso={10} indisponivel />
              </div>

              {(s.bonus_resgate ?? 0) > 0 && (
                <p className="text-xs text-emerald-500">
                  +{num(s.bonus_resgate, 0)} resgate
                </p>
              )}

              <div className="flex flex-wrap gap-1">
                {s.trava_nota_baixa && (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-red-500/15 text-red-500 border-red-500/30"
                  >
                    nota SE abaixo de 50 — bloqueia faixa Ouro
                  </Badge>
                )}
                {s.trava_cobertura_readai && (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-amber-500/15 text-amber-500 border-amber-500/30"
                  >
                    cobertura Read.ai abaixo de 80%
                  </Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* B. Evolução */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Evolução</h3>
        {evolucao.length === 0 ? (
          <Vazio />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Mês</th>
                  <th className="px-3 py-2 text-left">Closer</th>
                  <th className="px-3 py-2 text-right">Índice</th>
                  <th className="px-3 py-2 text-left">Faixa</th>
                  <th className="px-3 py-2 text-right">Resultado</th>
                  <th className="px-3 py-2 text-right">Qualidade</th>
                  <th className="px-3 py-2 text-right">Assertividade</th>
                  <th className="px-3 py-2 text-right">Processamento</th>
                  <th className="px-3 py-2 text-right">Bônus</th>
                </tr>
              </thead>
              <tbody>
                {evolucao.map((s, i) => (
                  <tr key={`${s.closer}-${s.mes}-${i}`} className="border-t border-border">
                    <td className="px-3 py-2">{s.mes ?? "—"}</td>
                    <td className="px-3 py-2">{s.closer ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {num(s.indice, 0)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", FAIXA_CLS[s.faixa ?? ""] ?? "")}
                      >
                        {s.faixa ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">{num(s.eixo_resultado, 1)}</td>
                    <td className="px-3 py-2 text-right">{num(s.eixo_qualidade, 1)}</td>
                    <td className="px-3 py-2 text-right">
                      {num(s.eixo_assertividade, 1)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {num(s.eixo_processamento, 1)}
                    </td>
                    <td className="px-3 py-2 text-right">{num(s.bonus_resgate, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* C. Carga × processamento */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Carga × processamento
        </h3>
        <p className="text-xs text-muted-foreground">
          carga que entrou no mês e o que foi feito dela
        </p>
        {carga.length === 0 ? (
          <Vazio />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Card label="Carga" value={String(cargaTot.carga)} />
              <Card label="Processados" value={String(cargaTot.processados)} />
              <Card
                label="Taxa de processamento"
                value={pct(cargaTot.taxa)}
                tone={taxaTone}
              />
              <Card label="Sem próximo passo" value={String(cargaTot.semProximo)} />
              <Card label="Encalhados >14d" value={String(cargaTot.encalhados)} />
            </div>

            <div className="space-y-2 pt-2">
              {carga.map((c) => {
                const total =
                  (c.ganhos ?? 0) +
                  (c.perdidos_com_motivo ?? 0) +
                  (c.vivos_com_proxima_tarefa ?? 0) +
                  (c.parados_sem_proximo_passo ?? 0);
                const seg = [
                  { v: c.ganhos ?? 0, cls: "bg-emerald-500", l: "ganhos" },
                  {
                    v: c.perdidos_com_motivo ?? 0,
                    cls: "bg-slate-500",
                    l: "perdidos com motivo",
                  },
                  {
                    v: c.vivos_com_proxima_tarefa ?? 0,
                    cls: "bg-blue-500",
                    l: "vivos com próxima tarefa",
                  },
                  {
                    v: c.parados_sem_proximo_passo ?? 0,
                    cls: "bg-red-500",
                    l: "sem próximo passo",
                  },
                ];
                return (
                  <div key={`${c.closer}-${c.mes}`} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{c.closer ?? "—"}</span>
                      <span className="text-muted-foreground">
                        carga {c.carga ?? 0} · {pct(c.pct_processamento)} processado
                      </span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                      {seg.map((s) => (
                        <div
                          key={s.l}
                          className={s.cls}
                          title={`${s.l}: ${s.v}`}
                          style={{
                            width: total > 0 ? `${(s.v / total) * 100}%` : "0%",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-3 pt-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <i className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> ganhos
                </span>
                <span className="flex items-center gap-1">
                  <i className="h-2 w-2 rounded-full bg-slate-500 inline-block" /> perdidos
                  com motivo
                </span>
                <span className="flex items-center gap-1">
                  <i className="h-2 w-2 rounded-full bg-blue-500 inline-block" /> vivos com
                  próxima tarefa
                </span>
                <span className="flex items-center gap-1">
                  <i className="h-2 w-2 rounded-full bg-red-500 inline-block" /> sem
                  próximo passo
                </span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* D. Resgate */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Resgate de lead frio
        </h3>
        <p className="text-xs text-muted-foreground">
          conta reunião realizada em card parado há 30+ dias — não conta reunião
          marcada
        </p>
        {resgateMes.length === 0 && resgates.length === 0 ? (
          <Vazio />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card label="Resgates realizados" value={String(resgTot.realizados)} />
              <Card label="Viraram venda" value={String(resgTot.ganhos)} />
              <Card
                label="Dias médios no pipe"
                value={resgTot.dias == null ? "—" : num(resgTot.dias, 0)}
              />
              <Card label="Receita resgatada" value={brl(resgTot.receita)} />
            </div>

            {resgates.length === 0 ? (
              <Vazio texto="sem card resgatado no período" />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Empresa</th>
                      <th className="px-3 py-2 text-left">Closer</th>
                      <th className="px-3 py-2 text-left">Data da reunião</th>
                      <th className="px-3 py-2 text-right">Dias no pipe</th>
                      <th className="px-3 py-2 text-left">Virou venda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...resgates]
                      .sort((a, b) => (b.dias_no_pipe ?? 0) - (a.dias_no_pipe ?? 0))
                      .map((r, i) => (
                        <tr
                          key={`${r.lead_id}-${i}`}
                          className="border-t border-border"
                        >
                          <td className="px-3 py-2">{r.empresa ?? "—"}</td>
                          <td className="px-3 py-2">{r.closer ?? "—"}</td>
                          <td className="px-3 py-2">
                            {r.data_reuniao
                              ? new Date(r.data_reuniao).toLocaleDateString("pt-BR")
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {num(r.dias_no_pipe, 0)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                r.virou_venda
                                  ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                                  : "bg-muted text-muted-foreground border-border"
                              )}
                            >
                              {r.virou_venda ? "sim" : "não"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* Detalhe ponto a ponto */}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {detalhe?.closer ?? "—"} · {detalhe?.mes ?? ""}
            </DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-1 text-sm">
              {CRITERIOS.map((c) => (
                <div
                  key={c.key as string}
                  className="flex items-center justify-between border-b border-border/50 py-1"
                >
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="font-medium">
                    {detalhe[c.key] == null ? "—" : num(detalhe[c.key] as number, 1)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 text-sm font-medium">
                <span>Total</span>
                <span>
                  {num(detalhe.pontos, 1)} / {detalhe.pontos_disponiveis ?? 90}
                </span>
              </div>
              {detalhe.cobertura_readai != null && (
                <p className="pt-1 text-xs text-muted-foreground">
                  cobertura Read.ai: {pct(detalhe.cobertura_readai)}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
