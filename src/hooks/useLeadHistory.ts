import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LeadHistoryEntry {
  id: string;
  lead_id: string;
  tipo: string;
  descricao: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  usuario_nome: string | null;
  created_at: string;
}

export function useLeadHistory() {
  const [entries, setEntries] = useState<LeadHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchForLead = useCallback(async (leadId: string) => {
    setLoading(true);
    const { data } = await supabase.from("lead_history").select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
    if (data) setEntries(data as unknown as LeadHistoryEntry[]);
    setLoading(false);
  }, []);

  const addEntry = useCallback(async (entry: Omit<LeadHistoryEntry, "id" | "created_at">) => {
    await supabase.from("lead_history").insert(entry as any);
  }, []);

  return { entries, loading, fetchForLead, addEntry };
}
