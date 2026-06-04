import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PipelineCard, PipelineGoal, Stage } from "./pipeline/types";
import { formatBRL, getBusinessDays, getBusinessDaysPassed } from "./pipeline/types";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Settings, Target, CalendarDays, DollarSign, Users, Percent, FileSignature } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeamMembers, type TeamMember } from "@/hooks/useTeamMembers";
import { useAuth } from "@/contexts/AuthContext";
import { supabaseExt as supabase } from "@/lib/supabaseExternal";
import { useToast } from "@/hooks/use-toast";
import { buildCanonicalizer } from "@/lib/ownerNormalization";

// Status de contrato considerados como "fechado" para meta de contratos
const CONTRATO_FECHADO_STATUS = new Set(["assinado"]);
function getContratoDate(c: PipelineCard): string | null {
  return c.zapsign_signed_at || c.contrato_preparado_em || null;
}

interface Props {
  cards: PipelineCard[];
  goals: PipelineGoal[];
  owners: string[]; // legacy, ignored — uses team members
  onSaveGoal?: (g: PipelineGoal) => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
}


function Semaphore({ pct }: { pct: number }) {
  const color = pct >= 110 ? "bg-green-500" : pct >= 90 ? "bg-yellow-500" : "bg-red-500";
  return <span className={cn("inline-block w-3 h-3 rounded-full", color)} />;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const FERIADOS_BR_2026 = new Set([
  "2026-01-01","2026-02-16","2026-02-17","2026-04-03",
  "2026-04-21","2026-05-01","2026-06-04","2026-09-07",
  "2026-10-12","2026-11-02","2026-11-15","2026-12-25",
]);

function fmtISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function diasUteisDoMes(year: number, month: number, dataAlvo: Date) {
  const inicio = new Date(year, month, 1);
  const fim = new Date(year, month + 1, 0);
  const ref = dataAlvo < inicio ? inicio : dataAlvo > fim ? fim : dataAlvo;
  let total = 0, ateAlvo = 0;
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const isHoliday = FERIADOS_BR_2026.has(fmtISO(d));
    if (!isWeekend && !isHoliday) {
      total++;
      if (d <= ref) ateAlvo++;
    }
    d.setDate(d.getDate() + 1);
  }
  return {
    total,
    ateAlvo,
    restantes: Math.max(0, total - ateAlvo),
    fatorPace: total > 0 ? ateAlvo / total : 0,
    refDate: ref,
  };
}

const REUNIAO_STAGES: Stage[] = ["reuniao_marcada", "reuniao_agendada", "no_show", "reuniao_realizada", "link_enviado", "contrato_assinado"];
const REUNIAO_REALIZADA_CURRENT_STAGES = new Set<Stage>(["reuniao_realizada", "link_enviado", "contrato_assinado"]);

function normalizeStageName(stage: string | null | undefined): Stage | null {
  const value = (stage || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, "_");
  if (value === "fez_contato" || value === "lead") return "fez_contato";
  if (value === "conectado") return "conectado";
  if (value === "sql" || value === "contestado") return "sql";
  if (value === "reuniao_marcada") return "reuniao_marcada";
  if (value === "reuniao_agendada") return "reuniao_agendada";
  if (value === "no_show") return "no_show";
  if (value === "reuniao_realizada") return "reuniao_realizada";
  if (value === "link_enviado") return "link_enviado";
  if (value === "contrato_assinado") return "contrato_assinado";
  return null;
}

function dateInRange(dateLike: string | null | undefined, start: Date, end: Date) {
  if (!dateLike) return false;
  const d = new Date(dateLike);
  return !Number.isNaN(d.getTime()) && d >= start && d <= end;
}

/** Data em São Paulo (meia-noite local) a partir de um ISO string */
function spDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const sp = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return new Date(sp.getFullYear(), sp.getMonth(), sp.getDate());
}

function spToday(): Date {
  const now = new Date();
  const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return new Date(sp.getFullYear(), sp.getMonth(), sp.getDate());
}

function getReuniaoRealizadaDate(c: PipelineCard): string | null {
  const historyHit = (c.history || []).find(h => normalizeStageName(h.to) === "reuniao_realizada");
  if (historyHit?.at) return historyHit.at;
  if (c.data_reuniao) return c.data_reuniao;
  if (c.stage === "reuniao_realizada") return c.stage_changed_at || c.created_at;
  return null;
}

// Counts cards that "reached" a given stage during [start, end] — based on history events
// OR cards currently at the stage with stage_changed_at within the window (fallback when history is missing).
function reachedInMonth(cards: PipelineCard[], stages: Stage[], start: Date, end: Date): PipelineCard[] {
  const set = new Set(stages);
  return cards.filter(c => {
    const inHistory = (c.history || []).some(h => {
      const to = normalizeStageName(h.to);
      if (!to || !set.has(to)) return false;
      return dateInRange(h.at, start, end);
    });
    if (inHistory) return true;
    if (set.has(c.stage as Stage)) {
      const ref = c.stage_changed_at || c.created_at;
      return dateInRange(ref, start, end);
    }
    return false;
  });
}

