import { useEffect, useState } from "react";
import { supabaseExt as supabase } from "@/lib/supabaseExternal";

function normalize(name: string): string {
  return (name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

type AvatarMap = Record<string, string>;

let cache: AvatarMap | null = null;
let inflight: Promise<AvatarMap> | null = null;
const listeners = new Set<(m: AvatarMap) => void>();

async function load(): Promise<AvatarMap> {
  const { data, error } = await (supabase as any)
    .from("user_profiles")
    .select("nome, avatar_url");
  if (error) {
    console.warn("useAvatars:", error.message);
    return {};
  }
  const map: AvatarMap = {};
  for (const row of data ?? []) {
    const url = (row?.avatar_url ?? "").toString().trim();
    if (!url || !row?.nome) continue;
    const full = normalize(row.nome);
    map[full] = url;
    const first = full.split(" ")[0];
    if (first && !map[first]) map[first] = url;
  }
  return map;
}

export function refreshAvatars() {
  cache = null;
  inflight = load().then((m) => {
    cache = m;
    listeners.forEach((l) => l(m));
    return m;
  });
}

/**
 * Mapa nome → avatar_url (user_profiles). Faz o "join" pelo nome exibido do
 * vendedor, com fallback para o primeiro nome.
 */
export function useAvatars() {
  const [map, setMap] = useState<AvatarMap>(cache ?? {});

  useEffect(() => {
    const listener = (m: AvatarMap) => setMap(m);
    listeners.add(listener);
    if (cache) {
      setMap(cache);
    } else {
      if (!inflight) {
        inflight = load().then((m) => {
          cache = m;
          listeners.forEach((l) => l(m));
          return m;
        });
      }
      void inflight.then((m) => setMap(m));
    }
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const getAvatar = (name?: string | null): string | undefined => {
    if (!name) return undefined;
    const key = normalize(name);
    return map[key] ?? map[key.split(" ")[0]] ?? undefined;
  };

  return { avatars: map, getAvatar };
}
