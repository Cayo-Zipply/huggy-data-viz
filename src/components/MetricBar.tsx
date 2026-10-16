import { cn } from "@/lib/utils";

/** Cor contra a média da seleção: verde melhor, âmbar até 20% pior, vermelho >20% pior. */
export const metricSignal = (v: number | null | undefined, media: number, menorMelhor: boolean) => {
  if (v == null || !media) return "bg-mkt-muted/40";
  const pior = menorMelhor ? (v - media) / media : (media - v) / media;
  if (pior <= 0) return "bg-mkt-good";
  if (pior <= 0.2) return "bg-mkt-warn";
  return "bg-mkt-bad";
};

interface MetricBarProps {
  label: string;
  texto: string;
  valor: number | null | undefined;
  media: number;
  menorMelhor?: boolean;
  /** Largura em % (0–100). Se omitida, usa valor relativo a 2x a média. */
  width?: number;
  colorClass?: string;
  className?: string;
}

export function MetricBar({ label, texto, valor, media, menorMelhor = false, width, colorClass, className }: MetricBarProps) {
  const w = width ?? (valor == null || !media ? 0 : Math.min(100, (valor / (media * 2)) * 100));
  return (
    <div className={cn("flex items-center gap-2 text-[11px]", className)}>
      <span className="w-20 shrink-0 text-mkt-muted">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-mkt-track overflow-hidden">
        <div className={cn("h-full rounded-full", colorClass ?? metricSignal(valor, media, menorMelhor))} style={{ width: `${w}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right tabular-nums text-mkt-text">{texto}</span>
    </div>
  );
}
