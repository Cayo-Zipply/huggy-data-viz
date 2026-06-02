import { useState, useEffect, useCallback } from "react";
import { supabaseExt as supabase } from "@/lib/supabaseExternal";

export interface OrigemLead {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export function useOrigensLeads() {
  const [origens, setOrigens] = useState<OrigemLead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await (supabase as any).from("origens_leads").select("*").order("ordem");
    if (data) setOrigens(data as OrigemLead[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const createOrigem = useCallback(async (nome: string) => {
    const maxOrdem = origens.length > 0 ? Math.max(...origens.map(o => o.ordem)) + 1 : 0;
    const { error } = await (supabase as any).from("origens_leads").insert({ nome, ordem: maxOrdem });
    if (!error) fetch();
  }, [fetch, origens]);

  const toggleAtivo = useCallback(async (id: string) => {
    const o = origens.find(x => x.id === id);
    if (o) await (supabase as any).from("origens_leads").update({ ativo: !o.ativo }).eq("id", id);
    fetch();
  }, [fetch, origens]);

  const deleteOrigem = useCallback(async (id: string) => {
    await (supabase as any).from("origens_leads").delete().eq("id", id);
    fetch();
  }, [fetch]);

  const activeOrigens = origens.filter(o => o.ativo);

  return { origens, activeOrigens, loading, createOrigem, toggleAtivo, deleteOrigem, refetch: fetch };
}
