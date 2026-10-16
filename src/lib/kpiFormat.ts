const toN = (v: any) => (v == null || !isFinite(Number(v)) ? null : Number(v));

export const brlFull = (v: any) => {
  const x = toN(v);
  return x == null ? "—" : x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};
export const numFull = (v: any) => {
  const x = toN(v);
  return x == null ? "—" : x.toLocaleString("pt-BR");
};
const compact = (x: number) => {
  const a = Math.abs(x);
  if (a >= 1e9) return `${(x / 1e9).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bi`;
  if (a >= 1e6) return `${(x / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
  return `${(x / 1e3).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`;
};
/** Compacto acima de 10 mil: "R$ 13,0 mil" */
export const brlKpi = (v: any) => {
  const x = toN(v);
  if (x == null) return "—";
  return Math.abs(x) >= 10000 ? `R$ ${compact(x)}` : brlFull(x);
};
/** Compacto acima de 10 mil: "235,7 mil" */
export const numKpi = (v: any) => {
  const x = toN(v);
  if (x == null) return "—";
  return Math.abs(x) >= 10000 ? compact(x) : numFull(x);
};
export const KPI_VALUE_STYLE = { fontSize: "clamp(20px, 1.6vw, 30px)" } as const;
export const KPI_VALUE_CLASS = "whitespace-nowrap tabular-nums leading-tight";
