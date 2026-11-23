import { useMemo, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Pencil, ExternalLink, Info } from "lucide-react";
import { supabase } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  cadastrosDe, orcamentoCampanhaCentavos, reaisParaCentavos, validarOrcamento, custoPorCadastro,
} from "@/lib/metaCampanhas";

const ADS_MANAGER_URL = "https://adsmanager.facebook.com/adsmanager/manage/ads?act=1063412549170586";
const brl = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const centavos = (c: any) => (c == null || c === "" ? null : Number(c) / 100);
const fmtDataHora = (s: string) =>
  new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

type Nivel = "campaign" | "adset";
type Overview = { campanhas: any[]; hoje: any[]; ultimos_7d: any[] };

async function invokeMeta(body: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("meta-manager", { body });
  if (error) {
    let msg = error.message;
    try { const ctx = await (error as any).context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* ignore */ }
    throw new Error(msg || "Falha ao falar com o Meta.");
  }
  if (data?.error) throw new Error(String(data.error));
  return data;
}

function StatusBadge({ status }: { status?: string }) {
  const ativo = status === "ACTIVE";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide",
      ativo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", ativo ? "bg-success" : "bg-muted-foreground")} />
      {ativo ? "ATIVA" : status === "PAUSED" ? "PAUSADA" : status ?? "—"}
    </span>
  );
}

