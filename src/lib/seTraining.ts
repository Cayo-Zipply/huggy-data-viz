import type { SupabaseClient } from '@supabase/supabase-js';
export type TrainingContent = {
  id: string; titulo: string; descricao: string | null; tipo: 'video' | 'arquivo' | 'link';
  url: string | null; storage_path: string | null; trilha: string | null; duracao_min: number | null;
  ordem: number; status: 'rascunho' | 'aprovado' | 'arquivado';
  capa_path?: string | null; capa_url?: string | null;
};
export const draftTrainingContent = (values: Omit<TrainingContent, 'id' | 'status'>) => ({ ...values, status: 'rascunho' as const });
export type TrainingTrack = { codigo: string; titulo: string; ordem: number | null; ativo?: boolean | null };
export type TrainingFocus = { closer?: string | null; posicao: number | null; trilha?: string | null; trilha_codigo?: string | null; codigo?: string | null };
export type TrainingProgress = { conteudo_id: string; iniciado_em?: string | null; concluido_em: string | null };
export type TrainingPlayable = TrainingContent & { concluido_em: string | null };
export type TrainingRow = { codigo: string; titulo: string; foco: boolean; contents: TrainingPlayable[] };
export const selectedTrainingCloser = (selected: string, closers: string[]) => closers.includes(selected) ? selected : closers[0] ?? '';
/** Admin filtra pelo closer escolhido; vendedor recebe do banco só as próprias linhas, sem filtro de identidade. */
export function trainingFocusQuery(client: Pick<SupabaseClient, 'from'>, closer: string | null) {
  const query = client.from('vw_treinamento_foco').select('*');
  return closer ? query.eq('closer', closer) : query;
}
export const focusTrackCode = (f: TrainingFocus) => f.trilha ?? f.trilha_codigo ?? f.codigo ?? null;
/** Trilhas de foco: posições 1 e 2, na ordem da posição. */
export function focusTrackCodes(focus: TrainingFocus[]) {
  const codes = [...focus].filter(f => f.posicao != null && f.posicao <= 2).sort((a, b) => (a.posicao ?? 0) - (b.posicao ?? 0)).map(focusTrackCode).filter((c): c is string => !!c);
  return [...new Set(codes)];
}
/** Uma fileira por trilha ativa com vídeo; foco primeiro, depois a ordem normal. */
export function trainingRows(tracks: TrainingTrack[], contents: TrainingContent[], focus: TrainingFocus[], progress: TrainingProgress[]): TrainingRow[] {
  const focusCodes = focusTrackCodes(focus);
  const done = new Map(progress.map(p => [p.conteudo_id, p.concluido_em ?? null]));
  const rows = [...tracks].filter(t => t.ativo !== false).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map(t => ({
    codigo: t.codigo, titulo: t.titulo, foco: focusCodes.includes(t.codigo),
    contents: contents.filter(c => c.trilha === t.codigo && c.status === 'aprovado').sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map(c => ({ ...c, concluido_em: done.get(c.id) ?? null })),
  })).filter(r => r.contents.length > 0);
  return [...rows.filter(r => r.foco).sort((a, b) => focusCodes.indexOf(a.codigo) - focusCodes.indexOf(b.codigo)), ...rows.filter(r => !r.foco)];
}
/** Capa: capa_path (assinada) > capa_url > miniatura do YouTube > nenhuma. */
export function trainingCover(c: Pick<TrainingContent, 'capa_path' | 'capa_url' | 'url'>, signed: Record<string, string> = {}): string | null {
  return (c.capa_path ? signed[c.capa_path] : null) ?? safeLink(c.capa_url) ?? youtubeTrainingThumbnail(c.url);
}
export async function signedTrainingCovers(client: Pick<SupabaseClient, 'storage'>, paths: string[]) {
  if (!paths.length) return {} as Record<string, string>;
  const { data, error } = await client.storage.from('treinamento').createSignedUrls(paths, 3600);
  if (error) throw error;
  return Object.fromEntries((data ?? []).filter(d => d.path && d.signedUrl && !d.error).map(d => [d.path as string, d.signedUrl]));
}
export function trainingErrorMessage(error: unknown, fallback = 'Tente novamente.') {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : fallback;
}
export const safeLink = (value: string | null | undefined) => {
  try { const u = new URL(value ?? ''); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null; } catch { return null; }
};
export function embedTrainingUrl(value: string | null | undefined): string | null {
  const safe = safeLink(value);
  if (!safe) return null;
  const u = new URL(safe); const host = u.hostname.replace(/^www\./, '');
  if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'youtu.be'].includes(host)) {
    const id = host === 'youtu.be' ? u.pathname.split('/')[1] : u.searchParams.get('v') ?? u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
    return id && /^[\w-]+$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` : null;
  }
  if (host === 'loom.com') { const id = u.pathname.match(/^\/(?:share|embed)\/([a-zA-Z0-9-]+)/)?.[1]; return id ? `https://www.loom.com/embed/${id}` : null; }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') { const id = u.pathname.match(/(?:^\/|\/video\/)(\d+)/)?.[1]; return id ? `https://player.vimeo.com/video/${id}${u.searchParams.has('h') ? `?h=${encodeURIComponent(u.searchParams.get('h') ?? '')}` : ''}` : null; }
  return null;
}
export function nextDay(iso: string): string { const d = new Date(`${iso.slice(0,10)}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+1); return d.toISOString().slice(0,10); }
export function youtubeTrainingThumbnail(value: string | null | undefined): string | null {
  const embed = embedTrainingUrl(value);
  const id = embed?.match(/^https:\/\/www\.youtube-nocookie\.com\/embed\/([\w-]+)/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
export async function signedTrainingUrl(client: Pick<SupabaseClient, 'storage'>, path: string) {
  const { data, error } = await client.storage.from('treinamento').createSignedUrl(path, 3600);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Não foi possível abrir o arquivo.');
  return data.signedUrl;
}
export async function startTraining(client: Pick<SupabaseClient, 'from'>, conteudoId: string) {
  const { error } = await client.from('se_treinamento_progresso').upsert({ conteudo_id: conteudoId }, { onConflict: 'user_id,conteudo_id', ignoreDuplicates: true });
  if (error) throw error;
}
export async function completeTraining(client: Pick<SupabaseClient, 'from'>, conteudoId: string, userId: string) {
  const { data, error } = await client.from('se_treinamento_progresso').update({ concluido_em: new Date().toISOString() }).eq('conteudo_id', conteudoId).eq('user_id', userId).select('conteudo_id');
  if (error) throw error;
  if (!data?.length) throw new Error('Não foi possível concluir este conteúdo. Abra-o novamente e tente de novo.');
}
export async function downloadTraining(url: string, name: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Não foi possível baixar o arquivo.');
  const blob = await response.blob(); const object = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = object; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(object), 1000);
}
export const dateSE = (value: string | null | undefined, time = false) => {
  if (!value) return '—';
  const local = value.replace(' ', 'T');
  const d = new Date(value.length === 10 ? `${value}T12:00:00Z` : /(?:Z|[+-]\d{2}:?\d{2})$/i.test(local) ? local : `${local}-03:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo', day:'2-digit', month:'2-digit', year:'numeric', ...(time ? { hour:'2-digit', minute:'2-digit' } as const : {}) });
};
