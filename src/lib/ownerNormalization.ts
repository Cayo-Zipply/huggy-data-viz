// Centralized owner/closer name normalization.
// Used everywhere we list closers/owners (filtros, Farol, métricas) para que
// pessoas com múltiplas grafias apareçam como UM ÚNICO nome canônico.

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const firstTokenNorm = (s: string) => norm(s).split(/\s+/)[0] || "";

// Aliases: chave = primeiro nome normalizado, valor = grupo canônico (key)
// Vários aliases podem mapear para o mesmo grupo (ex.: "joao" e "cafe" → "joao").
const ALIAS_TO_GROUP: Record<string, string> = {
  joao: "joao",
  cafe: "joao",
  fillipe: "fillipe",
  filipe: "fillipe",
};

// Nome canônico exibido para cada grupo conhecido. Quem não estiver listado
// usa o nome mais "completo" (mais longo) entre as variantes encontradas.
const GROUP_DISPLAY: Record<string, string> = {
  joao: "João",
  fillipe: "Fillipe Amorim Oliveira Silva",
};

function groupKey(name: string | null | undefined): string {
  const k = firstTokenNorm(name || "");
  return ALIAS_TO_GROUP[k] || k;
}

/**
 * Retorna o nome canônico para um único nome bruto, dado o universo de nomes
 * disponíveis (para escolher a variante mais longa quando não há override).
 */
export function buildCanonicalizer(allNames: (string | null | undefined)[]) {
  const longestByGroup = new Map<string, string>();
  allNames.forEach((n) => {
    if (!n) return;
    const g = groupKey(n);
    if (!g) return;
    const cur = longestByGroup.get(g);
    if (!cur || n.length > cur.length) longestByGroup.set(g, n);
  });

  return (name: string | null | undefined): string => {
    if (!name) return "";
    const g = groupKey(name);
    if (!g) return name;
    return GROUP_DISPLAY[g] || longestByGroup.get(g) || name;
  };
}

/**
 * Recebe uma lista de nomes possivelmente duplicados/com variantes e devolve
 * uma lista única ordenada com o nome canônico de cada pessoa.
 */
export function dedupeOwnerNames(names: (string | null | undefined)[]): string[] {
  const canon = buildCanonicalizer(names);
  const seen = new Map<string, string>();
  for (const n of names) {
    if (!n) continue;
    const g = groupKey(n);
    if (!g) continue;
    if (!seen.has(g)) seen.set(g, canon(n));
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * Verifica se dois nomes pertencem à mesma pessoa (mesmo grupo de alias).
 */
export function sameOwner(a: string | null | undefined, b: string | null | undefined): boolean {
  const ga = groupKey(a || "");
  const gb = groupKey(b || "");
  return !!ga && ga === gb;
}
