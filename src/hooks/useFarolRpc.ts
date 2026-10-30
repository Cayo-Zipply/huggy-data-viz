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
