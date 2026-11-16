export type ContatoStatus = "opt_out" | "virou_card" | "respondeu" | "erro" | "enviado" | "na_fila";

export interface ContatoStatusInput {
  opt_out_em?: string | null;
  lead_id_campanha?: string | null;
  respondeu_em?: string | null;
  envio_status?: string | null;
  enviado_em?: string | null;
}

/** Status do contato na campanha, na ordem de prioridade definida pelo time. */
export function statusContato(c: ContatoStatusInput): ContatoStatus {
  if (c.opt_out_em) return "opt_out";
  if (c.lead_id_campanha) return "virou_card";
  if (c.respondeu_em) return "respondeu";
  if (c.envio_status === "erro") return "erro";
  if (c.enviado_em) return "enviado";
  return "na_fila";
}

export const STATUS_LABEL: Record<ContatoStatus, string> = {
  opt_out: "Pediu para sair",
  virou_card: "Virou card",
  respondeu: "Respondeu",
  erro: "Erro no envio",
  enviado: "Enviado",
  na_fila: "Na fila",
};

export interface Ritmo {
  lote_por_rodada: number;
  limite_diario: number;
  hora_inicio: number;
  hora_fim: number;
}

/** Retorna a mensagem de erro do ritmo, ou null se válido. */
export function validarRitmo(r: Ritmo): string | null {
  const int = (n: number) => Number.isInteger(n);
  if (!int(r.lote_por_rodada) || r.lote_por_rodada < 1 || r.lote_por_rodada > 50) return "Lote por rodada deve ser entre 1 e 50.";
  if (!int(r.limite_diario) || r.limite_diario < 1 || r.limite_diario > 500) return "Limite diário deve ser entre 1 e 500.";
  if (!int(r.hora_inicio) || r.hora_inicio < 0 || r.hora_inicio > 23) return "Hora de início deve ser entre 0 e 23.";
  if (!int(r.hora_fim) || r.hora_fim < 1 || r.hora_fim > 24) return "Hora de fim deve ser entre 1 e 24.";
  if (r.hora_fim <= r.hora_inicio) return "Hora de fim deve ser maior que a hora de início.";
  return null;
}

/** Formata telefone BR: (11) 98765-4321; aceita com ou sem 55. */
export function formatTelefone(raw: string | null | undefined): string {
  if (!raw) return "—";
  let d = String(raw).replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(raw);
}

const TZ = "America/Sao_Paulo";
/** dd/MM HH:mm no fuso de São Paulo. */
export function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("day")}/${g("month")} ${g("hour")}:${g("minute")}`;
}
