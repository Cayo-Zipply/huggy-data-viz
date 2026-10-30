import { get, set, del } from "idb-keyval";

// Versão do cache local: troque ao mudar o formato dos dados persistidos.
export const APP_CACHE_BUSTER = "farol-cache-v1";
export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

type Wrapped<T> = { buster: string; savedAt: number; data: T };

/** Lê do IndexedDB (nunca guarda tokens — só dados de tela). */
export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const w = (await get(key)) as Wrapped<T> | undefined;
    if (!w || w.buster !== APP_CACHE_BUSTER || Date.now() - w.savedAt > CACHE_MAX_AGE) {
      if (w) void del(key);
      return null;
    }
    return w.data;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T) {
  try {
    await set(key, { buster: APP_CACHE_BUSTER, savedAt: Date.now(), data } as Wrapped<T>);
  } catch { /* quota/privado: ignora */ }
}

export function clearCache(key: string) {
  return del(key).catch(() => {});
}
