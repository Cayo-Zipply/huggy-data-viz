import { describe, expect, test } from 'bun:test';
import { articlesByModule, bestScores, gradeQuiz, quizOptions } from '../src/lib/seArticles';

const ten = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, correta: 'a' }));
const mark = (right: number) => Object.fromEntries(ten.map((q, i) => [q.id, i < right ? 'a' : 'b']));

describe('prova dos artigos de treinamento', () => {
  test('7 de 10 dá nota 70 e aprova', () => {
    expect(gradeQuiz(ten, mark(7))).toMatchObject({ acertos: 7, total: 10, nota: 70, aprovado: true });
  });
  test('6 de 10 dá nota 60 e não aprova', () => {
    expect(gradeQuiz(ten, mark(6))).toMatchObject({ acertos: 6, nota: 60, aprovado: false });
  });
  test('nota é arredondada: 2 de 3 = 67', () => {
    expect(gradeQuiz(ten.slice(0, 3), mark(2)).nota).toBe(67);
  });
  test('questão sem resposta conta como erro', () => {
    const r = gradeQuiz(ten.slice(0, 2), { q0: 'a' });
    expect(r.acertos).toBe(1); expect(r.itens[1]).toMatchObject({ marcada: null, acertou: false });
  });
  test('badge usa a melhor nota do usuário por treinamento', () => {
    expect(bestScores([{ treinamento_id: 't1', nota: 50 }, { treinamento_id: 't1', nota: 90 }, { treinamento_id: 't1', nota: 70 }, { treinamento_id: 't2', nota: null }])).toEqual({ t1: 90 });
  });
  test('cards agrupados por módulo e ordenados por ordem', () => {
    const a = (id: string, modulo: string, ordem: number) => ({ id, modulo, ordem, slug: id, titulo: id, resumo: null, nivel: null, tempo_leitura_min: null });
    const g = articlesByModule([a('c', 'Funil', 3), a('b', 'Fundamentos de Vendas', 2), a('a', 'Fundamentos de Vendas', 1)]);
    expect(g.map(x => [x.modulo, x.items.map(i => i.id)])).toEqual([['Fundamentos de Vendas', ['a', 'b']], ['Funil', ['c']]]);
  });
  test('alternativas aceitam lista ou texto JSON', () => {
    expect(quizOptions('[{"id":"a","texto":"x"}]')).toEqual([{ id: 'a', texto: 'x' }]);
    expect(quizOptions([{ id: 'b', texto: 'y' }])).toEqual([{ id: 'b', texto: 'y' }]);
    expect(quizOptions(null)).toEqual([]);
  });
});
