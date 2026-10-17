import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Info } from "lucide-react";
import { supabase } from "@/lib/supabaseExternal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { brlFull } from "@/lib/kpiFormat";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./AgentAvatar";
import { useAgentes } from "./AgentesContext";

const GOLD = "#B8956A";
const NOMES: Record<string, string> = { black_ops: "Atlas", pipeline: "Ghost", marketing: "Echo" };
type Periodo = "7d" | "30d" | "mes" | "mes_ant";

const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
function range(p: Periodo) {
  const hoje = new Date(ymd(new Date()) + "T12:00:00");
  const fim = new Date(hoje);
  let ini = new Date(hoje);
  if (p === "7d") ini.setDate(ini.getDate() - 6);
  else if (p === "30d") ini.setDate(ini.getDate() - 29);
  else if (p === "mes") ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 12);
  else {
    ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1, 12);
    return { p_inicio: ymd(ini), p_fim: ymd(new Date(hoje.getFullYear(), hoje.getMonth(), 0, 12)) };
  }
  return { p_inicio: ymd(ini), p_fim: ymd(fim) };
}
const quando = (s?: string) => (s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");

export function UsoAgentes() {
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const params = useMemo(() => range(periodo), [periodo]);
  const { data: agentes = [] } = useAgentes();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["ag-uso", params],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("ag_uso_agentes", params);
      if (error) throw error;
      return data as any;
    },
  });
  const t = data?.totais ?? {};
  const agente = (id: string) => agentes.find((a) => a.id === id) ?? ({ id, nome: NOMES[id] ?? id } as any);

  const revisar = useMemo(() => {
    const l = [...(data?.para_revisar ?? [])];
    l.sort((a: any, b: any) => (Number(!!a.revisado) - Number(!!b.revisado)) || (new Date(b.created_at ?? b.quando ?? 0).getTime() - new Date(a.created_at ?? a.quando ?? 0).getTime()));
    return l;
  }, [data]);

  const marcar = async (id: string) => {
    const { error } = await (supabase as any).rpc("ag_feedback_revisado", { p_mensagem_id: id });
    if (!error) qc.setQueryData(["ag-uso", params], (d: any) => d && { ...d, para_revisar: d.para_revisar.map((x: any) => ((x.mensagem_id ?? x.id) === id ? { ...x, revisado: true } : x)) });
  };

  const kpis = [
    { l: "Perguntas", v: t.perguntas ?? 0 },
    { l: "Pessoas ativas", v: t.pessoas_ativas ?? 0 },
    { l: "% 👎", v: t.pct_negativas == null ? "—" : `${Number(t.pct_negativas).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` },
    { l: "Erros técnicos", v: t.erros ?? t.erros_tecnicos ?? 0 },
    { l: "Custo do período", v: brlFull(t.custo_brl ?? 0), info: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-1">
        {([["7d", "7d"], ["30d", "30d"], ["mes", "Mês"], ["mes_ant", "Mês anterior"]] as [Periodo, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setPeriodo(k)} className={cn("px-3 py-1 text-xs rounded border", periodo === k ? "text-background" : "border-border text-muted-foreground hover:text-foreground")} style={periodo === k ? { backgroundColor: GOLD, borderColor: GOLD } : undefined}>{l}</button>
        ))}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {error && <p className="text-sm text-destructive">Não foi possível carregar o uso.</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {kpis.map((k) => (
              <div key={k.l} className="rounded-lg border border-border bg-card p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  {k.l}
                  {k.info && (
                    <Tooltip><TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">Estimativa conservadora (teto): conta todos os tokens de entrada a preço cheio, mesmo os que vieram do cache.</TooltipContent></Tooltip>
                  )}
                </p>
                <p className="text-2xl font-semibold tabular-nums mt-1" style={{ color: GOLD }}>{k.v}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(data.por_dia ?? []).map((d: any) => ({ ...d, label: String(d.dia ?? d.data).slice(5).split("-").reverse().join("/") }))}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A8A8A" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8A8A8A" }} width={30} />
                <RTooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  formatter={(v: any, _n: any, p: any) => [`${v} perguntas · ${brlFull(p.payload.custo_brl ?? 0)}`, ""]} />
                <Bar dataKey="perguntas" fill={GOLD} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <p className="px-4 pt-4 text-sm font-semibold">Quem usa</p>
            <table className="w-full text-sm mt-2">
              <thead className="text-[11px] uppercase text-muted-foreground">
                <tr className="border-b border-border">{["Pessoa", "Agente", "Perguntas", "Dias ativos", "Última pergunta", "👍", "👎", "Erros", "Custo (R$)"].map((h) => <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {[...(data.por_pessoa_agente ?? [])].sort((a: any, b: any) => (b.perguntas ?? 0) - (a.perguntas ?? 0)).map((r: any, i: number) => {
                  const a = agente(r.agente_id);
                  return (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-3 py-2">{r.pessoa ?? r.nome ?? r.email}</td>
                      <td className="px-3 py-2"><span className="flex items-center gap-2"><AgentAvatar agente={a} className="h-6 w-6 rounded-full" imgClassName="object-[center_25%]" />{NOMES[r.agente_id] ?? a.nome}</span></td>
                      <td className="px-3 py-2 tabular-nums">{r.perguntas ?? 0}</td>
                      <td className="px-3 py-2 tabular-nums">{r.dias_ativos ?? 0}</td>
                      <td className="px-3 py-2">{quando(r.ultima_pergunta)}</td>
                      <td className="px-3 py-2 tabular-nums">{r.positivas ?? r.likes ?? 0}</td>
                      <td className="px-3 py-2 tabular-nums">{r.negativas ?? r.dislikes ?? 0}</td>
                      <td className="px-3 py-2 tabular-nums">{r.erros ?? 0}</td>
                      <td className="px-3 py-2 tabular-nums">{brlFull(r.custo_brl ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-semibold mb-2">Ainda não usaram</p>
            {(data.sem_uso ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Todo o time usou no período</p> : (
              <div className="flex flex-wrap gap-2">
                {data.sem_uso.map((n: any, i: number) => <span key={i} className="text-xs rounded-full bg-muted text-muted-foreground px-2.5 py-1">{typeof n === "string" ? n : n.nome ?? n.email}</span>)}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Para revisar</p>
            {revisar.length === 0 && <p className="text-sm text-muted-foreground">Nada para revisar no período.</p>}
            {revisar.map((r: any) => <RevisarCard key={r.mensagem_id ?? r.id} r={r} nome={NOMES[r.agente_id] ?? r.agente_id} onMarcar={marcar} />)}
          </div>
        </>
      )}
    </div>
  );
}

function RevisarCard({ r, nome, onMarcar }: { r: any; nome: string; onMarcar: (id: string) => void }) {
  const [tudo, setTudo] = useState(false);
  const id = r.mensagem_id ?? r.id;
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 space-y-2 transition-opacity", r.revisado && "opacity-50")}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{r.pessoa ?? r.nome} · {nome} · {quando(r.created_at ?? r.quando)}{r.erro && <span className="ml-2 text-destructive">erro técnico</span>}</span>
        {r.revisado ? <span className="rounded-full border px-2 py-0.5" style={{ borderColor: GOLD, color: GOLD }}>Revisado</span>
          : <button onClick={() => onMarcar(id)} className="rounded border border-border px-2 py-1 hover:bg-muted text-foreground">Marcar como revisado</button>}
      </div>
      {(r.comentario ?? r.feedback_comentario) && <p className="text-sm font-medium text-[#F87171]">“{r.comentario ?? r.feedback_comentario}”</p>}
      {r.pergunta && <p className="text-sm"><span className="text-muted-foreground">Pergunta: </span>{r.pergunta}</p>}
      {r.resposta && (
        <div>
          <p className={cn("text-sm text-foreground/80 whitespace-pre-wrap", !tudo && "line-clamp-3")}>{r.resposta}</p>
          <button onClick={() => setTudo((v) => !v)} className="text-xs mt-1" style={{ color: GOLD }}>{tudo ? "ver menos" : "ver tudo"}</button>
        </div>
      )}
    </div>
  );
}
