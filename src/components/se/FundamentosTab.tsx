import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Check, Clock, RotateCcw, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseExternal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { APPROVAL_SCORE, articlesByModule, bestScores, gradeQuiz, quizOptions, type Article, type QuizAttempt, type QuizQuestion, type QuizResult } from '@/lib/seArticles';

const db = supabase as any;
const scoreTone = (nota: number) => nota >= APPROVAL_SCORE ? 'border-success/40 bg-success/10 text-success' : 'border-warning/40 bg-warning/10 text-warning';
const Back = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) =>
  <Button variant="ghost" size="sm" onClick={onClick} className="-ml-2 text-muted-foreground"><ArrowLeft className="mr-2 h-4 w-4" />{children}</Button>;
const Failed = ({ onRetry }: { onRetry: () => void }) =>
  <div role="alert" className="space-y-2"><p className="text-sm text-destructive">Não foi possível carregar. Tente novamente.</p><Button variant="outline" size="sm" onClick={onRetry}>Tentar novamente</Button></div>;

/** Sub-aba de artigos de fundamentos, cada um com prova de múltipla escolha. */
export function FundamentosTab() {
  const { user } = useAuth();
  const [open, setOpen] = useState<Article | null>(null);
  const [quiz, setQuiz] = useState(false);
  const { data: articles = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['se-articles'],
    queryFn: async () => {
      const { data, error } = await db.from('se_treinamentos').select('id,slug,modulo,titulo,resumo,ordem,nivel,tempo_leitura_min').eq('ativo', true).order('ordem', { ascending: true });
      if (error) throw error; return (data ?? []) as Article[];
    },
  });
  const { data: attempts = [] } = useQuery({
    queryKey: ['se-article-attempts', user?.id], enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db.from('se_treinamento_tentativas').select('treinamento_id,nota').eq('user_id', user!.id);
      if (error) throw error; return (data ?? []) as QuizAttempt[];
    },
  });
  const best = bestScores(attempts);

  if (open && quiz) return <ArticleQuiz article={open} onBack={() => setQuiz(false)} onList={() => { setQuiz(false); setOpen(null); }} />;
  if (open) return <ArticleReader article={open} best={best[open.id]} onBack={() => setOpen(null)} onQuiz={() => setQuiz(true)} />;
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando treinamentos…</p>;
  if (isError) return <Failed onRetry={() => void refetch()} />;

  return <div className="space-y-8">
    {articlesByModule(articles).map(g => <section key={g.modulo} className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.modulo}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {g.items.map(a => <button key={a.id} type="button" onClick={() => setOpen(a)} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 break-words text-base font-semibold leading-snug">{a.titulo}</h3>
            {best[a.id] != null && <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums', scoreTone(best[a.id]))}>Nota {best[a.id]}</span>}
          </div>
          {a.resumo && <p className="line-clamp-3 text-sm text-muted-foreground">{a.resumo}</p>}
          <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {a.tempo_leitura_min != null && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />~{a.tempo_leitura_min} min de leitura</span>}
            {a.nivel && <Badge variant="secondary" className="capitalize">{a.nivel}</Badge>}
          </div>
        </button>)}
      </div>
    </section>)}
    {articles.length <= 1 && <p className="text-sm text-muted-foreground">Em breve mais treinamentos.</p>}
  </div>;
}

function ArticleReader({ article, best, onBack, onQuiz }: { article: Article; best?: number; onBack: () => void; onQuiz: () => void }) {
  const { data: content, isLoading, isError, refetch } = useQuery({
    queryKey: ['se-article', article.id],
    queryFn: async () => {
      const { data, error } = await db.from('se_treinamentos').select('conteudo_md').eq('id', article.id).maybeSingle();
      if (error) throw error; return (data?.conteudo_md ?? '') as string;
    },
  });
  return <div className="mx-auto w-full max-w-[720px]">
    <Back onClick={onBack}>Treinamentos</Back>
    <header className="mt-3 space-y-2 border-b border-border pb-5">
      {article.modulo && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{article.modulo}</p>}
      <h1 className="break-words text-2xl font-bold leading-tight sm:text-3xl">{article.titulo}</h1>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {article.tempo_leitura_min != null && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />~{article.tempo_leitura_min} min de leitura</span>}
        {article.nivel && <Badge variant="secondary" className="capitalize">{article.nivel}</Badge>}
      </div>
    </header>
    {isLoading ? <p className="py-6 text-sm text-muted-foreground">Abrindo artigo…</p> : isError ? <div className="py-6"><Failed onRetry={() => void refetch()} /></div>
      : <article className="prose max-w-none break-words py-6 leading-relaxed dark:prose-invert prose-headings:font-semibold prose-blockquote:font-normal prose-blockquote:not-italic">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content ?? ''}</ReactMarkdown>
      </article>}
    <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
      <p className="text-sm text-muted-foreground">{best != null ? `Sua melhor nota: ${best}` : 'Terminou a leitura? Teste o que aprendeu.'}</p>
      <Button onClick={onQuiz}>{best != null ? 'Refazer a prova' : 'Fazer a prova'}</Button>
    </div>
  </div>;
}

