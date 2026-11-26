import { describe, expect, test } from 'bun:test';
import { criteriosPreenchidos, evidenciaSE, filtrarSelo, itensRegua, valorDivergente, versaoRegua, type RubricaSE, type SeloSE } from '../src/lib/seEvaluation';
const criterio = (codigo: string, versao: number, tipo = 'criterio'): RubricaSE => ({ codigo, versao, tipo, titulo: codigo, peso: 10, penalidade: null, descricao: null, como_pontuar: null });
describe('Black Ops — régua e selos', () => {
  test('régua ausente ou anterior à 3 usa 2; 3 permanece 3', () => {
    expect([null, undefined, 1, 2, '3'].map(versaoRegua)).toEqual([2, 2, 2, 2, 3]);
  });
  test('critérios vêm somente da versão da reunião, sem metadados', () => {
    const rows = [criterio('diagnostico', 2), criterio('diagnostico_reais', 3), criterio('_fatos', 3), criterio('g1_percentual', 3, 'guardrail')];
    expect(itensRegua(rows, 3, 'criterio').map(r => r.codigo)).toEqual(['diagnostico_reais']);
    expect(itensRegua(rows, null, 'criterio').map(r => r.codigo)).toEqual(['diagnostico']);
  });
  test('mensais escondem nulos e metadados, preservando nota zero real', () => {
    expect(criteriosPreenchidos({ diagnostico: null, diagnostico_reais: 0, objecoes: 8, _fatos: {} }, ['diagnostico', 'diagnostico_reais', 'objecoes', '_fatos'])).toEqual(['diagnostico_reais', 'objecoes']);
  });
  test('evidência depende do código e é omitida quando ausente', () => {
    expect(evidenciaSE({ _evidencias: { g4_escopo: 'Prometeu serviço extra' } }, 'g4_escopo')).toBe('Prometeu serviço extra');
    expect(evidenciaSE({ _evidencias: {} }, 'g4_escopo')).toBeUndefined();
  });
  test('divergência compara preço da call e do Farol em centavos, sem inventar valores ausentes', () => {
    expect(valorDivergente(1621, 1500)).toBe(true);
    expect(valorDivergente(1621, 1621)).toBe(false);
    expect(valorDivergente(null, 1621)).toBe(false);
    expect(valorDivergente(1621, undefined)).toBe(false);
  });
  test('fora da tabela requer false explícito; assinatura requer true', () => {
    const selo = { selo_tabela: false, selo_assinou_na_call: true } as SeloSE;
    expect(filtrarSelo(selo, true, true)).toBe(true);
    expect(filtrarSelo({ ...selo, selo_tabela: null }, true, false)).toBe(false);
    expect(filtrarSelo({ ...selo, selo_assinou_na_call: false }, false, true)).toBe(false);
    expect(filtrarSelo(undefined, false, false)).toBe(true);
  });
});
