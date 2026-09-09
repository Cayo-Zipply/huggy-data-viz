import { useCallback, useEffect, useState } from "react";
import { sbExt } from "@/lib/supabaseExternal";

export type PendenciaSituacao = "ok" | "no_prazo" | "vencido" | "dispensado";
export type PendenciaDiagnostico =
  | "ok"
  | "rascunho_nao_gerado"
  | "rascunho_nao_enviado"
  | "erro_envio";

export interface PendenciaEmail {
  lead_id: string;
  empresa: string | null;
  closer: string | null;
  dt_ganho: string | null;
  prazo: string | null;
  juridico_enviado: boolean | null;
  financeiro_enviado: boolean | null;
  juridico_enviado_em: string | null;
  financeiro_enviado_em: string | null;
  faltando: string[] | null;
  situacao: PendenciaSituacao;
  diagnostico: PendenciaDiagnostico | null;
  ultimo_erro: string | null;
  email_pendencia_dispensa_motivo: string | null;
}

const db = sbExt as any;
const VIEW = "vw_ganhos_pendencia_email";

/** Formata datas sempre em America/Sao_Paulo */
export function fmtData(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
}

export function fmtDataHora(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
  const hora = d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data} às ${hora}`;
}

export function labelFaltando(faltando?: string[] | null) {
  const arr = (faltando || []).map((f) =>
    f === "juridico" ? "Jurídico" : f === "financeiro" ? "Financeiro" : f
  );
  if (arr.length === 0) return "";
  if (arr.length === 1) return arr[0];
  return arr.join(" e ");
}

export async function dispensarPendencia(leadId: string, userId: string, motivo: string) {
  return db
    .from("leads")
    .update({
      email_pendencia_dispensada_em: new Date().toISOString(),
      email_pendencia_dispensada_por: userId,
      email_pendencia_dispensa_motivo: motivo,
    })
    .eq("id", leadId);
}

export async function reabrirPendencia(leadId: string) {
  return db
    .from("leads")
    .update({
      email_pendencia_dispensada_em: null,
      email_pendencia_dispensada_por: null,
      email_pendencia_dispensa_motivo: null,
    })
    .eq("id", leadId);
}

/** Lista completa da view (RLS já filtra por closer). */
export function usePendenciasEmail() {
  const [items, setItems] = useState<PendenciaEmail[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await db.from(VIEW).select("*").order("prazo", { ascending: true });
    if (error) console.error("[usePendenciasEmail]", error);
    setItems((data as PendenciaEmail[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const abertas = items.filter((i) => i.situacao === "no_prazo" || i.situacao === "vencido");
  const vencidas = items.filter((i) => i.situacao === "vencido");

  return {
    items,
    loading,
    refetch,
    abertas,
    vencidas,
    count: abertas.length,
    countVencidos: vencidas.length,
  };
}

/** Pendência de um lead específico. */
export function usePendenciaLead(leadId: string | null) {
  const [pendencia, setPendencia] = useState<PendenciaEmail | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!leadId) {
      setPendencia(null);
      return;
    }
    setLoading(true);
    const { data, error } = await db.from(VIEW).select("*").eq("lead_id", leadId).maybeSingle();
    if (error) console.error("[usePendenciaLead]", error);
    setPendencia((data as PendenciaEmail) || null);
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { pendencia, loading, refetch };
}
