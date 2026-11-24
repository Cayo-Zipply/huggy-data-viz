import { describe, expect, test } from "bun:test";
import { HORAS, intervaloValido, ultimaReuniao, rotuloData, segundaDaSemana } from "../src/lib/horarios";

describe("horários de atendimento", () => {
  test("horas de 06:00 a 23:30 a cada 30 min", () => {
    expect(HORAS[0]).toBe("06:00");
    expect(HORAS[HORAS.length - 1]).toBe("23:30");
    expect(HORAS.length).toBe(36);
  });
  test("fim precisa ser maior que início", () => {
    expect(intervaloValido("09:00", "13:00")).toBe(true);
    expect(intervaloValido("13:00", "13:00")).toBe(false);
  });
  test("fim 22:00 → última reunião 21:00", () => {
    expect(ultimaReuniao("22:00")).toBe("21:00");
  });
  test("rótulo e semana", () => {
    expect(rotuloData("2026-11-28")).toBe("Sáb 28/11");
    expect(segundaDaSemana("2026-11-28")).toBe("2026-11-23");
  });
});