function ArticleQuiz({ article, onBack, onList }: { article: Article; onBack: () => void; onList: () => void }) {
  const { user } = useAuth(); const qc = useQueryClient(); const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const { data: questions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['se-article-questions', article.id],
    queryFn: async () => {
      const { data, error } = await db.from('se_treinamento_questoes').select('id,ordem,pergunta,alternativas,correta,explicacao').eq('treinamento_id', article.id).order('ordem', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map(q => ({ ...q, alternativas: quizOptions(q.alternativas) })) as QuizQuestion[];
    },
  });
  const save = useMutation({
    mutationFn: async (r: QuizResult) => {
      if (!user?.id) throw new Error('Entre novamente para salvar sua nota.');
      const { error } = await db.from('se_treinamento_tentativas').insert({
        treinamento_id: article.id, user_id: user.id, acertos: r.acertos, total: r.total, nota: r.nota,
        respostas: answers, concluido_em: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['se-article-attempts'] }),
    onError: () => toast({ title: 'Sua nota não foi salva', description: 'O resultado está na tela, mas não ficou registrado. Refaça a prova para registrar.', variant: 'destructive' }),
  });
  const pending = questions.filter(q => !answers[q.id]).length;
  const submit = () => { const r = gradeQuiz(questions, answers); setResult(r); save.mutate(r); window.scrollTo({ top: 0 }); };
  const redo = () => { setAnswers({}); setResult(null); window.scrollTo({ top: 0 }); };

  return <div className="mx-auto w-full max-w-[720px] space-y-6">
    <Back onClick={onBack}>Voltar ao artigo</Back>
    <header className="space-y-1"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prova</p><h1 className="break-words text-2xl font-bold leading-tight">{article.titulo}</h1></header>
    {isLoading ? <p className="text-sm text-muted-foreground">Carregando a prova…</p> : isError ? <Failed onRetry={() => void refetch()} />
      : !questions.length ? <p className="text-sm text-muted-foreground">Este treinamento ainda não tem prova.</p> : <>
      {result && <section aria-live="polite" className={cn('rounded-xl border p-5 text-center', scoreTone(result.nota))}>
        <p className="text-5xl font-bold tabular-nums">{result.nota}</p>
        <p className="mt-1 text-sm font-medium">{result.acertos} de {result.total} acertos</p>
        <p className="mt-2 text-base font-semibold">{result.aprovado ? 'Aprovado ✓' : 'Revise o artigo e tente de novo'}</p>
      </section>}
      <ol className="space-y-5">
        {questions.map((q, i) => {
          const item = result?.itens.find(x => x.id === q.id);
          return <li key={q.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-2">
              <p id={`q-${q.id}`} className="min-w-0 flex-1 break-words font-medium leading-snug"><span className="text-muted-foreground">{i + 1}. </span>{q.pergunta}</p>
              {item && <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold', item.acertou ? 'border-success/40 bg-success/10 text-success' : 'border-destructive/40 bg-destructive/10 text-destructive')}>
                {item.acertou ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}{item.acertou ? 'Certo' : 'Errado'}</span>}
            </div>
            <RadioGroup aria-labelledby={`q-${q.id}`} value={answers[q.id] ?? ''} disabled={!!result} onValueChange={v => setAnswers(a => ({ ...a, [q.id]: v }))} className="mt-3 gap-2">
              {q.alternativas.map(o => {
                const right = !!item && o.id.toLowerCase() === q.correta.trim().toLowerCase();
                const wrong = !!item && !item.acertou && item.marcada === o.id;
                return <Label key={o.id} htmlFor={`${q.id}-${o.id}`} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm font-normal leading-snug', !result && 'hover:bg-muted/50', right && 'border-success/50 bg-success/10', wrong && 'border-destructive/50 bg-destructive/10', result && 'cursor-default')}>
                  <RadioGroupItem id={`${q.id}-${o.id}`} value={o.id} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 break-words">{o.texto}</span>
                </Label>;
              })}
            </RadioGroup>
            {item && q.explicacao && <p className="mt-3 break-words rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{q.explicacao}</p>}
          </li>;
        })}
      </ol>
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        {result ? <>
          <Button variant="outline" onClick={onList}>Voltar aos treinamentos</Button>
          <Button onClick={redo}><RotateCcw className="mr-2 h-4 w-4" />Refazer a prova</Button>
        </> : <>
          <p className="text-sm text-muted-foreground">{pending ? `${pending === 1 ? 'Falta 1 questão' : `Faltam ${pending} questões`}` : 'Tudo respondido.'}</p>
          <Button disabled={pending > 0} onClick={submit}>Enviar respostas</Button>
        </>}
      </div>
    </>}
  </div>;
}
