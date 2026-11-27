// Artigos de fundamentos com prova (se_treinamentos / se_treinamento_questoes / se_treinamento_tentativas).
export const APPROVAL_SCORE = 70;
export type Article = {
  id: string; slug: string | null; modulo: string | null; titulo: string | null; resumo: string | null;
  ordem: number | null; nivel: string | null; tempo_leitura_min: number | null; conteudo_md?: string | null;
};
export type QuizOption = { id: string; texto: string };
export type QuizQuestion = { id: string; ordem: number | null; pergunta: string; alternativas: QuizOption[]; correta: string; explicacao: string | null };
export type QuizAttempt = { treinamento_id: string; nota: number | null };
export type QuizItem = { id: string; marcada: string | null; correta: string; acertou: boolean };
export type QuizResult = { acertos: number; total: number; nota: number; aprovado: boolean; itens: QuizItem[] };

const key = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** `alternativas` chega como jsonb (lista) ou, às vezes, como texto JSON. */
export function quizOptions(raw: unknown): QuizOption[] {
  let list = raw;
  if (typeof raw === 'string') { try { list = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(list)) return [];
  return list.filter(o => o && typeof o === 'object' && o.id != null).map(o => ({ id: String(o.id), texto: String(o.texto ?? '') }));
}

/** Corrige a prova: nota = acertos / total × 100, arredondada; aprovado com 70 ou mais. */
export function gradeQuiz(questions: Pick<QuizQuestion, 'id' | 'correta'>[], answers: Record<string, string>): QuizResult {
  const itens = questions.map(q => {
    const marcada = answers[q.id] ?? null;
    return { id: q.id, marcada, correta: q.correta, acertou: marcada != null && key(marcada) === key(q.correta) };
  });
  const total = itens.length; const acertos = itens.filter(i => i.acertou).length;
  const nota = total ? Math.round(acertos / total * 100) : 0;
  return { acertos, total, nota, aprovado: nota >= APPROVAL_SCORE, itens };
}

/** Melhor nota de cada treinamento entre as tentativas do usuário. */
export function bestScores(attempts: QuizAttempt[]): Record<string, number> {
  const best: Record<string, number> = {};
  for (const a of attempts) {
    if (a.nota == null) continue;
    const n = Number(a.nota);
    if (!Number.isFinite(n)) continue;
    if (best[a.treinamento_id] == null || n > best[a.treinamento_id]) best[a.treinamento_id] = n;
  }
  return best;
}

/** Agrupa por módulo, mantendo a ordem dos artigos; o módulo aparece na posição do seu primeiro artigo. */
export function articlesByModule(articles: Article[]): { modulo: string; items: Article[] }[] {
  const sorted = [...articles].sort((a, b) => (a.ordem ?? Infinity) - (b.ordem ?? Infinity));
  const groups: { modulo: string; items: Article[] }[] = [];
  for (const a of sorted) {
    const modulo = a.modulo?.trim() || 'Outros';
    let g = groups.find(x => x.modulo === modulo);
    if (!g) { g = { modulo, items: [] }; groups.push(g); }
    g.items.push(a);
  }
  return groups;
}
