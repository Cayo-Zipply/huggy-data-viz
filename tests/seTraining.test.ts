import { describe, expect, test } from 'bun:test';
import { completeTraining, dateSE, draftTrainingContent, embedTrainingUrl, focusTrackCodes, nextDay, safeLink, selectedTrainingCloser, signedTrainingCovers, signedTrainingUrl, startTraining, trainingCover, trainingErrorMessage, trainingFocusQuery, trainingRows, youtubeTrainingThumbnail, type TrainingContent, type TrainingTrack } from '../src/lib/seTraining';
import type { SupabaseClient } from '@supabase/supabase-js';
describe('Treinamento e reunião da semana',()=>{
 test('admin inicia no primeiro closer e mantém uma seleção válida',()=>{
  expect(selectedTrainingCloser('', ['Fillipe','Luka'])).toBe('Fillipe');
  expect(selectedTrainingCloser('Luka', ['Fillipe','Luka'])).toBe('Luka');
  expect(selectedTrainingCloser('Antigo', ['Fillipe','Luka'])).toBe('Fillipe');
  expect(selectedTrainingCloser('', [])).toBe('');
 });
 test('admin filtra o foco pelo closer escolhido',()=>{
  const calls:unknown[]=[];const builder={select:(c:string)=>{calls.push(c);return builder;},eq:(...args:unknown[])=>{calls.push(args);return builder;}};
  const client={from:(name:string)=>{calls.push(name);return builder;}} as unknown as Pick<SupabaseClient,'from'>;
  trainingFocusQuery(client,'Luka');expect(calls).toEqual(['vw_treinamento_foco','*',['closer','Luka']]);
 });
 test('vendedor não recebe nenhum filtro de identidade no foco',()=>{
  const calls:unknown[]=[];const builder={select:(c:string)=>{calls.push(c);return builder;},eq:(...args:unknown[])=>{calls.push(args);return builder;}};
  const client={from:(name:string)=>{calls.push(name);return builder;}} as unknown as Pick<SupabaseClient,'from'>;
  trainingFocusQuery(client,null);expect(calls).toEqual(['vw_treinamento_foco','*']);
 });
 test('material nasce em rascunho e não envia autoria/data de aprovação',()=>{const payload=draftTrainingContent({titulo:'Aula',descricao:null,tipo:'link',url:'https://example.org',storage_path:null,trilha:'fechamento',duracao_min:null,ordem:1});expect(payload.status).toBe('rascunho');expect(Object.keys(payload)).not.toContain('codigo_alvo');expect(Object.keys(payload)).not.toContain('aprovado_por');expect(Object.keys(payload)).not.toContain('aprovado_em');});
 test('semana inclui todo o último dia, inclusive virada do mês',()=>{expect(nextDay('2026-11-30')).toBe('2026-12-01');expect(nextDay('2026-12-31')).toBe('2027-01-01');});
 test('quando_local sem fuso preserva a hora de São Paulo',()=>{expect(dateSE('2026-11-26T15:30:00',true)).toContain('15:30');expect(dateSE('2026-11-26T18:30:00Z',true)).toContain('15:30');});
 test('YouTube, Loom e Vimeo viram embeds e rejeitam domínios falsos',()=>{
  expect(embedTrainingUrl('https://youtu.be/abc-123')).toBe('https://www.youtube-nocookie.com/embed/abc-123?autoplay=1&rel=0');
  expect(embedTrainingUrl('https://www.youtube.com/watch?v=abc')).toBe('https://www.youtube-nocookie.com/embed/abc?autoplay=1&rel=0');
  expect(embedTrainingUrl('https://www.youtube.com/shorts/abc')).toBe('https://www.youtube-nocookie.com/embed/abc?autoplay=1&rel=0');
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

describe('Página de treinamento', () => {
 const track = (codigo:string, ordem:number, ativo=true):TrainingTrack => ({codigo,titulo:`Trilha ${codigo}`,ordem,ativo});
 const material = (id:string, trilha:string|null='fechamento', ordem=0, status:TrainingContent['status']='aprovado'):TrainingContent => ({id,titulo:id,descricao:null,tipo:'video',url:'https://youtu.be/abc',storage_path:null,trilha,duracao_min:5,ordem,status});
 const tracks=[track('rapport',1),track('fechamento',2),track('objecoes',3),track('vazia',4),track('inativa',0,false)];
 test('uma fileira por trilha ativa na ordem da coluna ordem, com vídeos por ordem',()=>{
  const rows=trainingRows(tracks,[material('b','fechamento',2),material('a','fechamento',1),material('r','rapport')],[],[]);
  expect(rows.map(r=>r.codigo)).toEqual(['rapport','fechamento']);
  expect(rows[1].contents.map(c=>c.id)).toEqual(['a','b']);
 });
 test('trilha sem vídeo aprovado, inativa ou conteúdo sem trilha não aparecem',()=>{
  const rows=trainingRows(tracks,[material('x','inativa'),material('rasc','vazia',0,'rascunho'),material('solto',null),material('ok','objecoes')],[],[]);
  expect(rows.map(r=>r.codigo)).toEqual(['objecoes']);
 });
 test('trilhas de foco são só posições 1 e 2, vêm primeiro na ordem da posição',()=>{
  const focus=[{closer:'Luka',posicao:2,trilha:'rapport'},{closer:'Luka',posicao:1,trilha:'objecoes'},{closer:'Luka',posicao:3,trilha:'fechamento'}];
  expect(focusTrackCodes(focus)).toEqual(['objecoes','rapport']);
  const rows=trainingRows(tracks,[material('f','fechamento'),material('r','rapport'),material('o','objecoes')],focus,[]);
  expect(rows.map(r=>[r.codigo,r.foco])).toEqual([['objecoes',true],['rapport',true],['fechamento',false]]);
 });
 test('Assistido só para o conteúdo com concluido_em',()=>{
  const rows=trainingRows(tracks,[material('visto'),material('aberto'),material('novo')],[],[{conteudo_id:'visto',concluido_em:'2026-11-26T19:00:00Z'},{conteudo_id:'aberto',concluido_em:null}]);
  expect(rows[0].contents.map(c=>c.concluido_em)).toEqual(['2026-11-26T19:00:00Z',null,null]);
 });
 test('miniatura do YouTube sai de watch, youtu.be e shorts',()=>{
  for (const u of ['https://www.youtube.com/watch?v=AbC_12-x','https://youtu.be/AbC_12-x','https://www.youtube.com/shorts/AbC_12-x']) expect(youtubeTrainingThumbnail(u)).toBe('https://i.ytimg.com/vi/AbC_12-x/hqdefault.jpg');
  expect(youtubeTrainingThumbnail('https://vimeo.com/123')).toBeNull();
 });
 test('capa: capa_path assinada > capa_url > miniatura do YouTube > nenhuma',()=>{
  const signed={'u/capa.jpg':'https://example.org/signed.jpg'};const url='https://youtu.be/abc';
  expect(trainingCover({capa_path:'u/capa.jpg',capa_url:'https://example.org/c.jpg',url},signed)).toBe('https://example.org/signed.jpg');
  expect(trainingCover({capa_path:null,capa_url:'https://example.org/c.jpg',url},signed)).toBe('https://example.org/c.jpg');
  expect(trainingCover({capa_path:null,capa_url:null,url},signed)).toBe('https://i.ytimg.com/vi/abc/hqdefault.jpg');
  expect(trainingCover({capa_path:null,capa_url:'javascript:alert(1)',url:'https://example.org/video.mp4'})).toBeNull();
 });
 test('capas privadas são assinadas em lote no bucket treinamento por uma hora',async()=>{
  const calls:unknown[]=[];
  const client={storage:{from:(bucket:string)=>{calls.push(bucket);return {createSignedUrls:async(paths:string[],seconds:number)=>{calls.push(paths,seconds);return {data:[{path:'a.jpg',signedUrl:'https://example.org/a',error:null},{path:'b.jpg',signedUrl:'',error:'not found'}],error:null};}};}}} as unknown as Pick<SupabaseClient,'storage'>;
  expect(await signedTrainingCovers(client,['a.jpg','b.jpg'])).toEqual({'a.jpg':'https://example.org/a'});
  expect(calls).toEqual(['treinamento',['a.jpg','b.jpg'],3600]);
 });
 test('mensagem de erro do banco é preservada mesmo quando não é instância de Error',()=>{
  expect(trainingErrorMessage({message:'trilha inválida',code:'23514'})).toBe('trilha inválida');
  expect(trainingErrorMessage(new Error('Falha de upload'))).toBe('Falha de upload');
 });
});
