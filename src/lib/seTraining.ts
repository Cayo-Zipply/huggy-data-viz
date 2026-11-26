import type { SupabaseClient } from '@supabase/supabase-js';
import type { RubricaSE } from './seEvaluation';
export type TrainingContent = {
  id: string; titulo: string; descricao: string | null; tipo: 'video' | 'arquivo' | 'link';
  url: string | null; storage_path: string | null; codigo_alvo: string; duracao_min: number | null;
  ordem: number; status: 'rascunho' | 'aprovado' | 'arquivado';
};
export const draftTrainingContent = (values: Omit<TrainingContent, 'id' | 'status'>) => ({ ...values, status: 'rascunho' as const });
export type TrainingGap = {
  closer: string; posicao?: number; posicao_gap?: number; tipo_gap: string; codigo: string;
  gap_titulo?: string; titulo?: string; media: number | null; frequencia: number | null;
  pontos_perdidos: number | null; reunioes: number; amostra_suficiente: boolean;
};
export type TrainingSuggestion = TrainingGap & {
  conteudo_id: string | null; conteudo_titulo: string | null; descricao: string | null;
  conteudo_tipo: TrainingContent['tipo']; url: string | null; storage_path: string | null;
  duracao_min: number | null; ordem: number; iniciado_em: string | null; concluido_em: string | null;
};
export type TrainingPlayable = Pick<TrainingSuggestion, 'conteudo_id' | 'conteudo_titulo' | 'descricao' | 'conteudo_tipo' | 'url' | 'storage_path' | 'duracao_min' | 'iniciado_em' | 'concluido_em'>;
export type TrainingProgress = { conteudo_id: string; iniciado_em: string | null; concluido_em: string | null };
export const selectedTrainingCloser = (selected: string, closers: string[]) => closers.includes(selected) ? selected : closers[0] ?? '';
export function trainingViewQuery(client: Pick<SupabaseClient, 'from'>, view: 'vw_se_gaps_closer' | 'vw_se_treinamento_sugestoes', closer: string | null) {
  const query = client.from(view).select('*');
  return closer ? query.eq('closer', closer) : query;
}
export function trainingTargets(rubric: RubricaSE[], tipo: 'criterio' | 'guardrail') {
  return rubric.filter((r, i, all) => r.ativo === true && r.tipo === tipo && !!r.codigo && all.findIndex(x => x.ativo === true && x.tipo === tipo && x.codigo === r.codigo) === i);
}
export const trainingTargetTitle = (rubric: RubricaSE[], codigo: string) => rubric.find(r => r.codigo === codigo && r.ativo === true)?.titulo || 'Ponto da régua indisponível';
export function groupTrainingLibrary(contents: TrainingContent[], rubric: RubricaSE[], suggestions: TrainingSuggestion[], progress: TrainingProgress[]) {
  const recommended = new Set(suggestions.map(s => s.conteudo_id).filter(Boolean));
  const groups = new Map<string, { codigo: string; titulo: string; contents: { content: TrainingPlayable; recommended: boolean }[] }>();
  for (const c of [...contents].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))) {
    if (c.status !== 'aprovado') continue;
    const group = groups.get(c.codigo_alvo) ?? { codigo: c.codigo_alvo, titulo: trainingTargetTitle(rubric, c.codigo_alvo), contents: [] };
    const p = progress.find(row => row.conteudo_id === c.id);
    group.contents.push({ recommended: recommended.has(c.id), content: {
      conteudo_id: c.id, conteudo_titulo: c.titulo, descricao: c.descricao, conteudo_tipo: c.tipo, url: c.url,
      storage_path: c.storage_path, duracao_min: c.duracao_min, iniciado_em: p?.iniciado_em ?? null, concluido_em: p?.concluido_em ?? null,
    } });
    groups.set(c.codigo_alvo, group);
  }
  return [...groups.values()];
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
export const gapKey = (g: TrainingGap) => `${g.closer}|${g.tipo_gap}|${g.codigo}`;
export function groupTraining(gaps: TrainingGap[], suggestions: TrainingSuggestion[], closer: string) {
  return gaps.filter(g => (g.posicao ?? g.posicao_gap ?? Infinity) <= 4 && (closer === 'todos' || g.closer === closer))
    .sort((a,b) => (a.posicao ?? a.posicao_gap ?? 0)-(b.posicao ?? b.posicao_gap ?? 0))
    .map(g => ({ gap:g, contents:suggestions.filter(s => s.conteudo_id && gapKey(s) === gapKey(g)).sort((a,b) => (a.ordem ?? 0)-(b.ordem ?? 0)) }));
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
