import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";

// Fonte única (cache compartilhado) das RPCs do Farol. Mesma queryKey em
// todas as telas => React Query reaproveita o resultado em vez de repetir.
async function rpcRows(fn: string, mes: string): Promise<any[]> {
  const { data, error } = await (supabase as any).rpc(fn, { p_mes: mes });
  if (error) {
    console.error(`[Farol] ${fn} RPC error:`, error);
    throw error;
  }
  return Array.isArray(data) ? data : [];
}

export function useFarolMetricasTime(mes: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["farol_metricas_time", mes],
    queryFn: () => rpcRows("farol_metricas_time", mes as string),
    enabled: enabled && !!mes,
    placeholderData: keepPreviousData,
    gcTime: 24 * 60 * 60_000,
    refetchOnMount: true, // dado restaurado do cache local atualiza em 2º plano
  });
}

export function useFarolMetricasSdr(mes: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["farol_metricas_sdr", mes],
    queryFn: () => rpcRows("farol_metricas_sdr", mes as string),
    enabled: enabled && !!mes,
    placeholderData: keepPreviousData,
    gcTime: 24 * 60 * 60_000,
    refetchOnMount: true, // dado restaurado do cache local atualiza em 2º plano
  });
}

/** Funil acumulado (8 linhas: ordem, etapa, qtd, qtd_na_etapa_hoje) do mês 'YYYY-MM'. */
export function useFunilAcumulado(mes: string | null | undefined, closer: string | null, enabled = true) {
  return useQuery({
    queryKey: ["funil_acumulado", mes, closer],
    queryFn: async () => {
      const [y, m] = (mes as string).split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      const { data, error } = await (supabase as any).rpc("farol_funil_acumulado", {
        p_inicio: `${mes}-01`, p_fim: `${mes}-${String(last).padStart(2, "0")}`, p_closer: closer || null,
      });
      if (error) { console.error("[Farol] farol_funil_acumulado RPC error:", error); throw error; }
      return (Array.isArray(data) ? data : []) as { ordem: number; etapa: string; qtd: number; qtd_na_etapa_hoje: number }[];
    },
    enabled: enabled && !!mes,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