export default function CampanhasMeta() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const overview = useQuery({
    queryKey: ["meta-manager-overview"],
    queryFn: async () => (await invokeMeta({ action: "overview" })) as Overview,
    staleTime: 60_000,
  });

  const [confirmar, setConfirmar] = useState<{ nivel: Nivel; id: string; nome: string; status: "ACTIVE" | "PAUSED" } | null>(null);
  const [orcamento, setOrcamento] = useState<{ nivel: Nivel; id: string; nome: string; atual: number | null } | null>(null);
  const [valorTxt, setValorTxt] = useState("");
  const [salvando, setSalvando] = useState(false);

  const insights = useMemo(() => {
    const idx = (arr: any[] | undefined) => {
      const m = new Map<string, any>();
      (arr ?? []).forEach((r) => m.set(String(r.campaign_id), r));
      return m;
    };
    return { hoje: idx(overview.data?.hoje), d7: idx(overview.data?.ultimos_7d) };
  }, [overview.data]);

  const recarregar = async () => {
    await qc.invalidateQueries({ queryKey: ["meta-manager-overview"] });
    qc.invalidateQueries({ queryKey: ["mkt-acoes-log"] });
  };

  const executarStatus = async () => {
    if (!confirmar) return;
    setSalvando(true);
    try {
      await invokeMeta({ action: "set_status", nivel: confirmar.nivel, id: confirmar.id, status: confirmar.status, nome: confirmar.nome });
      toast.success(confirmar.status === "PAUSED" ? `${confirmar.nome} pausada.` : `${confirmar.nome} ativada.`);
      setConfirmar(null);
      await recarregar();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível alterar o status.");
    } finally { setSalvando(false); }
  };

  const centavosNovo = reaisParaCentavos(valorTxt);
  const erroOrcamento = valorTxt ? validarOrcamento(centavosNovo) : null;
  const executarOrcamento = async () => {
    if (!orcamento) return;
    const erro = validarOrcamento(centavosNovo);
    if (erro) { toast.error(erro); return; }
    setSalvando(true);
    try {
      await invokeMeta({ action: "set_budget", nivel: orcamento.nivel, id: orcamento.id, daily_budget_centavos: centavosNovo, nome: orcamento.nome });
      toast.success(`Orçamento de ${orcamento.nome} atualizado para ${brl((centavosNovo ?? 0) / 100)}/dia.`);
      setOrcamento(null);
      await recarregar();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível alterar o orçamento.");
    } finally { setSalvando(false); }
  };

  const abrirOrcamento = (nivel: Nivel, id: string, nome: string, atualCentavos: number | null) => {
    setValorTxt(atualCentavos ? (atualCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
    setOrcamento({ nivel, id, nome, atual: atualCentavos });
  };

  const campanhas = overview.data?.campanhas ?? [];

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif-display text-2xl text-foreground">Campanhas</h1>
            <p className="text-xs text-muted-foreground">Meta Ads · orçamento, gasto e cadastros por campanha</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => overview.refetch()} disabled={overview.isFetching}>
            <RefreshCw className={cn("h-4 w-4 mr-1.5", overview.isFetching && "animate-spin")} /> Atualizar
          </Button>
        </div>

        {overview.isLoading ? (
          <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div>
        ) : overview.isError ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Não foi possível carregar as campanhas. {(overview.error as any)?.message}</p>
            <Button size="sm" variant="outline" onClick={() => overview.refetch()}>Tentar de novo</Button>
          </div>
        ) : campanhas.length === 0 ? (
          <p className="text-center py-10 text-sm text-muted-foreground">Nenhuma campanha encontrada.</p>
        ) : (
          <div className="space-y-4">
            {campanhas.map((c) => {
              const id = String(c.id);
              const orc = orcamentoCampanhaCentavos(c);
              const cbo = Number(c.daily_budget ?? 0) > 0;
              const gHoje = Number(insights.hoje.get(id)?.spend ?? 0);
              const i7 = insights.d7.get(id);
              const g7 = Number(i7?.spend ?? 0);
              const cad7 = cadastrosDe(i7?.actions);
              const cpc = custoPorCadastro(g7, cad7);
              const ativa = c.status === "ACTIVE";
              const adsets: any[] = c.adsets?.data ?? [];
              const ads: any[] = c.ads?.data ?? [];
              return (
                <section key={id} className="rounded-lg border border-border bg-card">
                  <div className="flex flex-wrap items-start justify-between gap-3 p-4 border-b border-border">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-foreground">{c.name}</h2>
                        <StatusBadge status={c.status} />
                        {c.effective_status && c.effective_status !== c.status && (
                          <span className="text-[10px] text-muted-foreground">({c.effective_status})</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{c.objective ?? ""} · {cbo ? "Orçamento na campanha" : "Orçamento nos conjuntos"}</p>
                    </div>
                    {isAdmin && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        {ativa ? "Ativa" : "Pausada"}
                        <Switch checked={ativa} onCheckedChange={(v) => setConfirmar({ nivel: "campaign", id, nome: c.name, status: v ? "ACTIVE" : "PAUSED" })} />
                      </label>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4">
                    <Kpi l="Orçamento diário" v={brl(orc != null ? orc / 100 : null)}
                      acao={isAdmin && cbo ? () => abrirOrcamento("campaign", id, c.name, orc) : undefined} />
                    <Kpi l="Gasto hoje" v={brl(gHoje)} />
                    <Kpi l="Gasto 7 dias" v={brl(g7)} />
                    <Kpi l="Cadastros 7 dias" v={cad7.toLocaleString("pt-BR")} />
                    <Kpi l="Custo/cadastro 7d" v={brl(cpc)} />
                  </div>

                  {adsets.length > 0 && (
                    <div className="px-4 pb-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Conjuntos de anúncios</p>
                      <ul className="divide-y divide-border rounded-md border border-border">
                        {adsets.map((a) => {
                          const aid = String(a.id);
                          const aOrc = a.daily_budget != null && Number(a.daily_budget) > 0 ? Number(a.daily_budget) : null;
                          const aAtivo = a.status === "ACTIVE";
                          return (
                            <li key={aid} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                              <span className="min-w-0 flex-1 truncate text-foreground" title={a.name}>{a.name}</span>
                              <StatusBadge status={a.status} />
                              <span className="tabular-nums text-xs text-muted-foreground w-28 text-right">{aOrc != null ? `${brl(aOrc / 100)}/dia` : "—"}</span>
                              {isAdmin && (
                                <div className="flex items-center gap-2">
                                  {!cbo && (
                                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Editar orçamento de ${a.name}`}
                                      onClick={() => abrirOrcamento("adset", aid, a.name, aOrc)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Switch checked={aAtivo} aria-label={`Ativar ou pausar ${a.name}`}
                                    onCheckedChange={(v) => setConfirmar({ nivel: "adset", id: aid, nome: a.name, status: v ? "ACTIVE" : "PAUSED" })} />
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {ads.length > 0 && (
                    <div className="px-4 pb-4">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Anúncios</p>
                      <ul className="divide-y divide-border rounded-md border border-border">
                        {ads.map((ad) => (
                          <li key={String(ad.id)} className="flex items-center gap-3 px-3 py-2 text-sm">
                            <span className="min-w-0 flex-1 truncate text-foreground" title={ad.name}>{ad.name}</span>
                            <StatusBadge status={ad.status} />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a href={ADS_MANAGER_URL} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                                  aria-label="Abrir no Gerenciador de Anúncios">
                                  <Info className="h-3.5 w-3.5" />
                                </a>
                              </TooltipTrigger>
                              <TooltipContent>Anúncios de WhatsApp só podem ser ligados/desligados no Gerenciador</TooltipContent>
                            </Tooltip>
                          </li>
                        ))}
                      </ul>
                      <a href={ADS_MANAGER_URL} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                        Abrir no Gerenciador <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <HistoricoAcoes />
      </div>

      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && !salvando && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmar?.status === "PAUSED" ? "Pausar" : "Ativar"} {confirmar?.nivel === "campaign" ? "a campanha" : "o conjunto"} {confirmar?.nome}?
            </AlertDialogTitle>
            <AlertDialogDescription>A mudança é aplicada direto no Meta Ads.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={salvando} onClick={(e) => { e.preventDefault(); executarStatus(); }}>
              {salvando ? "Aplicando…" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!orcamento} onOpenChange={(o) => !o && !salvando && setOrcamento(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Orçamento diário — {orcamento?.nome}</DialogTitle>
            <DialogDescription>Atual: {brl(orcamento?.atual != null ? orcamento.atual / 100 : null)}/dia. Limites: R$ 10 a R$ 5.000 por dia.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="orc-novo">Novo orçamento (R$/dia)</Label>
            <Input id="orc-novo" inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} placeholder="150,00" />
            {erroOrcamento && <p className="text-xs text-destructive">{erroOrcamento}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrcamento(null)} disabled={salvando}>Cancelar</Button>
            <Button onClick={executarOrcamento} disabled={salvando || !!validarOrcamento(centavosNovo)}>{salvando ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ l, v, acao }: { l: string; v: string; acao?: () => void }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</p>
      <div className="flex items-center gap-1">
        <p className="font-semibold tabular-nums whitespace-nowrap text-foreground">{v}</p>
        {acao && (
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={acao} aria-label={`Editar ${l.toLowerCase()}`}>
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

const POR_PAGINA = 20;
const RESULTADO_CLS = (r?: string) =>
  r === "sucesso" || r === "ok" ? "text-success" : r === "erro" || r === "falha" ? "text-destructive" : "text-muted-foreground";

function HistoricoAcoes() {
  const [pagina, setPagina] = useState(0);
  const q = useQuery({
    queryKey: ["mkt-acoes-log", pagina],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const de = pagina * POR_PAGINA;
      const { data, error, count } = await supabase
        .from("mkt_acoes_log" as any)
        .select("user_email, acao, nivel, objeto_id, objeto_nome, resultado, erro, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(de, de + POR_PAGINA - 1);
      if (error) throw error;
      return { linhas: (data ?? []) as any[], total: count ?? 0 };
    },
  });
  const total = q.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Histórico de ações</h2>
        <span className="text-xs text-muted-foreground">{total.toLocaleString("pt-BR")} registros</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 font-medium">Quando</th>
              <th className="px-4 py-2 font-medium">Quem fez</th>
              <th className="px-4 py-2 font-medium">Ação</th>
              <th className="px-4 py-2 font-medium">Objeto</th>
              <th className="px-4 py-2 font-medium">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={5} className="px-4 py-2"><Skeleton className="h-5 w-full" /></td></tr>)
            ) : q.isError ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Não foi possível carregar o histórico.</td></tr>
            ) : (q.data?.linhas ?? []).length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nenhuma ação registrada ainda.</td></tr>
            ) : (
              q.data!.linhas.map((r, i) => (
                <tr key={`${r.created_at}-${i}`}>
                  <td className="px-4 py-2 whitespace-nowrap tabular-nums text-muted-foreground">{fmtDataHora(r.created_at)}</td>
                  <td className="px-4 py-2">{r.user_email ?? "—"}</td>
                  <td className="px-4 py-2">{r.acao}{r.nivel ? <span className="text-muted-foreground"> · {r.nivel === "campaign" ? "campanha" : r.nivel === "adset" ? "conjunto" : r.nivel}</span> : null}</td>
                  <td className="px-4 py-2 max-w-[280px] truncate" title={r.objeto_nome ?? r.objeto_id}>{r.objeto_nome ?? r.objeto_id ?? "—"}</td>
                  <td className={cn("px-4 py-2", RESULTADO_CLS(r.resultado))} title={r.erro ?? undefined}>{r.resultado ?? "—"}{r.erro ? ` — ${r.erro}` : ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {paginas > 1 && (
        <div className="flex items-center justify-end gap-2 p-3 border-t border-border text-xs text-muted-foreground">
          <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
          <span>Página {pagina + 1} de {paginas}</span>
          <Button size="sm" variant="outline" disabled={pagina + 1 >= paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
        </div>
      )}
    </section>
  );
}
