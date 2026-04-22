import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/data/marketingData";
import type { CloserBreakdown } from "@/hooks/useMarketingLive";

interface CommercialCloserTableProps {
  porCloser: CloserBreakdown[];
  investimento: number;
  totalReunioes: number;
}

/**
 * Tabela detalhada de performance por closer.
 * O investimento total do Meta Ads é distribuído proporcionalmente ao número
 * de reuniões realizadas de cada closer.
 */
export function CommercialCloserTable({
  porCloser,
  investimento,
  totalReunioes,
}: CommercialCloserTableProps) {
  const rows = useMemo(() => {
    return porCloser.map((c) => {
      const share = totalReunioes > 0 ? c.reunioes / totalReunioes : 0;
      const investimentoProporcional = investimento * share;
      const custoReuniao =
        c.reunioes > 0 ? investimentoProporcional / c.reunioes : 0;
      const ticketMedio = c.vendas > 0 ? c.faturamento / c.vendas : 0;
      const taxaConversao =
        c.reunioes > 0 ? (c.vendas / c.reunioes) * 100 : 0;
      return {
        ...c,
        ticketMedio,
        taxaConversao,
        investimentoProporcional,
        custoReuniao,
      };
    });
  }, [porCloser, investimento, totalReunioes]);

  const totals = useMemo(() => {
    const vendas = rows.reduce((s, r) => s + r.vendas, 0);
    const faturamento = rows.reduce((s, r) => s + r.faturamento, 0);
    const reunioes = rows.reduce((s, r) => s + r.reunioes, 0);
    const investimentoProporcional = rows.reduce(
      (s, r) => s + r.investimentoProporcional,
      0,
    );
    return {
      vendas,
      faturamento,
      reunioes,
      ticketMedio: vendas > 0 ? faturamento / vendas : 0,
      taxaConversao: reunioes > 0 ? (vendas / reunioes) * 100 : 0,
      investimentoProporcional,
      custoReuniao: reunioes > 0 ? investimentoProporcional / reunioes : 0,
    };
  }, [rows]);

  return (
    <Card className="p-3 sm:p-6">
      <div className="mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-foreground">
          Performance por Closer
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          O investimento é distribuído proporcionalmente às reuniões realizadas
          de cada closer.
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Closer</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
              <TableHead className="text-right">Reuniões</TableHead>
              <TableHead className="text-right">Ticket Médio</TableHead>
              <TableHead className="text-right">Conv. (%)</TableHead>
              <TableHead className="text-right">Invest. Prop.</TableHead>
              <TableHead className="text-right">Custo/Reunião</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  Sem dados de closers para o período.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.closer}>
                  <TableCell className="font-medium">{r.closer}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.vendas}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(r.faturamento)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.reunioes}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(r.ticketMedio)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.taxaConversao.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(r.investimentoProporcional)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.custoReuniao > 0 ? formatCurrency(r.custoReuniao) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {rows.length > 0 && (
            <tfoot>
              <TableRow className="border-t-2 font-semibold bg-muted/30">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">
                  {totals.vendas}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(totals.faturamento)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totals.reunioes}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(totals.ticketMedio)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totals.taxaConversao.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(totals.investimentoProporcional)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totals.custoReuniao > 0
                    ? formatCurrency(totals.custoReuniao)
                    : "—"}
                </TableCell>
              </TableRow>
            </tfoot>
          )}
        </Table>
      </div>
    </Card>
  );
}
