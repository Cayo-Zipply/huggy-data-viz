import { useMemo, useState } from "react";
import type { PipelineCard, PipelineGoal } from "./pipeline/types";
import { formatBRL, getBusinessDays, getBusinessDaysPassed, cardsReachedStage } from "./pipeline/types";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Props {
  cards: PipelineCard[];
  goals: PipelineGoal[];
  owners: string[];
}

function Semaphore({ pct }: { pct: number }) {
  const color = pct >= 110 ? "bg-green-500" : pct >= 90 ? "bg-yellow-500" : "bg-red-500";
  return <span className={cn("inline-block w-3 h-3 rounded-full", color)} />;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function FarolPanel({ cards, goals, owners }: Props) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));

  const monthKey = getMonthKey(selectedMonth);
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const totalBD = getBusinessDays(year, month);
  const passedBD = getBusinessDaysPassed(year, month, now);
  const ratio = passedBD > 0 ? totalBD / passedBD : 1;

  // Available months
  const months = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 6; i >= -1; i--) {
      arr.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    }
    return arr;
  }, []);

  // Cards created in selected month
  const monthCards = useMemo(() => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);
    return cards.filter(c => {
      const d = new Date(c.created_at);
      return d >= start && d <= end;
    });
  }, [cards, year, month]);

  // All cards (lifetime) for stage checks
  const closers = owners.filter(o => o && o !== "SDR");
  const sdrs = owners.filter(o => o === "SDR" || o === "Cayo");

  // INBOUND data (closers)
  const inboundData = useMemo(() => {
    return closers.map(closer => {
      const closerCards = monthCards.filter(c => c.owner === closer);
      const ganhos = closerCards.filter(c => c.lead_status === "ganho");
      const vendas = ganhos.length;
      const realizado = ganhos.reduce((s, c) => s + (c.deal_value || 0), 0);
      const goal = goals.find(g => g.closer === closer && g.month === monthKey);
      const meta = goal?.faturamento_meta || 0;
      const projecao = passedBD > 0 ? Math.round(realizado * ratio) : 0;
      const falta = vendas > 0 ? Math.max(0, Math.ceil((meta - realizado) / (realizado / vendas))) : 0;
      const diferenca = projecao - meta;
      const pctMeta = meta > 0 ? Math.round((projecao / meta) * 100) : 0;

      const reunioesRealizadas = closerCards.filter(c =>
        c.stage === "reuniao_realizada" || c.stage === "link_enviado" || c.stage === "contrato_assinado" ||
        c.history.some(h => h.to === "reuniao_realizada")
      ).length;
      const conv = reunioesRealizadas > 0 ? Math.round((vendas / reunioesRealizadas) * 100) : 0;
      const ticket = vendas > 0 ? realizado / vendas : 0;

      return { closer, vendas, realizado, meta, projecao, falta, diferenca, projFat: projecao, pctMeta, conv, ticket };
    });
  }, [closers, monthCards, goals, monthKey, passedBD, ratio]);

  const inboundTotal = useMemo(() => {
    const vendas = inboundData.reduce((s, d) => s + d.vendas, 0);
    const realizado = inboundData.reduce((s, d) => s + d.realizado, 0);
    const meta = inboundData.reduce((s, d) => s + d.meta, 0);
    const projecao = inboundData.reduce((s, d) => s + d.projecao, 0);
    const falta = inboundData.reduce((s, d) => s + d.falta, 0);
    const diferenca = projecao - meta;
    const pctMeta = meta > 0 ? Math.round((projecao / meta) * 100) : 0;
    const reunioesRealizadas = monthCards.filter(c =>
      closers.includes(c.owner || "") && (
        c.stage === "reuniao_realizada" || c.stage === "link_enviado" || c.stage === "contrato_assinado" ||
        c.history.some(h => h.to === "reuniao_realizada")
      )
    ).length;
    const conv = reunioesRealizadas > 0 ? Math.round((vendas / reunioesRealizadas) * 100) : 0;
    const ticket = vendas > 0 ? realizado / vendas : 0;
    return { vendas, realizado, meta, projecao, falta, diferenca, projFat: projecao, pctMeta, conv, ticket };
  }, [inboundData, monthCards, closers]);

  // PRE-VENDAS data (SDR)
  const preVendasData = useMemo(() => {
    const sdrNames = [...new Set(monthCards.filter(c => c.pipe === "sdr").map(c => c.owner).filter(Boolean))] as string[];
    if (sdrNames.length === 0) sdrNames.push("SDR");

    return sdrNames.map(sdr => {
      const sdrCards = monthCards.filter(c => c.owner === sdr || (sdr === "SDR" && c.pipe === "sdr"));
      const reunioesMarcadas = sdrCards.filter(c =>
        c.stage === "reuniao_marcada" || c.history.some(h => h.to === "reuniao_marcada")
      ).length;
      const reunioesRealizadas = sdrCards.filter(c =>
        c.history.some(h => h.to === "reuniao_realizada" || h.to === "reuniao_agendada")
      ).length;
      const goal = goals.find(g => g.closer === sdr && g.month === monthKey);
      const meta = goal?.reunioes_marcadas_meta || 0;
      const projecao = passedBD > 0 ? Math.round(reunioesMarcadas * ratio) : 0;
      const falta = projecao - reunioesMarcadas;
      const projetado = passedBD > 0 ? Math.round(reunioesRealizadas * ratio) : 0;
      const pctMeta = meta > 0 ? Math.round((projecao / meta) * 100) : 0;
      const conv = reunioesMarcadas > 0 ? Math.round((reunioesRealizadas / reunioesMarcadas) * 100) : 0;
      const noShows = sdrCards.filter(c =>
        c.stage === "no_show" || c.history.some(h => h.to === "no_show")
      ).length;

      return { sdr, reunioesMarcadas, reunioesRealizadas, meta, projecao, falta, projetado, pctMeta, conv, noShows };
    });
  }, [monthCards, goals, monthKey, passedBD, ratio]);

  const preVendasTotal = useMemo(() => {
    const rm = preVendasData.reduce((s, d) => s + d.reunioesMarcadas, 0);
    const rr = preVendasData.reduce((s, d) => s + d.reunioesRealizadas, 0);
    const meta = preVendasData.reduce((s, d) => s + d.meta, 0);
    const projecao = preVendasData.reduce((s, d) => s + d.projecao, 0);
    const falta = preVendasData.reduce((s, d) => s + d.falta, 0);
    const projetado = preVendasData.reduce((s, d) => s + d.projetado, 0);
    const pctMeta = meta > 0 ? Math.round((projecao / meta) * 100) : 0;
    const conv = rm > 0 ? Math.round((rr / rm) * 100) : 0;
    const noShows = preVendasData.reduce((s, d) => s + d.noShows, 0);
    const taxaShow = rm > 0 ? ((rr / rm) * 100).toFixed(1) : "0";
    return { rm, rr, meta, projecao, falta, projetado, pctMeta, conv, noShows, taxaShow };
  }, [preVendasData]);

  const monthLabel = selectedMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">🚦 Farol de Metas</h1>
          <p className="text-xs text-muted-foreground capitalize">{monthLabel} — {passedBD}/{totalBD} dias úteis</p>
        </div>
        <select
          value={selectedMonth.toISOString()}
          onChange={e => setSelectedMonth(new Date(e.target.value))}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
        >
          {months.map(m => (
            <option key={m.toISOString()} value={m.toISOString()}>
              {m.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </option>
          ))}
        </select>
      </div>

      {/* INBOUND */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-primary/5">
          <h2 className="text-sm font-bold text-foreground">📞 INBOUND (Closers)</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px]">Closer</TableHead>
              <TableHead className="text-[10px] text-center">Vendas</TableHead>
              <TableHead className="text-[10px] text-right">Realizado</TableHead>
              <TableHead className="text-[10px] text-right">Meta</TableHead>
              <TableHead className="text-[10px] text-right">Projeção</TableHead>
              <TableHead className="text-[10px] text-center">Falta</TableHead>
              <TableHead className="text-[10px] text-right">Diferença</TableHead>
              <TableHead className="text-[10px] text-center">%Meta</TableHead>
              <TableHead className="text-[10px] text-center">Conv%</TableHead>
              <TableHead className="text-[10px] text-right">Ticket Médio</TableHead>
              <TableHead className="text-[10px] text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inboundData.map(d => (
              <TableRow key={d.closer}>
                <TableCell className="text-xs font-medium">{d.closer}</TableCell>
                <TableCell className="text-xs text-center">{d.vendas}</TableCell>
                <TableCell className="text-xs text-right">{formatBRL(d.realizado)}</TableCell>
                <TableCell className="text-xs text-right">{formatBRL(d.meta)}</TableCell>
                <TableCell className="text-xs text-right">{formatBRL(d.projecao)}</TableCell>
                <TableCell className="text-xs text-center">{d.falta}</TableCell>
                <TableCell className={cn("text-xs text-right", d.diferenca >= 0 ? "text-green-400" : "text-red-400")}>
                  {formatBRL(d.diferenca)}
                </TableCell>
                <TableCell className="text-xs text-center">{d.pctMeta}%</TableCell>
                <TableCell className="text-xs text-center">{d.conv}%</TableCell>
                <TableCell className="text-xs text-right">{formatBRL(d.ticket)}</TableCell>
                <TableCell className="text-center"><Semaphore pct={d.pctMeta} /></TableCell>
              </TableRow>
            ))}
            {/* Total row */}
            <TableRow className="bg-muted/30 font-bold">
              <TableCell className="text-xs font-bold">Total</TableCell>
              <TableCell className="text-xs text-center font-bold">{inboundTotal.vendas}</TableCell>
              <TableCell className="text-xs text-right font-bold">{formatBRL(inboundTotal.realizado)}</TableCell>
              <TableCell className="text-xs text-right font-bold">{formatBRL(inboundTotal.meta)}</TableCell>
              <TableCell className="text-xs text-right font-bold">{formatBRL(inboundTotal.projecao)}</TableCell>
              <TableCell className="text-xs text-center font-bold">{inboundTotal.falta}</TableCell>
              <TableCell className={cn("text-xs text-right font-bold", inboundTotal.diferenca >= 0 ? "text-green-400" : "text-red-400")}>
                {formatBRL(inboundTotal.diferenca)}
              </TableCell>
              <TableCell className="text-xs text-center font-bold">{inboundTotal.pctMeta}%</TableCell>
              <TableCell className="text-xs text-center font-bold">{inboundTotal.conv}%</TableCell>
              <TableCell className="text-xs text-right font-bold">{formatBRL(inboundTotal.ticket)}</TableCell>
              <TableCell className="text-center"><Semaphore pct={inboundTotal.pctMeta} /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* PRE-VENDAS */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-blue-500/5">
          <h2 className="text-sm font-bold text-foreground">🎯 PRÉ-VENDAS (SDR)</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px]">SDR</TableHead>
              <TableHead className="text-[10px] text-center">Reuniões</TableHead>
              <TableHead className="text-[10px] text-center">Realizadas</TableHead>
              <TableHead className="text-[10px] text-center">Meta</TableHead>
              <TableHead className="text-[10px] text-center">Projeção</TableHead>
              <TableHead className="text-[10px] text-center">Falta</TableHead>
              <TableHead className="text-[10px] text-center">Projetado</TableHead>
              <TableHead className="text-[10px] text-center">%Meta</TableHead>
              <TableHead className="text-[10px] text-center">Conv%</TableHead>
              <TableHead className="text-[10px] text-center">No Shows</TableHead>
              <TableHead className="text-[10px] text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preVendasData.map(d => (
              <TableRow key={d.sdr}>
                <TableCell className="text-xs font-medium">{d.sdr}</TableCell>
                <TableCell className="text-xs text-center">{d.reunioesMarcadas}</TableCell>
                <TableCell className="text-xs text-center">{d.reunioesRealizadas}</TableCell>
                <TableCell className="text-xs text-center">{d.meta}</TableCell>
                <TableCell className="text-xs text-center">{d.projecao}</TableCell>
                <TableCell className="text-xs text-center">{d.falta}</TableCell>
                <TableCell className="text-xs text-center">{d.projetado}</TableCell>
                <TableCell className="text-xs text-center">{d.pctMeta}%</TableCell>
                <TableCell className="text-xs text-center">{d.conv}%</TableCell>
                <TableCell className="text-xs text-center">{d.noShows}</TableCell>
                <TableCell className="text-center"><Semaphore pct={d.pctMeta} /></TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/30 font-bold">
              <TableCell className="text-xs font-bold">Total</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.rm}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.rr}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.meta}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.projecao}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.falta}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.projetado}</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.pctMeta}%</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.conv}%</TableCell>
              <TableCell className="text-xs text-center font-bold">{preVendasTotal.noShows}</TableCell>
              <TableCell className="text-center"><Semaphore pct={preVendasTotal.pctMeta} /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="px-4 py-2 border-t border-border flex gap-6 text-xs text-muted-foreground">
          <span>Taxa de Show: <strong className="text-foreground">{preVendasTotal.taxaShow}%</strong></span>
        </div>
      </div>
    </div>
  );
}
