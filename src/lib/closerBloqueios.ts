import type { SupabaseClient } from "@supabase/supabase-js";
import { hhmm, HORAS, intervaloValido } from "@/lib/horarios";

type ClienteBloqueios = Pick<SupabaseClient, "from">;

export const ALMOCO_PADRAO = { inicio: "12:00", fim: "13:00" } as const;

export type AlmocoPadrao = { id: string; inicio: string; fim: string };
export type BloqueioEfetivo = {
  id: string;
  closer: string;
  data: string;
  inicio: string;
  fim: string;
  tipo: "almoco" | "ausente";
  motivo: string | null;
  padrao: boolean;
};

export function intervaloBloqueioValido(inicio: string, fim: string): boolean {
  return HORAS.includes(inicio) && HORAS.includes(fim) && intervaloValido(inicio, fim);
}

export async function lerAlmocoPadrao(cliente: ClienteBloqueios, closer: string): Promise<AlmocoPadrao | null> {
  const { data, error } = await cliente.from("closer_bloqueios")
    .select("id, inicio, fim").eq("closer", closer).eq("tipo", "almoco").is("data", null).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, inicio: hhmm(data.inicio), fim: hhmm(data.fim) } : null;
}

export async function salvarAlmocoPadrao(cliente: ClienteBloqueios, closer: string, inicio: string, fim: string): Promise<void> {
  if (!closer || !intervaloBloqueioValido(inicio, fim)) throw new Error("Informe um intervalo válido de almoço.");
  // Os índices de almoço são parciais: sempre consultar antes de inserir/atualizar.
  const existente = await lerAlmocoPadrao(cliente, closer);
  const valores = { inicio, fim, updated_at: new Date().toISOString() };
  const consulta = existente
    ? cliente.from("closer_bloqueios").update(valores).eq("id", existente.id).eq("closer", closer)
    : cliente.from("closer_bloqueios").insert({ closer, tipo: "almoco", data: null, ...valores });
  const { error } = await consulta.select("id").single();
  if (error) throw error;
}

export async function removerAlmocoPadrao(cliente: ClienteBloqueios, closer: string): Promise<void> {
  const { error } = await cliente.from("closer_bloqueios")
    .delete().eq("closer", closer).eq("tipo", "almoco").is("data", null);
  if (error) throw error;
}