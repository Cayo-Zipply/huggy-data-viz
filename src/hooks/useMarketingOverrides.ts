import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MarketingOverride {
  id: string;
  month: string;
  manual_mensagens: number | null;
  manual_reunioes: number | null;
  manual_vendas: number | null;
  manual_faturamento: number | null;
  manual_impressoes: number | null;
  manual_cliques: number | null;
  manual_investimento: number | null;
  manual_ctr: number | null;
  manual_cpc: number | null;
  manual_cpm: number | null;
}

export function useMarketingOverrides() {
  const [overrides, setOverrides] = useState<MarketingOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    const { data, error } = await supabase
      .from("marketing_overrides")
      .select("*")
      .order("month", { ascending: false });
    if (!error && data) setOverrides(data as unknown as MarketingOverride[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const upsert = useCallback(async (month: string, fields: Partial<Omit<MarketingOverride, "id" | "month">>) => {
    const existing = overrides.find(o => o.month === month);
    if (existing) {
      const { error } = await supabase
        .from("marketing_overrides")
        .update(fields as any)
        .eq("id", existing.id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase
        .from("marketing_overrides")
        .insert({ month, ...fields } as any);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
    }
    toast({ title: "Salvo", description: "Métricas manuais atualizadas." });
    await fetch();
  }, [overrides, fetch, toast]);

  const getOverride = useCallback((month: string) => {
    return overrides.find(o => o.month === month) || null;
  }, [overrides]);

  return { overrides, loading, upsert, getOverride, refetch: fetch };
}
