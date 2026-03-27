import { Clock, Phone, CalendarCheck, CheckCircle, Send, FileText, Handshake, Target, MessageSquare } from "lucide-react";

export type PipeType = "sdr" | "closer";
export type SdrStage = "conectado" | "sql" | "reuniao_marcada";
export type CloserStage = "reuniao_realizada" | "proposta_enviada" | "negociacao" | "venda";
export type Stage = SdrStage | CloserStage;
export type LeadStatus = "aberto" | "ganho" | "perdido";
export type LossCategory = "preco" | "timing" | "concorrente" | "sem_budget" | "sem_resposta" | "outro";

export interface StageChange {
  from: string | null;
  to: string;
  at: string;
  by: string;
  duration_days: number | null;
}

export interface PipelineCard {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cnpj: string | null;
  valor_divida: number | null;
  pipe: PipeType;
  stage: Stage;
  origem: string | null;
  anotacoes: string | null;
  contract_url: string | null;
  created_at: string;
  updated_at: string;
  owner: string | null;
  deal_value: number;
  lead_status: LeadStatus;
  loss_reason: string | null;
  loss_category: LossCategory | null;
  last_stage: string | null;
  stage_changed_at: string;
  history: StageChange[];
}

export interface PipelineTask {
  id: string;
  card_id: string;
  title: string;
  due_date: string;
  responsible: string | null;
  status: "pendente" | "concluida";
  pipe_context: PipeType;
  auto_generated: boolean;
  created_at: string;
}

export interface PipelineGoal {
  closer: string;
  month: string;
  reunioes_marcadas_meta: number;
  reunioes_realizadas_meta: number;
  faturamento_meta: number;
  conversao_meta: number;
}

export const CLOSERS = ["Cayo", "Stephanie", "Fillipe"] as const;
export const DEFAULT_DEAL_VALUE = 1621;
export const STALE_DAYS = 7;

export const STAGE_ORDER: Stage[] = ["conectado", "sql", "reuniao_marcada", "reuniao_realizada", "proposta_enviada", "negociacao", "venda"];

export const STAGE_CONFIG: Record<Stage, {
  label: string; pipe: PipeType; probability: number; exitCriteria: string;
  icon: any; color: string; bg: string;
}> = {
  conectado: { label: "Conectado", pipe: "sdr", probability: 0.05, exitCriteria: "Lead respondeu e tem interesse mínimo", icon: Phone, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" },
  sql: { label: "SQL", pipe: "sdr", probability: 0.15, exitCriteria: "Qualificado (tem problema, verba e autoridade)", icon: CheckCircle, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/30" },
  reuniao_marcada: { label: "Reunião Marcada", pipe: "sdr", probability: 0.30, exitCriteria: "Data confirmada na agenda", icon: CalendarCheck, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30" },
  reuniao_realizada: { label: "Reunião Realizada", pipe: "closer", probability: 0.50, exitCriteria: "Reunião aconteceu independente do resultado", icon: Handshake, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" },
  proposta_enviada: { label: "Proposta Enviada", pipe: "closer", probability: 0.65, exitCriteria: "Proposta formal enviada", icon: Send, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" },
  negociacao: { label: "Negociação", pipe: "closer", probability: 0.80, exitCriteria: "Objeções ativas sendo tratadas", icon: MessageSquare, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/30" },
  venda: { label: "Venda", pipe: "closer", probability: 1.0, exitCriteria: "Contrato assinado", icon: Target, color: "text-green-400", bg: "bg-green-400/10 border-green-400/30" },
};

export const SDR_STAGES = STAGE_ORDER.filter(s => STAGE_CONFIG[s].pipe === "sdr");
export const CLOSER_STAGES = STAGE_ORDER.filter(s => STAGE_CONFIG[s].pipe === "closer");

export const AUTO_TASKS: Record<Stage, { title: (n: string) => string; daysOffset: number }[]> = {
  conectado: [{ title: n => `Enviar áudio de apresentação — ${n}`, daysOffset: 1 }],
  sql: [{ title: n => `Confirmar dor principal e agendar reunião — ${n}`, daysOffset: 0 }],
  reuniao_marcada: [
    { title: n => `Enviar lembrete 24h antes — ${n}`, daysOffset: 0 },
    { title: n => `Preparar material da reunião — ${n}`, daysOffset: 0 },
  ],
  reuniao_realizada: [{ title: n => `Enviar proposta em até 24h — ${n}`, daysOffset: 1 }],
  proposta_enviada: [{ title: n => `Follow-up da proposta — ${n}`, daysOffset: 2 }],
  negociacao: [{ title: n => `Verificar objeções pendentes — ${n}`, daysOffset: 1 }],
  venda: [],
};

export const LOSS_CATEGORIES: { key: LossCategory; label: string }[] = [
  { key: "preco", label: "Preço" },
  { key: "timing", label: "Timing (não é o momento)" },
  { key: "concorrente", label: "Concorrente" },
  { key: "sem_budget", label: "Sem budget" },
  { key: "sem_resposta", label: "Sem resposta" },
  { key: "outro", label: "Outro" },
];

export const HANDOFF_ITEMS = [
  "Dor principal identificada",
  "Orçamento confirmado",
  "Decisor na reunião",
  "Gancho/contexto passado ao closer",
];

export function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function daysDiff(from: string, to: string = new Date().toISOString()): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
}

export function getBusinessDays(year: number, month: number): number {
  let c = 0; const d = new Date(year, month, 1);
  while (d.getMonth() === month) { if (d.getDay() !== 0 && d.getDay() !== 6) c++; d.setDate(d.getDate() + 1); }
  return c;
}

export function getBusinessDaysPassed(year: number, month: number, today: Date): number {
  let c = 0; const d = new Date(year, month, 1);
  while (d.getMonth() === month && d <= today) { if (d.getDay() !== 0 && d.getDay() !== 6) c++; d.setDate(d.getDate() + 1); }
  return c;
}

export function isStale(card: PipelineCard): boolean {
  return card.lead_status === "aberto" && daysDiff(card.stage_changed_at) > STALE_DAYS;
}

export function cardsReachedStage(cards: PipelineCard[], stage: Stage): PipelineCard[] {
  return cards.filter(c => c.stage === stage || c.history.some(h => h.to === stage));
}
