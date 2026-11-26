import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, Clock, Play, FileText, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabaseExternal';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { groupTraining, gapKey, type TrainingGap, type TrainingSuggestion } from '@/lib/seTraining';
import { TrainingViewer } from './TrainingViewer';
import { TrainingAdmin } from './TrainingAdmin';

export function TrainingTab() {
  const { isAdmin, user } = useAuth(); const [closer, setCloser] = useState('todos');
  const [opened, setOpened] = useState<TrainingSuggestion | null>(null);
  const { data: suggestions = [], isLoading: loadingSuggestions, isError: errorSuggestions, refetch: retrySuggestions } = useQuery({
    queryKey:['se-training-suggestions', user?.id, isAdmin ? closer : 'proprio'], enabled:!!user,
    queryFn: async () => {
      let q = supabase.from('vw_se_treinamento_sugestoes').select('*');
      if (isAdmin && closer !== 'todos') q = q.eq('closer', closer);
      const { data,error } = await q.order('posicao_gap').order('ordem');
      if (error) throw error;
      return (data ?? []) as TrainingSuggestion[];
    },
  });
  const { data: gaps = [], isLoading: loadingGaps, isError: errorGaps, refetch: retryGaps } = useQuery({
    queryKey:['se-training-gaps', user?.id, isAdmin ? closer : 'proprio'], enabled:!!user,
    queryFn: async () => {
      let q = supabase.from('vw_se_gaps_closer').select('*').lte('posicao',4);
      if (isAdmin && closer !== 'todos') q = q.eq('closer', closer);
      const { data,error } = await q.order('posicao'); if (error) throw error;
      return (data ?? []) as TrainingGap[];
    },
  });
  // A lista de closers permanece estável ao aplicar um filtro administrativo.
  const { data: allClosers = [] } = useQuery({
    queryKey:['se-training-closers'], enabled:isAdmin,
    queryFn: async () => { const {data,error}=await supabase.from('vw_se_gaps_closer').select('closer').lte('posicao',4);if(error)throw error; return [...new Set((data ?? []).map((r:{closer:string})=>r.closer).filter(Boolean))].sort() as string[]; },
  });
  const groups = useMemo(()=>groupTraining(gaps,suggestions,isAdmin ? closer : 'todos'),[gaps,suggestions,isAdmin,closer]);
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" />Treinamento</h2>{isAdmin && <Select value={closer} onValueChange={setCloser}><SelectTrigger className="w-56" aria-label="Filtrar treinamento por closer"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os closers</SelectItem>{allClosers.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>}</header>
    {loadingSuggestions || loadingGaps ? <p className="text-sm text-muted-foreground">Carregando treinamentos…</p> : errorSuggestions || errorGaps ? <div role="alert" className="space-y-2"><p className="text-sm text-destructive">Não foi possível carregar os treinamentos.</p><Button variant="outline" onClick={()=>{void retryGaps();void retrySuggestions();}}>Tentar novamente</Button></div> : !groups.length ? <p className="text-sm text-muted-foreground">Nenhum ponto de treinamento disponível.</p> : <div className="space-y-7">{groups.map(({gap:g,contents})=><section key={gapKey(g)} className="space-y-3"><header className="space-y-1"><div className="flex flex-wrap items-baseline gap-2"><h3 className="text-sm font-semibold">{g.gap_titulo ?? g.titulo ?? g.codigo}</h3>{isAdmin && closer==='todos' && <span className="text-xs text-primary">{g.closer}</span>}<span className="text-xs text-muted-foreground">{g.tipo_gap==='guardrail' ? `em ${((g.frequencia ?? 0)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% das calls` : `média ${g.media ?? '—'}/10`} · custa {g.pontos_perdidos ?? '—'} pontos por reunião</span></div>{g.amostra_suficiente===false && <p className="text-xs text-warning">Poucas reuniões avaliadas ({g.reunioes}); o gap pode mudar</p>}</header>
      {!contents.length ? <p className="text-sm text-muted-foreground">Ainda não há material aprovado para este ponto</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{contents.map(c=>{const Icon=c.conteudo_tipo==='video' ? Play : c.conteudo_tipo==='arquivo' ? FileText : ExternalLink; return <article key={`${gapKey(g)}-${c.conteudo_id}`} className="border border-border bg-card rounded-lg p-4 flex flex-col gap-3 min-w-0"><div className="flex items-start gap-2"><Icon className="h-4 w-4 mt-0.5 text-primary shrink-0" /><h4 className="text-sm font-medium flex-1 break-words">{c.conteudo_titulo}</h4>{c.concluido_em && <Badge variant="outline" className="text-success border-success/30 shrink-0"><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</Badge>}</div>{c.descricao && <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{c.descricao}</p>}<div className="mt-auto flex items-center justify-between gap-2">{c.duracao_min != null ? <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Clock className="h-3 w-3" />{c.duracao_min} min</span> : <span />}<Button size="sm" variant="outline" onClick={()=>setOpened(c)}>Abrir conteúdo</Button></div></article>;})}</div>}
    </section>)}</div>}
    {isAdmin && <TrainingAdmin />}
    {opened && <TrainingViewer key={opened.conteudo_id} content={opened} onClose={()=>setOpened(null)} />}
  </div>;
}
