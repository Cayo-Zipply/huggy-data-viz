import { useState, useEffect, useCallback } from "react";
// motivos_perda vive no Supabase EXTERNO (riyfdcmmabvpcubusujw),
// junto com leads, metas, sla_config, feedback_reports etc.
import { supabase } from "@/lib/supabaseExternal";

export interface MotivoPerda {
  id: string;
  nome: string;
  categoria: string;
  ativo: boolean;
  ordem: number;
}

export function useMotivosPerda() {
  const [motivos, setMotivos] = useState<MotivoPerda[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from("motivos_perda")
      .select("*")
      .order("ordem", { ascending: true });
    if (data) setMotivos(data as unknown as MotivoPerda[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const createMotivo = useCallback(async (nome: string, categoria: string) => {
    const maxOrdem = motivos.length > 0 ? Math.max(...motivos.map(m => m.ordem)) + 1 : 1;
    const { error } = await supabase
      .from("motivos_perda")
      .insert({ nome, categoria, ordem: maxOrdem, ativo: true } as any);
    if (!error) fetch();
  }, [fetch, motivos]);

  const updateMotivo = useCallback(async (id: string, updates: Partial<MotivoPerda>) => {
    await supabase.from("motivos_perda").update(updates as any).eq("id", id);
    fetch();
  }, [fetch]);

  const toggleAtivo = useCallback(async (id: string) => {
    const m = motivos.find(x => x.id === id);
    if (m) await supabase.from("motivos_perda").update({ ativo: !m.ativo } as any).eq("id", id);
    fetch();
  }, [fetch, motivos]);

  // Soft delete (apenas desativa). Mantém histórico.
  const deleteMotivo = useCallback(async (id: string) => {
    await supabase.from("motivos_perda").update({ ativo: false } as any).eq("id", id);
    fetch();
  }, [fetch]);

  const activeMotivos = motivos.filter(m => m.ativo);

  return { motivos, activeMotivos, loading, createMotivo, updateMotivo, toggleAtivo, deleteMotivo, refetch: fetch };
}
