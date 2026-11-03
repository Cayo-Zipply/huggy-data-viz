import { describe, expect, test } from "bun:test";
import { contractModality, reportDeadline, reportErrors, reportPaymentFields } from "../src/lib/reportContract";

describe("Termo de adesão", () => {
  test("modalidade vazia usa venda_relatorio e mantém mensalidade explícita", () => {
    expect(contractModality(null)).toBe("venda_relatorio");
    expect(contractModality("mensalidade")).toBe("mensalidade");
  });
  test("prazo vazio do termo é 5 e valores salvos permanecem", () => {
    expect(reportDeadline(null)).toBe(5);
    expect(reportDeadline(10)).toBe(10);
    expect(reportDeadline(null, "mensalidade")).toBe(7);
  });
  test("Pix grava parcela única", () => {
    expect(reportPaymentFields(1500, "pix", 10).parcelas_relatorio).toBe(1);
  });
  test("cartão exige inteiro de 1 até 10", () => {
    for (const n of [null, 0, 11, 1.5]) expect(reportErrors(1500, "cartao", n)).toContain("Parcelas no cartão");
    for (const n of [1, 10]) expect(reportErrors(1500, "cartao", n)).toEqual([]);
  });
  test("valor positivo e forma de pagamento são obrigatórios", () => {
    expect(reportErrors(0, "pix", 1)).toContain("Valor do relatório");
    expect(reportErrors(1500, "", 1)).toContain("Forma de pagamento");
    expect(reportPaymentFields(1300.53, "cartao", 3).valor_relatorio).toBe(1300.53);
  });
});