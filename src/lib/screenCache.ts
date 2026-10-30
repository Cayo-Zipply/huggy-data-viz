// Chaves das telas Criativos e Black Ops guardadas no cache persistente.
export const SE_VIEW_KEYS = [
  "se-meses", "se-desempenho-meta", "se-alertas", "se-reunioes", "se-evolucao",
  "se-notas-mensais", "se-assertividade", "se-nota-x-conversao", "se-reuniao-desfecho",
  "se-alertas-assertividade", "se-pontualidade-revisar", "se-pontualidade-ranking",
];
export const CRIATIVOS_KEYS = ["mkt-criativos-resumo", "mkt-criativos"];
export const SCREEN_PERSISTED_KEYS = [...SE_VIEW_KEYS, "se-rubrica", ...CRIATIVOS_KEYS];
export const SE_STALE_TIME = 5 * 60_000;
