import { describe, expect, test } from "bun:test";
import { missingLeadBasics, missingMeetingBasics } from "../src/lib/leadReadyChecks";
import { formatDocumento } from "../src/lib/utils";

const lead = { valor_divida: 1000, origem_divida: "pgfn", email: "lead@example.com", estado: null, cidade: null, cep: null, endereco: null };

describe("Reunião para CPF", () => {
  test("CPF agenda sem UF, cidade, CEP ou endereço", () => {
    expect(missingMeetingBasics({ ...lead, tipo_documento: "cpf" })).toEqual([]);
  });
  test("CNPJ continua exigindo UF", () => {
    expect(missingMeetingBasics({ ...lead, tipo_documento: "cnpj" })).toEqual(["UF"]);
    expect(missingMeetingBasics({ ...lead, tipo_documento: "cnpj", estado: "SP" })).toEqual([]);
  });
  test("classificação ausente não dispensa UF", () => {
    expect(missingMeetingBasics(lead)).toEqual(["UF"]);
  });
  test("CPF mantém os demais campos básicos obrigatórios", () => {
    expect(missingMeetingBasics({ tipo_documento: "cpf" })).toEqual(["Valor da dívida", "Origem da dívida (Receita/PGFN)", "E-mail"]);
  });
  test("validação geral mantém UF mesmo para CPF", () => {
    expect(missingLeadBasics({ ...lead, tipo_documento: "cpf" })).toEqual(["UF"]);
  });
});

describe("Documento por tamanho", () => {
  test("11 dígitos recebem máscara CPF", () => {
    expect(formatDocumento("12345678901")).toBe("123.456.789-01");
  });
  test("14 dígitos recebem máscara CNPJ", () => {
    expect(formatDocumento("12345678000190")).toBe("12.345.678/0001-90");
  });
});