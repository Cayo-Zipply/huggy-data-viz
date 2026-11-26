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