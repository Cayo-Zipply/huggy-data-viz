import { useCallback, useEffect, useState } from "react";
import { supabaseExt } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Conjunto de lead_ids com observação nova (escrita/editada por outra pessoa)
 * ainda não lida pelo usuário logado. A view vw_lead_anotacao_nao_lida é a
 * fonte da verdade — não reimplementar as regras aqui.
 */
export function useAnotacoesNaoLidas() {
  const { user } = useAuth();
  const [naoLidos, setNaoLidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (supabaseExt as any)
      .from("vw_lead_anotacao_nao_lida")
      .select("lead_id")
      .then(({ data }: any) => {
        if (cancelled) return;
        setNaoLidos(new Set((data || []).map((r: any) => r.lead_id)));
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Marca como lido na abertura do card: otimista no Set local + upsert em
  // background (não bloqueia a abertura).
  const marcarLida = useCallback((leadId: string) => {
    if (!user?.id) return;
    setNaoLidos(prev => {
      if (!prev.has(leadId)) return prev;
      const next = new Set(prev);
      next.delete(leadId);
      return next;
    });
    (supabaseExt as any)
      .from("lead_anotacao_leitura")
      .upsert(
        { lead_id: leadId, user_id: user.id, lido_em: new Date().toISOString() },
        { onConflict: "lead_id,user_id" }
      )
      .then(() => {});
  }, [user?.id]);

  return { naoLidos, marcarLida };
}
