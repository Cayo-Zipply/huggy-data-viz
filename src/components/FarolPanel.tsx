import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PipelineCard, PipelineGoal, Stage } from "./pipeline/types";
import { formatBRL, getBusinessDays, getBusinessDaysPassed } from "./pipeline/types";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Settings, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeamMembers, type TeamMember } from "@/hooks/useTeamMembers";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  cards: PipelineCard[];
  goals: PipelineGoal[];
  owners: string[]; // legacy, ignored — uses team members
  onSaveGoal?: (g: PipelineGoal) => void | Promise<void>;
}

function Semaphore({ pct }: { pct: number }) {
  const color = pct >= 110 ? "bg-green-500" : pct >= 90 ? "bg-yellow-500" : "bg-red-500";
  return <span className={cn("inline-block w-3 h-3 rounded-full", color)} />;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const REUNIAO_STAGES: Stage[] = ["reuniao_marcada", "reuniao_agendada", "no_show", "reuniao_realizada", "link_enviado", "contrato_assinado"];

// Counts cards that "reached" a given stage during [start, end] — based on history events
function reachedInMonth(cards: PipelineCard[], stages: Stage[], start: Date, end: Date): PipelineCard[] {
  return cards.filter(c => {
    return c.history.some(h => stages.includes(h.to as Stage) && (() => {
      const d = new Date(h.at);
      return d >= start && d <= end;
    })());
  });
}

export function FarolPanel({ cards, goals, onSaveGoal }: Props) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { members, closerNames, sdrNames, refetch } = useTeamMembers();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [editGoalsOpen, setEditGoalsOpen] = useState(false);
  const [manageTeamOpen, setManageTeamOpen] = useState(false);
  const [unassignedOpen, setUnassignedOpen] = useState(false);

  const monthKey = getMonthKey(selectedMonth);
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const start = useMemo(() => new Date(year, month, 1), [year, month]);
  const end = useMemo(() => new Date(year, month + 1, 0, 23, 59, 59), [year, month]);
  const totalBD = getBusinessDays(year, month);
  const passedBD = getBusinessDaysPassed(year, month, now);
  const ratio = passedBD > 0 ? totalBD / passedBD : 1;

  const months = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 6; i >= -1; i--) arr.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCard = (cardId: string) => {
    sessionStorage.setItem("crm_selected_card_id", cardId);
    sessionStorage.setItem("crm_drawer_open", "true");
    navigate("/pipeline");
  };

  // ── Reuniões marcadas/realizadas/no-show no mês (fiel ao pipe) ──
  const reunioesMarcadas = useMemo(
    () => reachedInMonth(cards, ["reuniao_marcada"], start, end),
    [cards, start, end]
  );
  // Tudo que entrou em reuniao_realizada OU passou para frente (link_enviado/contrato_assinado) conta como reunião realizada
  const reunioesRealizadas = useMemo(
    () => reachedInMonth(cards, ["reuniao_realizada", "link_enviado", "contrato_assinado"], start, end),
    [cards, start, end]
  );
  const noShowsMes = useMemo(
    () => reachedInMonth(cards, ["no_show"], start, end),
    [cards, start, end]
  );
  const ganhosMes = useMemo(() => {
    return cards.filter(c => {
      if (c.lead_status !== "ganho") return false;
      const ref = c.data_venda || c.stage_changed_at;
      const d = new Date(ref);
      return d >= start && d <= end;
    });
  }, [cards, start, end]);

  // ── INBOUND (closers) — vendas/faturamento por closer ──
  const closerRows = useMemo(() => closerNames, [closerNames]);

  const inboundData = useMemo(() => {
    const rows = closerRows.map(closer => {
      const ganhos = ganhosMes.filter(c => c.owner === closer);
      const vendas = ganhos.length;
      const realizado = ganhos.reduce((s, c) => s + (c.deal_value || 0), 0);
      const goal = goals.find(g => g.closer === closer && g.month === monthKey);
      const meta = goal?.faturamento_meta || 0;
      const projecao = passedBD > 0 ? Math.round(realizado * ratio) : 0;
      const ticket = vendas > 0 ? realizado / vendas : 0;
      const falta = ticket > 0 ? Math.max(0, Math.ceil((meta - realizado) / ticket)) : 0;
      const diferenca = projecao - meta;
      const pctMeta = meta > 0 ? Math.round((projecao / meta) * 100) : 0;
      const rrCloser = reunioesRealizadas.filter(c => c.owner === closer).length;
      const conv = rrCloser > 0 ? Math.round((vendas / rrCloser) * 100) : 0;
      return { closer, vendas, realizado, meta, projecao, falta, diferenca, pctMeta, conv, ticket, unassigned: 0 };
    });

    // Sem responsável (closer)
    const semOwnerGanhos = ganhosMes.filter(c => !c.owner);
    const semOwnerReuniao = reunioesRealizadas.filter(c => !c.owner);
    if (semOwnerGanhos.length || semOwnerReuniao.length) {
      const realizado = semOwnerGanhos.reduce((s, c) => s + (c.deal_value || 0), 0);
      rows.push({
        closer: "Sem responsável",
        vendas: semOwnerGanhos.length,
        realizado, meta: 0, projecao: 0, falta: 0, diferenca: 0, pctMeta: 0,
        conv: 0, ticket: 0,
        unassigned: semOwnerGanhos.length + semOwnerReuniao.length,
      });
    }
    return rows;
  }, [closerRows, ganhosMes, reunioesRealizadas, goals, monthKey, passedBD, ratio]);

  const inboundTotal = useMemo(() => {
    const vendas = inboundData.reduce((s, d) => s + d.vendas, 0);
    const realizado = inboundData.reduce((s, d) => s + d.realizado, 0);
    const meta = inboundData.reduce((s, d) => s + d.meta, 0);
    const projecao = inboundData.reduce((s, d) => s + d.projecao, 0);
    const falta = inboundData.reduce((s, d) => s + d.falta, 0);
    const diferenca = projecao - meta;
    const pctMeta = meta > 0 ? Math.round((projecao / meta) * 100) : 0;
    const rrTotal = reunioesRealizadas.length;
    const conv = rrTotal > 0 ? Math.round((vendas / rrTotal) * 100) : 0;
    const ticket = vendas > 0 ? realizado / vendas : 0;
    return { vendas, realizado, meta, projecao, falta, diferenca, pctMeta, conv, ticket };
  }, [inboundData, reunioesRealizadas]);

  // ── PRÉ-VENDAS (SDR) ──
  const sdrRows = useMemo(() => sdrNames, [sdrNames]);

  const preVendasData = useMemo(() => {
    const rows = sdrRows.map(sdr => {
      const rm = reunioesMarcadas.filter(c => c.owner === sdr).length;
      const rr = reunioesRealizadas.filter(c => c.owner === sdr).length;
      const ns = noShowsMes.filter(c => c.owner === sdr).length;
      const goal = goals.find(g => g.closer === sdr && g.month === monthKey);
      const meta = goal?.reunioes_marcadas_meta || 0;
      const projecao = passedBD > 0 ? Math.round(rm * ratio) : 0;
      const falta = Math.max(0, meta - rm);
      const projetado = passedBD > 0 ? Math.round(rr * ratio) : 0;
      const pctMeta = meta > 0 ? Math.round((projecao / meta) * 100) : 0;
      const conv = rm > 0 ? Math.round((rr / rm) * 100) : 0;
      return { sdr, reunioesMarcadas: rm, reunioesRealizadas: rr, meta, projecao, falta, projetado, pctMeta, conv, noShows: ns, unassigned: 0 };
    });

    const rmSem = reunioesMarcadas.filter(c => !c.owner).length;
    const rrSem = reunioesRealizadas.filter(c => !c.owner).length;
    const nsSem = noShowsMes.filter(c => !c.owner).length;
    if (rmSem || rrSem || nsSem) {
      rows.push({
        sdr: "Sem responsável",
        reunioesMarcadas: rmSem, reunioesRealizadas: rrSem, meta: 0, projecao: 0, falta: 0, projetado: 0,
        pctMeta: 0, conv: 0, noShows: nsSem, unassigned: rmSem + rrSem + nsSem,
      });
    }
    return rows;
  }, [sdrRows, reunioesMarcadas, reunioesRealizadas, noShowsMes, goals, monthKey, passedBD, ratio]);

  const preVendasTotal = useMemo(() => {
    const rm = preVendasData.reduce((s, d) => s + d.reunioesMarcadas, 0);
    const rr = preVendasData.reduce((s, d) => s + d.reunioesRealizadas, 0);
    const meta = preVendasData.reduce((s, d) => s + d.meta, 0);
    const projecao = preVendasData.reduce((s, d) => s + d.projecao, 0);
    const falta = preVendasData.reduce((s, d) => s + d.falta, 0);
    const projetado = preVendasData.reduce((s, d) => s + d.projetado, 0);
    const pctMeta = meta > 0 ? Math.round((projecao / meta) * 100) : 0;
    const conv = rm > 0 ? Math.round((rr / rm) * 100) : 0;
    const noShows = preVendasData.reduce((s, d) => s + d.noShows, 0);
    const taxaShow = rm > 0 ? ((rr / rm) * 100).toFixed(1) : "0";
    return { rm, rr, meta, projecao, falta, projetado, pctMeta, conv, noShows, taxaShow };
  }, [preVendasData]);

  // ── Cards sem responsável (lista para o modal) ──
  const unassignedCards = useMemo(() => {
    const ids = new Set<string>();
    const list: PipelineCard[] = [];
    const all = [...reunioesMarcadas, ...reunioesRealizadas, ...noShowsMes, ...ganhosMes];
    all.forEach(c => {
      if (!c.owner && !ids.has(c.id)) {
        ids.add(c.id);
        list.push(c);
      }
    });
    return list.sort((a, b) => new Date(b.stage_changed_at).getTime() - new Date(a.stage_changed_at).getTime());
  }, [reunioesMarcadas, reunioesRealizadas, noShowsMes, ganhosMes]);

  const monthLabel = selectedMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">🚦 Farol de Metas</h1>
          <p className="text-xs text-muted-foreground capitalize">{monthLabel} — {passedBD}/{totalBD} dias úteis</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditGoalsOpen(true)}>
                <Target className="w-3.5 h-3.5 mr-1" /> Editar Metas
              </Button>
              <Button size="sm" variant="outline" onClick={() => setManageTeamOpen(true)}>
                <Settings className="w-3.5 h-3.5 mr-1" /> Gerenciar Time
              </Button>
            </>
          )}
          {unassignedCards.length > 0 && (
            <Button size="sm" variant="destructive" onClick={() => setUnassignedOpen(true)}>
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              {unassignedCards.length} sem responsável
            </Button>
          )}
          <select
            value={selectedMonth.toISOString()}
            onChange={e => setSelectedMonth(new Date(e.target.value))}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
          >
            {months.map(m => (
              <option key={m.toISOString()} value={m.toISOString()}>
                {m.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* INBOUND */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-primary/5">
          <h2 className="text-sm font-bold text-foreground">📞 INBOUND (Closers)</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px]">Closer</TableHead>
              <TableHead className="text-[10px] text-center">Vendas</TableHead>
              <TableHead className="text-[10px] text-right">Realizado</TableHead>
              <TableHead className="text-[10px] text-right">Meta</TableHead>
              <TableHead className="text-[10px] text-right">Projeção</TableHead>
              <TableHead className="text-[10px] text-center">Falta</TableHead>
              <TableHead className="text-[10px] text-right">Diferença</TableHead>
              <TableHead className="text-[10px] text-center">%Meta</TableHead>
              <TableHead className="text-[10px] text-center">Conv%</TableHead>
              <TableHead className="text-[10px] text-right">Ticket Médio</TableHead>
              <TableHead className="text-[10px] text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inboundData.map(d => (
              <TableRow key={d.closer} className={d.closer === "Sem responsável" ? "bg-destructive/10" : ""}>
                <TableCell className="text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    {d.unassigned > 0 && (
                      <button onClick={() => setUnassignedOpen(true)} title="Possui cards sem responsável">
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive animate-pulse" />
                      </button>
                    )}
                    {d.closer}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-center">{d.vendas}</TableCell>
                <TableCell className="text-xs text-right">{formatBRL(d.realizado)}</TableCell>
                <TableCell className="text-xs text-right">{formatBRL(d.meta)}</TableCell>
                <TableCell className="text-xs text-right">{formatBRL(d.projecao)}</TableCell>
                <TableCell className="text-xs text-center">{d.falta}</TableCell>
                <TableCell className={cn("text-xs text-right", d.diferenca >= 0 ? "text-green-400" : "text-red-400")}>
                  {formatBRL(d.diferenca)}
                </TableCell>
                <TableCell className="text-xs text-center">{d.pctMeta}%</TableCell>
                <TableCell className="text-xs text-center">{d.conv}%</TableCell>
                <TableCell className="text-xs text-right">{formatBRL(d.ticket)}</TableCell>
                <TableCell className="text-center">{d.meta > 0 && <Semaphore pct={d.pctMeta} />}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/30 font-bold">
              <TableCell className="text-xs font-bold">Total</TableCell>
              <TableCell className="text-xs text-center font-bold">{inboundTotal.vendas}</TableCell>
              <TableCell className="text-xs text-right font-bold">{formatBRL(inboundTotal.realizado)}</TableCell>
              <TableCell className="text-xs text-right font-bold">{formatBRL(inboundTotal.meta)}</TableCell>
              <TableCell className="text-xs text-right font-bold">{formatBRL(inboundTotal.projecao)}</TableCell>
              <TableCell className="text-xs text-center font-bold">{inboundTotal.falta}</TableCell>
              <TableCell className={cn("text-xs text-right font-bold", inboundTotal.diferenca >= 0 ? "text-green-400" : "text-red-400")}>
                {formatBRL(inboundTotal.diferenca)}
              </TableCell>
              <TableCell className="text-xs text-center font-bold">{inboundTotal.pctMeta}%</TableCell>
              <TableCell className="text-xs text-center font-bold">{inboundTotal.conv}%</TableCell>
              <TableCell className="text-xs text-right font-bold">{formatBRL(inboundTotal.ticket)}</TableCell>
              <TableCell className="text-center"><Semaphore pct={inboundTotal.pctMeta} /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* PRÉ-VENDAS */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-blue-500/5">
          <h2 className="text-sm font-bold text-foreground">🎯 PRÉ-VENDAS (SDR)</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px]">SDR</TableHead>
              <TableHead className="text-[10px] text-center">Reuniões</TableHead>
              <TableHead className="text-[10px] text-center">Realizadas</TableHead>
              <TableHead className="text-[10px] text-center">Meta</TableHead>
              <TableHead className="text-[10px] text-center">Projeção</TableHead>
              <TableHead className="text-[10px] text-center">Falta</TableHead>
              <TableHead className="text-[10px] text-center">Projetado</TableHead>
              <TableHead className="text-[10px] text-center">%Meta</TableHead>
              <TableHead className="text-[10px] text-center">Conv%</TableHead>
              <TableHead className="text-[10px] text-center">No Shows</TableHead>
              <TableHead className="text-[10px] text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preVendasData.map(d => (
              <TableRow key={d.sdr} className={d.sdr === "Sem responsável" ? "bg-destructive/10" : ""}>
                <TableCell className="text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    {d.unassigned > 0 && (
                      <button onClick={() => setUnassignedOpen(true)} title="Possui cards sem responsável">
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive animate-pulse" />
                      </button>
                    )}
                    {d.sdr}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-center">{d.reunioesMarcadas}</TableCell>
                <TableCell className="text-xs text-center">{d.reunioesRealizadas}</TableCell>
                <TableCell className="text-xs text-center">{d.meta}</TableCell>
                <TableCell className="text-xs text-center">{d.projecao}</TableCell>
                <TableCell className="text-xs text-center">{d.falta}</TableCell>
                <TableCell className="text-xs text-center">{d.projetado}</TableCell>
                <TableCell className="text-xs text-center">{d.pctMeta}%</TableCell>
                <TableCell className="text-xs text-center">{d.conv}%</TableCell>
                <TableCell className="text-xs text-center">{d.noShows}</TableCell>
                <TableCell className="text-center">{d.meta > 0 && <Semaphore pct={d.pctMeta} />}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/30 font-bold">
              <TableCell className="text-xs font-bold">Total</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.rm}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.rr}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.meta}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.projecao}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.falta}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.projetado}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.pctMeta}%</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.conv}%</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.noShows}</TableCell>
              <TableCell className="text-center"><Semaphore pct={preVendasTotal.pctMeta} /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="px-4 py-2 border-t border-border flex gap-6 text-xs text-muted-foreground">
          <span>Taxa de Show: <strong className="text-foreground">{preVendasTotal.taxaShow}%</strong></span>
        </div>
      </div>

      {/* Edit Goals Dialog */}
      {isAdmin && onSaveGoal && (
        <EditGoalsDialog
          open={editGoalsOpen}
          onOpenChange={setEditGoalsOpen}
          monthKey={monthKey}
          monthLabel={monthLabel}
          closers={closerNames}
          sdrs={sdrNames}
          goals={goals}
          onSave={onSaveGoal}
        />
      )}

      {/* Manage Team Dialog */}
      {isAdmin && (
        <ManageTeamDialog
          open={manageTeamOpen}
          onOpenChange={setManageTeamOpen}
          members={members}
          onChanged={refetch}
        />
      )}

      {/* Unassigned Dialog */}
      <Dialog open={unassignedOpen} onOpenChange={setUnassignedOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reuniões sem responsável — {monthLabel}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto space-y-1">
            {unassignedCards.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum card sem responsável.</p>
            )}
            {unassignedCards.map(c => (
              <button
                key={c.id}
                onClick={() => { setUnassignedOpen(false); openCard(c.id); }}
                className="w-full text-left p-3 border border-border rounded-lg hover:bg-accent transition flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-medium">{c.nome}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {c.stage.replace(/_/g, " ")} · {new Date(c.stage_changed_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Edit Goals Dialog ──
function EditGoalsDialog({
  open, onOpenChange, monthKey, monthLabel, closers, sdrs, goals, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  monthKey: string;
  monthLabel: string;
  closers: string[];
  sdrs: string[];
  goals: PipelineGoal[];
  onSave: (g: PipelineGoal) => void | Promise<void>;
}) {
  const allNames = useMemo(() => Array.from(new Set([...closers, ...sdrs])), [closers, sdrs]);
  const initial = useMemo(() => {
    const map: Record<string, PipelineGoal> = {};
    allNames.forEach(n => {
      const g = goals.find(x => x.closer === n && x.month === monthKey);
      map[n] = g || { closer: n, month: monthKey, reunioes_marcadas_meta: 0, reunioes_realizadas_meta: 0, faturamento_meta: 0, conversao_meta: 0 };
    });
    return map;
  }, [allNames, goals, monthKey]);
  const [draft, setDraft] = useState<Record<string, PipelineGoal>>(initial);

  // reset when dialog opens
  useEffect(() => { if (open) setDraft(initial); }, [open, initial]);

  const upd = (name: string, key: keyof PipelineGoal, val: number) => {
    setDraft(prev => ({ ...prev, [name]: { ...prev[name], [key]: val } }));
  };

  const save = async () => {
    for (const name of allNames) {
      await onSave(draft[name]);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar metas — <span className="capitalize">{monthLabel}</span></DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b border-border">
                <th className="text-left p-2">Pessoa</th>
                <th className="text-right p-2">Faturamento</th>
                <th className="text-right p-2">Reuniões Marcadas</th>
                <th className="text-right p-2">Reuniões Realizadas</th>
                <th className="text-right p-2">Conversão %</th>
              </tr>
            </thead>
            <tbody>
              {allNames.map(n => (
                <tr key={n} className="border-b border-border/50">
                  <td className="p-2 font-medium">{n}</td>
                  <td className="p-2"><input type="number" className="w-28 bg-muted/50 border border-border rounded px-2 py-1 text-right" value={draft[n]?.faturamento_meta || 0} onChange={e => upd(n, "faturamento_meta", Number(e.target.value))} /></td>
                  <td className="p-2"><input type="number" className="w-20 bg-muted/50 border border-border rounded px-2 py-1 text-right" value={draft[n]?.reunioes_marcadas_meta || 0} onChange={e => upd(n, "reunioes_marcadas_meta", Number(e.target.value))} /></td>
                  <td className="p-2"><input type="number" className="w-20 bg-muted/50 border border-border rounded px-2 py-1 text-right" value={draft[n]?.reunioes_realizadas_meta || 0} onChange={e => upd(n, "reunioes_realizadas_meta", Number(e.target.value))} /></td>
                  <td className="p-2"><input type="number" className="w-20 bg-muted/50 border border-border rounded px-2 py-1 text-right" value={draft[n]?.conversao_meta || 0} onChange={e => upd(n, "conversao_meta", Number(e.target.value))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Manage Team Dialog ──
function ManageTeamDialog({
  open, onOpenChange, members, onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  members: TeamMember[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState<string | null>(null);

  const updateMember = async (id: string, patch: Partial<Pick<TeamMember, "role" | "secondary_role">>) => {
    setSaving(id);
    const { error } = await (supabase as any).from("user_profiles").update(patch).eq("id", id);
    setSaving(null);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Time do Farol</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b border-border">
                <th className="text-left p-2">Pessoa</th>
                <th className="text-center p-2">Closer</th>
                <th className="text-center p-2">SDR</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const isCloser = m.role === "closer" || m.secondary_role === "closer" || m.role === "admin";
                const isSdr = m.role === "sdr" || m.secondary_role === "sdr" || m.role === "admin";
                const toggle = (kind: "closer" | "sdr", on: boolean) => {
                  if (m.role === "admin") {
                    toast({ title: "Admin", description: "Admins aparecem em ambas as listas automaticamente." });
                    return;
                  }
                  let role = m.role;
                  let secondary_role = m.secondary_role;
                  if (on) {
                    if (!role) role = kind;
                    else if (role !== kind) secondary_role = kind;
                  } else {
                    if (role === kind) role = secondary_role;
                    secondary_role = secondary_role === kind ? null : secondary_role;
                    if (role === secondary_role) secondary_role = null;
                  }
                  updateMember(m.id, { role, secondary_role });
                };
                return (
                  <tr key={m.id} className="border-b border-border/50">
                    <td className="p-2 font-medium">{m.nome}</td>
                    <td className="p-2 text-center">
                      <Switch checked={isCloser} onCheckedChange={v => toggle("closer", v)} disabled={saving === m.id || m.role === "admin"} />
                    </td>
                    <td className="p-2 text-center">
                      <Switch checked={isSdr} onCheckedChange={v => toggle("sdr", v)} disabled={saving === m.id || m.role === "admin"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
