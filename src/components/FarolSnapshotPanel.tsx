import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatBRL } from "./pipeline/types";
import { supabaseExt as supabase } from "@/lib/supabaseExternal";

/** Antes disso não há histórico de etapas para reconstruir. */
export const SNAPSHOT_MIN_DATE = new Date(2026, 2, 28); // 28/03/2026

export function isSameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  );
}

/** true quando a data escolhida é passada ou hoje (dispara a fotografia). */
export function isSnapshotDate(d: Date) {
  const today = new Date();
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const tt = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return dd.getTime() <= tt.getTime();
}

function fmtISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtBR(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ───────────────────────── Date picker com popover ─────────────────────────

export function FarolDatePicker({
  value,
  onChange,
  maxDate,
}: {
  value: Date;
  onChange: (d: Date) => void;
  maxDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const ontem = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const fimMes = new Date(value.getFullYear(), value.getMonth() + 1, 0);

  const pick = (d: Date) => {
    onChange(d);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <CalendarDays className="w-3.5 h-3.5 text-primary" />
      <span className="uppercase tracking-wider text-muted-foreground hidden sm:inline">Projeção até</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs font-normal tabular-nums">
            {fmtBR(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={value}
            month={value}
            onSelect={(d) => d && pick(d)}
            disabled={(d) =>
              d < SNAPSHOT_MIN_DATE || (maxDate ? d > maxDate : false)
            }
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
          <div className="flex items-center gap-2 border-t border-border p-2">
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => pick(ontem)}>
              Ontem
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => pick(new Date())}>
              Hoje
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => pick(fimMes)}>
              Fim do mês
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ───────────────────────── Fotografia do dia ─────────────────────────

interface SnapRow {
  closer: string;
  reunioes_realizadas: number;
  contratos: number;
  faturamento: number;
  ticket_medio: number;
  conversao: number;
  meta_reunioes: number;
  meta_contratos: number;
  meta_faturamento: number;
  meta_conversao: number;
  meta_ticket_medio: number;
  dias_uteis_decorridos: number;
  dias_uteis_mes: number;
  meta_reunioes_ate: number;
  meta_contratos_ate: number;
  meta_faturamento_ate: number;
}

type Modo = "acumulado" | "dia";

function n(v: unknown) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function MetaCompare({ real, meta, format }: { real: number; meta: number; format: (v: number) => string }) {
  if (meta <= 0) return <p className="text-[11px] text-muted-foreground mt-1">sem meta cadastrada</p>;
  const pct = (real / meta) * 100;
  const color = pct >= 100 ? "text-emerald-600 dark:text-emerald-400" : pct >= 80 ? "text-amber-600 dark:text-amber-400" : "text-red-500";
  return (
    <p className={cn("text-[11px] mt-1", color)}>
      {format(real)} de {format(meta)} esperados até aqui
    </p>
  );
}

function SnapCard({
  title,
  value,
  children,
}: {
  title: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="text-xl font-semibold text-foreground mt-1 tabular-nums">{value}</p>
      {children}
    </div>
  );
}

export function FarolSnapshotPanel({ data }: { data: Date }) {
  const [modo, setModo] = useState<Modo>("acumulado");
  const [rows, setRows] = useState<SnapRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const iso = fmtISO(data);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data: res, error } = await (supabase as any).rpc("farol_snapshot_dia", {
        p_data: iso,
        p_modo: modo,
      });
      if (cancelled) return;
      if (error) {
        console.error("[Farol] farol_snapshot_dia RPC error:", error);
        setRows([]);
      } else {
        setRows(Array.isArray(res) ? res : []);
      }
      setLoading(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [iso, modo]);

  const totals = useMemo(() => {
    const list = rows ?? [];
    const reunioes = list.reduce((s, r) => s + n(r.reunioes_realizadas), 0);
    const contratos = list.reduce((s, r) => s + n(r.contratos), 0);
    const faturamento = list.reduce((s, r) => s + n(r.faturamento), 0);
    return {
      reunioes,
      contratos,
      faturamento,
      ticket: contratos > 0 ? faturamento / contratos : 0,
      conversao: reunioes > 0 ? (contratos / reunioes) * 100 : 0,
      metaReunioesAte: list.reduce((s, r) => s + n(r.meta_reunioes_ate), 0),
      metaContratosAte: list.reduce((s, r) => s + n(r.meta_contratos_ate), 0),
      metaFaturamentoAte: list.reduce((s, r) => s + n(r.meta_faturamento_ate), 0),
    };
  }, [rows]);

  const semMovimento =
    !loading && totals.reunioes === 0 && totals.contratos === 0 && totals.faturamento === 0;
  const acumulado = modo === "acumulado";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-foreground">Fotografia de {fmtBR(data)}</h2>
        <div className="inline-flex rounded-lg border border-border overflow-hidden text-xs">
          <button
            onClick={() => setModo("acumulado")}
            className={cn("px-3 py-1.5", acumulado ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}
          >
            Acumulado do mês
          </button>
          <button
            onClick={() => setModo("dia")}
            className={cn("px-3 py-1.5", !acumulado ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}
          >
            Só este dia
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[86px] rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <SnapCard title="Reuniões realizadas" value={String(totals.reunioes)}>
              {acumulado && (
                <MetaCompare real={totals.reunioes} meta={totals.metaReunioesAte} format={(v) => String(Math.round(v))} />
              )}
            </SnapCard>
            <SnapCard title="Contratos" value={String(totals.contratos)}>
              {acumulado && (
                <MetaCompare real={totals.contratos} meta={totals.metaContratosAte} format={(v) => String(Math.round(v))} />
              )}
            </SnapCard>
            <SnapCard title="Faturamento" value={formatBRL(totals.faturamento)}>
              {acumulado && (
                <MetaCompare real={totals.faturamento} meta={totals.metaFaturamentoAte} format={formatBRL} />
              )}
            </SnapCard>
            <SnapCard title="Ticket médio" value={formatBRL(totals.ticket)} />
            <SnapCard title="Conversão" value={`${totals.conversao.toFixed(1)}%`} />
          </div>

          {semMovimento && (
            <p className="text-xs text-muted-foreground">Nenhum movimento neste dia</p>
          )}

          {(rows?.length ?? 0) > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Closer</TableHead>
                    <TableHead className="text-right">Reuniões</TableHead>
                    <TableHead className="text-right">Contratos</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Ticket médio</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                    {acumulado && <TableHead className="text-right">Meta até aqui</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(rows ?? []).map((r) => (
                    <TableRow key={r.closer}>
                      <TableCell className="font-medium">{r.closer}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(r.reunioes_realizadas)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(r.contratos)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(n(r.faturamento))}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(n(r.ticket_medio))}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(r.conversao).toFixed(1)}%</TableCell>
                      {acumulado && (
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatBRL(n(r.meta_faturamento_ate))}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
