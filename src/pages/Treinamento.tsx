import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseExternal';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { selectedTrainingCloser, signedTrainingCovers, trainingCover, trainingFocusQuery, trainingRows, type TrainingContent, type TrainingFocus, type TrainingPlayable, type TrainingProgress } from '@/lib/seTraining';
import { useTrainingTracks } from '@/hooks/useTrainingTracks';
import { TrainingCard } from '@/components/se/TrainingCard';
import { TrainingViewer } from '@/components/se/TrainingViewer';
import { TrainingAdmin } from '@/components/se/TrainingAdmin';

export default function Treinamento() {
  const { isAdmin, user } = useAuth();
  const [closer, setCloser] = useState('');
  const [opened, setOpened] = useState<TrainingPlayable | null>(null);
  const [managing, setManaging] = useState(false);
  const tracks = useTrainingTracks(!!user);
  const contents = useQuery({
    queryKey: ['se-training-library', user?.id, 'aprovados'], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('se_treinamento_conteudos').select('*').eq('status', 'aprovado').order('ordem');
      if (error) throw error;
      return (data ?? []) as TrainingContent[];
    },
  });
  const { data: closers = [] } = useQuery({
    queryKey: ['se-training-focus-closers'], enabled: isAdmin && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('vw_treinamento_foco').select('closer');
      if (error) throw error;
      return [...new Set((data ?? []).map((r: { closer: string | null }) => r.closer).filter(Boolean))].sort() as string[];
    },
  });
  const selectedCloser = selectedTrainingCloser(closer, closers);
  // O foco só reordena as fileiras: se falhar, a página segue na ordem normal.
  const { data: focus = [] } = useQuery({
    queryKey: ['se-training-focus', user?.id, isAdmin ? selectedCloser : 'proprio'], enabled: !!user && (!isAdmin || !!selectedCloser),
    queryFn: async () => {
      const { data, error } = await trainingFocusQuery(supabase, isAdmin ? selectedCloser : null).order('posicao');
      if (error) throw error;
      return (data ?? []) as TrainingFocus[];
    },
  });
  const { data: progress = [] } = useQuery({
    queryKey: ['se-training-progress', user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('se_treinamento_progresso').select('conteudo_id,concluido_em').eq('user_id', user!.id);
      if (error) throw error;
      return (data ?? []) as TrainingProgress[];
    },
  });
  const coverPaths = useMemo(() => [...new Set((contents.data ?? []).map(c => c.capa_path).filter((p): p is string => !!p))].sort(), [contents.data]);
  const { data: covers = {} } = useQuery({
    queryKey: ['se-training-covers', coverPaths], enabled: coverPaths.length > 0, staleTime: 50 * 60_000, gcTime: 55 * 60_000,
    queryFn: () => signedTrainingCovers(supabase, coverPaths),
  });
  const rows = useMemo(() => trainingRows(tracks.data ?? [], contents.data ?? [], focus, progress), [tracks.data, contents.data, focus, progress]);
  const loading = tracks.isLoading || contents.isLoading;
  const failed = tracks.isError || contents.isError;

  return <div className="space-y-8 p-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">Treinamento</h1>
      {isAdmin && <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedCloser} onValueChange={setCloser} disabled={!closers.length}>
          <SelectTrigger aria-label="Ver como" className="w-52 max-w-full"><span className="mr-1 text-muted-foreground">Ver como</span><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>{closers.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setManaging(true)}><Settings2 className="mr-2 h-4 w-4" />Gerenciar</Button>
      </div>}
    </header>

    {loading ? <div className="space-y-8" aria-busy="true">{[0, 1].map(r => <div key={r} className="space-y-3">
      <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      <div className="flex gap-4 overflow-hidden">{[0, 1, 2, 3].map(i => <div key={i} className="aspect-video w-72 shrink-0 animate-pulse rounded-xl bg-muted" />)}</div>
    </div>)}</div>
      : failed ? <div role="alert" className="space-y-2"><p className="text-sm text-destructive">Não foi possível carregar os treinamentos.</p><Button variant="outline" onClick={() => { void tracks.refetch(); void contents.refetch(); }}>Tentar novamente</Button></div>
      : !rows.length ? <p className="text-sm text-muted-foreground">Nenhum vídeo disponível ainda.</p>
      : rows.map(row => <section key={row.codigo} className="space-y-3" aria-label={row.titulo}>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">{row.titulo}</h2>
          {row.foco && <Badge variant="outline" className="shrink-0 whitespace-nowrap border-primary/40 text-primary">Seu foco</Badge>}
        </div>
        <div className="-mx-6 flex snap-x gap-4 overflow-x-auto px-6 pb-3 scroll-px-6">
          {row.contents.map(c => <TrainingCard key={c.id} content={c} cover={trainingCover(c, covers)} onOpen={setOpened} />)}
        </div>
      </section>)}

    {isAdmin && <Dialog open={managing} onOpenChange={setManaging}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto">
        <DialogHeader><DialogTitle>Gerenciar treinamento</DialogTitle></DialogHeader>
        {managing && <TrainingAdmin />}
      </DialogContent>
    </Dialog>}
    {opened && <TrainingViewer key={opened.id} content={opened} onClose={() => setOpened(null)} />}
  </div>;
}
