import { describe, expect, test } from "bun:test";
import { statusContato, validarRitmo, formatTelefone, fmtDataHora } from "../src/lib/campanhaDisparo";

describe("statusContato", () => {
  test("opt-out vence tudo", () => {
    expect(statusContato({ opt_out_em: "x", lead_id_campanha: "l", respondeu_em: "r", enviado_em: "e" })).toBe("opt_out");
  });
  test("virou card vence respondeu", () => {
    expect(statusContato({ lead_id_campanha: "l", respondeu_em: "r" })).toBe("virou_card");
  });
  test("respondeu vence erro", () => {
    expect(statusContato({ respondeu_em: "r", envio_status: "erro" })).toBe("respondeu");
  });
  test("erro vence enviado", () => {
    expect(statusContato({ envio_status: "erro", enviado_em: "e" })).toBe("erro");
  });
  test("enviado", () => expect(statusContato({ enviado_em: "e" })).toBe("enviado"));
  test("sem nada fica na fila", () => expect(statusContato({})).toBe("na_fila"));
});

describe("validarRitmo", () => {
  const ok = { lote_por_rodada: 10, limite_diario: 200, hora_inicio: 9, hora_fim: 18 };
  test("válido", () => expect(validarRitmo(ok)).toBeNull());
  test("lote acima de 50", () => expect(validarRitmo({ ...ok, lote_por_rodada: 51 })).not.toBeNull());
  test("limite acima de 500", () => expect(validarRitmo({ ...ok, limite_diario: 501 })).not.toBeNull());
  test("hora início 24 inválida", () => expect(validarRitmo({ ...ok, hora_inicio: 24, hora_fim: 24 })).not.toBeNull());
  test("hora fim 24 válida", () => expect(validarRitmo({ ...ok, hora_fim: 24 })).toBeNull());
  test("fim igual ao início inválido", () => expect(validarRitmo({ ...ok, hora_inicio: 10, hora_fim: 10 })).not.toBeNull());
});

test("formatTelefone remove 55", () => expect(formatTelefone("5511987654321")).toBe("(11) 98765-4321"));
test("fmtDataHora em São Paulo", () => expect(fmtDataHora("2026-11-16T14:05:00Z")).toBe("16/11 11:05"));
