// Lightweight global store for the active Burn run.
import { useEffect, useState } from "react";

const KEY = "burn_run_id";
const listeners = new Set<(v: string | null) => void>();

function emit(v: string | null) {
  listeners.forEach((l) => l(v));
}

export const burnState = {
  get(): string | null {
    try { return localStorage.getItem(KEY); } catch { return null; }
  },
  set(runId: string | null) {
    try {
      if (runId) localStorage.setItem(KEY, runId);
      else localStorage.removeItem(KEY);
    } catch {}
    emit(runId);
  },
  subscribe(fn: (v: string | null) => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};

export function useBurnRunId(): string | null {
  const [v, setV] = useState<string | null>(() => burnState.get());
  useEffect(() => burnState.subscribe(setV), []);
  return v;
}
