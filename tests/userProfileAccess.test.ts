import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteUserProfile, deletionBlockReason, findExistingProfile, firstNameMatches } from "../src/lib/userProfileAccess";

const admin = { user_id: "admin-atual", role: "admin" };
const outroAdmin = { user_id: "outro-admin", role: "admin" };
const closer = { user_id: "closer-ativo", role: "closer" };
function client(responses: { data: any; error: { message: string } | null }[]) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: any = {};
  for (const method of ["from", "select", "eq", "is", "delete", "update"]) {
    builder[method] = (...args: unknown[]) => { calls.push({ method, args }); return builder; };
  }
  builder.maybeSingle = async () => responses.shift();
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(responses.shift()).then(resolve);
  return { db: builder as Pick<SupabaseClient, "from">, calls };
}

describe("exclusão de perfis", () => {
  test("bloqueia excluir o próprio admin mesmo havendo outro", () => {
    expect(deletionBlockReason(admin, "admin-atual", [admin, outroAdmin])).not.toBeNull();
  });
  test("bloqueia excluir o único admin da lista", () => {
    expect(deletionBlockReason(outroAdmin, "admin-atual", [outroAdmin, closer])).not.toBeNull();
  });
  test("permite excluir outro admin quando há dois", () => {
    expect(deletionBlockReason(outroAdmin, "admin-atual", [admin, outroAdmin])).toBeNull();
  });
  test("permite excluir usuário com login e usuário pendente", () => {
    expect(deletionBlockReason(closer, "admin-atual", [admin, closer])).toBeNull();
    expect(deletionBlockReason({ user_id: null, role: "sdr" }, "admin-atual", [admin])).toBeNull();
  });
  test("exige primeiro nome e rejeita nome incorreto/vazio/completo", () => {
    expect(firstNameMatches("Maria Santos", "Maria")).toBe(true);
    expect(firstNameMatches("Maria Santos", " maria ")).toBe(true);
    expect(firstNameMatches("Maria Santos", "Mariana")).toBe(false);
    expect(firstNameMatches("Maria Santos", "Maria Santos")).toBe(false);
    expect(firstNameMatches("Maria Santos", "")).toBe(false);
    expect(firstNameMatches("", "")).toBe(false);
  });
  test("exclui só user_profiles por id e exige select id", async () => {
    const { db, calls } = client([{ data: [{ id: "perfil-1" }], error: null }]);
    await deleteUserProfile(db, "perfil-1");
    expect(calls).toEqual([
      { method: "from", args: ["user_profiles"] }, { method: "delete", args: [] },
      { method: "eq", args: ["id", "perfil-1"] }, { method: "select", args: ["id"] },
    ]);
  });
  test("zero linhas apagadas não é sucesso", async () => {
    const { db } = client([{ data: [], error: null }]);
    await expect(deleteUserProfile(db, "perfil-1")).rejects.toThrow("Sem permissão");
  });
  test("retorna erro do banco sem simular sucesso", async () => {
    const { db } = client([{ data: null, error: { message: "bloqueado" } }]);
    await expect(deleteUserProfile(db, "perfil-1")).rejects.toThrow("Não foi possível excluir: bloqueado");
  });
});

describe("acesso somente com perfil existente", () => {
  test("carrega perfil por user_id", async () => {
    const { db, calls } = client([{ data: { id: "perfil", ...closer }, error: null }]);
    expect(await findExistingProfile(db, "closer-ativo", "closer@penaquadros.com")).toMatchObject(closer);
    expect(calls.filter(c => c.method === "from")).toHaveLength(1);
  });
  test("perfil ausente retorna null e nunca insere nem recria", async () => {
    const { db, calls } = client([{ data: null, error: null }, { data: null, error: null }]);
    expect(await findExistingProfile(db, "removido", "removido@penaquadros.com")).toBeNull();
    expect(calls.every(c => ["from", "select", "eq", "is"].includes(c.method))).toBe(true);
    expect(calls).toContainEqual({ method: "is", args: ["user_id", null] });
  });
  test("vincula somente convite não vinculado pelo email normalizado", async () => {
    const { db, calls } = client([
      { data: null, error: null }, { data: { id: "convite", user_id: null }, error: null },
      { data: { id: "convite", user_id: "novo" }, error: null },
    ]);
    expect(await findExistingProfile(db, "novo", " NOVO@PENAQUADROS.COM ")).toEqual({ id: "convite", user_id: "novo" });
    expect(calls).toContainEqual({ method: "eq", args: ["email", "novo@penaquadros.com"] });
    expect(calls).toContainEqual({ method: "update", args: [{ user_id: "novo" }] });
  });
  test("erro de rede não é confundido com perfil inexistente", async () => {
    const { db } = client([{ data: null, error: { message: "rede indisponível" } }]);
    await expect(findExistingProfile(db, "id", "email@penaquadros.com")).rejects.toMatchObject({ message: "rede indisponível" });
  });
});
