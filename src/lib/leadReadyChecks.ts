// Validações compartilhadas para barrar avanço de etapas quando o lead
// não tem dados mínimos. Mantemos a mesma lista de campos no agendamento
// de reunião (SDR -> Closer) e na geração/envio de contrato.

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || "").trim());

export type LeadCheckable = {
  valor_divida?: number | null;
  origem_divida?: string | null;
  estado?: string | null;
  email?: string | null;
  [k: string]: any;
};

/**
 * Retorna a lista de rótulos amigáveis dos campos básicos faltantes.
 * Campos: valor_divida, origem_divida (pgfn|receita_federal), estado (UF), email.
 */
export function missingLeadBasics(lead: LeadCheckable): string[] {
  const missing: string[] = [];
  if (!lead.valor_divida || Number(lead.valor_divida) <= 0) missing.push("Valor da dívida");
  const origem = (lead.origem_divida || "").toLowerCase();
  if (origem !== "pgfn" && origem !== "receita_federal") {
    missing.push("Origem da dívida (Receita/PGFN)");
  }
  if (!lead.estado || !String(lead.estado).trim()) missing.push("UF");
  if (!lead.email || !isEmail(lead.email)) missing.push("E-mail");
  return missing;
}

export function buildMissingMessage(prefix: string, missing: string[]): string {
  return `${prefix} ${missing.join(", ")}.`;
}
