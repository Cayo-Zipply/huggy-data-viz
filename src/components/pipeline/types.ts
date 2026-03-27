import { Clock, Phone, CalendarCheck, CheckCircle, XCircle, FileText, Send } from "lucide-react";

export type PipeType = "sdr" | "closer";
export type SdrStage = "lead" | "conectado" | "sql" | "reuniao_marcada";
export type CloserStage = "reuniao_agendada" | "no_show" | "reuniao_realizada" | "link_enviado" | "contrato_assinado";
export type LeadStatus = "aberto" | "ganho" | "perdido";

export interface PipelineCard {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cnpj: string | null;
  valor_divida: number | null;
  pipe: PipeType;
  sdr_stage: SdrStage | null;
  closer_stage: CloserStage | null;
  origem: string | null;
  anotacoes: string | null;
  contract_url: string | null;
  sheet_row_id: string | null;
  created_at: string;
  updated_at: string;
  owner: string | null;
  deal_value: number;
  lead_status: LeadStatus;
  loss_reason: string | null;
  last_stage: string | null;
  stage_changed_at: string | null;
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
  id: string;
  closer: string;
  month: string;
  reunioes_marcadas_meta: number;
  reunioes_realizadas_meta: number;
  faturamento_meta: number;
  conversao_meta: number;
}

export const CLOSERS = ["Cayo", "Stephanie", "Fillipe"] as const;
export const DEFAULT_DEAL_VALUE = 1621;

export const SDR_STAGES = [
  { key: "lead" as SdrStage, label: "Lead", icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" },
  { key: "conectado" as SdrStage, label: "Conectado", icon: Phone, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" },
  { key: "sql" as SdrStage, label: "SQL", icon: CalendarCheck, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/30" },
  { key: "reuniao_marcada" as SdrStage, label: "Reunião Marcada", icon: CalendarCheck, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30" },
];

export const CLOSER_STAGES = [
  { key: "reuniao_agendada" as CloserStage, label: "Reunião Agendada", icon: CalendarCheck, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" },
  { key: "no_show" as CloserStage, label: "No Show", icon: XCircle, color: "text-red-400", bg: "bg-red-400/10 border-red-400/30" },
  { key: "reuniao_realizada" as CloserStage, label: "Reunião Realizada", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30" },
  { key: "link_enviado" as CloserStage, label: "Link Enviado", icon: Send, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" },
  { key: "contrato_assinado" as CloserStage, label: "Contrato Assinado", icon: FileText, color: "text-green-400", bg: "bg-green-400/10 border-green-400/30" },
];

export const ALL_STAGES = [...SDR_STAGES, ...CLOSER_STAGES];

export function getStageLabel(card: PipelineCard): string {
  if (card.pipe === "sdr") return SDR_STAGES.find(s => s.key === card.sdr_stage)?.label || "—";
  return CLOSER_STAGES.find(s => s.key === card.closer_stage)?.label || "—";
}

export function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function getBusinessDays(year: number, month: number): number {
  let count = 0;
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export function getBusinessDaysPassed(year: number, month: number, today: Date): number {
  let count = 0;
  const d = new Date(year, month, 1);
  while (d.getMonth() === month && d <= today) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}
