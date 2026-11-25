import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ALMOCO_PADRAO, intervaloBloqueioValido, lerAlmocoPadrao, removerAlmocoPadrao, salvarAlmocoPadrao } from "../src/lib/closerBloqueios";

function clienteTeste(existente: { id: string; inicio: string; fim: string } | null = null, erro: Error | null = null) {
  const chamadas: { metodo: string; args: unknown[] }[] = [];
  const builder: Record<string, (...args: unknown[]) => unknown> = {};
  for (const metodo of ["from", "select", "eq", "is", "insert", "update", "delete"]) {
    builder[metodo] = (...args) => { chamadas.push({ metodo, args }); return builder; };
  }
  builder.maybeSingle = async () => ({ data: existente, error: erro });
  builder.single = async () => ({ data: { id: existente?.id ?? "novo" }, error: erro });
  builder.then = (resolve: unknown) => (resolve as (value: unknown) => unknown)({ error: erro });
  return { cliente: builder as unknown as Pick<SupabaseClient, "from">, chamadas };
}

describe("almoço dos horários de atendimento", () => {
  test("ao ligar, o intervalo padrão é 12:00 a 13:00", () => {
    expect(ALMOCO_PADRAO).toEqual({ inicio: "12:00", fim: "13:00" });
  });
  test("aceita horários em intervalos de 30 minutos e fim posterior", () => {
    expect(intervaloBloqueioValido("12:00", "13:00")).toBe(true);
    expect(intervaloBloqueioValido("12:30", "13:30")).toBe(true);
    expect(intervaloBloqueioValido("12:15", "13:00")).toBe(false);
    expect(intervaloBloqueioValido("13:00", "12:00")).toBe(false);
  });
  test("carrega somente almoço padrão do closer, sem exceções datadas", async () => {
    const { cliente, chamadas } = clienteTeste({ id: "a", inicio: "12:30:00", fim: "13:30:00" });
    expect(await lerAlmocoPadrao(cliente, "Fillipe")).toEqual({ id: "a", inicio: "12:30", fim: "13:30" });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["closer", "Fillipe"] });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["tipo", "almoco"] });
    expect(chamadas).toContainEqual({ metodo: "is", args: ["data", null] });
  });
  test("sem almoço, insere linha com tipo almoco e data nula", async () => {
    const { cliente, chamadas } = clienteTeste();
    await salvarAlmocoPadrao(cliente, "Fillipe", "12:00", "13:00");
    expect(chamadas.find((c) => c.metodo === "insert")?.args[0]).toMatchObject({ closer: "Fillipe", tipo: "almoco", data: null, inicio: "12:00", fim: "13:00" });
    expect(chamadas.some((c) => c.metodo === "update" || c.metodo === "upsert")).toBe(false);
  });
  test("almoço existente é atualizado por id com updated_at", async () => {
    const { cliente, chamadas } = clienteTeste({ id: "almoco-1", inicio: "12:00", fim: "13:00" });
    const antes = Date.now();
    await salvarAlmocoPadrao(cliente, "Fillipe", "12:30", "13:30");
    const valores = chamadas.find((c) => c.metodo === "update")?.args[0] as { inicio: string; fim: string; updated_at: string };
    expect(valores).toMatchObject({ inicio: "12:30", fim: "13:30" });
    expect(Date.parse(valores.updated_at)).toBeGreaterThanOrEqual(antes);
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["id", "almoco-1"] });
    expect(chamadas.some((c) => c.metodo === "insert" || c.metodo === "upsert")).toBe(false);
  });
  test("desligar remove só o almoço padrão, preservando ausências e almoço datado", async () => {
    const { cliente, chamadas } = clienteTeste();
    await removerAlmocoPadrao(cliente, "Fillipe");
    expect(chamadas).toContainEqual({ metodo: "delete", args: [] });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["closer", "Fillipe"] });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["tipo", "almoco"] });
    expect(chamadas).toContainEqual({ metodo: "is", args: ["data", null] });
  });
  test("propaga erro de leitura, gravação e remoção", async () => {
    const erro = new Error("Não permitido");
    const { cliente } = clienteTeste(null, erro);
    await expect(lerAlmocoPadrao(cliente, "Fillipe")).rejects.toThrow("Não permitido");
    await expect(salvarAlmocoPadrao(cliente, "Fillipe", "12:00", "13:00")).rejects.toThrow("Não permitido");
    await expect(removerAlmocoPadrao(cliente, "Fillipe")).rejects.toThrow("Não permitido");
  });
});