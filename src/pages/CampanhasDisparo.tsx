import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pause, Play, SlidersHorizontal, ExternalLink, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseExternal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  statusContato, STATUS_LABEL, validarRitmo, formatTelefone, fmtDataHora,
  type ContatoStatus, type Ritmo,
} from "@/lib/campanhaDisparo";

interface Resumo {
  campanha: string;
  template_nome: string | null;
  envio_ativo: boolean;
  total_alvo: number | null;
  na_fila: number | null;
  enviados: number | null;
  enviados_hoje: number | null;
  limite_diario: number | null;
  com_erro: number | null;
  responderam: number | null;
  viraram_card: number | null;
  pediram_sair: number | null;
  lote_por_rodada: number | null;
  hora_inicio: number | null;
  hora_fim: number | null;
  filtro_onda: string | null;
}

interface Contato {
  id?: string;
  socio: string | null;
  cliente: string | null;
  telefone: string | null;
  retencao_meses: number | null;
  onda: string | number | null;
  enviado_em: string | null;
  respondeu_em: string | null;
  envio_status: string | null;
  envio_erro: string | null;
  opt_out_em: string | null;
  lead_id_campanha: string | null;
}

const POLL = 30_000;
const PAGE = 200;
const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");

const STATUS_CLS: Record<ContatoStatus, string> = {
  opt_out: "bg-foreground/80 text-background",
  virou_card: "bg-success/15 text-success border border-success/30",
  respondeu: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30",
  erro: "bg-destructive/15 text-destructive border border-destructive/30",
  enviado: "bg-blue-500/5 text-blue-500 dark:text-blue-300 border border-blue-500/20",
  na_fila: "bg-muted text-muted-foreground border border-border",
};

async function fetchResumo(): Promise<Resumo[]> {
  const { data, error } = await (supabase as any).from("vw_campanha_resumo").select("*");
  if (error) throw error;
  return (data ?? []) as Resumo[];
}

async function fetchContatos(campanha: string): Promise<Contato[]> {
  const all: Contato[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await (supabase as any)
      .from("campanha_disparo_contatos")
      .select("*")
      .eq("campanha", campanha)
      .range(from, from + 999);
    if (error) throw error;
    all.push(...((data ?? []) as Contato[]));
    if (!data || data.length < 1000) break;
  }
  return all;
}

