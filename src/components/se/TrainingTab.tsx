import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabaseExternal';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { groupTraining, groupTrainingLibrary, gapKey, selectedTrainingCloser, trainingViewQuery, type TrainingContent, type TrainingGap, type TrainingPlayable, type TrainingProgress, type TrainingSuggestion } from '@/lib/seTraining';
import { useTrainingRubric } from '@/hooks/useTrainingRubric';
import { TrainingContentCard } from './TrainingContentCard';
import { TrainingViewer } from './TrainingViewer';
import { TrainingAdmin } from './TrainingAdmin';

export function TrainingTab() {
  const { isAdmin, user } = useAuth(); const [closer, setCloser] = useState('');
  const [opened, setOpened] = useState<TrainingPlayable | null>(null);
  const { data: rubric = [], isLoading: loadingRubric, isError: errorRubric, refetch: retryRubric } = useTrainingRubric();
  const { data: allClosers = [], isLoading: loadingClosers, isError: errorClosers, refetch: retryClosers } = useQuery({
    queryKey:['se-training-closers'], enabled:isAdmin && !!user,
    queryFn: async () => { const {data,error}=await supabase.from('vw_se_gaps_closer').select('closer');if(error)throw error; return [...new Set((data ?? []).map((r:{closer:string})=>r.closer).filter(Boolean))].sort() as string[]; },
  });
  const selectedCloser = selectedTrainingCloser(closer, allClosers);
  const viewsEnabled = !!user && (!isAdmin || !!selectedCloser);
  const { data: suggestions = [], isLoading: loadingSuggestions, isError: errorSuggestions, refetch: retrySuggestions } = useQuery({
    queryKey:['se-training-suggestions', user?.id, isAdmin ? selectedCloser : 'proprio'], enabled:viewsEnabled,
    queryFn: async () => {
      const q = trainingViewQuery(supabase, 'vw_se_treinamento_sugestoes', isAdmin ? selectedCloser : null);
      const { data,error } = await q.order('posicao_gap').order('ordem');
      if (error) throw error;
      return (data ?? []) as TrainingSuggestion[];
    },
  });
  const { data: gaps = [], isLoading: loadingGaps, isError: errorGaps, refetch: retryGaps } = useQuery({
    queryKey:['se-training-gaps', user?.id, isAdmin ? selectedCloser : 'proprio'], enabled:viewsEnabled,
    queryFn: async () => {
      const q = trainingViewQuery(supabase, 'vw_se_gaps_closer', isAdmin ? selectedCloser : null);
      const { data,error } = await q.order('posicao'); if (error) throw error;
      return (data ?? []) as TrainingGap[];
    },
  });
  const { data: library = [], isLoading: loadingLibrary, isError: errorLibrary, refetch: retryLibrary } = useQuery({
    queryKey:['se-training-library', user?.id, 'aprovados'], enabled:!!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('se_treinamento_conteudos').select('*').eq('status', 'aprovado').order('ordem');
      if (error) throw error;
      return (data ?? []) as TrainingContent[];
    },
  });
  const { data: progress = [], isError: errorProgress } = useQuery({
    queryKey:['se-training-progress', user?.id], enabled:!!user && !isAdmin,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('se_treinamento_progresso').select('conteudo_id,iniciado_em,concluido_em');
      if (error) throw error;
      return (data ?? []) as TrainingProgress[];
    },
  });
  const groups = useMemo(()=>groupTraining(gaps,suggestions,isAdmin ? selectedCloser : 'todos'),[gaps,suggestions,isAdmin,selectedCloser]);
  const libraryGroups = useMemo(()=>groupTrainingLibrary(library,rubric,suggestions,progress),[library,rubric,suggestions,progress]);
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" />Treinamento</h2>{isAdmin && <div className="space-y-1 max-w-full"><Label htmlFor="training-view-as">Ver como</Label><Select value={selectedCloser} onValueChange={setCloser} disabled={loadingClosers || !allClosers.length}><SelectTrigger id="training-view-as" className="w-56 max-w-full"><SelectValue placeholder={loadingClosers ? 'Carregando…' : 'Nenhum closer disponível'} /></SelectTrigger><SelectContent>{allClosers.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>}</header>
    {(isAdmin && loadingClosers) || loadingSuggestions || loadingGaps ? <p className="text-sm text-muted-foreground">Carregando treinamentos…</p> : (isAdmin && errorClosers) || errorSuggestions || errorGaps ? <div role="alert" className="space-y-2"><p className="text-sm text-destructive">Não foi possível carregar os treinamentos.</p><Button variant="outline" onClick={()=>{if(isAdmin && errorClosers) void retryClosers();if(viewsEnabled){void retryGaps();void retrySuggestions();}}}>Tentar novamente</Button></div> : !groups.length ? <p className="text-sm text-muted-foreground">Ainda não há reuniões suficientes avaliadas na régua nova.</p> : <div className="space-y-7">{groups.map(({gap:g,contents})=><section key={gapKey(g)} className="space-y-3"><header className="space-y-1"><div className="flex flex-wrap items-baseline gap-2"><h3 className="text-sm font-semibold">{g.gap_titulo ?? g.titulo ?? g.codigo}</h3><span className="text-xs text-muted-foreground">{g.tipo_gap==='guardrail' ? `em ${((g.frequencia ?? 0)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% das calls` : `média ${g.media ?? '—'}/10`} · custa {g.pontos_perdidos ?? '—'} pontos por reunião</span></div>{g.amostra_suficiente===false && <p className="text-xs text-warning">Poucas reuniões avaliadas ({g.reunioes}); o gap pode mudar</p>}</header>
      {!contents.length ? <p className="text-sm text-muted-foreground">Ainda não há material aprovado para este ponto</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{contents.map(c=><TrainingContentCard key={`${gapKey(g)}-${c.conteudo_id}`} content={c} onOpen={setOpened} />)}</div>}
    </section>)}</div>}
    <section className="space-y-5 border-t border-border pt-6">
      <h2 className="text-base font-semibold">Todos os materiais</h2>
      {loadingLibrary || loadingRubric ? <p className="text-sm text-muted-foreground">Carregando materiais…</p> : errorLibrary || errorRubric ? <div role="alert" className="space-y-2"><p className="text-sm text-destructive">Não foi possível carregar todos os materiais.</p><Button variant="outline" onClick={()=>{void retryLibrary();void retryRubric();}}>Tentar novamente</Button></div> : !libraryGroups.length ? <p className="text-sm text-muted-foreground">Nenhum material aprovado disponível.</p> : libraryGroups.map(group=><section key={group.codigo} className="space-y-3"><h3 className="text-sm font-semibold">{group.titulo}</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{group.contents.map(({content,recommended})=><TrainingContentCard key={content.conteudo_id} content={content} recommended={recommended} onOpen={setOpened} />)}</div></section>)}
      {errorProgress && <p role="alert" className="text-xs text-muted-foreground">Não foi possível carregar seu progresso.</p>}
    </section>
    {isAdmin && <TrainingAdmin />}
    {opened && <TrainingViewer key={opened.conteudo_id} content={opened} onClose={()=>setOpened(null)} />}
  </div>;
}
