import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SlaRule {
  id: string;
  etapa: string;
  sla_horas: number;
  alerta_para: string[];
  acao_ao_estourar: string;
}

export function useSlaRules() {
  const [rules, setRules] = useState<SlaRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase.from("pipeline_sla_rules").select("*").order("etapa");
    if (data) setRules(data as unknown as SlaRule[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const upsertRule = useCallback(async (rule: Partial<SlaRule> & { etapa: string }) => {
    const { data, error } = await supabase.from("pipeline_sla_rules")
      .upsert({ etapa: rule.etapa, sla_horas: rule.sla_horas ?? 24, alerta_para: rule.alerta_para ?? ["responsavel"], acao_ao_estourar: rule.acao_ao_estourar ?? "destacar", updated_at: new Date().toISOString() } as any, { onConflict: "etapa" })
      .select().single();
    if (!error) fetch();
    return { data, error };
  }, [fetch]);

  const getRuleForStage = useCallback((etapa: string) => {
    return rules.find(r => r.etapa === etapa) || { etapa, sla_horas: 24, alerta_para: ["responsavel"], acao_ao_estourar: "destacar" } as SlaRule;
  }, [rules]);

  return { rules, loading, upsertRule, getRuleForStage, refetch: fetch };
}
