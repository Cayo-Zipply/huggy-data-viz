import { describe, expect, test } from "bun:test";
import { createPresenceGeoCollector, GEO_INTERVAL_MS, GEO_OPTIONS, hasGeoNotice, saveGeoNotice, locationFlags } from "../src/lib/presenceGeolocation";

function setup({ state = "granted", error = 0, supported = true } = {}) {
  let visible = true;
  let calls = 0;
  const sent: unknown[] = [];
  let options: PositionOptions | undefined;
  const browser = {
    permissions: { query: async () => ({ state }) },
    geolocation: supported ? { getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback, opts: PositionOptions) => {
      calls++; options = opts;
      if (error) fail({ code: error } as GeolocationPositionError);
      else ok({ coords: { latitude: -23.5, longitude: -46.6, accuracy: 1200.4 } } as GeolocationPosition);
    } } : undefined,
  } as unknown as Navigator;
  const collector = createPresenceGeoCollector({ browser, visible: () => visible, send: async (p) => { sent.push(p); } });
  return { collector, sent, hide: () => { visible = false; }, calls: () => calls, options: () => options };
}

describe("Localização de presença", () => {
  test("coleta usa cinco minutos, precisão alta, timeout 15s e posição até 120s", async () => {
    expect(GEO_INTERVAL_MS).toBe(300000);
    const s = setup(); await s.collector.collect();
    expect(s.options()).toEqual({ enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 });
    expect(s.sent).toEqual([{ p_geo_status: "concedida", p_lat: -23.5, p_lng: -46.6, p_precisao_m: 1200.4 }]);
    expect(s.options()).toBe(GEO_OPTIONS);
  });
  test("aba oculta e coleta desmontada não coletam nem enviam", async () => {
    const s = setup(); s.hide(); await s.collector.collect();
    expect(s.calls()).toBe(0); expect(s.sent).toEqual([]);
    const d = setup(); d.collector.dispose(); await d.collector.collect();
    expect(d.calls()).toBe(0); expect(d.sent).toEqual([]);
  });
  test("permissão denied apenas envia negada sem pedir novamente", async () => {
    const s = setup({ state: "denied" });
    await s.collector.collect(); await s.collector.collect();
    expect(s.calls()).toBe(0);
    expect(s.sent).toEqual([{ p_geo_status: "negada" }, { p_geo_status: "negada" }]);
  });
  test("recusa após pedido não repete o pedido mesmo se consulta retornar prompt", async () => {
    const s = setup({ state: "prompt", error: 1 });
    await s.collector.collect(); await s.collector.collect();
    expect(s.calls()).toBe(1);
    expect(s.sent).toEqual([{ p_geo_status: "negada" }, { p_geo_status: "negada" }]);
  });
  test("outros erros ou navegador sem suporte enviam indisponivel", async () => {
    for (const s of [setup({ error: 2 }), setup({ error: 3 }), setup({ supported: false })]) {
      await s.collector.collect(); expect(s.sent).toEqual([{ p_geo_status: "indisponivel" }]);
    }
  });
  test("aviso é separado por usuário na chave geo_aviso_visto", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
    expect(hasGeoNotice("a", storage)).toBe(false);
    saveGeoNotice("a", storage);
    expect(values.get("geo_aviso_visto")).toBe('["a"]');
    expect(hasGeoNotice("a", storage)).toBe(true); expect(hasGeoNotice("b", storage)).toBe(false);
    saveGeoNotice("b", storage); expect(hasGeoNotice("b", storage)).toBe(true);
  });
  test("armazenamento bloqueado não quebra a confirmação", () => {
    const storage = { getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("blocked"); } };
    expect(hasGeoNotice("a", storage)).toBe(false);
    expect(() => saveGeoNotice("a", storage)).not.toThrow();
  });
  test("imprecisa só acima de 1000m e desatualizada só após 30min", () => {
    const now = Date.parse("2026-11-05T14:18:00Z");
    expect(locationFlags(1000, "2026-11-05T13:48:00Z", now)).toEqual({ imprecisa: false, desatualizada: false });
    expect(locationFlags(1001, "2026-11-05T13:47:59Z", now)).toEqual({ imprecisa: true, desatualizada: true });
    expect(locationFlags(null, null, now)).toEqual({ imprecisa: false, desatualizada: false });
  });
});