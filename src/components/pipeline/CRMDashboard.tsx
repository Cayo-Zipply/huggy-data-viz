import { cn } from "@/lib/utils";
import { Users, Trophy, XCircle, TrendingUp, DollarSign, CalendarCheck, FileText } from "lucide-react";
import type { PipelineCard } from "./types";
import { CLOSERS, formatBRL } from "./types";

interface Props {
  cards: PipelineCard[];
  activeUser: string;
}

function MetricBox({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: any; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", color)}>
          <Icon size={16} className="text-foreground" />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function CloserMetrics({ cards, closer }: { cards: PipelineCard[]; closer: string }) {
  const closerCards = cards.filter(c => c.owner === closer);
  const ativos = closerCards.filter(c => c.lead_status === "aberto").length;
  const reunioesMarcadas = closerCards.filter(c =>
    (c.pipe === "sdr" && c.sdr_stage === "reuniao_marcada") ||
    (c.pipe === "closer" && c.closer_stage === "reuniao_agendada")
  ).length;
  const reunioesRealizadas = closerCards.filter(c => c.pipe === "closer" && c.closer_stage === "reuniao_realizada").length;
  const contratos = closerCards.filter(c => c.lead_status === "ganho").length;
  const valorFechado = closerCards.filter(c => c.lead_status === "ganho").reduce((s, c) => s + (c.deal_value || 0), 0);

  return (
    <div className="bg-card/50 border border-border rounded-xl p-4">
      <h4 className="text-sm font-semibold text-foreground mb-3">{closer}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div><p className="text-[10px] text-muted-foreground">Ativos</p><p className="text-lg font-bold">{ativos}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Reuniões Marc.</p><p className="text-lg font-bold">{reunioesMarcadas}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Reuniões Real.</p><p className="text-lg font-bold">{reunioesRealizadas}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Contratos</p><p className="text-lg font-bold">{contratos}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Valor Fechado</p><p className="text-lg font-bold text-emerald-400">{formatBRL(valorFechado)}</p></div>
      </div>
    </div>
  );
}

export function CRMDashboard({ cards, activeUser }: Props) {
  const isAdmin = activeUser === "Cayo";
  const visibleCards = isAdmin ? cards : cards.filter(c => c.owner === activeUser);

  const ativos = visibleCards.filter(c => c.lead_status === "aberto");
  const ganhos = visibleCards.filter(c => c.lead_status === "ganho");
  const perdidos = visibleCards.filter(c => c.lead_status === "perdido");
  const totalAtivos = ativos.length;
  const totalGanhos = ganhos.length;
  const totalPerdidos = perdidos.length;
  const valorGanhos = ganhos.reduce((s, c) => s + (c.deal_value || 0), 0);
  const valorPipeline = ativos.reduce((s, c) => s + (c.deal_value || 0), 0);
  const taxaPerda = visibleCards.length > 0 ? ((totalPerdidos / visibleCards.length) * 100).toFixed(1) : "0";
  const taxaConversao = visibleCards.length > 0 ? ((totalGanhos / visibleCards.length) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground">Dashboard CRM</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Visão {isAdmin ? "geral" : `de ${activeUser}`}</p>
      </div>

      {/* Main metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricBox label="Leads Ativos" value={totalAtivos.toString()} icon={Users} color="bg-primary/20" />
        <MetricBox label="Ganhos" value={totalGanhos.toString()} sub={formatBRL(valorGanhos)} icon={Trophy} color="bg-green-500/20" />
        <MetricBox label="Perdidos" value={totalPerdidos.toString()} sub={`${taxaPerda}% de perda`} icon={XCircle} color="bg-destructive/20" />
        <MetricBox label="Conversão" value={`${taxaConversao}%`} icon={TrendingUp} color="bg-yellow-400/20" />
        <MetricBox label="Valor Pipeline" value={formatBRL(valorPipeline)} icon={DollarSign} color="bg-emerald-400/20" />
      </div>

      {/* Per closer */}
      {isAdmin && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Por Closer</h4>
          {CLOSERS.map(c => <CloserMetrics key={c} cards={cards} closer={c} />)}
          <CloserMetrics cards={cards} closer="" />
        </div>
      )}
      {!isAdmin && <CloserMetrics cards={visibleCards} closer={activeUser} />}
    </div>
  );
}
