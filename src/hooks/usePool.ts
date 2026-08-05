import { useCallback, useEffect, useState } from "react";
import { supabaseExt } from "@/lib/supabaseExternal";

const db = supabaseExt as any;

export interface PoolConfig {
  id: string;
  pool_ativo: boolean;
  dias_inatividade: number;
  prazo_pool_dias: number;
  etapas_elegiveis: string[];
  motivos_excluidos: string[];
  updated_at: string | null;
  updated_by: string | null;
}

export interface PoolRotacao {
  id: string;
  lead_id: string;
  closer_original: string | null;
  closer_atribuido: string | null;
  atribuido_em: string;
  prazo_ate: string | null;
  oferta_tier: number | null;
  resultado: string | null;
  resultado_em: string | null;
  comissionavel: boolean;
}

export interface PoolLead {
  id: string;
  nome: string;
  empresa?: string | null;
  telefone: string | null;
  valor_divida: number | null;
  origem_divida: string | null;
  etapa_atual: string | null;
  resumo_reuniao?: string | null;
  closer?: string | null;
  pool_prazo_ate?: string | null;
}

export function usePool() {
  const [config, setConfig] = useState<PoolConfig | null>(null);
  const [elegiveis, setElegiveis] = useState(0);
  const [emAtendimento, setEmAtendimento] = useState(0);
  const [convertidosMes, setConvertidosMes] = useState(0);
  const [rotacoes, setRotacoes] = useState<PoolRotacao[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [cfg, eleg, atend, conv, rot] = await Promise.all([
      db.from("pool_config").select("*").limit(1).maybeSingle(),
      db.from("v_pool_elegiveis").select("id", { count: "exact", head: true }),
      db.from("leads").select("id", { count: "exact", head: true }).eq("pool_status", "em_atendimento"),
      db
        .from("pool_rotacoes")
        .select("id", { count: "exact", head: true })
        .eq("resultado", "convertido")
        .gte("resultado_em", inicioMes.toISOString()),
      db.from("pool_rotacoes").select("*").order("atribuido_em", { ascending: false }).limit(300),
    ]);

    if (cfg?.data) setConfig(cfg.data as PoolConfig);
    setElegiveis(eleg?.count ?? 0);
    setEmAtendimento(atend?.count ?? 0);
    setConvertidosMes(conv?.count ?? 0);
    if (rot?.data) setRotacoes(rot.data as PoolRotacao[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const saveConfig = useCallback(
    async (patch: Partial<PoolConfig>, updatedBy?: string | null) => {
      if (!config) return { error: new Error("config não carregada") };
      const { error } = await db
        .from("pool_config")
        .update({ ...patch, updated_at: new Date().toISOString(), updated_by: updatedBy ?? null })
        .eq("id", config.id);
      if (!error) setConfig({ ...config, ...patch } as PoolConfig);
      return { error };
    },
    [config],
  );

  return { config, elegiveis, emAtendimento, convertidosMes, rotacoes, loading, refetch, saveConfig };
}

export async function puxarProximoLead(closer: string): Promise<{ lead: PoolLead | null; error: any }> {
  const { data, error } = await db.rpc("distribuir_pool_lead", { p_closer: closer });
  const lead = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
  return { lead: lead as PoolLead | null, error };
}

export async function registrarResultadoPool(
  leadId: string,
  closer: string,
  resultado: "convertido" | "sem_sucesso" | "devolvido",
  ofertaTier: number | null,
) {
  return db.rpc("pool_registrar_resultado", {
    p_lead_id: leadId,
    p_closer: closer,
    p_resultado: resultado,
    p_oferta_tier: ofertaTier,
  });
}
