// Regras puras do módulo Campanhas/Criativos (Meta). Sem I/O.

export const ORCAMENTO_MIN_CENTAVOS = 1000; // R$ 10/dia
export const ORCAMENTO_MAX_CENTAVOS = 500000; // R$ 5.000/dia

const CADASTRO_TYPES = new Set([
  "offsite_conversion.fb_pixel_complete_registration",
  "complete_registration",
]);

type Action = { action_type?: string; value?: string | number };

/** Cadastros = action "complete_registration" (pixel ou genérica). Usa a maior das duas para não somar em dobro. */
export function cadastrosDe(actions: Action[] | null | undefined): number {
  if (!Array.isArray(actions)) return 0;
  let max = 0;
  for (const a of actions) {
    if (a?.action_type && CADASTRO_TYPES.has(a.action_type)) max = Math.max(max, Number(a.value ?? 0) || 0);
  }
  return max;
}

/** Orçamento diário da campanha em centavos: CBO no nível campanha; ABO = soma dos adsets. */
export function orcamentoCampanhaCentavos(c: { daily_budget?: string | number | null; adsets?: { data?: { daily_budget?: string | number | null }[] } }): number | null {
  const proprio = Number(c.daily_budget ?? 0);
  if (proprio > 0) return proprio;
  const soma = (c.adsets?.data ?? []).reduce((s, a) => s + (Number(a.daily_budget ?? 0) || 0), 0);
  return soma > 0 ? soma : null;
}

/** Converte texto em reais ("150", "150,50", "1.250,00") para centavos inteiros. */
export function reaisParaCentavos(txt: string): number | null {
  const limpo = String(txt ?? "").trim().replace(/[R$\s]/g, "");
  if (!limpo) return null;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const v = Number(normal);
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 100);
}

/** null = válido; string = motivo do erro. */
export function validarOrcamento(centavos: number | null): string | null {
  if (centavos == null) return "Informe um valor em reais.";
  if (centavos < ORCAMENTO_MIN_CENTAVOS) return "Mínimo de R$ 10,00 por dia.";
  if (centavos > ORCAMENTO_MAX_CENTAVOS) return "Máximo de R$ 5.000,00 por dia.";
  return null;
}

export function custoPorCadastro(gasto: number, cadastros: number): number | null {
  return cadastros > 0 ? gasto / cadastros : null;
}

export function slugify(s: string): string {
  return String(s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 60) || "criativo";
}

export const VIDEO_MAX_BYTES = 500 * 1024 * 1024;

export function caminhoVideo(nome: string, agora = Date.now()): string {
  return `videos/${agora}-${slugify(nome)}.mp4`;
}

export const ANGULOS = [
  { v: "dor", l: "Dor" },
  { v: "prova", l: "Prova" },
  { v: "preco", l: "Preço" },
  { v: "outro", l: "Outro" },
] as const;

export const STATUS_CRIATIVO: Record<string, string> = {
  arquivo: "Arquivo",
  enviado_meta: "Enviado ao Meta",
  em_anuncio: "Em anúncio",
  aposentado: "Aposentado",
};
