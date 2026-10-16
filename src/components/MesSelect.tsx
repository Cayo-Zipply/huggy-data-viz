interface MesSelectProps {
  value: Date;
  months: Date[];
  onChange: (month: Date) => void;
  className?: string;
}

export const formatMesLabel = (d: Date) =>
  d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

/** Mês vigente (1º dia) no fuso America/Sao_Paulo. */
export function currentMonthSP(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const y = Number(parts.find(p => p.type === "year")?.value);
  const m = Number(parts.find(p => p.type === "month")?.value);
  return new Date(y, m - 1, 1);
}

export function MesSelect({ value, months, onChange, className }: MesSelectProps) {
  const key = value.toISOString();
  const list = months.some(m => m.toISOString() === key) ? months : [value, ...months];
  return (
    <select
      value={key}
      onChange={e => onChange(new Date(e.target.value))}
      className={className ?? "text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"}
    >
      {list.map(m => (
        <option key={m.toISOString()} value={m.toISOString()}>{formatMesLabel(m)}</option>
      ))}
    </select>
  );
}
