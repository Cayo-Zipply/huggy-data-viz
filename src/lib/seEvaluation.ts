export type RubricaSE = {
  tipo: string | null; codigo: string | null; titulo: string | null;
  peso: number | null; penalidade: number | null; descricao: string | null;
  como_pontuar: string | null; ativo?: boolean | null; versao?: number | string | null;
};
export type SeloSE = {
  readai_meeting_id: string; preco_tabela: number | null; valor_relatorio: number | null;
  valor_divida: number | null; selo_tabela: boolean | null; selo_assinou_na_call: boolean;
  signed_at: string | null; selo_pago: boolean | null;
};
export const CRITERIOS_V3: Record<string, string> = {
  abertura: 'Abertura', diagnostico_reais: 'Diagnóstico em reais', implicacao_quantificada: 'Implicação',
  apresentacao_relatorio: 'Relatório', preco_ancora: 'Preço e âncora', objecoes: 'Objeções', fechamento_data: 'Fechamento com data',
};
export function versaoRegua(versao: unknown): number {
  const n = Number(versao);
  return Number.isFinite(n) && n >= 3 ? n : 2;
}
export function itensRegua(rows: RubricaSE[], versao: unknown, tipo: string) {
  return rows.filter(r => versaoRegua(r.versao) === versaoRegua(versao) && r.tipo === tipo && !!r.codigo && !r.codigo.startsWith('_'));
}
export function criteriosPreenchidos(row: Record<string, unknown>, codigos: string[]) {
  return codigos.filter(c => !c.startsWith('_') && row[c] != null);
}
export function objetoSE(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function evidenciaSE(notas: Record<string, unknown> | null, codigo: string) {
  const valor = objetoSE(notas?._evidencias)[codigo];
  return typeof valor === 'string' && valor.trim() ? valor : undefined;
}
export function valorDivergente(preco: unknown, valor: number | null | undefined) {
  return preco != null && valor != null && Number.isFinite(Number(preco)) && Math.round(Number(preco) * 100) !== Math.round(Number(valor) * 100);
}
export function filtrarSelo(selo: SeloSE | undefined, foraTabela: boolean, assinou: boolean) {
  return (!foraTabela || selo?.selo_tabela === false) && (!assinou || selo?.selo_assinou_na_call === true);
}
