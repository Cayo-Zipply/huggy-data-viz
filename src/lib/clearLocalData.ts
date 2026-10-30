import { clear as idbClear } from "idb-keyval";
import type { QueryClient } from "@tanstack/react-query";
import { resetPipelineCache } from "@/components/pipeline/usePipelineData";

const DRAFT_PREFIX = "crm_draft_";
const DRAFT_META_KEY = "crm_draft_meta"; // { [chave]: timestamp }
const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/** Apaga todo o cache persistido do Farol (logout / sessão expirada). */
export async function clearPersistedData(qc?: QueryClient) {
  try { resetPipelineCache(); } catch { /* ignore */ }
  try { qc?.clear(); } catch { /* ignore */ }
  try { await idbClear(); } catch { /* ignore */ }
  try {
    if (typeof indexedDB !== "undefined") indexedDB.deleteDatabase("keyval-store");
  } catch { /* ignore */ }
}

/** Limpeza na abertura do app: contratos legados e rascunhos antigos. */
export function cleanupLocalStorage() {
  try {
    const keys = Object.keys(localStorage);
    keys.filter(k => k.startsWith("crm_contract_")).forEach(k => localStorage.removeItem(k));

    let meta: Record<string, number> = {};
    try { meta = JSON.parse(localStorage.getItem(DRAFT_META_KEY) || "{}") || {}; } catch { meta = {}; }
    const now = Date.now();
    const next: Record<string, number> = {};
    keys.filter(k => k.startsWith(DRAFT_PREFIX) && k !== DRAFT_META_KEY).forEach(k => {
      const ts = meta[k];
      if (ts == null) { next[k] = now; return; } // sem data conhecida: começa a contar agora
      if (now - ts > DRAFT_MAX_AGE) localStorage.removeItem(k);
      else next[k] = ts;
    });
    localStorage.setItem(DRAFT_META_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export function touchDraft(key: string, remove = false) {
  try {
    const meta = JSON.parse(localStorage.getItem(DRAFT_META_KEY) || "{}") || {};
    if (remove) delete meta[key]; else meta[key] = Date.now();
    localStorage.setItem(DRAFT_META_KEY, JSON.stringify(meta));
  } catch { /* ignore */ }
}
