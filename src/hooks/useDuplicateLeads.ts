import { useMemo } from "react";
import type { PipelineCard } from "@/components/pipeline/types";

export interface DuplicateInfo {
  id: string;
  nome: string;
  owner: string | null;
  stage: string;
  matches: ("telefone" | "email" | "cnpj")[];
}

function normPhone(v?: string | null) {
  if (!v) return "";
  const d = v.replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : "";
}
function normEmail(v?: string | null) {
  return v ? v.trim().toLowerCase() : "";
}
function normCnpj(v?: string | null) {
  if (!v) return "";
  const d = v.replace(/\D/g, "");
  return d.length >= 11 ? d : "";
}

/**
 * Detecta leads duplicados por telefone (últimos 8 dígitos), e-mail ou CNPJ.
 * Retorna um Map<cardId, DuplicateInfo[]> com os outros leads que coincidem.
 */
export function useDuplicateLeads(cards: PipelineCard[]) {
  return useMemo(() => {
    const byPhone = new Map<string, string[]>();
    const byEmail = new Map<string, string[]>();
    const byCnpj = new Map<string, string[]>();

    // Indexa por pipe para não considerar mirrors SDR↔Closer como duplicados
    const k = (pipe: string | undefined, v: string) => `${pipe ?? ""}::${v}`;

    cards.forEach((c) => {
      const p = normPhone(c.telefone);
      const e = normEmail(c.email);
      const cn = normCnpj(c.cnpj);
      if (p) byPhone.set(k(c.pipe, p), [...(byPhone.get(k(c.pipe, p)) || []), c.id]);
      if (e) byEmail.set(k(c.pipe, e), [...(byEmail.get(k(c.pipe, e)) || []), c.id]);
      if (cn) byCnpj.set(k(c.pipe, cn), [...(byCnpj.get(k(c.pipe, cn)) || []), c.id]);
    });

    const result = new Map<string, DuplicateInfo[]>();
    const cardMap = new Map(cards.map((c) => [c.id, c]));

    cards.forEach((c) => {
      const matches = new Map<string, Set<"telefone" | "email" | "cnpj">>();
      const p = normPhone(c.telefone);
      const e = normEmail(c.email);
      const cn = normCnpj(c.cnpj);
      if (p) byPhone.get(p)?.forEach((id) => {
        if (id !== c.id) {
          if (!matches.has(id)) matches.set(id, new Set());
          matches.get(id)!.add("telefone");
        }
      });
      if (e) byEmail.get(e)?.forEach((id) => {
        if (id !== c.id) {
          if (!matches.has(id)) matches.set(id, new Set());
          matches.get(id)!.add("email");
        }
      });
      if (cn) byCnpj.get(cn)?.forEach((id) => {
        if (id !== c.id) {
          if (!matches.has(id)) matches.set(id, new Set());
          matches.get(id)!.add("cnpj");
        }
      });
      if (matches.size > 0) {
        const dups: DuplicateInfo[] = [];
        matches.forEach((fields, id) => {
          const other = cardMap.get(id);
          if (other) {
            dups.push({
              id,
              nome: other.nome,
              owner: other.owner,
              stage: other.stage,
              matches: Array.from(fields),
            });
          }
        });
        result.set(c.id, dups);
      }
    });

    return result;
  }, [cards]);
}
