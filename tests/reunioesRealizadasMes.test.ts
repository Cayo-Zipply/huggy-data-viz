import { describe, expect, test } from "bun:test";
import { ETAPAS_REUNIAO_REALIZADA, limitesMesSP } from "../src/hooks/useFarolRpc";

describe("reuniões realizadas do mês", () => {
  test("conta Reunião Realizada, Realizada, Link Enviado e Contrato Assinado; não conta Marcada/Agendada/No Show", () => {
    expect(ETAPAS_REUNIAO_REALIZADA).toEqual(["Reunião Realizada", "Realizada", "Link Enviado", "Contrato Assinado"]);
    for (const e of ["Reunião Marcada", "Reunião Agendada", "No Show"]) expect(ETAPAS_REUNIAO_REALIZADA).not.toContain(e);
  });
  test("mês no fuso de São Paulo", () => {
    expect(limitesMesSP("2026-11")).toEqual({ inicio: "2026-11-01T00:00:00-03:00", fimExclusivo: "2026-12-01T00:00:00-03:00" });
    expect(limitesMesSP("2026-12").fimExclusivo).toBe("2027-01-01T00:00:00-03:00");
  });
});
