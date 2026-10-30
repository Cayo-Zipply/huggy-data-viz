import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
import { supabase as cloud } from "@/integrations/supabase/client";

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
  if (path === "/criativos") {
    // Período padrão da tela: mês atual, todas as campanhas.
    void import("@/pages/Criativos").then(({ periodoDe }) => {
      const { ini, fim } = periodoDe("mes");
      const args = { p_inicio: ini, p_fim: fim, p_campanha: null };
      void qc.prefetchQuery({ queryKey: ["mkt-criativos-resumo", ini, fim, null], queryFn: async () => {
        const { data, error } = await (cloud as any).rpc("mkt_criativos_resumo", args); if (error) throw error; return data;
      } });
      void qc.prefetchQuery({ queryKey: ["mkt-criativos", ini, fim, null], queryFn: async () => {
        const { data, error } = await (cloud as any).rpc("mkt_criativos", args); if (error) throw error; return Array.isArray(data) ? data : [];
      } });
    }).catch(() => {});
  }
  if (path === "/sales-enablement") void prefetchBlackOps(qc);
}

const STALE = 5 * 60_000;
const view = (name: string, mes?: string) => async () => {
  let q: any = (supabase as any).from(name).select("*");
  if (mes) q = q.eq("mes", mes);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
};

async function prefetchBlackOps(qc: QueryClient) {
  const meses: any[] = await qc.fetchQuery({ queryKey: ["se-meses"], queryFn: view("vw_se_meses"), staleTime: STALE }).catch(() => []);
  const mes = meses.find((m) => m.is_atual)?.mes || meses[0]?.mes || mesAtual();
  const porMes: [string, string][] = [
    ["se-desempenho-meta", "vw_se_desempenho_meta"], ["se-reunioes", "vw_se_reunioes"],
    ["se-evolucao", "vw_se_evolucao"], ["se-assertividade", "vw_se_assertividade"],
    ["se-reuniao-desfecho", "vw_se_reuniao_desfecho"],
  ];
  porMes.forEach(([k, v]) => void qc.prefetchQuery({ queryKey: [k, mes], queryFn: view(v, mes), staleTime: STALE }));
  void qc.prefetchQuery({ queryKey: ["se-alertas", mes], staleTime: STALE, queryFn: async () => {
    const { data, error } = await (supabase as any).from("vw_se_alertas").select("*").eq("mes", mes).order("ordem", { ascending: true });
    if (error) throw error; return data ?? [];
  } });
  void qc.prefetchQuery({ queryKey: ["se-notas-mensais"], staleTime: STALE, queryFn: async () => {
    const { data, error } = await (supabase as any).from("vw_se_notas_mensais").select("*").order("mes", { ascending: true });
    if (error) throw error; return data ?? [];
  } });
  void qc.prefetchQuery({ queryKey: ["se-nota-x-conversao"], queryFn: view("vw_se_nota_x_conversao"), staleTime: STALE });
  void qc.prefetchQuery({ queryKey: ["se-rubrica"], queryFn: async () => {
    const { data, error } = await (supabase as any).from("se_rubrica").select("*").eq("ativo", true);
    if (error) throw error; return data ?? [];
  } });
}
