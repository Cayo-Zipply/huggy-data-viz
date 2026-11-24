export const TZ = "America/Sao_Paulo";
export const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const HORAS: string[] = (() => {
  const out: string[] = [];
  for (let m = 6 * 60; m <= 23 * 60 + 30; m += 30)
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return out;
})();

export const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "");

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo. */
export function hojeSP(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diaSemana(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

/** "Sáb 28/11" */
export function rotuloData(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${DIAS_CURTO[diaSemana(iso)]} ${d}/${m}`;
}

/** Fim precisa ser depois do início. */
export const intervaloValido = (inicio: string, fim: string) => !!inicio && !!fim && fim > inicio;

/** Última reunião começa 1h antes do fim. */
export function ultimaReuniao(fim: string): string {
  if (!fim) return "";
  const [h, m] = fim.split(":").map(Number);
  const t = h * 60 + m - 60;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Chave da semana (segunda-feira em SP) para o pop-up semanal. */
export function segundaDaSemana(iso: string): string {
  const dow = diaSemana(iso);
  return addDias(iso, -((dow + 6) % 7));
}
