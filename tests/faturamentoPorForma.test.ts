import { describe, expect, it } from "bun:test";
import {
  linhasFormas,
  rangeDoMes,
} from "@/components/FaturamentoPorFormaPagamento";

describe("rangeDoMes", () => {
  it("usa o primeiro e o último dia do mês em YYYY-MM-DD", () => {
    expect(rangeDoMes("2026-10")).toEqual({ inicio: "2026-10-01", fim: "2026-10-31" });
    expect(rangeDoMes("2026-02")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
    expect(rangeDoMes("2024-02")).toEqual({ inicio: "2024-02-01", fim: "2024-02-29" });
  });
});

describe("linhasFormas", () => {
  const rows = [
    { forma_pagamento: "pix", qtd_vendas: 40, valor_total: 10000 },
    { forma_pagamento: "cartao", qtd_vendas: 20, valor_total: 6000 },
    { forma_pagamento: "nao_informado", qtd_vendas: 5, valor_total: 4000 },
  ];

  it("mostra Pix, Cartão de crédito e Não informado com rótulos em pt-BR", () => {
    const linhas = linhasFormas(rows);
    expect(linhas.map(l => l.rotulo)).toEqual(["Pix", "Cartão de crédito", "Não informado"]);
  });

  it("esconde Não informado quando o valor é zero", () => {
    const linhas = linhasFormas([
      { forma_pagamento: "pix", qtd_vendas: 3, valor_total: 500 },
      { forma_pagamento: "cartao", qtd_vendas: 0, valor_total: 0 },
      { forma_pagamento: "nao_informado", qtd_vendas: 0, valor_total: 0 },
    ]);
    expect(linhas.map(l => l.chave)).toEqual(["pix", "cartao"]);
  });

  it("mantém Pix e Cartão mesmo zerados e marca Só Não informado como discreto", () => {
    const linhas = linhasFormas(rows);
    const pix = linhas.find(l => l.chave === "pix")!;
    const naoInf = linhas.find(l => l.chave === "nao_informado")!;
    expect(pix.discreto).toBe(false);
    expect(naoInf.discreto).toBe(true);
  });

  it("calcula o % sobre o total do período", () => {
    const linhas = linhasFormas(rows);
    const pct = Object.fromEntries(linhas.map(l => [l.chave, l.pct]));
    expect(pct.pix).toBeCloseTo(50, 5);
    expect(pct.cartao).toBeCloseTo(30, 5);
    expect(pct.nao_informado).toBeCloseTo(20, 5);
  });

  it("soma linhas repetidas da mesma forma e não mostra parcelas", () => {
    const linhas = linhasFormas([
      { forma_pagamento: "cartao", qtd_vendas: 2, valor_total: 1000 },
      { forma_pagamento: "cartao", qtd_vendas: 3, valor_total: 2000 },
    ]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].qtd).toBe(5);
    expect(linhas[0].valor).toBe(3000);
    expect(linhas[0].pct).toBeCloseTo(100, 5);
    expect("parcelas" in linhas[0]).toBe(false);
  });
});
