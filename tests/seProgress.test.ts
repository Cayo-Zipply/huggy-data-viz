import { describe, expect, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { advanceWatched, canConclude, progressFromRpc, progressIndex, registerTrainingProgress, watchedPercent, youtubeVideoId } from '../src/lib/seProgress';

describe('Progresso dos treinamentos', () => {
  test('assistir em sequência avança o maior ponto assistido', () => {
    expect(advanceWatched(100, 100, 110)).toBe(110);
    expect(advanceWatched(100, 100, 115)).toBe(115);
  });
  test('pular para frente não soma, nem depois de continuar assistindo do ponto pulado', () => {
    expect(advanceWatched(100, 100, 116)).toBe(100);
    expect(advanceWatched(100, 100, 900)).toBe(100);
    expect(advanceWatched(100, 900, 910)).toBe(100);
  });
  test('voltar no vídeo não reduz o maior ponto assistido', () => {
    expect(advanceWatched(100, 100, 40)).toBe(100);
    expect(advanceWatched(100, 40, 50)).toBe(100);
  });
  test('só conclui no fim com pelo menos 90% assistido', () => {
    expect(canConclude(540, 600)).toBe(true);
    expect(canConclude(539, 600)).toBe(false);
    expect(canConclude(10, 0)).toBe(false);
    expect(watchedPercent(300, 600)).toBe(50);
  });
  test('lê o retorno da RPC como número, linha ou lista', () => {
    expect(progressFromRpc(42)).toEqual({ percentual: 42, concluido: null });
    expect(progressFromRpc({ percentual: 95.4, concluido: true })).toEqual({ percentual: 95, concluido: true });
    expect(progressFromRpc([{ percentual: 10, concluido: false }])).toEqual({ percentual: 10, concluido: false });
    expect(progressFromRpc(null)).toEqual({ percentual: null, concluido: null });
  });
  test('arquivo aberto registra em andamento sem duração', async () => {
    const calls: unknown[] = [];
    const client = { rpc: async (...args: unknown[]) => { calls.push(...args); return { data: null, error: null }; } } as unknown as Pick<SupabaseClient, 'rpc'>;
    await registerTrainingProgress(client, 'arq-1', 0, null, false);
    expect(calls).toEqual(['se_registrar_progresso', { p_conteudo_id: 'arq-1', p_posicao_seg: 0, p_duracao_seg: null, p_concluir: false }]);
  });
  test('cruza o progresso por origem e item', () => {
    const index = progressIndex([{ origem: 'artigo', item_id: 'a', percentual: 100, concluido: true, concluido_em: null, status: 'concluido' }]);
    expect(index.get('artigo:a')?.status).toBe('concluido');
    expect(index.get('conteudo:a')).toBeUndefined();
  });
  test('extrai o ID do YouTube e ignora outros serviços', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=abc_123-X')).toBe('abc_123-X');
    expect(youtubeVideoId('https://youtu.be/abc123?t=10')).toBe('abc123');
    expect(youtubeVideoId('https://vimeo.com/123')).toBeNull();
    expect(youtubeVideoId(null)).toBeNull();
  });
});
