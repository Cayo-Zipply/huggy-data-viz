import type { SupabaseClient } from '@supabase/supabase-js';

export type ProgressStatus = 'concluido' | 'em_andamento' | 'nao_iniciado';
export type MyProgress = {
  origem: 'conteudo' | 'artigo'; item_id: string; percentual: number | null;
  concluido: boolean | null; concluido_em: string | null; status: ProgressStatus;
};
export type SavedProgress = { percentual: number | null; concluido: boolean | null };

export const MAX_SAMPLE_JUMP_SEC = 15;
export const COMPLETION_RATIO = 0.9;
export const SAVE_EVERY_MS = 10_000;

const pct = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : null; };

/** Índice por origem + item, para cruzar com os cards de vídeo/arquivo e de artigo. */
export function progressIndex(rows: MyProgress[]) {
  return new Map(rows.map(r => [`${r.origem}:${r.item_id}`, r]));
}
/**
 * Maior ponto assistido: só avança quando a amostra vem em sequência (até 15s depois da anterior)
 * e continua do trecho já assistido. Pular para frente não soma.
 */
export function advanceWatched(max: number, last: number, now: number) {
  const jump = now - last;
  return jump >= 0 && jump <= MAX_SAMPLE_JUMP_SEC && now <= max + MAX_SAMPLE_JUMP_SEC ? Math.max(max, now) : max;
}
/** Só conclui no fim do vídeo quem assistiu pelo menos 90% da duração. */
export const canConclude = (max: number, duration: number) => duration > 0 && max >= duration * COMPLETION_RATIO;
export const watchedPercent = (max: number, duration: number) => duration > 0 ? pct((max / duration) * 100) ?? 0 : 0;

/** A RPC pode devolver o percentual, uma linha ou uma lista com a linha do progresso. */
export function progressFromRpc(data: unknown): SavedProgress {
  const row = Array.isArray(data) ? data[0] : data;
  if (typeof row === 'number') return { percentual: pct(row), concluido: null };
  if (row && typeof row === 'object') {
    const r = row as Record<string, unknown>;
    return { percentual: r.percentual == null ? null : pct(r.percentual), concluido: typeof r.concluido === 'boolean' ? r.concluido : r.concluido_em ? true : null };
  }
  return { percentual: null, concluido: null };
}
export async function registerTrainingProgress(client: Pick<SupabaseClient, 'rpc'>, conteudoId: string, posicaoSeg: number, duracaoSeg: number | null, concluir: boolean) {
  const { data, error } = await client.rpc('se_registrar_progresso', {
    p_conteudo_id: conteudoId, p_posicao_seg: Math.max(0, Math.floor(posicaoSeg)),
    p_duracao_seg: duracaoSeg == null ? null : Math.round(duracaoSeg), p_concluir: concluir,
  });
  if (error) throw error;
  return progressFromRpc(data);
}
/** ID do vídeo do YouTube a partir do link cadastrado; outros serviços devolvem null. */
export function youtubeVideoId(value: string | null | undefined): string | null {
  try {
    const u = new URL(value ?? ''); const host = u.hostname.replace(/^www\./, '');
    if (!['youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'youtu.be'].includes(host)) return null;
    const id = host === 'youtu.be' ? u.pathname.split('/')[1] : u.searchParams.get('v') ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
    return id && /^[\w-]+$/.test(id) ? id : null;
  } catch { return null; }
}

type YT = { Player: new (el: HTMLElement, options: Record<string, unknown>) => YTPlayer };
export type YTPlayer = { getCurrentTime(): number; getDuration(): number; getPlayerState(): number; destroy(): void };
let youtubeApi: Promise<YT> | null = null;
/** Carrega a YouTube IFrame Player API uma única vez. */
export function loadYoutubeApi(): Promise<YT> {
  const w = window as unknown as { YT?: YT; onYouTubeIframeAPIReady?: () => void };
  if (w.YT?.Player) return Promise.resolve(w.YT);
  return youtubeApi ??= new Promise<YT>((resolve, reject) => {
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { previous?.(); resolve(w.YT as YT); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { youtubeApi = null; reject(new Error('Não foi possível carregar o player do YouTube.')); };
    document.head.appendChild(script);
  });
}
