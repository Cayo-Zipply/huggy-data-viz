import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseExternal";

// Tabela real no externo: public.sla_config
// Schema: etapa (PK, label humano: "Fez Contato", "Reunião Marcada", ...),
//         sla_horas (int), acao (text), ativo (bool), ordem (int), updated_at.
// Não existe coluna `id`.
export interface SlaRule {
  etapa: string;          // label humano, ex: "Reunião Marcada"
  sla_horas: number;
  acao: string;           // ex: "destacar_kanban", "destacar_notificar", ...
  ativo: boolean;
  ordem: number;
}

const TABLE = "sla_config";

export function useSlaRules() {
  const [rules, setRules] = useState<SlaRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from(TABLE)
      .select("*")
      .order("ordem", { ascending: true });
    if (data) setRules(data as unknown as SlaRule[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Upsert por etapa (PK). Aceita patch parcial.
  const upsertRule = useCallback(async (rule: Partial<SlaRule> & { etapa: string }) => {
    const existing = rules.find(r => r.etapa === rule.etapa);
    const payload = {
      etapa: rule.etapa,
      sla_horas: rule.sla_horas ?? existing?.sla_horas ?? 24,
      acao: rule.acao ?? existing?.acao ?? "destacar_kanban",
      ativo: rule.ativo ?? existing?.ativo ?? true,
      ordem: rule.ordem ?? existing?.ordem ?? 999,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(payload as any, { onConflict: "etapa" })
      .select()
      .single();
    if (!error) fetch();
    return { data, error };
  }, [rules, fetch]);

  const getRuleForStage = useCallback((etapaLabel: string): SlaRule => {
    return rules.find(r => r.etapa === etapaLabel)
      ?? { etapa: etapaLabel, sla_horas: 24, acao: "destacar_kanban", ativo: true, ordem: 999 };
  }, [rules]);

  // Compat com chamadas legadas (alguns componentes ainda usam o nome antigo).
  const getRuleForStageLegacy = getRuleForStage;

  return { rules, loading, upsertRule, getRuleForStage, getRuleForStageLegacy, refetch: fetch };
}
