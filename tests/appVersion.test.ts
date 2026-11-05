import { expect, test } from "bun:test";
import { createVersionCheck, VERSION_INTERVAL_MS } from "../src/lib/appVersion";

function setup() {
  let version: string | undefined = "v1";
  let hidden = false;
  let reloads = 0;
  let notices = 0;
  let fail = false;
  const loadedVersion = { current: undefined as string | undefined };
  const checker = createVersionCheck({
    loadedVersion,
    readVersion: async () => { if (fail) throw Error("network"); return version; },
    hidden: () => hidden,
    reload: () => { reloads++; }, notify: () => { notices++; },
  });
  return { checker, loadedVersion, version: (v: string | undefined) => { version = v; }, hide: () => { hidden = true; }, fail: () => { fail = true; }, counts: () => ({ reloads, notices }) };
}

test("intervalo de versão é três minutos e primeira leitura não recarrega", async () => {
  expect(VERSION_INTERVAL_MS).toBe(180000);
  const s = setup(); await s.checker.check(); await s.checker.check();
  expect(s.loadedVersion.current).toBe("v1");
  expect(s.counts()).toEqual({ reloads: 0, notices: 0 });
});
test("aba ativa nunca recarrega sozinha e só recebe um aviso persistente", async () => {
  const s = setup(); await s.checker.check(); s.version("v2");
  await s.checker.check(); await s.checker.check();
  expect(s.counts()).toEqual({ reloads: 0, notices: 1 });
  expect(s.loadedVersion.current).toBe("v1");
});
test("aba oculta recarrega ao detectar versão diferente", async () => {
  const s = setup(); await s.checker.check(); s.hide(); s.version("v2");
  await s.checker.check(); expect(s.counts()).toEqual({ reloads: 1, notices: 0 });
});
test("aba que ficou oculta depois do aviso recarrega no próximo polling", async () => {
  const s = setup(); await s.checker.check(); s.version("v2"); await s.checker.check(); s.hide();
  await s.checker.check(); expect(s.counts()).toEqual({ reloads: 1, notices: 1 });
});
test("erros e versão ausente não significam nova versão", async () => {
  const s = setup(); await s.checker.check(); s.version(undefined); await s.checker.check(); s.fail(); await s.checker.check();
  expect(s.counts()).toEqual({ reloads: 0, notices: 0 });
});
test("desmontar interrompe as verificações", async () => {
  const s = setup(); await s.checker.check(); s.version("v2"); s.checker.dispose(); await s.checker.check();
  expect(s.counts()).toEqual({ reloads: 0, notices: 0 });
});