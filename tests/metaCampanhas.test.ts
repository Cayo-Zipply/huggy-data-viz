import { describe, expect, test } from "bun:test";
import { cadastrosDe, orcamentoCampanhaCentavos, reaisParaCentavos, validarOrcamento, custoPorCadastro, caminhoVideo } from "../src/lib/metaCampanhas";

describe("metaCampanhas", () => {
  test("cadastros usam complete_registration sem somar em dobro", () => {
    expect(cadastrosDe([
      { action_type: "offsite_conversion.fb_pixel_complete_registration", value: "12" },
      { action_type: "complete_registration", value: "12" },
      { action_type: "link_click", value: "300" },
    ])).toBe(12);
    expect(cadastrosDe([{ action_type: "complete_registration", value: "5" }])).toBe(5);
    expect(cadastrosDe(undefined)).toBe(0);
  });

  test("orçamento: CBO usa campanha, ABO soma adsets", () => {
    expect(orcamentoCampanhaCentavos({ daily_budget: "15000", adsets: { data: [{ daily_budget: "999" }] } })).toBe(15000);
    expect(orcamentoCampanhaCentavos({ adsets: { data: [{ daily_budget: "5000" }, { daily_budget: "3000" }, {}] } })).toBe(8000);
    expect(orcamentoCampanhaCentavos({ adsets: { data: [] } })).toBeNull();
  });

  test("reais para centavos", () => {
    expect(reaisParaCentavos("150")).toBe(15000);
    expect(reaisParaCentavos("150,50")).toBe(15050);
    expect(reaisParaCentavos("1.250,00")).toBe(125000);
    expect(reaisParaCentavos("")).toBeNull();
  });

  test("limites de orçamento R$ 10 a R$ 5.000", () => {
    expect(validarOrcamento(999)).not.toBeNull();
    expect(validarOrcamento(1000)).toBeNull();
    expect(validarOrcamento(500000)).toBeNull();
    expect(validarOrcamento(500001)).not.toBeNull();
  });

  test("custo por cadastro = gasto ÷ cadastros", () => {
    expect(custoPorCadastro(300, 12)).toBe(25);
    expect(custoPorCadastro(300, 0)).toBeNull();
  });

  test("caminho do vídeo", () => {
    expect(caminhoVideo("Dor da Dívida — Ágil", 1700000000000)).toBe("videos/1700000000000-dor-da-divida-agil.mp4");
  });
});
