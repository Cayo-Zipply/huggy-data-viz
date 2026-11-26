import { describe, expect, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { featuredChips, featuredDontCopy, featuredExceptionAlerts, featuredMeetingKey, featuredSwapParams, requestMeetingVideo, videoErrorMessage } from '../src/lib/seFeaturedMeeting';

const client = (result: unknown) => ({ functions: { invoke: async () => result } }) as unknown as Pick<SupabaseClient, 'functions'>;
describe('Reunião em destaque', () => {
  test('mês e semana não compartilham a mesma entrada de cache', () => {
    expect(featuredMeetingKey('mes')).toEqual(['se-reuniao-semana', 'mes']);
    expect(featuredMeetingKey('semana')).toEqual(['se-reuniao-semana', 'semana']);
  });
  test('troca mensal envia o período e resumo nulo quando vazio', () => {
    expect(featuredSwapParams('2026-11-01', 'reuniao-1', ' ', 'mes')).toEqual({ p_ref: '2026-11-01', p_forcar: 'reuniao-1', p_resumo: null, p_periodo: 'mes' });
  });
  test('troca semanal preserva o resumo e período', () => {
    expect(featuredSwapParams('2026-11-23', 'reuniao-2', ' Resumo ', 'semana')).toEqual({ p_ref: '2026-11-23', p_forcar: 'reuniao-2', p_resumo: 'Resumo', p_periodo: 'semana' });
  });
  test('cada clique busca uma nova URL e envia somente o id da reunião', async () => {
    const calls: unknown[] = [];
    const c = { functions: { invoke: async (...args: unknown[]) => { calls.push(args); return { data: { url: `https://example.org/video-${calls.length}.mp4`, readai_url: 'https://example.org/read' }, error: null }; } } } as unknown as Pick<SupabaseClient, 'functions'>;
    expect((await requestMeetingVideo(c, 'reuniao-1', null)).url).toBe('https://example.org/video-1.mp4');
    expect((await requestMeetingVideo(c, 'reuniao-1', null)).url).toBe('https://example.org/video-2.mp4');
    expect(calls).toEqual(Array(2).fill(['readai-video', { body: { readai_meeting_id: 'reuniao-1' } }]));
  });
  test.each(['nao_conectado', 'sem_gravacao', 'sem_acesso', 'erro_readai'])('erro HTTP %s recupera codigo e link do corpo', async codigo => {
    const result = await requestMeetingVideo(client({ data: null, error: { context: new Response(JSON.stringify({ codigo, readai_url: 'https://example.org/read' }), { status: 403 }) } }), 'id', null);
    expect(result).toEqual({ url: null, link: 'https://example.org/read', message: videoErrorMessage(codigo) });
  });
  test('falha de rede mantém o link conhecido e não produz vídeo', async () => {
    expect(await requestMeetingVideo(client({ data: null, error: new Error('network') }), 'id', 'https://example.org/read')).toEqual({ url: null, link: 'https://example.org/read', message: videoErrorMessage() });
  });
  test('resposta inválida ou URL insegura não vira src', async () => {
    const result = await requestMeetingVideo(client({ data: { url: 'javascript:alert(1)', readai_url: 'data:text/html,unsafe' }, error: null }), 'id', null);
    expect(result.url).toBeNull(); expect(result.link).toBeNull(); expect(result.message).toBe(videoErrorMessage());
  });
  test('chips: assinou na call verde, na tabela verde', () => {
    expect(featuredChips({ selo_assinou_na_call: true, selo_tabela: true })).toEqual([{ label: 'Assinou na call', tone: 'ok' }, { label: 'Na tabela', tone: 'ok' }]);
  });
  test('fora da tabela fica vermelho com valor vendido e preço de tabela', () => {
    const chips = featuredChips({ selo_assinou_na_call: false, selo_tabela: false, valor_relatorio: 1200, preco_tabela: 1621 });
    expect(chips[0].tone).toBe('off');
    expect(chips[1].tone).toBe('bad');
    expect(chips[1].label.replace(/\s/g, ' ')).toBe('R$ 1.200 de R$ 1.621');
  });
  test('selos sem valor no banco não geram chip', () => {
    expect(featuredChips({ selo_assinou_na_call: null, selo_tabela: null })).toEqual([]);
  });
  test('Não copie junta ressalvas e pontos de melhoria; vazio quando ambos vazios', () => {
    expect(featuredDontCopy(['Prometeu prazo'], ['Falou demais', 'Prometeu prazo'])).toEqual(['Prometeu prazo', 'Falou demais']);
    expect(featuredDontCopy(null, [])).toEqual([]);
  });
  test('faixa de exceção só para criterio_escolha excecao', () => {
    expect(featuredExceptionAlerts('excecao', ['Fora da tabela'])).toEqual(['Fora da tabela']);
    expect(featuredExceptionAlerts('completo', ['Fora da tabela'])).toBeNull();
    expect(featuredExceptionAlerts('manual', null)).toBeNull();
  });
});
