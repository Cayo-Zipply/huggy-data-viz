export const GEO_INTERVAL_MS = 5 * 60_000;
export const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 120_000,
};

export type GeoPayload = {
  p_geo_status: "concedida" | "negada" | "indisponivel";
  p_lat?: number;
  p_lng?: number;
  p_precisao_m?: number;
};

export function createPresenceGeoCollector({
  browser,
  visible,
  send,
}: {
  browser: Pick<Navigator, "geolocation" | "permissions">;
  visible: () => boolean;
  send: (payload: GeoPayload) => Promise<void>;
}) {
  let disposed = false;
  let collecting = false;
  let denied = false;
  const active = () => !disposed && visible();
  const emit = async (payload: GeoPayload) => {
    if (active()) await send(payload);
  };

  return {
    dispose() { disposed = true; },
    async collect() {
      if (!active() || collecting) return;
      collecting = true;
      try {
        if (!browser.geolocation) {
          await emit({ p_geo_status: "indisponivel" });
          return;
        }
        if (browser.permissions?.query) {
          try {
            const permission = await browser.permissions.query({ name: "geolocation" });
            denied = permission.state === "denied" || (denied && permission.state !== "granted");
          } catch { /* Alguns navegadores não suportam consultar geolocalização. */ }
        }
        if (!active()) return;
        if (denied) {
          await emit({ p_geo_status: "negada" });
          return;
        }
        await new Promise<void>((resolve) => {
          browser.geolocation.getCurrentPosition(
            (position) => {
              void emit({
                p_geo_status: "concedida",
                p_lat: position.coords.latitude,
                p_lng: position.coords.longitude,
                p_precisao_m: position.coords.accuracy,
              }).finally(resolve);
            },
            (error) => {
              denied = error.code === 1;
              void emit({ p_geo_status: denied ? "negada" : "indisponivel" }).finally(resolve);
            },
            GEO_OPTIONS,
          );
        });
      } finally {
        collecting = false;
      }
    },
  };
}

export function locationFlags(precision: number | null, updatedAt: string | null, now = Date.now()) {
  return {
    imprecisa: precision !== null && precision > 1000,
    desatualizada: updatedAt !== null && now - new Date(updatedAt).getTime() > 30 * 60_000,
  };
}

export function hasGeoNotice(userId: string, storage: Pick<Storage, "getItem">) {
  try {
    const users: unknown = JSON.parse(storage.getItem("geo_aviso_visto") ?? "[]");
    return Array.isArray(users) && users.includes(userId);
  } catch { return false; }
}

export function saveGeoNotice(userId: string, storage: Pick<Storage, "getItem" | "setItem">) {
  try {
    let users: unknown;
    try { users = JSON.parse(storage.getItem("geo_aviso_visto") ?? "[]"); } catch { users = []; }
    const ids = Array.isArray(users) ? users.filter((id): id is string => typeof id === "string") : [];
    storage.setItem("geo_aviso_visto", JSON.stringify(Array.from(new Set([...ids, userId]))));
  } catch { /* A confirmação em memória funciona mesmo com armazenamento bloqueado. */ }
}