export function FarolPanel({ cards, goals, onSaveGoal, onRefresh }: Props) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { members, closerNames, sdrNames, refetch } = useTeamMembers();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [dataAlvo, setDataAlvo] = useState<Date>(() => new Date());
  const [editGoalsOpen, setEditGoalsOpen] = useState(false);
  const [manageTeamOpen, setManageTeamOpen] = useState(false);
  const [unassignedOpen, setUnassignedOpen] = useState(false);
  const [weekFilter, setWeekFilter] = useState<string>("all"); // "all" | "1".."5"
  const [debugRR, setDebugRR] = useState<{ owner: string } | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  const monthKey = getMonthKey(selectedMonth);
  const excludedKey = `farol_excluded_rr_${monthKey}`;

  // Load excluded card ids from localStorage when month changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(excludedKey);
      setExcludedIds(new Set(raw ? JSON.parse(raw) : []));
    } catch {
      setExcludedIds(new Set());
    }
  }, [excludedKey]);

  const toggleExcluded = (id: string) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(excludedKey, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };

  // [removido] auto-aplicar metas fixas — gerava linhas com nome completo do Google
  // (ex.: "Fillipe Amorim Oliveira Silva") e sobrescrevia edições feitas pelo admin.
  // Metas agora só são gravadas via o diálogo "Editar Metas".


  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();

  // Recorte semanal opcional: divide o mês em janelas de 7 dias (1-7, 8-14, ...).
  const weekRanges = useMemo(() => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const ranges: { idx: number; start: Date; end: Date; label: string }[] = [];
    let day = 1, idx = 1;
    while (day <= lastDay) {
      const sDay = day;
      const eDay = Math.min(day + 6, lastDay);
      ranges.push({
        idx,
        start: new Date(year, month, sDay),
        end: new Date(year, month, eDay, 23, 59, 59),
        label: `Sem ${idx} (${String(sDay).padStart(2, "0")}–${String(eDay).padStart(2, "0")})`,
      });
      day = eDay + 1; idx++;
    }
    return ranges;
  }, [year, month]);

  const activeWeek = weekFilter !== "all" ? weekRanges.find(w => String(w.idx) === weekFilter) : null;
  const start = useMemo(
    () => activeWeek ? activeWeek.start : new Date(year, month, 1),
    [year, month, activeWeek]
  );
  const end = useMemo(
    () => activeWeek ? activeWeek.end : new Date(year, month + 1, 0, 23, 59, 59),
    [year, month, activeWeek]
  );

  // Persistir filtro de semana por mês
  useEffect(() => {
    const saved = localStorage.getItem(`farol_week_${monthKey}`);
    setWeekFilter(saved || "all");
  }, [monthKey]);
  useEffect(() => {
    localStorage.setItem(`farol_week_${monthKey}`, weekFilter);
  }, [monthKey, weekFilter]);

  // Reseta dataAlvo quando o mês muda (vai pro último dia se mês passado, hoje se mês atual)
  useEffect(() => {
    const today = new Date();
    if (year === today.getFullYear() && month === today.getMonth()) {
      setDataAlvo(new Date());
    } else if (new Date(year, month + 1, 0) < today) {
      setDataAlvo(new Date(year, month + 1, 0));
    } else {
      setDataAlvo(new Date(year, month, 1));
    }
  }, [year, month]);

  const du = useMemo(() => diasUteisDoMes(year, month, dataAlvo), [year, month, dataAlvo]);
  const totalBD = du.total;
  const passedBD = du.ateAlvo;
  const ratio = passedBD > 0 ? totalBD / passedBD : 1;
  const fatorPace = du.fatorPace;
  const isToday = (() => {
    const t = new Date();
    return dataAlvo.getDate() === t.getDate() && dataAlvo.getMonth() === t.getMonth() && dataAlvo.getFullYear() === t.getFullYear();
  })();
  const dataAlvoLabel = dataAlvo.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

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

  // ── Reuniões marcadas/realizadas/no-show no mês (somente cards no pipe Closer) ──
  // Critério único para SDR e Closer: usa SOMENTE cards já no pipe Closer,
  // pois no pipe SDR os dados (nome, e-mail, CNPJ) ainda costumam estar incompletos.
  // O closer corrige essas informações antes da reunião, então o pipe Closer é a fonte confiável.
  const closerCards = useMemo(() => cards.filter(c => c.pipe === "closer"), [cards]);

  // Espelho do pipe: contamos pelo ESTADO ATUAL do card (não pelo histórico).
  // Se um card voltar de "realizada" para "agendada", ele deixa de contar como realizada.
  const currentStageInMonth = (stages: Stage[]) => {
    const set = new Set(stages);
    return closerCards.filter(c => {
      if (!set.has(c.stage as Stage)) return false;
      const ref = c.stage_changed_at || c.data_reuniao || c.created_at;
      return dateInRange(ref, start, end);
    });
  };

  // Reuniões marcadas (PRÉ-VENDAS / SDR): card atualmente em qualquer etapa que
  // já passou da agendada (inclui no_show, realizada, link_enviado, contrato_assinado).
  const reunioesMarcadas = useMemo(
    () => currentStageInMonth([
      "reuniao_marcada", "reuniao_agendada", "no_show",
      "reuniao_realizada", "link_enviado", "contrato_assinado"
    ]),
    [closerCards, start, end]
  );
  // Reuniões realizadas: card atualmente em realizada/link_enviado/contrato_assinado.
  const reunioesRealizadas = useMemo(
    () => currentStageInMonth(["reuniao_realizada", "link_enviado", "contrato_assinado"])
      .filter(c => !excludedIds.has(c.id)),
    [closerCards, start, end, excludedIds]
  );
  const noShowsMes = useMemo(
    () => currentStageInMonth(["no_show"]),
    [closerCards, start, end]
  );
  const ganhosMes = useMemo(() => {
    return cards.filter(c => {
      if (c.lead_status !== "ganho") return false;
      const ref = c.data_venda || c.stage_changed_at;
      const d = new Date(ref);
      return d >= start && d <= end;
    });
  }, [cards, start, end]);

  // ── Contratos fechados no mês (mesma métrica que "vendas"): lead em ganho OU stage contrato_assinado ──
  const contratosMes = useMemo(() => {
    return cards.filter(c => {
      const isGanho = c.lead_status === "ganho";
      const isContratoAssinadoStage = c.stage === "contrato_assinado";
      const isStatusAssinado = c.contrato_status && CONTRATO_FECHADO_STATUS.has(c.contrato_status);
      if (!isGanho && !isContratoAssinadoStage && !isStatusAssinado) return false;
      const ref = c.data_venda || c.zapsign_signed_at || c.contrato_preparado_em || c.stage_changed_at || c.created_at;
      if (!ref) return false;
      const d = new Date(ref);
      return d >= start && d <= end;
    });
  }, [cards, start, end]);
  // Métricas auxiliares (independentes de "fechado") para o card de contratos
  const contratosEnviados = useMemo(
    () => cards.filter(c => {
      const st = c.contrato_status;
      if (st !== "enviado" && st !== "enviado_whatsapp" && st !== "gerado") return false;
      const ref = getContratoDate(c);
      if (!ref) return false;
      const d = new Date(ref);
      return d >= start && d <= end;
    }).length,
    [cards, start, end]
  );
  const contratosAssinados = useMemo(
    () => contratosMes.length,
    [contratosMes]
  );

  // Regras de visibilidade no Farol (item 14):
  // Exibir um closer/SDR apenas se tiver META no mês OU venda/realização no mês.
  // Sem meta e sem realização → não aparece.
  const norm = (s: string) =>
    (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const visibleByName = (_name: string, _hasSale: boolean) => true; // legacy — não usado mais


  // ── INBOUND (closers) — vendas/faturamento por closer ──
  // Une os closers cadastrados (perfis) com os owners reais que aparecem
  // como responsáveis em cards do pipe Closer + presets fixos. Em seguida
  // aplica uma canonicalização por PRIMEIRO NOME normalizado para colapsar
  // variantes (ex.: "Fillipe" do perfil + "Fillipe Amorim Oliveira Silva"
  // do card → mantém só o nome mais longo).
  const canonical = useMemo(() => {
    const all: string[] = [];
    closerNames.forEach(n => n && all.push(n));
    closerCards.forEach(c => { if (c.owner) all.push(c.owner); });
    cards.forEach(c => { if (c.owner) all.push(c.owner); });
    goals.forEach(g => { if (g.closer) all.push(g.closer); });
    ["Cayo Bitencourt", "João", "Fillipe Amorim Oliveira Silva"].forEach(n => all.push(n));
    return buildCanonicalizer(all);
  }, [closerNames, closerCards, cards, goals]);

  const closerRows = useMemo(() => {
    const set = new Set<string>();
    closerNames.forEach(n => n && set.add(canonical(n)));
    closerCards.forEach(c => { if (c.owner) set.add(canonical(c.owner)); });
    ["Cayo Bitencourt", "João", "Fillipe Amorim Oliveira Silva"].forEach(n => set.add(canonical(n)));
    return Array.from(set);
  }, [closerNames, closerCards, canonical]);

  const inboundData = useMemo(() => {
    const rows = closerRows
      .map(closer => {
        // "Vendas" e "Contratos" são a mesma métrica — usamos contratos como fonte única de verdade
        const ganhos = contratosMes.filter(c => canonical(c.owner) === closer);
        const vendas = ganhos.length;
        const realizado = ganhos.reduce((s, c) => s + (c.deal_value || 0), 0);
        const goal = goals.find(g => canonical(g.closer) === closer && g.month === monthKey);
        const meta = goal?.faturamento_meta || 0;
        const metaAteAlvo = meta * fatorPace;
        const projecao = passedBD > 0 ? Math.round(realizado * ratio) : 0;
        const ticket = vendas > 0 ? realizado / vendas : 0;
        const tktProjetado = (goal?.ticket_medio_meta && goal.ticket_medio_meta > 0)
          ? goal.ticket_medio_meta
          : (goal?.contratos_meta && goal.contratos_meta > 0 && meta > 0 ? meta / goal.contratos_meta : (goal?.vendas_meta && goal.vendas_meta > 0 && meta > 0 ? meta / goal.vendas_meta : 0));
        // Falta = nº de vendas necessárias para atingir a META ATÉ HOJE, usando o Ticket Médio Projetado
        const tktParaFalta = tktProjetado > 0 ? tktProjetado : ticket;
        const falta = tktParaFalta > 0 ? Math.max(0, Math.ceil((metaAteAlvo - realizado) / tktParaFalta)) : 0;
        const diferenca = projecao - meta;
        const pctMeta = meta > 0 ? Math.round((projecao / meta) * 100) : 0;
        const atingTotal = meta > 0 ? Math.round((projecao / meta) * 100) : 0;
        const rrCloser = reunioesRealizadas.filter(c => canonical(c.owner) === closer).length;
        const conv = rrCloser > 0 ? Math.round((vendas / rrCloser) * 100) : 0;
        const contratos = vendas; // mesma métrica
        return { closer, vendas, realizado, meta, metaAteAlvo, projecao, falta, diferenca, pctMeta, atingTotal, conv, ticket, tktProjetado, contratos, unassigned: 0 };
      })
      // Item 14: exibir só quem tem meta OU venda/realizado/contrato no mês
      .filter(r => r.meta > 0 || r.realizado > 0 || r.vendas > 0 || r.contratos > 0);


    // Sem responsável (closer) — só aparece quando há valor real (>0)
    const semOwnerGanhos = contratosMes.filter(c => !c.owner);
    const semOwnerReuniao = reunioesRealizadas.filter(c => !c.owner);
    const realizadoSem = semOwnerGanhos.reduce((s, c) => s + (c.deal_value || 0), 0);
    if (semOwnerGanhos.length > 0 || realizadoSem > 0) {
      rows.push({
        closer: "Sem responsável",
        vendas: semOwnerGanhos.length,
        realizado: realizadoSem, meta: 0, metaAteAlvo: 0, projecao: 0, falta: 0, diferenca: 0, pctMeta: 0, atingTotal: 0,
        conv: 0, ticket: 0, tktProjetado: 0, contratos: semOwnerGanhos.length,
        unassigned: semOwnerGanhos.length + semOwnerReuniao.length,
      });
    }
    return rows;
  }, [closerRows, contratosMes, reunioesRealizadas, goals, monthKey, passedBD, ratio, fatorPace]);

  const inboundTotal = useMemo(() => {
    const vendas = inboundData.reduce((s, d) => s + d.vendas, 0);
    const realizado = inboundData.reduce((s, d) => s + d.realizado, 0);
    const meta = inboundData.reduce((s, d) => s + d.meta, 0);
    const metaAteAlvo = meta * fatorPace;
    const projecao = inboundData.reduce((s, d) => s + d.projecao, 0);
    const falta = inboundData.reduce((s, d) => s + d.falta, 0);
    const diferenca = projecao - meta;
    const pctMeta = meta > 0 ? Math.round((projecao / meta) * 100) : 0;
    const atingTotal = meta > 0 ? Math.round((projecao / meta) * 100) : 0;
    const rrTotal = reunioesRealizadas.length;
    const conv = rrTotal > 0 ? Math.round((vendas / rrTotal) * 100) : 0;
    const ticket = vendas > 0 ? realizado / vendas : 0;
    const contratos = inboundData.reduce((s, d) => s + d.contratos, 0);
    return { vendas, realizado, meta, metaAteAlvo, projecao, falta, diferenca, pctMeta, atingTotal, conv, ticket, contratos };
  }, [inboundData, reunioesRealizadas, fatorPace]);

  // ── PRÉ-VENDAS (SDR) ──
  // Em PRÉ-VENDAS contamos também os closers: assim que um card recebe um closer
  // como responsável (no pipe Closer), aquele closer ganha +1 "reunião marcada"
  // somente nesta tabela. Por isso unificamos sdrs + closers como linhas de pré-vendas.
  const sdrRows = useMemo(() => {
    const set = new Set<string>();
    sdrNames.forEach(n => n && set.add(canonical(n)));
    closerNames.forEach(n => n && set.add(canonical(n)));
    closerCards.forEach(c => { if (c.owner) set.add(canonical(c.owner)); });
    ["Cayo Bitencourt", "João", "Fillipe Amorim Oliveira Silva"].forEach(n => set.add(canonical(n)));
    return Array.from(set);
  }, [sdrNames, closerNames, closerCards, canonical]);

  const preVendasData = useMemo(() => {
    const rows = sdrRows
      .map(sdr => {
        const rm = reunioesMarcadas.filter(c => canonical(c.owner) === sdr).length;
        const rr = reunioesRealizadas.filter(c => canonical(c.owner) === sdr).length;
        const ns = noShowsMes.filter(c => canonical(c.owner) === sdr).length;
        const vendas = contratosMes.filter(c => canonical(c.owner) === sdr).length;
        const goal = goals.find(g => canonical(g.closer) === sdr && g.month === monthKey);
        const meta = goal?.reunioes_marcadas_meta || 0;
        const metaRR = goal?.reunioes_realizadas_meta || 0;

        const metaAteAlvo = (metaRR || meta) * fatorPace;
        const projecao = passedBD > 0 ? Math.round(rm * ratio) : 0;
        const projecaoRR = passedBD > 0 ? Math.round(rr * ratio) : 0;
        // Falta = quantas reuniões realizadas ainda faltam para bater a meta do mês
        const faltaBase = metaRR > 0 ? metaRR : meta;
        const falta = Math.max(0, faltaBase - rr);
        const projetado = passedBD > 0 ? Math.round(rr * ratio) : 0;
        const pctMeta = meta > 0 ? Math.round((projecao / meta) * 100) : 0;
        const atingTotal = metaRR > 0 ? Math.round((projecaoRR / metaRR) * 100) : 0;
        const restantes = du.restantes;
        const paceDiarioRR = (metaRR > 0 && restantes > 0)
          ? Math.max(0, Math.ceil((metaRR - rr) / restantes))
          : 0;
        const conv = rm > 0 ? Math.round((rr / rm) * 100) : 0;
        return { sdr, vendas, reunioesMarcadas: rm, reunioesRealizadas: rr, meta, metaRR, metaAteAlvo, projecao, falta, projetado, pctMeta, atingTotal, paceDiarioRR, conv, noShows: ns, unassigned: 0 };
      })
      // Item 14: exibir só quem tem meta OU realização/venda
      .filter(r => r.meta > 0 || r.metaRR > 0 || r.reunioesMarcadas > 0 || r.reunioesRealizadas > 0 || r.vendas > 0);


    const rmSem = reunioesMarcadas.filter(c => !c.owner).length;
    const rrSem = reunioesRealizadas.filter(c => !c.owner).length;
    const nsSem = noShowsMes.filter(c => !c.owner).length;
    if (rmSem || rrSem || nsSem) {
      rows.push({
        sdr: "Sem responsável", vendas: 0,
        reunioesMarcadas: rmSem, reunioesRealizadas: rrSem, meta: 0, metaRR: 0, metaAteAlvo: 0, projecao: 0, falta: 0, projetado: 0,
        pctMeta: 0, atingTotal: 0, paceDiarioRR: 0, conv: 0, noShows: nsSem, unassigned: rmSem + rrSem + nsSem,
      });
    }
    return rows;
  }, [sdrRows, sdrNames, closerNames, reunioesMarcadas, reunioesRealizadas, noShowsMes, ganhosMes, goals, monthKey, passedBD, ratio, fatorPace, du.restantes]);

  const preVendasTotal = useMemo(() => {
    const rm = preVendasData.reduce((s, d) => s + d.reunioesMarcadas, 0);
    const rr = preVendasData.reduce((s, d) => s + d.reunioesRealizadas, 0);
    const meta = preVendasData.reduce((s, d) => s + d.meta, 0);
    const metaRR = preVendasData.reduce((s, d) => s + d.metaRR, 0);
    const projecao = preVendasData.reduce((s, d) => s + d.projecao, 0);
    const falta = preVendasData.reduce((s, d) => s + d.falta, 0);
    const projetado = preVendasData.reduce((s, d) => s + d.projetado, 0);
    const pctMeta = meta > 0 ? Math.round((projecao / meta) * 100) : 0;
    const atingTotal = metaRR > 0 ? Math.round((projetado / metaRR) * 100) : 0;
    const conv = rm > 0 ? Math.round((rr / rm) * 100) : 0;
    const noShows = preVendasData.reduce((s, d) => s + d.noShows, 0);
    const taxaShow = rm > 0 ? ((rr / rm) * 100).toFixed(1) : "0";
    const metaAteAlvo = (metaRR || meta) * fatorPace;
    const paceDiarioRR = (metaRR > 0 && du.restantes > 0)
      ? Math.max(0, Math.ceil((metaRR - rr) / du.restantes))
      : 0;
    return { rm, rr, meta, metaRR, metaAteAlvo, projecao, falta, projetado, pctMeta, atingTotal, paceDiarioRR, conv, noShows, taxaShow };
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

  // ── HERO globais (acima das tabelas) ──
  const globais = useMemo(() => {
    const metaFatTotal = inboundData.reduce((s, d) => s + (d.meta || 0), 0);
    const metaContratosTotal = closerRows.reduce((s, c) => {
      const g = goals.find(x => x.closer === c && x.month === monthKey);
      return s + (g?.contratos_meta || 0);
    }, 0);
    const metaConvAlvo = (() => {
      const vals = closerRows
        .map(c => goals.find(x => x.closer === c && x.month === monthKey)?.conversao_meta || 0)
        .filter(v => v > 0);
      if (!vals.length) return 0;
      return vals.reduce((s, v) => s + v, 0) / vals.length;
    })();

    const realizadoFat = inboundTotal.realizado;
    const projecaoFat = passedBD > 0 ? Math.round(realizadoFat * ratio) : 0;
    const fatMetaAteAlvo = metaFatTotal * fatorPace;
    const fatPacePct = metaFatTotal > 0 ? (realizadoFat / metaFatTotal) * 100 : 0;
    const fatFaltaPace = Math.max(0, fatMetaAteAlvo - realizadoFat);
    const fatAtingTotal = metaFatTotal > 0 ? (projecaoFat / metaFatTotal) * 100 : 0;

    const rrTotal = reunioesRealizadas.length;
    const metaRRTotal = closerRows.reduce((s, c) => {
      const g = goals.find(x => x.closer === c && x.month === monthKey);
      return s + (g?.reunioes_realizadas_meta || 0);
    }, 0);
    const rrMetaAteAlvo = metaRRTotal * fatorPace;
    const rrPaceDiario = (metaRRTotal > 0 && du.restantes > 0)
      ? Math.max(0, Math.ceil((metaRRTotal - rrTotal) / du.restantes))
      : 0;
    const rrProjecao = passedBD > 0 ? Math.round(rrTotal * ratio) : 0;
    const rrGap = rrTotal - rrMetaAteAlvo;

    const totalVendas = inboundTotal.vendas;
    const convAtual = rrTotal > 0 ? (totalVendas / rrTotal) * 100 : 0;
    const convPctAlvo = metaConvAlvo > 0 ? (convAtual / metaConvAlvo) * 100 : 0;
    const convGap = convAtual - metaConvAlvo;
    const ticketMedio = totalVendas > 0 ? realizadoFat / totalVendas : 0;
    const realCloserRows = inboundData.filter(d => d.closer !== "Sem responsável");
    const topClosers = realCloserRows
      .map(d => ({ closer: d.closer, conv: d.conv }))
      .sort((a, b) => b.conv - a.conv)
      .slice(0, 3);
    const topByFat = realCloserRows
      .map(d => ({ closer: d.closer, value: d.realizado }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
    const topByRR = realCloserRows
      .map(d => ({ closer: d.closer, value: reunioesRealizadas.filter(c => canonical(c.owner) === d.closer).length }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
    const topByContratos = realCloserRows
      .map(d => ({ closer: d.closer, value: d.contratos }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
    const topByTicket = realCloserRows
      .map(d => ({ closer: d.closer, value: d.ticket }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    const contratosFech = contratosMes.length;
    const contMetaAteAlvo = metaContratosTotal * fatorPace;
    const contGap = contratosFech - contMetaAteAlvo;
    const contProjecao = passedBD > 0 ? Math.round(contratosFech * ratio) : 0;

    return {
      faturamento: {
        realizado: realizadoFat, meta: metaFatTotal, metaAteAlvo: fatMetaAteAlvo,
        pacePct: fatPacePct, faltaPace: fatFaltaPace, projecao: projecaoFat, atingTotal: fatAtingTotal,
      },
      reunioes: {
        realizadas: rrTotal, meta: metaRRTotal, metaAteAlvo: rrMetaAteAlvo,
        paceDiarioRR: rrPaceDiario, taxaShow: preVendasTotal.taxaShow, projecao: rrProjecao, gap: rrGap,
      },
      conversao: {
        atual: convAtual, esperada: metaConvAlvo, pctDoAlvo: convPctAlvo,
        gapPp: convGap, vendas: totalVendas, ticketMedio, topClosers, topByTicket,
      },
      contratos: {
        fechados: contratosFech, enviados: contratosEnviados, assinados: contratosAssinados,
        meta: metaContratosTotal, metaAteAlvo: contMetaAteAlvo, gap: contGap, projecao: contProjecao,
        topByContratos,
      },
      rankings: { topByFat, topByRR },
    };
  }, [inboundData, inboundTotal, preVendasTotal, reunioesRealizadas.length, closerRows, goals, monthKey, passedBD, ratio, fatorPace, du.restantes, contratosMes.length, contratosEnviados, contratosAssinados]);


  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Farol</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            {monthLabel} — {passedBD}/{totalBD} dias úteis até {dataAlvoLabel}
          </p>
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
          <div className="flex items-center gap-1.5 text-xs">
            <CalendarDays className="w-3.5 h-3.5 text-primary" />
            <span className="uppercase tracking-wider text-muted-foreground hidden sm:inline">Projeção até</span>
            <input
              type="date"
              value={fmtISO(dataAlvo)}
              min={fmtISO(start)}
              max={fmtISO(new Date(year, month + 1, 0))}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split("-").map(Number);
                setDataAlvo(new Date(y, m - 1, d));
              }}
              className="border border-border rounded-md px-2 py-1 bg-background text-foreground"
            />
            {!isToday && (
              <button onClick={() => setDataAlvo(new Date())} className="text-[10px] text-primary underline">
                hoje
              </button>
            )}
          </div>
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
          <select
            value={weekFilter}
            onChange={e => setWeekFilter(e.target.value)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
            title="Recorte semanal dentro do mês"
          >
            <option value="all">Mês inteiro</option>
            {weekRanges.map(w => (
              <option key={w.idx} value={String(w.idx)}>{w.label}</option>
            ))}
          </select>
        </div>
      </div>

      {!isToday && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-xs text-foreground">
          📅 Visualizando projeção até <strong>{dataAlvo.toLocaleDateString("pt-BR")}</strong>. Os números abaixo mostram quanto você precisa ter atingido até essa data para estar em pace.
        </div>
      )}

      {/* SEÇÃO: Visão Geral */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Visão Geral
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroCard
          icon={<DollarSign className="w-4 h-4" />}
            title="Faturamento"
            valueAccent
            value={formatBRL(globais.faturamento.realizado)}
          metaLabel={globais.faturamento.meta > 0 ? `/ ${formatBRL(globais.faturamento.meta)}` : "meta não cadastrada"}
          subLabel={`meta até ${dataAlvoLabel}: ${formatBRL(globais.faturamento.metaAteAlvo)}`}
          progress={globais.faturamento.pacePct}
          progressLabel={`Pace ${Math.round(globais.faturamento.pacePct)}%`}
          footerLeft={{ label: "Falta p/ pace", value: formatBRL(globais.faturamento.faltaPace), tone: globais.faturamento.faltaPace > 0 ? "red" : "green" }}
          footerRight={{ label: "Por closer", value: <RankList items={globais.rankings.topByFat} format={(v) => formatBRL(v)} /> }}
        />
        <HeroCard
          icon={<Users className="w-4 h-4" />}
          title="Reuniões realizadas"
          value={String(globais.reunioes.realizadas)}
          metaLabel={globais.reunioes.meta > 0 ? `/ ${globais.reunioes.meta}` : "meta não cadastrada"}
          subLabel={`meta até ${dataAlvoLabel}: ${Math.round(globais.reunioes.metaAteAlvo)}`}
          progress={globais.reunioes.meta > 0 ? (globais.reunioes.realizadas / globais.reunioes.meta) * 100 : 0}
          progressLabel={`Pace diário · ${globais.reunioes.paceDiarioRR} RR`}
          footerLeft={{ label: "Taxa show geral", value: `${globais.reunioes.taxaShow}%` }}
          footerRight={{ label: "Por closer", value: <RankList items={globais.rankings.topByRR} format={(v) => String(v)} /> }}
        />
        <HeroCard
          icon={<Percent className="w-4 h-4" />}
          title="Taxa de conversão"
          value={`${globais.conversao.atual.toFixed(1)}%`}
          metaLabel={globais.conversao.esperada > 0 ? `/ ${globais.conversao.esperada.toFixed(0)}%` : "meta não cadastrada"}
          subLabel={globais.conversao.esperada > 0 ? `${Math.round(globais.conversao.pctDoAlvo)}% do alvo` : ""}
          progress={globais.conversao.pctDoAlvo}
          progressLabel={`Vendas · ${globais.conversao.vendas}`}
          footerLeft={{ label: "Ticket médio geral", value: globais.conversao.ticketMedio > 0 ? formatBRL(globais.conversao.ticketMedio) : "—" }}
          footerRight={{ label: "Conv. por closer", value: <RankList items={globais.conversao.topClosers.map(t => ({ closer: t.closer, value: t.conv }))} format={(v) => `${v}%`} /> }}
        />
        <HeroCard
          icon={<FileSignature className="w-4 h-4" />}
          title="Contratos"
          value={String(globais.contratos.fechados)}
          metaLabel={globais.contratos.meta > 0 ? `/ ${globais.contratos.meta}` : "meta não cadastrada"}
          subLabel={`meta até ${dataAlvoLabel}: ${Math.round(globais.contratos.metaAteAlvo)}`}
          progress={globais.contratos.meta > 0 ? (globais.contratos.fechados / globais.contratos.meta) * 100 : 0}
          progressLabel={`Pace até ${dataAlvoLabel}`}
          footerLeft={{ label: "Assinados geral", value: String(globais.contratos.assinados) }}
          footerRight={{ label: "Por closer", value: <RankList items={globais.contratos.topByContratos} format={(v) => String(v)} /> }}
        />
        </div>
      </section>


      {/* SEÇÃO: INBOUND */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Inbound · Closers
        </h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px]">Closer</TableHead>
              
              <TableHead className="text-[10px] text-right">Realizado</TableHead>
              <TableHead className="text-[10px] text-right">Meta</TableHead>
              <TableHead className="text-[10px] text-right">Meta até {dataAlvoLabel}</TableHead>
              <TableHead className="text-[10px] text-right">Projeção</TableHead>
              <TableHead className="text-[10px] text-center">Atingimento</TableHead>
              <TableHead className="text-[10px] text-center">Falta</TableHead>
              <TableHead className="text-[10px] text-center">Contratos</TableHead>
              <TableHead className="text-[10px] text-right">Tkt Méd Proj</TableHead>
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
                
                <TableCell className="text-xs text-right">{formatBRL(d.realizado)}</TableCell>
                <TableCell className="text-xs text-right">{formatBRL(d.meta)}</TableCell>
                <TableCell className="text-xs text-right text-muted-foreground">{formatBRL(d.metaAteAlvo)}</TableCell>
                <TableCell className="text-xs text-right">{formatBRL(d.projecao)}</TableCell>
                <TableCell className="text-xs text-center">{d.atingTotal}%</TableCell>
                <TableCell className="text-xs text-center">{d.falta}</TableCell>
                <TableCell className="text-xs text-center">{d.contratos}</TableCell>
                <TableCell className="text-xs text-right">{d.tktProjetado > 0 ? formatBRL(d.tktProjetado) : "—"}</TableCell>
                <TableCell className="text-xs text-center">{d.conv}%</TableCell>
                <TableCell className="text-xs text-right">{formatBRL(d.ticket)}</TableCell>
                <TableCell className="text-center">{d.meta > 0 && <Semaphore pct={d.atingTotal} />}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/30 font-bold">
              <TableCell className="text-xs font-bold">Total</TableCell>
              
              <TableCell className="text-xs text-right font-bold">{formatBRL(inboundTotal.realizado)}</TableCell>
              <TableCell className="text-xs text-right font-bold">{formatBRL(inboundTotal.meta)}</TableCell>
              <TableCell className="text-xs text-right font-bold text-muted-foreground">{formatBRL(inboundTotal.metaAteAlvo)}</TableCell>
              <TableCell className="text-xs text-right font-bold">{formatBRL(inboundTotal.projecao)}</TableCell>
              <TableCell className="text-xs text-center font-bold">{inboundTotal.atingTotal}%</TableCell>
              <TableCell className="text-xs text-center font-bold">{inboundTotal.falta}</TableCell>
              <TableCell className="text-xs text-center font-bold">{inboundTotal.contratos}</TableCell>
              <TableCell className="text-xs text-right font-bold">—</TableCell>
              <TableCell className="text-xs text-center font-bold">{inboundTotal.conv}%</TableCell>
              <TableCell className="text-xs text-right font-bold">{formatBRL(inboundTotal.ticket)}</TableCell>
              <TableCell className="text-center"><Semaphore pct={inboundTotal.atingTotal} /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
        </div>
        </div>
      </section>

      {/* SEÇÃO: PRÉ-VENDAS */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Pré-Vendas · SDR
        </h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px]">SDR</TableHead>
              <TableHead className="text-[10px] text-center">Reuniões</TableHead>
              <TableHead className="text-[10px] text-center">Realizadas</TableHead>
              <TableHead className="text-[10px] text-center">Meta</TableHead>
              <TableHead className="text-[10px] text-center">Meta até {dataAlvoLabel}</TableHead>
              <TableHead className="text-[10px] text-center">Projeção</TableHead>
              <TableHead className="text-[10px] text-center">Atingimento</TableHead>
              <TableHead className="text-[10px] text-center">Pace/dia</TableHead>
              <TableHead className="text-[10px] text-center">Falta</TableHead>
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
                <TableCell className="text-xs text-center">
                  <button
                    className="hover:underline hover:text-primary"
                    onClick={() => setDebugRR({ owner: d.sdr })}
                    title="Ver leads contados"
                  >
                    {d.reunioesRealizadas}
                  </button>
                </TableCell>
                <TableCell className="text-xs text-center">{d.metaRR || d.meta}</TableCell>
                <TableCell className="text-xs text-center text-muted-foreground">{Math.round(d.metaAteAlvo)}</TableCell>
                <TableCell className="text-xs text-center">{d.projecao}</TableCell>
                <TableCell className="text-xs text-center">{d.atingTotal}%</TableCell>
                <TableCell className="text-xs text-center">{du.restantes > 0 ? d.paceDiarioRR : "—"}</TableCell>
                <TableCell className="text-xs text-center">{d.falta}</TableCell>
                <TableCell className="text-xs text-center">{d.conv}%</TableCell>
                <TableCell className="text-xs text-center">{d.noShows}</TableCell>
                <TableCell className="text-center">{d.meta > 0 && <Semaphore pct={d.atingTotal || d.pctMeta} />}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/30 font-bold">
              <TableCell className="text-xs font-bold">Total</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.rm}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.rr}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.metaRR || preVendasTotal.meta}</TableCell>
              <TableCell className="text-xs text-center font-bold text-muted-foreground">{Math.round(preVendasTotal.metaAteAlvo)}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.projecao}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.atingTotal}%</TableCell>
              <TableCell className="text-xs text-center font-bold">{du.restantes > 0 ? preVendasTotal.paceDiarioRR : "—"}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.falta}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.conv}%</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.noShows}</TableCell>
              <TableCell className="text-center"><Semaphore pct={preVendasTotal.atingTotal || preVendasTotal.pctMeta} /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
        </div>
        <div className="px-4 py-2 border-t border-border flex gap-6 text-xs text-muted-foreground">
          <span>Taxa de Show: <strong className="text-foreground">{preVendasTotal.taxaShow}%</strong></span>
        </div>
        </div>
      </section>

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
          onRefresh={onRefresh}
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
      {/* Debug — leads contados como Reuniões Realizadas */}
      <Dialog open={!!debugRR} onOpenChange={(o) => !o && setDebugRR(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reuniões Realizadas — {debugRR?.owner} · {monthLabel}</DialogTitle>
          </DialogHeader>
          {(() => {
            const ownerKey = debugRR?.owner;
            const all = ownerKey
              ? closerCards.filter(c => {
                  if (!["reuniao_realizada","link_enviado","contrato_assinado"].includes(c.stage)) return false;
                  const ref = c.stage_changed_at || c.data_reuniao || c.created_at;
                  if (!dateInRange(ref, start, end)) return false;
                  return (c.owner || "Sem responsável") === ownerKey;
                })
              : [];
            const counted = all.filter(c => !excludedIds.has(c.id)).length;
            return (
              <>
                <div className="text-[11px] text-muted-foreground mb-2">
                  {counted} contadas / {all.length} total · clique em "Excluir" para tirar do mês (ex.: reunião feita no mês anterior)
                </div>
                <div className="max-h-[60vh] overflow-auto space-y-1">
                  {all.map(c => {
                    const ref = c.stage_changed_at || c.data_reuniao || c.created_at;
                    const isExcluded = excludedIds.has(c.id);
                    return (
                      <div
                        key={c.id}
                        className={`w-full p-3 border rounded-lg flex items-center justify-between gap-2 ${isExcluded ? "border-dashed opacity-60 bg-muted/30" : "border-border"}`}
                      >
                        <button
                          onClick={() => { setDebugRR(null); openCard(c.id); }}
                          className="flex-1 text-left hover:underline"
                        >
                          <div className="text-sm font-medium">{c.nome} {isExcluded && <span className="text-[10px] text-muted-foreground">(excluído do mês)</span>}</div>
                          <div className="text-[11px] text-muted-foreground">
                            stage: <strong>{c.stage.replace(/_/g, " ")}</strong> · {ref ? new Date(ref).toLocaleString("pt-BR") : "sem data"}
                          </div>
                        </button>
                        <button
                          onClick={() => toggleExcluded(c.id)}
                          className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent"
                        >
                          {isExcluded ? "Incluir" : "Excluir do mês"}
                        </button>
                      </div>
                    );
                  })}
                  {all.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum card.</p>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Edit Goals Dialog ──
// ── Hero Card ──
function HeroCard({
  icon, title, value, valueAccent, metaLabel, subLabel, progress, progressLabel, footerLeft, footerRight,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  valueAccent?: boolean;
  metaLabel: string;
  subLabel?: string;
  progress: number;
  progressLabel?: string;
  footerLeft: { label: string; value: React.ReactNode; tone?: "red" | "green" };
  footerRight: { label: string; value: React.ReactNode; tone?: "red" | "green" };
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const toneClass = (t?: "red" | "green") =>
    t === "red" ? "text-red-400" : t === "green" ? "text-green-400" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4 hover:border-primary/40 transition-colors">
      {/* Header: label uppercase à esquerda, ícone em badge à direita */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </span>
        <span className="shrink-0 w-8 h-8 rounded-lg bg-muted/60 text-primary flex items-center justify-center">
          {icon}
        </span>
      </div>

      {/* Valor principal */}
      <div>
        <div className={cn(
          "text-3xl font-bold tracking-tight leading-none tabular-nums truncate",
          valueAccent ? "text-primary" : "text-foreground"
        )}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1.5">{metaLabel}</div>
        {subLabel && <div className="text-[10px] text-muted-foreground/80 mt-0.5">{subLabel}</div>}
      </div>

      {/* Progresso */}
      <div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        {progressLabel && (
          <div className="text-[10px] text-muted-foreground mt-1 flex justify-between">
            <span>{progressLabel}</span>
            <span>{pct}%</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-3 border-t border-border/60">
        <div className="min-w-[88px]">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{footerLeft.label}</div>
          <div className={cn("text-sm font-bold tabular-nums", toneClass(footerLeft.tone))}>{footerLeft.value}</div>
        </div>
        <div className="border-l border-border/60 pl-3">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{footerRight.label}</div>
          <div className={cn("text-xs font-medium", toneClass(footerRight.tone))}>{footerRight.value}</div>
        </div>
      </div>
    </div>
  );
}



function RankList({ items, format }: { items: { closer: string; value: number }[]; format: (v: number) => string }) {
  if (!items || items.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const top = items.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="flex flex-col gap-px mt-0.5">
      {top.map((t, i) => {
        const first = t.closer.split(" ")[0];
        return (
          <div
            key={t.closer}
            className="grid grid-cols-[14px_1fr_auto] items-center gap-1.5 text-[11px] leading-tight tabular-nums"
          >
            <span className="text-[11px] leading-none">{medals[i]}</span>
            <span className="font-medium text-foreground truncate">{first}</span>
            <span className="font-semibold text-foreground/90">{format(t.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Edit Goals Dialog ──
function EditGoalsDialog({
  open, onOpenChange, monthKey, monthLabel, closers, sdrs, goals, onSave, onRefresh,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  monthKey: string;
  monthLabel: string;
  closers: string[];
  sdrs: string[];
  goals: PipelineGoal[];
  onSave: (g: PipelineGoal) => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
}) {
  const allNames = useMemo(() => Array.from(new Set([...closers, ...sdrs])), [closers, sdrs]);
  const firstNorm = (s: string) =>
    (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().split(/\s+/)[0] || "";

  // Metas frescas direto do banco quando o diálogo abre — sem cache/rascunho antigo.
  const [freshGoals, setFreshGoals] = useState<PipelineGoal[] | null>(null);
  const [loadingFresh, setLoadingFresh] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setDirty(new Set());
    setFreshGoals(null);
    setLoadingFresh(true);
    (async () => {
      const { data, error } = await supabase
        .from("metas")
        .select("*")
        .eq("mes", monthKey);
      if (error) {
        console.warn("EditGoalsDialog: fetch metas failed", error.message);
        setFreshGoals(goals.filter(g => g.month === monthKey));
      } else {
        setFreshGoals((data || []).map((row: any) => ({
          closer: row.closer,
          month: row.mes,
          reunioes_marcadas_meta: row.meta_reunioes_marcadas || 0,
          reunioes_realizadas_meta: row.meta_reunioes_realizadas || 0,
          faturamento_meta: row.meta_faturamento || 0,
          conversao_meta: row.meta_conversao || 0,
          vendas_meta: row.meta_vendas || 0,
          ticket_medio_meta: row.meta_ticket_medio || 0,
          contratos_meta: row.meta_contratos || 0,
        })));
      }
      // Limpa qualquer rascunho local antigo (fonte de bug de sobrescrita)
      try { localStorage.removeItem(`farol_goals_draft_${monthKey}`); } catch {}
      setLoadingFresh(false);
    })();
  }, [open, monthKey]);

  const source = freshGoals ?? [];
  const findGoal = (name: string) => {
    const k = firstNorm(name);
    return source.find(g => firstNorm(g.closer) === k);
  };

  const initial = useMemo(() => {
    const map: Record<string, PipelineGoal> = {};
    allNames.forEach(n => {
      const g = findGoal(n);
      // Sempre usar o nome oficial curto (n), nunca o que veio do banco
      map[n] = g
        ? { ...g, closer: n, month: monthKey }
        : { closer: n, month: monthKey, reunioes_marcadas_meta: 0, reunioes_realizadas_meta: 0, faturamento_meta: 0, conversao_meta: 0, vendas_meta: 0, ticket_medio_meta: 0, contratos_meta: 0 };
    });
    return map;
  }, [allNames, source, monthKey]);

  const [draft, setDraft] = useState<Record<string, PipelineGoal>>({});
  useEffect(() => { setDraft(initial); }, [initial]);

  const upd = (name: string, key: keyof PipelineGoal, val: number) => {
    setDraft(prev => ({ ...prev, [name]: { ...prev[name], [key]: val } }));
    setDirty(prev => { const n = new Set(prev); n.add(name); return n; });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Só salva os closers efetivamente editados — não reescreve o conjunto inteiro às cegas.
      for (const name of allNames) {
        if (!dirty.has(name)) continue;
        const g = { ...draft[name], closer: name, month: monthKey, vendas_meta: draft[name]?.contratos_meta ?? 0 } as PipelineGoal;
        await onSave(g);
      }
      try { localStorage.removeItem(`farol_goals_draft_${monthKey}`); } catch {}
      if (onRefresh) await onRefresh();
    } finally {
      setSaving(false);
      onOpenChange(false);
    }
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
                <th className="text-right p-2">R. Realizadas</th>
                <th className="text-right p-2">Conv %</th>
                <th className="text-right p-2">Tkt Médio</th>
                <th className="text-right p-2">Contratos</th>
              </tr>
            </thead>
            <tbody>
              {allNames.map(n => (
                <tr key={n} className="border-b border-border/50">
                  <td className="p-2 font-medium">{n}</td>
                  <td className="p-2"><input type="number" className="w-28 bg-muted/50 border border-border rounded px-2 py-1 text-right" value={draft[n]?.faturamento_meta || 0} onChange={e => upd(n, "faturamento_meta", Number(e.target.value))} /></td>
                  
                  <td className="p-2"><input type="number" className="w-16 bg-muted/50 border border-border rounded px-2 py-1 text-right" value={draft[n]?.reunioes_realizadas_meta || 0} onChange={e => upd(n, "reunioes_realizadas_meta", Number(e.target.value))} /></td>
                  <td className="p-2"><input type="number" className="w-16 bg-muted/50 border border-border rounded px-2 py-1 text-right" value={draft[n]?.conversao_meta || 0} onChange={e => upd(n, "conversao_meta", Number(e.target.value))} /></td>
                  <td className="p-2"><input type="number" className="w-24 bg-muted/50 border border-border rounded px-2 py-1 text-right" value={draft[n]?.ticket_medio_meta || 0} onChange={e => upd(n, "ticket_medio_meta" as any, Number(e.target.value))} /></td>
                  <td className="p-2"><input type="number" className="w-16 bg-muted/50 border border-border rounded px-2 py-1 text-right" value={draft[n]?.contratos_meta || 0} onChange={e => upd(n, "contratos_meta" as any, Number(e.target.value))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              const presets: Record<string, Partial<PipelineGoal>> = {
                "Fillipe": { faturamento_meta: 31500, reunioes_realizadas_meta: 60, conversao_meta: 30, ticket_medio_meta: 1750, contratos_meta: 18 },
                "João": { faturamento_meta: 14080, reunioes_realizadas_meta: 40, conversao_meta: 22, ticket_medio_meta: 1600, contratos_meta: 9 },
                "Cayo Bitencourt": { faturamento_meta: 10500, reunioes_realizadas_meta: 20, conversao_meta: 30, ticket_medio_meta: 1750, contratos_meta: 6 },
              };
              const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
              const matchKey = (name: string) => {
                const n = norm(name);
                if (n.includes("fillipe") || n.includes("filipe")) return "Fillipe";
                if (n.includes("cafe") || n.includes("café") || n.includes("joao")) return "João";
                if (n.includes("cayo")) return "Cayo Bitencourt";
                return null;
              };
              setDraft(prev => {
                const next = { ...prev };
                allNames.forEach(n => {
                  const k = matchKey(n);
                  if (k && presets[k]) {
                    next[n] = { ...next[n], ...presets[k] } as PipelineGoal;
                  }
                });
                return next;
              });
            }}
          >
            Aplicar metas de maio
          </Button>
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
