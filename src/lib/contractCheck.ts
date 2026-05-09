import { sbExt } from "@/lib/supabaseExternal";
import { supabase } from "@/integrations/supabase/client";
import type { PipelineCard } from "@/components/pipeline/types";

const CONTRACT_PREFIX = "crm_contract_";

/**
 * Verifica se o lead tem ao menos um contrato anexado.
 * Considera: lead_anexos (cloud) com tipo "contrato",
 * leads.contract_url ou contrato_file_url, zapsign_contracts.signed_file_url,
 * ou contrato salvo em localStorage (fallback).
 */
export async function hasContractAttached(card: PipelineCard | { id: string; contract_url?: string | null; contrato_file_url?: string | null; }): Promise<boolean> {
  const id = card.id;

  // 1) campos diretos no lead
  if ((card as any).contract_url || (card as any).contrato_file_url) return true;

  // 2) localStorage (workflow legado)
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem(`${CONTRACT_PREFIX}${id}`)) {
      return true;
    }
  } catch {}

  // 3) lead_anexos com tipo contendo "contrato"
  try {
    const { data: anexos } = await (supabase as any)
      .from("lead_anexos")
      .select("id, tipo, nome_arquivo")
      .eq("lead_id", id);
    if (anexos && anexos.length) {
      const has = anexos.some((a: any) => {
        const t = (a.tipo || "").toLowerCase();
        const n = (a.nome_arquivo || "").toLowerCase();
        return t.includes("contrato") || n.includes("contrato");
      });
      if (has) return true;
    }
  } catch (e) {
    console.warn("[hasContractAttached] anexos error:", e);
  }

  // 4) zapsign_contracts
  try {
    const { data: zs } = await (sbExt as any)
      .from("zapsign_contracts")
      .select("signed_file_url")
      .eq("lead_id", id)
      .limit(1);
    if (zs && zs.length && zs[0].signed_file_url) return true;
  } catch {}

  return false;
}