function Contador({ label, valor, destaque }: { label: string; valor: React.ReactNode; destaque?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
      <p className={cn("text-lg font-semibold tabular-nums text-foreground", destaque && "text-destructive")}>{valor}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function CampanhaCard({
  r, selecionada, onSelect, onIniciar, onPausar, onEditar, salvando,
}: {
  r: Resumo; selecionada: boolean; salvando: boolean;
  onSelect: () => void; onIniciar: () => void; onPausar: () => void; onEditar: () => void;
}) {
  const total = r.total_alvo ?? 0;
  const pct = total > 0 ? Math.min(100, ((r.enviados ?? 0) / total) * 100) : 0;
  return (
    <div
      onClick={onSelect}
      className={cn(
        "bg-card border rounded-xl p-4 space-y-3 cursor-pointer transition-colors",
        selecionada ? "border-primary ring-1 ring-primary/40" : "border-border hover:border-primary/40",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground break-all">{r.campanha}</p>
          <p className="text-xs text-muted-foreground">{r.template_nome ?? "—"}</p>
        </div>
        <span
          className={cn(
            "text-[11px] font-medium rounded-full px-2 py-0.5 border",
            r.envio_ativo ? "bg-success/15 text-success border-success/30" : "bg-muted text-muted-foreground border-border",
          )}
        >
          {r.envio_ativo ? "Enviando" : "Pausada"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Contador label="Total alvo" valor={n(r.total_alvo)} />
        <Contador label="Na fila" valor={n(r.na_fila)} />
        <Contador label="Enviados" valor={n(r.enviados)} />
        <Contador label="Enviados hoje" valor={<>{n(r.enviados_hoje)} <span className="text-xs font-normal text-muted-foreground">de {n(r.limite_diario)}</span></>} />
        <Contador label="Com erro" valor={n(r.com_erro)} destaque={(r.com_erro ?? 0) > 0} />
        <Contador label="Responderam" valor={n(r.responderam)} />
        <Contador label="Viraram card" valor={n(r.viraram_card)} />
        <Contador label="Pediram para sair" valor={n(r.pediram_sair)} />
      </div>

      <div className="space-y-1">
        <Progress value={pct} className="h-2" />
        <p className="text-[11px] text-muted-foreground text-right tabular-nums">
          {n(r.enviados)} de {n(r.total_alvo)} enviados ({pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Lotes de {r.lote_por_rodada ?? "—"} a cada 10 min, seg–sex das {r.hora_inicio ?? "—"}h às {r.hora_fim ?? "—"}h,
        até {r.limite_diario ?? "—"}/dia. Onda: {r.filtro_onda ?? "todas"}
      </p>

      <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
        {r.envio_ativo ? (
          <Button size="sm" variant="outline" onClick={onPausar} disabled={salvando}>
            <Pause className="h-4 w-4 mr-1" /> Pausar envio
          </Button>
        ) : (
          <Button size="sm" onClick={onIniciar} disabled={salvando}>
            <Play className="h-4 w-4 mr-1" /> Iniciar envio
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onEditar} disabled={salvando}>
          <SlidersHorizontal className="h-4 w-4 mr-1" /> Editar ritmo
        </Button>
      </div>
    </div>
  );
}

export default function CampanhasDisparo() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [confirmarInicio, setConfirmarInicio] = useState<Resumo | null>(null);
  const [editando, setEditando] = useState<Resumo | null>(null);
  const [ritmo, setRitmo] = useState<Record<keyof Ritmo, string>>({ lote_por_rodada: "", limite_diario: "", hora_inicio: "", hora_fim: "" });
  const [salvando, setSalvando] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | ContatoStatus>("todos");
  const [filtroOnda, setFiltroOnda] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(PAGE);

  const resumoQ = useQuery({ queryKey: ["vw_campanha_resumo"], queryFn: fetchResumo, refetchInterval: POLL, staleTime: 0 });
  const campanhas = resumoQ.data ?? [];

  useEffect(() => {
    if (!selecionada && campanhas.length > 0) setSelecionada(campanhas[0].campanha);
  }, [campanhas, selecionada]);

  const contatosQ = useQuery({
    queryKey: ["campanha_disparo_contatos", selecionada],
    queryFn: () => fetchContatos(selecionada!),
    enabled: !!selecionada,
    refetchInterval: POLL,
    staleTime: 0,
  });

  useEffect(() => { setLimite(PAGE); }, [selecionada, filtroStatus, filtroOnda, busca]);

  const contatos = useMemo(
    () => (contatosQ.data ?? []).map((c) => ({ ...c, _status: statusContato(c) })),
    [contatosQ.data],
  );
  const ondas = useMemo(
    () => Array.from(new Set(contatos.map((c) => c.onda).filter((o) => o !== null && o !== "").map(String))).sort(),
    [contatos],
  );
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDig = q.replace(/\D/g, "");
    return contatos.filter((c) => {
      if (filtroStatus !== "todos" && c._status !== filtroStatus) return false;
      if (filtroOnda !== "todas" && String(c.onda) !== filtroOnda) return false;
      if (!q) return true;
      return (
        (c.socio ?? "").toLowerCase().includes(q) ||
        (c.cliente ?? "").toLowerCase().includes(q) ||
        (qDig.length > 0 && (c.telefone ?? "").replace(/\D/g, "").includes(qDig))
      );
    });
  }, [contatos, filtroStatus, filtroOnda, busca]);

  const atualizarConfig = async (campanha: string, patch: Record<string, unknown>, okMsg: string) => {
    setSalvando(true);
    const { data, error } = await (supabase as any)
      .from("campanha_config")
      .update(patch)
      .eq("campanha", campanha)
      .select("campanha");
    setSalvando(false);
    if (error) { toast.error(error.message || "Não foi possível salvar."); return false; }
    if (!data || data.length === 0) { toast.error("Nada foi alterado. Verifique se você tem permissão de admin."); return false; }
    toast.success(okMsg);
    await qc.invalidateQueries({ queryKey: ["vw_campanha_resumo"] });
    return true;
  };

  const abrirEditar = (r: Resumo) => {
    setRitmo({
      lote_por_rodada: String(r.lote_por_rodada ?? ""),
      limite_diario: String(r.limite_diario ?? ""),
      hora_inicio: String(r.hora_inicio ?? ""),
      hora_fim: String(r.hora_fim ?? ""),
    });
    setEditando(r);
  };

  const ritmoNum: Ritmo = {
    lote_por_rodada: Number(ritmo.lote_por_rodada),
    limite_diario: Number(ritmo.limite_diario),
    hora_inicio: Number(ritmo.hora_inicio),
    hora_fim: Number(ritmo.hora_fim),
  };
  const ritmoVazio = Object.values(ritmo).some((v) => v.trim() === "");
  const erroRitmo = ritmoVazio ? "Preencha todos os campos." : validarRitmo(ritmoNum);

  const salvarRitmo = async () => {
    if (!editando || erroRitmo) return;
    const ok = await atualizarConfig(editando.campanha, { ...ritmoNum, atualizado_em: new Date().toISOString() }, "Ritmo atualizado.");
    if (ok) setEditando(null);
  };

  const abrirCard = (leadId: string) => {
    navigate("/pipeline");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("open-lead-card", { detail: { leadId } }));
    }, 200);
  };

  const fetchingSilencioso = (resumoQ.isFetching && !resumoQ.isLoading) || (contatosQ.isFetching && !contatosQ.isLoading);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Campanhas de Disparo</h1>
        <p className="text-sm text-muted-foreground">
          Disparos de WhatsApp feitos automaticamente pelo sistema · atualiza a cada 30s{fetchingSilencioso ? " · atualizando…" : ""}
        </p>
      </div>

      {resumoQ.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="h-72 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : resumoQ.isError ? (
        <p className="text-sm text-destructive">Não foi possível carregar as campanhas.</p>
      ) : campanhas.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma campanha cadastrada.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {campanhas.map((r) => (
            <CampanhaCard
              key={r.campanha}
              r={r}
              selecionada={selecionada === r.campanha}
              salvando={salvando}
              onSelect={() => setSelecionada(r.campanha)}
              onIniciar={() => setConfirmarInicio(r)}
              onPausar={() => atualizarConfig(r.campanha, { envio_ativo: false }, "Envio pausado.")}
              onEditar={() => abrirEditar(r)}
            />
          ))}
        </div>
      )}

      {selecionada && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Contatos · <span className="font-normal text-muted-foreground">{selecionada}</span>
              <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                {filtrados.length.toLocaleString("pt-BR")} de {contatos.length.toLocaleString("pt-BR")}
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, empresa ou telefone"
                  className="h-8 pl-8 w-60 text-sm"
                />
              </div>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as any)}
                className="h-8 text-sm bg-card border border-border rounded-md px-2 text-foreground"
              >
                <option value="todos">Todos os status</option>
                {(Object.keys(STATUS_LABEL) as ContatoStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
              <select
                value={filtroOnda}
                onChange={(e) => setFiltroOnda(e.target.value)}
                className="h-8 text-sm bg-card border border-border rounded-md px-2 text-foreground"
              >
                <option value="todas">Todas as ondas</option>
                {ondas.map((o) => <option key={o} value={o}>Onda {o}</option>)}
              </select>
            </div>
          </div>

          {contatosQ.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-9 rounded bg-muted/40 animate-pulse" />)}
            </div>
          ) : contatosQ.isError ? (
            <p className="text-sm text-destructive">Não foi possível carregar os contatos.</p>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum contato encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-medium">Sócio</th>
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 pr-3 font-medium">Telefone</th>
                    <th className="py-2 pr-3 font-medium text-right">Retenção (meses)</th>
                    <th className="py-2 pr-3 font-medium">Onda</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Enviado em</th>
                    <th className="py-2 pr-3 font-medium">Respondeu em</th>
                    <th className="py-2 font-medium">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.slice(0, limite).map((c, i) => (
                    <tr key={c.id ?? `${c.telefone}-${i}`} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-3 text-foreground">{c.socio ?? "—"}</td>
                      <td className="py-2 pr-3 text-foreground">{c.cliente ?? "—"}</td>
                      <td className="py-2 pr-3 whitespace-nowrap tabular-nums text-foreground">{formatTelefone(c.telefone)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-foreground">{c.retencao_meses ?? "—"}</td>
                      <td className="py-2 pr-3 text-foreground">{c.onda ?? "—"}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <StatusBadge c={c} status={c._status} onAbrir={abrirCard} />
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap tabular-nums text-muted-foreground">{fmtDataHora(c.enviado_em)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap tabular-nums text-muted-foreground">{fmtDataHora(c.respondeu_em)}</td>
                      <td className="py-2 text-xs text-destructive max-w-[16rem] truncate" title={c.envio_erro ?? undefined}>
                        {c.envio_erro ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtrados.length > limite && (
                <div className="pt-3 text-center">
                  <Button size="sm" variant="outline" onClick={() => setLimite((l) => l + PAGE)}>
                    Mostrar mais ({(filtrados.length - limite).toLocaleString("pt-BR")} restantes)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!confirmarInicio} onOpenChange={(o) => !o && setConfirmarInicio(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar envio</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai enviar o modelo {confirmarInicio?.template_nome ?? "—"} para {n(confirmarInicio?.na_fila)} contatos
              pelo WhatsApp 0412. Confirmar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={salvando}
              onClick={async (e) => {
                e.preventDefault();
                if (!confirmarInicio) return;
                const ok = await atualizarConfig(confirmarInicio.campanha, { envio_ativo: true }, "Envio iniciado.");
                if (ok) setConfirmarInicio(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar ritmo · {editando?.campanha}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["lote_por_rodada", "Lote por rodada", 1, 50],
              ["limite_diario", "Limite diário", 1, 500],
              ["hora_inicio", "Hora de início", 0, 23],
              ["hora_fim", "Hora de fim", 1, 24],
            ] as const).map(([k, label, min, max]) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={k} className="text-xs">{label} ({min}–{max})</Label>
                <Input
                  id={k}
                  type="number"
                  inputMode="numeric"
                  min={min}
                  max={max}
                  step={1}
                  value={ritmo[k]}
                  onChange={(e) => setRitmo((r) => ({ ...r, [k]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          {erroRitmo && <p className="text-xs text-destructive">{erroRitmo}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditando(null)} disabled={salvando}>Cancelar</Button>
            <Button onClick={salvarRitmo} disabled={salvando || !!erroRitmo}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ c, status, onAbrir }: { c: Contato; status: ContatoStatus; onAbrir: (id: string) => void }) {
  const badge = (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_CLS[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
  if (status === "virou_card" && c.lead_id_campanha) {
    return (
      <span className="inline-flex items-center gap-1.5">
        {badge}
        <button
          type="button"
          onClick={() => onAbrir(c.lead_id_campanha!)}
          className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
        >
          Abrir card <ExternalLink className="h-3 w-3" />
        </button>
      </span>
    );
  }
  if (status === "erro" && c.envio_erro) {
    return (
      <Tooltip>
        <TooltipTrigger asChild><span className="cursor-help">{badge}</span></TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{c.envio_erro}</TooltipContent>
      </Tooltip>
    );
  }
  return badge;
}
