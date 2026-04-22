import { User, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/data/marketingData";
import type { CloserBreakdown, MetaCloser } from "@/hooks/useMarketingLive";

interface Props {
  porCloser: CloserBreakdown[];
  metasCloser: MetaCloser[];
  monthLabel: string;
  selectedMonth: string; // "YYYY-MM"
  totalVendas: number;
  totalFaturamento: number;
  totalReunioesRealizadas: number;
  investimento: number;
}

// ────────────────── Helpers de dias úteis ──────────────────

function diasUteisDoMes(year: number, month: number): number {
  const dias = new Date(year, month, 0).getDate();
  let n = 0;
  for (let d = 1; d <= dias; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

function diasUteisAteHoje(year: number, month: number): number {
  const hoje = new Date();
  const ultimoDia = new Date(year, month, 0).getDate();
  const limite =
    year === hoje.getFullYear() && month === hoje.getMonth() + 1
      ? hoje.getDate()
      : ultimoDia;
  let n = 0;
  for (let d = 1; d <= limite; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

function normalize(name: string): string {
  return (name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findMeta(metas: MetaCloser[], closer: string): MetaCloser | undefined {
  const target = normalize(closer);
  if (!target) return undefined;
  let m = metas.find((x) => normalize(x.closer) === target);
  if (m) return m;
  const first = target.split(" ")[0];
  m = metas.find((x) => normalize(x.closer).split(" ")[0] === first);
  return m;
}

// ────────────────── Sub-componente: barra de métrica ──────────────────

interface MetricaFarolProps {
  label: string;
  realizado: number;
  meta: number;
  projecao: number;
  isCurrency?: boolean;
  isPercent?: boolean;
}

function fmt(v: number, isCurrency?: boolean, isPercent?: boolean): string {
  if (isCurrency) return formatCurrency(v);
  if (isPercent) return `${v.toFixed(1)}%`;
  return String(Math.round(v));
}

function MetricaFarol({ label, realizado, meta, projecao, isCurrency, isPercent }: MetricaFarolProps) {
  const progresso = meta > 0 ? (realizado / meta) * 100 : 0;
  const projDiff = projecao - meta;
  const acima = projDiff >= 0;

  const barColor =
    progresso >= 100
      ? "[&>div]:bg-emerald-500"
      : progresso >= 60
      ? "[&>div]:bg-primary"
      : "[&>div]:bg-amber-500";

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {fmt(realizado, isCurrency, isPercent)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={Math.min(progresso, 100)} className={"h-2 flex-1 " + barColor} />
        <span className="text-[11px] text-muted-foreground tabular-nums min-w-[60px] text-right">
          {meta > 0 ? `Meta: ${fmt(meta, isCurrency, isPercent)}` : "—"}
        </span>
      </div>
      {meta > 0 && (
        <div className="flex items-center gap-1 mt-1.5">
          {acima ? (
            <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-500" />
          )}
          <span
            className={
              "text-[11px] " +
              (acima ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")
            }
          >
            Projeção: {fmt(projecao, isCurrency, isPercent)} ·{" "}
            {fmt(Math.abs(projDiff), isCurrency, isPercent)}{" "}
            {acima ? "acima" : "abaixo"} da meta
          </span>
        </div>
      )}
    </div>
  );
}

// ────────────────── Card por closer ──────────────────

interface FarolCardProps {
  c: CloserBreakdown;
  meta?: MetaCloser;
  totalDU: number;
  duAteHoje: number;
}

function FarolCloserCard({ c, meta, totalDU, duAteHoje }: FarolCardProps) {
  const metaFat = Number(meta?.meta_faturamento ?? 0);
  const metaRR = Number(meta?.meta_reunioes_realizadas ?? 0);
  const metaRM = Number(meta?.meta_reunioes_marcadas ?? 0);
  const metaConv = Number(meta?.meta_conversao ?? 0);

  // Projeções por pace de dias úteis
  const proj = (real: number) =>
    duAteHoje > 0 ? (real / duAteHoje) * totalDU : 0;

  const projFat = proj(c.faturamento);
  const projRR = proj(c.reunioesRealizadas);
  const projRM = proj(c.reunioesMarcadas);

  const conversaoAtual = c.reunioesRealizadas > 0 ? (c.vendas / c.reunioesRealizadas) * 100 : 0;
  const projConversao = projRR > 0
    ? ((proj(c.vendas)) / projRR) * 100
    : conversaoAtual;

  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <h4 className="font-semibold text-base text-foreground truncate">{c.closer}</h4>
        </div>
        <span className="text-[11px] text-muted-foreground bg-muted px-2 py-1 rounded-full whitespace-nowrap">
          {duAteHoje}/{totalDU} dias úteis
        </span>
      </div>

      {/* Métricas Farol */}
      <div className="space-y-4">
        <MetricaFarol
          label="Reuniões Marcadas"
          realizado={c.reunioesMarcadas}
          meta={metaRM}
          projecao={projRM}
        />
        <MetricaFarol
          label="Reuniões Realizadas"
          realizado={c.reunioesRealizadas}
          meta={metaRR}
          projecao={projRR}
        />
        <MetricaFarol
          label="Faturamento"
          realizado={c.faturamento}
          meta={metaFat}
          projecao={projFat}
          isCurrency
        />
        <MetricaFarol
          label="Conversão"
          realizado={conversaoAtual}
          meta={metaConv}
          projecao={projConversao}
          isPercent
        />
      </div>
    </Card>
  );
}

// ────────────────── Grade principal ──────────────────

export function FarolCloserCards({
  porCloser,
  metasCloser,
  monthLabel,
  selectedMonth,
  totalVendas,
  totalFaturamento,
  totalReunioesRealizadas,
  investimento,
}: Props) {
  const [yStr, mStr] = selectedMonth.split("-");
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const totalDU = diasUteisDoMes(year, month);
  const duAteHoje = diasUteisAteHoje(year, month);

  const ticketMedio = totalVendas > 0 ? totalFaturamento / totalVendas : 0;
  const metaTotal = metasCloser.reduce(
    (s, m) => s + Number(m.meta_faturamento ?? 0),
    0,
  );
  const metaTotalAteHoje = totalDU > 0 ? (metaTotal / totalDU) * duAteHoje : 0;
  const pctPaceGeral = metaTotalAteHoje > 0 ? (totalFaturamento / metaTotalAteHoje) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Resumo do time */}
      <Card className="p-5 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-semibold text-base capitalize">
            Farol — {monthLabel}
          </h3>
          <span className="text-xs text-muted-foreground">
            Meta total: {formatCurrency(metaTotal)}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Vendas</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{totalVendas}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Faturamento</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{formatCurrency(totalFaturamento)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ticket Médio</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{formatCurrency(ticketMedio)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Reuniões Realizadas</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{totalReunioesRealizadas}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">% Pace Geral</p>
            <p
              className={
                "text-2xl font-bold mt-1 tabular-nums " +
                (pctPaceGeral >= 100
                  ? "text-emerald-600 dark:text-emerald-400"
                  : pctPaceGeral >= 60
                  ? "text-foreground"
                  : "text-red-500")
              }
            >
              {metaTotalAteHoje > 0 ? `${pctPaceGeral.toFixed(0)}%` : "—"}
            </p>
          </div>
        </div>
      </Card>

      {/* Título da grade */}
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-foreground">Farol por Closer</h3>
        <span className="text-xs text-muted-foreground">
          {porCloser.length} closer(s) · {duAteHoje} de {totalDU} dias úteis
        </span>
      </div>

      {porCloser.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          Sem dados de closer no período.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {porCloser.map((c) => (
            <FarolCloserCard
              key={c.closer}
              c={c}
              meta={findMeta(metasCloser, c.closer)}
              totalDU={totalDU}
              duAteHoje={duAteHoje}
            />
          ))}
        </div>
      )}
    </div>
  );
}
