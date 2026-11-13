import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
import { formatBRL } from "@/components/pipeline/types";
import { cn } from "@/lib/utils";

/** Linha retornada por `farol_faturamento_por_forma_pagamento`. */
export interface LinhaForma {
  forma_pagamento: string;
  qtd_vendas: number;
  valor_total: number;
}

const ROTULOS: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão de crédito",
  nao_informado: "Não informado",
};
const ORDEM: string[] = ["pix", "cartao", "nao_informado"];

/** Primeiro e último dia (YYYY-MM-DD) do mês 'YYYY-MM'. */
export function rangeDoMes(mes: string): { inicio: string; fim: string } {
  const [y, m] = mes.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    inicio: `${mes}-01`,
    fim: `${mes}-${String(last).padStart(2, "0")}`,
  };
}

/**
 * Linhas exibíveis do card.
 * - Pix e Cartão aparecem sempre (mesmo zerados).
 * - "Não informado" só aparece quando tem valor > 0.
 * - pct é a participação no total do período (todas as formas somadas).
 */
export interface LinhaFormaExibida {
  chave: string;
  rotulo: string;
  qtd: number;
  valor: number;
  pct: number;
  discreto: boolean;
}

export function linhasFormas(rows: LinhaForma[]): LinhaFormaExibida[] {
  const acumulado = new Map<string, { qtd: number; valor: number }>();
  for (const r of rows || []) {
    const chave = String(r.forma_pagamento ?? "nao_informado").trim().toLowerCase();
    const cur = acumulado.get(chave) || { qtd: 0, valor: 0 };
    cur.qtd += Number(r.qtd_vendas || 0);
    cur.valor += Number(r.valor_total || 0);
    acumulado.set(chave, cur);
  }

  const total = Array.from(acumulado.values()).reduce((s, v) => s + v.valor, 0);
  const chaves = [
    ...ORDEM,
    ...Array.from(acumulado.keys()).filter(k => !ORDEM.includes(k)),
  ];

  return chaves
    .map((chave): LinhaFormaExibida | null => {
      const cur = acumulado.get(chave) || { qtd: 0, valor: 0 };
      const discreto = chave === "nao_informado";
      if (discreto && cur.valor <= 0) return null;
      return {
        chave,
        rotulo: ROTULOS[chave] ?? chave,
        qtd: cur.qtd,
        valor: cur.valor,
        pct: total > 0 ? (cur.valor / total) * 100 : 0,
        discreto,
      };
    })
    .filter((l): l is LinhaFormaExibida => l !== null);
}

function pctLabel(pct: number): string {
  return `${pct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function FaturamentoPorFormaPagamentoCard({
  mes,
  mesLabel,
}: {
  mes: string;
  mesLabel: string;
}) {
  const { inicio, fim } = useMemo(
    () => (mes ? rangeDoMes(mes) : { inicio: "", fim: "" }),
    [mes],
  );

  const q = useQuery({
    queryKey: ["faturamento_por_forma_pagamento", inicio, fim],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "farol_faturamento_por_forma_pagamento",
        { p_inicio: inicio, p_fim: fim },
      );
      if (error) {
        console.error("[Farol] farol_faturamento_por_forma_pagamento RPC error:", error);
        throw error;
      }
      return (Array.isArray(data) ? data : []) as LinhaForma[];
    },
    enabled: !!inicio && !!fim,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const linhas = useMemo(() => linhasFormas(q.data ?? []), [q.data]);
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const totalVendas = linhas.reduce((s, l) => s + l.qtd, 0);

  if (!mes) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="mb-2">
        <h4 className="text-sm font-semibold text-foreground">
          Faturamento por forma de pagamento
        </h4>
        {mesLabel && (
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{mesLabel}</p>
        )}
      </div>

      {q.isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : q.isError ? (
        <p className="text-xs text-muted-foreground">
          Não foi possível carregar as formas de pagamento deste período.
        </p>
      ) : linhas.length === 0 || total <= 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma venda no período.</p>
      ) : (
        <>
          <div className="divide-y divide-border">
            {linhas.map(l => (
              <div key={l.chave} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p
                    className={cn(
                      "font-medium truncate",
                      l.discreto
                        ? "text-[11px] text-muted-foreground"
                        : "text-sm text-foreground",
                    )}
                  >
                    {l.rotulo}
                  </p>
                  <p
                    className={cn(
                      "text-muted-foreground tabular-nums",
                      l.discreto ? "text-[10px]" : "text-[11px]",
                    )}
                  >
                    {l.qtd.toLocaleString("pt-BR")}{" "}
                    {l.qtd === 1 ? "venda" : "vendas"} · {pctLabel(l.pct)} do total
                  </p>
                </div>
                <p
                  className={cn(
                    "font-semibold tabular-nums whitespace-nowrap",
                    l.discreto
                      ? "text-xs text-muted-foreground"
                      : "text-base sm:text-lg text-foreground",
                  )}
                >
                  {formatBRL(l.valor)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">Total do período</p>
            <p className="text-xs font-semibold text-foreground tabular-nums whitespace-nowrap">
              {formatBRL(total)} · {totalVendas.toLocaleString("pt-BR")}{" "}
              {totalVendas === 1 ? "venda" : "vendas"}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
