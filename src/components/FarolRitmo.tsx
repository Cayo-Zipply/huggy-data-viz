import type { ReactNode } from "react";
import { PersonAvatar } from "@/components/PersonAvatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const FAROL_COLORS = {
  gold: "#C8B28A",
  green: "#4ADE80",
  yellow: "#FBBF24",
  red: "#F87171",
};

export type FarolMode = "current" | "past" | "week";

export function statusColor(pct: number) {
  if (pct >= 100) return FAROL_COLORS.green;
  if (pct >= 85) return FAROL_COLORS.yellow;
  return FAROL_COLORS.red;
}

const fmtInt = (v: number) => Math.round(v).toLocaleString("pt-BR");
export const fmtBRL0 = (v: number) => `R$ ${fmtInt(v)}`;

function Pill({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium tabular-nums"
      style={color ? { backgroundColor: color, color: "#0B0B0B" } : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
    >
      {children}
    </span>
  );
}

interface BarProps {
  realizado: number;
  meta: number;
  fatorPace: number;
  mode: FarolMode;
  showLabel?: boolean;
  tooltip: ReactNode;
}

export function RitmoBar({ realizado, meta, fatorPace, mode, showLabel, tooltip }: BarProps) {
  const pct = meta > 0 ? Math.min(100, (realizado / meta) * 100) : realizado > 0 ? 100 : 0;
  const showTick = meta > 0 && mode !== "week";
  const tick = mode === "past" ? 100 : Math.min(100, fatorPace * 100);
  const showRed = showTick && mode === "current" && pct < tick;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative pt-1 pb-1 cursor-default">
          <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
            {showRed && (
              <div className="absolute inset-y-0 rounded-r-full" style={{ left: `${pct}%`, width: `${tick - pct}%`, backgroundColor: "rgba(248,113,113,0.55)" }} />
            )}
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, backgroundColor: FAROL_COLORS.green }} />
          </div>
          {showTick && (
            <div className="absolute top-0 h-4 w-[3px] -translate-x-1/2 rounded" style={{ left: `${tick}%`, backgroundColor: FAROL_COLORS.gold }} />
          )}
          {showTick && showLabel && (
            <span className="absolute top-5 -translate-x-1/2 text-[11px] whitespace-nowrap" style={{ left: `${tick}%`, color: FAROL_COLORS.gold }}>
              ritmo hoje
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent className="text-xs space-y-0.5">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export interface RitmoInfo {
  realizado: number;
  meta: number;
  projecao: number;
  fatorPace: number;
  mode: FarolMode;
  passedBD: number;
  totalBD: number;
  fmt: (v: number) => string;
}

function tooltipFor(i: RitmoInfo) {
  return (
    <>
      <div>Realizado: {i.fmt(i.realizado)}</div>
      <div>Meta até hoje: {i.fmt(i.meta * i.fatorPace)}</div>
      <div>Meta do mês: {i.fmt(i.meta)}</div>
      <div>Projeção: {i.fmt(i.projecao)}</div>
      <div>Dias úteis: {i.passedBD}/{i.totalBD}</div>
    </>
  );
}

function projText(i: RitmoInfo) {
  return i.meta > 0 ? `${i.fmt(i.projecao)} (${Math.round((i.projecao / i.meta) * 100)}%)` : i.fmt(i.projecao);
}

export function TeamCard({ title, subtitle, info, showLabel }: { title: string; subtitle: string; info: RitmoInfo; showLabel?: boolean }) {
  const pctProj = info.meta > 0 ? (info.projecao / info.meta) * 100 : 0;
  const pctReal = info.meta > 0 ? (info.realizado / info.meta) * 100 : 0;
  let pill: ReactNode = null;
  if (info.mode !== "week") {
    if (info.meta <= 0) pill = <Pill>Sem meta</Pill>;
    else if (info.mode === "past") pill = <Pill color={statusColor(pctReal)}>Fechou em {Math.round(pctReal)}%</Pill>;
    else {
      const c = statusColor(pctProj);
      pill = <Pill color={c}>{pctProj >= 100 ? "No ritmo" : pctProj >= 85 ? "Atenção" : "Fora do ritmo"}</Pill>;
    }
  }
  return (
    <div className="h-full flex flex-col justify-between rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-3xl font-bold tabular-nums text-foreground">{info.fmt(info.realizado)}</span>
        {info.meta > 0 && <span className="text-sm text-muted-foreground tabular-nums">de {info.fmt(info.meta)}</span>}
      </div>
      <div>
        <RitmoBar realizado={info.realizado} meta={info.meta} fatorPace={info.fatorPace} mode={info.mode} tooltip={tooltipFor(info)} />
        {info.meta > 0 && info.mode !== "week" && (
          <div className="flex justify-center gap-3 mt-1 text-xs tabular-nums">
            <span className="text-muted-foreground">{Math.round(pctReal)}% feito</span>
            <span className="text-muted-foreground">·</span>
            <span style={{ color: FAROL_COLORS.gold }}>ritmo {info.mode === "past" ? 100 : Math.round(info.fatorPace * 100)}%</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 min-h-[28px]">
        {info.mode !== "week" ? (
          <span className="text-sm text-foreground tabular-nums">Projeção: {projText(info)}</span>
        ) : <span />}
        {pill}
      </div>
      {info.mode === "current" && info.meta > 0 && (() => {
        const d = info.realizado - info.meta * info.fatorPace;
        return (
          <div className="text-right text-xs text-muted-foreground tabular-nums">
            {d >= 0 ? "+" : "−"}{info.fmt(Math.abs(d))} {d >= 0 ? "acima" : "abaixo"} do ritmo
          </div>
        );
      })()}
    </div>
  );
}

export function ReguaMes({ passedBD, totalBD, fatorPace }: { passedBD: number; totalBD: number; fatorPace: number }) {
  const pct = Math.min(100, fatorPace * 100);
  return (
    <div className="space-y-1.5">
      <div className="relative h-2 rounded-full bg-muted mt-5">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, backgroundColor: FAROL_COLORS.gold }} />
        <div className="absolute -top-1 h-4 w-[3px] -translate-x-1/2 rounded" style={{ left: `${pct}%`, backgroundColor: FAROL_COLORS.gold }} />
        <span
          className="absolute bottom-full mb-1 text-xs tabular-nums whitespace-nowrap"
          style={
            pct > 85 ? { right: 0, color: FAROL_COLORS.gold }
            : pct < 15 ? { left: 0, color: FAROL_COLORS.gold }
            : { left: `${pct}%`, transform: "translateX(-50%)", color: FAROL_COLORS.gold }
          }
        >{Math.round(pct)}%</span>
      </div>
      <div className="flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
        <span className="whitespace-nowrap">Dia útil {passedBD} de {totalBD}</span>
        <span className="whitespace-nowrap text-right">{(() => {
          const r = totalBD - passedBD;
          if (r < 0) return "Mês encerrado";
          if (r === 0) return "Último dia útil";
          if (r === 1) return "1 dia útil restante";
          return `${r} dias úteis restantes`;
        })()}</span>
      </div>
    </div>
  );
}

export function GargaloBanner({ titulo, texto, pctProj }: { titulo: string; texto: string; pctProj: number }) {
  const c = statusColor(pctProj);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-5" style={{ borderLeft: `4px solid ${c}` }}>
      <div>
        <h3 className="text-base font-semibold text-foreground">Gargalo do mês: {titulo}</h3>
        <p className="text-sm text-muted-foreground">{texto}</p>
      </div>
      <Pill color={c}>Projeção {Math.round(pctProj)}% da meta</Pill>
    </div>
  );
}

export function EficienciaCard({ conv, metaConv, ticket, metaTicket }: { conv: number; metaConv: number; ticket: number; metaTicket: number }) {
  const dConv = conv - metaConv;
  const dTk = ticket - metaTicket;
  const tone = (v: number) => ({ color: v >= 0 ? FAROL_COLORS.green : FAROL_COLORS.red });
  return (
    <div className="h-full flex flex-col rounded-xl border border-border bg-card divide-y divide-border">
      <div className="p-5 space-y-1 flex-1">
        <h3 className="text-base font-semibold text-foreground mb-2">Eficiência</h3>
        <div className="text-xs text-muted-foreground">Conversão</div>
        <div className="text-3xl font-bold tabular-nums text-foreground">{Math.round(conv)}%</div>
        {metaConv > 0 && (
          <div className="flex justify-between text-xs tabular-nums">
            <span className="text-muted-foreground">meta {Math.round(metaConv)}%</span>
            <span style={tone(dConv)}>{dConv >= 0 ? "+" : "−"}{Math.abs(Math.round(dConv))} p.p.</span>
          </div>
        )}
      </div>
      <div className="p-5 space-y-1 flex-1">
        <div className="text-xs text-muted-foreground">Ticket médio</div>
        <div className="text-2xl font-bold tabular-nums text-foreground">{fmtBRL0(ticket)}</div>
        {metaTicket > 0 && (
          <>
            <div className="text-xs text-muted-foreground tabular-nums">meta {fmtBRL0(metaTicket)}</div>
            <div className="text-xs tabular-nums" style={tone(dTk)}>{dTk >= 0 ? "+" : "−"}{fmtBRL0(Math.abs(dTk))}</div>
          </>
        )}
      </div>
    </div>
  );
}

export interface Stat { label: string; value: ReactNode }

export function RitmoRow({ name, header, info, unit, stats, onClickRealizado }: {
  name: string;
  header: ReactNode;
  info: RitmoInfo;
  unit?: "brl" | "int";
  stats: Stat[];
  onClickRealizado?: () => void;
}) {
  const metaAte = info.meta * info.fatorPace;
  const diff = info.realizado - metaAte;
  const pctProj = info.meta > 0 ? (info.projecao / info.meta) * 100 : 0;
  const pctReal = info.meta > 0 ? (info.realizado / info.meta) * 100 : 0;
  const fmtDiff = (v: number) => (unit === "brl" ? fmtBRL0(Math.abs(v)) : fmtInt(Math.abs(v)));
  let pill: ReactNode = null;
  if (info.mode !== "week") {
    if (info.meta <= 0) pill = <Pill>Sem meta</Pill>;
    else if (info.mode === "past") pill = <Pill color={statusColor(pctReal)}>Fechou em {Math.round(pctReal)}%</Pill>;
    else pill = (
      <Pill color={statusColor(pctProj)}>
        {diff < 0 ? `Atrás do ritmo · −${fmtDiff(diff)}` : `À frente · +${fmtDiff(diff)}`}
      </Pill>
    );
  }
  const allStats = info.mode === "week" ? stats : [{ label: "Projeção", value: projText(info) }, ...stats];
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-4 px-5 py-4">
      <div className="flex items-center gap-3 lg:w-44 shrink-0 min-w-0">
        <PersonAvatar name={name} className="h-10 w-10" />
        <span className="text-base font-medium text-foreground truncate">{name}</span>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="text-sm tabular-nums">
          {onClickRealizado ? (
            <button onClick={onClickRealizado} className="hover:underline">{header}</button>
          ) : header}
        </div>
        <RitmoBar realizado={info.realizado} meta={info.meta} fatorPace={info.fatorPace} mode={info.mode} tooltip={tooltipFor(info)} />
      </div>
      <div className="lg:w-56 shrink-0">{pill}</div>
      <div className={cn("grid gap-4 shrink-0", allStats.length >= 5 ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-3 sm:grid-cols-4")}>
        {allStats.map(s => (
          <div key={s.label} className="min-w-0">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-sm text-foreground tabular-nums whitespace-nowrap">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FarolLegend() {
  return (
    <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span><span style={{ color: FAROL_COLORS.green }}>●</span> verde ≥100% da meta projetada</span>
      <span><span style={{ color: FAROL_COLORS.yellow }}>●</span> amarelo 85–99%</span>
      <span><span style={{ color: FAROL_COLORS.red }}>●</span> vermelho &lt;85%</span>
      <span>| <span style={{ color: FAROL_COLORS.gold }}>tracinho dourado</span> = onde deveria estar hoje</span>
    </div>
  );
}
