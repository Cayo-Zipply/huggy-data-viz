import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";

const done = new Set<string>();
const mesAtual = () => new Date().toISOString().slice(0, 7);
const rpc = (fn: string, mes: string) => async () => {
  const { data, error } = await (supabase as any).rpc(fn, { p_mes: mes });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
};

// Código das telas carregadas sob demanda (baixa o pedaço no hover).
const CHUNKS: Record<string, () => Promise<unknown>> = {
  "/criativos": () => import("@/pages/Criativos"),
  "/esquadrao": () => import("@/pages/Esquadrao"),
  "/configuracoes": () => import("@/pages/Settings"),
  "/usuarios": () => import("@/pages/UserManagement"),
  "/contratos": () => import("@/pages/Contratos"),
  "/pool": () => import("@/pages/Pool"),
  "/pendencias-pos-venda": () => import("@/pages/PendenciasPosVenda"),
  "/material-apoio": () => import("@/pages/MaterialApoio"),
  "/sales-enablement": () => import("@/pages/SalesEnablement"),
  "/feedbacks": () => import("@/pages/Feedbacks"),
  "/comparativo": () => import("@/components/ComparisonPanel"),
  "/rentabilidade": () => import("@/components/RevenuePanel"),
  "/consolidado": () => import("@/components/ConsolidatedPanel"),
  "/ajuda": () => import("@/components/HelpPanel"),
  "/marketing": () => import("@/components/MarketingOverview"),
};

/** Prefetch no hover do menu: código da tela + dados principais. */
export function prefetchRoute(qc: QueryClient, path: string) {
  if (!done.has(path)) {
    done.add(path);
    void CHUNKS[path]?.().catch(() => done.delete(path));
  }
  if (path === "/farol" || path === "/marketing") {
    const mes = mesAtual();
    void qc.prefetchQuery({ queryKey: ["farol_metricas_time", mes], queryFn: rpc("farol_metricas_time", mes) });
    void qc.prefetchQuery({ queryKey: ["farol_metricas_sdr", mes], queryFn: rpc("farol_metricas_sdr", mes) });
  }
}
