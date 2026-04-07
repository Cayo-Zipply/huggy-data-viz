import { Clock, Phone, CalendarCheck, CheckCircle, Send, FileText, Handshake, Target, MessageSquare, XCircle, Link, FileSignature } from "lucide-react";

export type PipeType = "sdr" | "closer";
export type SdrStage = "fez_contato" | "conectado" | "sql" | "reuniao_marcada";
export type CloserStage = "reuniao_agendada" | "no_show" | "reuniao_realizada" | "link_enviado" | "contrato_assinado";
export type Stage = SdrStage | CloserStage;
export type LeadStatus = "aberto" | "ganho" | "perdido";
export type LossCategory = "preco" | "timing" | "concorrente" | "sem_budget" | "sem_resposta" | "outro";
export type ContractType = "tributario_cnpj" | "tributario_cpf" | "empresarial_completo";
export type ContractStatus = "pendente" | "gerado" | "enviado" | "assinado" | "recusado";

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
  empresa: string | null;
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
  resumo_reuniao: string | null;
  transcricao_reuniao: string | null;
  data_reuniao: string | null;
  duracao_reuniao: string | null;
  participantes_reuniao: string | null;
  data_no_show: string | null;
  // Contract fields
  contrato_status: ContractStatus | null;
  contrato_file_url: string | null;
  contrato_preparado_em: string | null;
  contrato_preparado_por: string | null;
  tipo_contrato: ContractType | null;
  representante_nome: string | null;
  representante_cpf: string | null;
  valor_mensalidade: number | null;
  qtd_salarios_minimos: string | null;
  porcentagem_exito: string | null;
  data_primeiro_pagamento: string | null;
  dia_demais_pagamentos: string | null;
  prazo_entrega_relatorios: number | null;
  prazo_contrato: string | null;
  valor_proposta: number | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  zapsign_signed_at: string | null;
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

export const STAGE_ORDER: Stage[] = ["fez_contato", "conectado", "sql", "reuniao_marcada", "reuniao_agendada", "no_show", "reuniao_realizada", "link_enviado", "contrato_assinado"];

export const STAGE_CONFIG: Record<Stage, {
  label: string; pipe: PipeType; probability: number; exitCriteria: string;
  icon: any; color: string; bg: string;
}> = {
  fez_contato: { label: "Fez Contato", pipe: "sdr", probability: 0.02, exitCriteria: "Lead recém-chegado, ainda não abordado", icon: MessageSquare, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/30" },
  conectado: { label: "Conectado", pipe: "sdr", probability: 0.05, exitCriteria: "Lead respondeu e tem interesse mínimo", icon: Phone, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" },
  sql: { label: "SQL", pipe: "sdr", probability: 0.15, exitCriteria: "Qualificado (tem problema, verba e autoridade)", icon: CheckCircle, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/30" },
  reuniao_marcada: { label: "Reunião Marcada", pipe: "sdr", probability: 0.30, exitCriteria: "Data confirmada na agenda", icon: CalendarCheck, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30" },
  reuniao_agendada: { label: "Reunião Agendada", pipe: "closer", probability: 0.40, exitCriteria: "Reunião confirmada na agenda do closer", icon: CalendarCheck, color: "text-cyan-400", bg: "bg-cyan-400/10 border-cyan-400/30" },
  no_show: { label: "No Show", pipe: "closer", probability: 0.20, exitCriteria: "Lead não compareceu à reunião", icon: XCircle, color: "text-red-400", bg: "bg-red-400/10 border-red-400/30" },
  reuniao_realizada: { label: "Reunião Realizada", pipe: "closer", probability: 0.50, exitCriteria: "Reunião aconteceu independente do resultado", icon: Handshake, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" },
  link_enviado: { label: "Link Enviado", pipe: "closer", probability: 0.70, exitCriteria: "Link de pagamento/proposta enviado ao lead", icon: Link, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" },
  contrato_assinado: { label: "Contrato Assinado", pipe: "closer", probability: 1.0, exitCriteria: "Contrato assinado e venda fechada", icon: FileSignature, color: "text-green-400", bg: "bg-green-400/10 border-green-400/30" },
};

export const SDR_STAGES = STAGE_ORDER.filter(s => STAGE_CONFIG[s].pipe === "sdr");
export const CLOSER_STAGES = STAGE_ORDER.filter(s => STAGE_CONFIG[s].pipe === "closer");

export const AUTO_TASKS: Record<Stage, { title: (n: string) => string; daysOffset: number }[]> = {
  fez_contato: [{ title: n => `Primeiro contato — ${n}`, daysOffset: 1 }],
  conectado: [{ title: n => `Enviar áudio de apresentação — ${n}`, daysOffset: 1 }],
  sql: [{ title: n => `Confirmar dor principal e agendar reunião — ${n}`, daysOffset: 0 }],
  reuniao_marcada: [
    { title: n => `Enviar lembrete 24h antes — ${n}`, daysOffset: 0 },
    { title: n => `Preparar material da reunião — ${n}`, daysOffset: 0 },
  ],
  reuniao_agendada: [{ title: n => `Confirmar presença do lead — ${n}`, daysOffset: 0 }],
  no_show: [{ title: n => `Reagendar reunião — ${n}`, daysOffset: 1 }],
  reuniao_realizada: [{ title: n => `Enviar proposta em até 24h — ${n}`, daysOffset: 1 }],
  link_enviado: [{ title: n => `Follow-up do link enviado — ${n}`, daysOffset: 2 }],
  contrato_assinado: [],
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
