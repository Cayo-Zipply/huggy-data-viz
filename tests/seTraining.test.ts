import { describe, expect, test } from 'bun:test';
import { completeTraining, dateSE, draftTrainingContent, embedTrainingUrl, groupTraining, nextDay, safeLink, signedTrainingUrl, startTraining, type TrainingGap, type TrainingSuggestion } from '../src/lib/seTraining';
import type { SupabaseClient } from '@supabase/supabase-js';
const gap = (closer='Ana',codigo='diagnostico',posicao=1):TrainingGap=>({closer,codigo,posicao,tipo_gap:'criterio',media:5,frequencia:null,pontos_perdidos:4,reunioes:2,amostra_suficiente:false});
const content = (closer='Ana',codigo='diagnostico',ordem=1):TrainingSuggestion=>({...gap(closer,codigo),conteudo_id:`${closer}-${ordem}`,conteudo_titulo:'Aula',descricao:null,conteudo_tipo:'video',url:'https://youtu.be/abc',storage_path:null,duracao_min:5,ordem,iniciado_em:null,concluido_em:null});
describe('Treinamento e reunião da semana',()=>{
 test('material nasce em rascunho e não envia autoria/data de aprovação',()=>{const payload=draftTrainingContent({titulo:'Aula',descricao:null,tipo:'link',url:'https://example.org',storage_path:null,codigo_alvo:'abertura',duracao_min:null,ordem:1});expect(payload.status).toBe('rascunho');expect(Object.keys(payload)).not.toContain('aprovado_por');expect(Object.keys(payload)).not.toContain('aprovado_em');});
 test('semana inclui todo o último dia, inclusive virada do mês',()=>{expect(nextDay('2026-11-30')).toBe('2026-12-01');expect(nextDay('2026-12-31')).toBe('2027-01-01');});
 test('quando_local sem fuso preserva a hora de São Paulo',()=>{expect(dateSE('2026-11-26T15:30:00',true)).toContain('15:30');expect(dateSE('2026-11-26T18:30:00Z',true)).toContain('15:30');});
 test('gaps são limitados às posições 1–4 e preservam os sem material',()=>{const groups=groupTraining([gap(),gap('Ana','objecoes',4),gap('Ana','abertura',5)],[],'todos');expect(groups.map(g=>g.gap.codigo)).toEqual(['diagnostico','objecoes']);expect(groups[1].contents).toEqual([]);});
 test('conteúdos e filtro administrativo não misturam closers',()=>{const groups=groupTraining([gap(),gap('Bia')],[content('Bia'),content('Ana')],'Ana');expect(groups).toHaveLength(1);expect(groups[0].contents.map(c=>c.closer)).toEqual(['Ana']);});
 test('conteúdos são ordenados por ordem dentro de cada gap',()=>{expect(groupTraining([gap()],[content('Ana','diagnostico',3),content('Ana','diagnostico',1)],'todos')[0].contents.map(c=>c.ordem)).toEqual([1,3]);});
 test('YouTube, Loom e Vimeo viram embeds e rejeitam domínios falsos',()=>{
  expect(embedTrainingUrl('https://youtu.be/abc-123')).toBe('https://www.youtube-nocookie.com/embed/abc-123');
  expect(embedTrainingUrl('https://www.youtube.com/watch?v=abc')).toBe('https://www.youtube-nocookie.com/embed/abc');
  expect(embedTrainingUrl('https://www.loom.com/share/abcdef')).toBe('https://www.loom.com/embed/abcdef');
  expect(embedTrainingUrl('https://vimeo.com/123')).toBe('https://player.vimeo.com/video/123');
  expect(embedTrainingUrl('https://youtube.com.evil.invalid/watch?v=abc')).toBeNull();
 });
 test('links não executam scripts nem data URLs',()=>{expect(safeLink('javascript:alert(1)')).toBeNull();expect(safeLink('data:text/html,a')).toBeNull();expect(safeLink('https://example.org/curso')).toBe('https://example.org/curso');});
 test('arquivo usa bucket privado treinamento com URL assinada de uma hora',async()=>{
  const calls:unknown[]=[];
  const client={storage:{from:(bucket:string)=>{calls.push(bucket);return {createSignedUrl:async(path:string,seconds:number)=>{calls.push(path,seconds);return {data:{signedUrl:'https://example.org/signed'},error:null};}};}}} as unknown as Pick<SupabaseClient,'storage'>;
  expect(await signedTrainingUrl(client,'usuario/video.mp4')).toBe('https://example.org/signed');expect(calls).toEqual(['treinamento','usuario/video.mp4',3600]);
 });
 test('falha da assinatura não gera URL pública de fallback',async()=>{
  const client={storage:{from:()=>({createSignedUrl:async()=>({data:null,error:new Error('negado')})})}} as unknown as Pick<SupabaseClient,'storage'>;
  await expect(signedTrainingUrl(client,'privado.pdf')).rejects.toThrow('negado');
 });
 test('abrir registra só conteudo_id sem sobrescrever conclusão prévia',async()=>{
  const calls:unknown[]=[];const client={from:(table:string)=>{calls.push(table);return {upsert:async(...args:unknown[])=>{calls.push(...args);return {error:null};}};}} as unknown as Pick<SupabaseClient,'from'>;
  await startTraining(client,'aula-1');expect(calls).toEqual(['se_treinamento_progresso',{conteudo_id:'aula-1'},{onConflict:'user_id,conteudo_id',ignoreDuplicates:true}]);
 });
 test('concluir atualiza somente a linha do usuário e conteúdo atuais',async()=>{
  const calls:unknown[]=[];const builder={update:(value:unknown)=>{calls.push(value);return builder;},eq:(...args:unknown[])=>{calls.push(args);return builder;},select:async()=>({data:[{conteudo_id:'aula-1'}],error:null})};
  const client={from:()=>builder} as unknown as Pick<SupabaseClient,'from'>;await completeTraining(client,'aula-1','user-1');expect(calls).toContainEqual(['conteudo_id','aula-1']);expect(calls).toContainEqual(['user_id','user-1']);expect(Number.isNaN(Date.parse((calls[0] as {concluido_em:string}).concluido_em))).toBe(false);
 });
 test('conclusão sem linha retornada é erro, não sucesso',async()=>{
  const b={update:()=>b,eq:()=>b,select:async()=>({data:[],error:null})};const c={from:()=>b} as unknown as Pick<SupabaseClient,'from'>;
  await expect(completeTraining(c,'aula','user')).rejects.toThrow('A');
 });
});
