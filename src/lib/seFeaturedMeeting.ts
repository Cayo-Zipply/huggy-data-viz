import type { SupabaseClient } from '@supabase/supabase-js';
import { safeLink } from './seTraining';

export type FeaturedPeriod = 'mes' | 'semana';
export const featuredMeetingKey = (periodo: FeaturedPeriod) => ['se-reuniao-semana', periodo];
export const featuredSwapParams = (inicio: string, meeting: string, summary: string, periodo: FeaturedPeriod) => ({
  p_ref: inicio, p_forcar: meeting, p_resumo: summary.trim() || null, p_periodo: periodo,
});
export function featuredMonth(inicio: string) {
  return new Date(`${inicio.slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}
export const videoErrorMessage = (codigo?: string) => codigo === 'nao_conectado'
  ? 'Vídeo indisponível: Read AI ainda não conectada'
  : codigo === 'sem_gravacao' ? 'Esta reunião não tem gravação' : 'Não foi possível carregar o vídeo agora';

export async function requestMeetingVideo(client: Pick<SupabaseClient, 'functions'>, meetingId: string, fallback: string | null) {
  try {
    const { data, error } = await client.functions.invoke('readai-video', { body: { readai_meeting_id: meetingId } });
    let payload = data;
    if (error?.context instanceof Response) {
      try { payload = await error.context.clone().json(); } catch { /* Falha sem corpo JSON. */ }
    }
    const link = safeLink(payload?.readai_url) ?? safeLink(fallback);
    const url = !error && !payload?.codigo ? safeLink(payload?.url) : null;
    return { url, link, message: url ? null : videoErrorMessage(payload?.codigo) };
  } catch {
    return { url: null, link: safeLink(fallback), message: videoErrorMessage() };
  }
}
const brl = (v: number | null | undefined) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2 });
export type FeaturedChip = { label: string; tone: 'ok' | 'bad' | 'off' };
/** Selos da reunião em destaque; selo sem valor no banco não vira chip. */
export function featuredChips(m: { selo_assinou_na_call?: boolean | null; selo_tabela?: boolean | null; valor_relatorio?: number | null; preco_tabela?: number | null }): FeaturedChip[] {
  const chips: FeaturedChip[] = [];
  if (m.selo_assinou_na_call != null) chips.push(m.selo_assinou_na_call ? { label: 'Assinou na call', tone: 'ok' } : { label: 'Não assinou na call', tone: 'off' });
  if (m.selo_tabela === true) chips.push({ label: 'Na tabela', tone: 'ok' });
  if (m.selo_tabela === false) chips.push({ label: `${brl(m.valor_relatorio)} de ${brl(m.preco_tabela)}`, tone: 'bad' });
  return chips;
}
/** "Não copie": ressalvas (guardrails) seguidas dos pontos de melhoria, sem vazios nem repetidos. */
export function featuredDontCopy(ressalvas: string[] | null | undefined, pontosMelhoria: string[] | null | undefined) {
  return [...new Set([...(ressalvas ?? []), ...(pontosMelhoria ?? [])].map(t => t?.trim()).filter(Boolean))] as string[];
}
/** A faixa âmbar só aparece quando a escolha foi por exceção. */
export const featuredExceptionAlerts = (criterio: string | null | undefined, alertas: string[] | null | undefined) => criterio === 'excecao' ? (alertas ?? []).filter(Boolean) : null;
