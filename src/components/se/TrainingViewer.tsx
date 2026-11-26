import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Download, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabaseExternal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { completeTraining, downloadTraining, embedTrainingUrl, safeLink, signedTrainingUrl, startTraining, type TrainingSuggestion } from '@/lib/seTraining';

export function TrainingViewer({ content, onClose }: { content: TrainingSuggestion; onClose: () => void }) {
  const { user } = useAuth(); const qc = useQueryClient(); const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [progressReady, setProgressReady] = useState(false);
  const [completed, setCompleted] = useState(!!content.concluido_em); const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setProgressReady(false);
    const open = async () => {
      try {
        if (!content.conteudo_id || !user) throw new Error('Entre novamente para abrir o conteúdo.');
        const resolved = content.storage_path ? await signedTrainingUrl(supabase, content.storage_path) : safeLink(content.url);
        if (!resolved) throw new Error('Este conteúdo ainda não tem um endereço válido.');
        await startTraining(supabase, content.conteudo_id);
        if (active) { setUrl(resolved); setProgressReady(true); }
        void qc.invalidateQueries({ queryKey:['se-training-suggestions'] });
        void qc.invalidateQueries({ queryKey:['se-training-progress'] });
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Não foi possível abrir o conteúdo.'); }
      finally { if (active) setLoading(false); }
    };
    void open(); return () => { active = false; };
  }, [content.conteudo_id, content.storage_path, content.url, user?.id, qc, attempt]);
  const finish = async () => {
    if (!user || !content.conteudo_id || !progressReady) return;
    setBusy(true);
    try { await completeTraining(supabase, content.conteudo_id, user.id); setCompleted(true); await qc.invalidateQueries({ queryKey:['se-training-suggestions'] }); await qc.invalidateQueries({ queryKey:['se-training-progress'] }); toast({ title:'Treinamento concluído' }); }
    catch(e) { toast({ title:'Não foi possível concluir', description:e instanceof Error ? e.message : 'Tente novamente.', variant:'destructive' }); }
    finally { setBusy(false); }
  };
  const embed = !content.storage_path ? embedTrainingUrl(content.url) : null;
  const pdf = /\.pdf(?:$|\?)/i.test(content.storage_path ?? content.url ?? '');
  const download = async () => { if (!url) return; try { await downloadTraining(url, content.storage_path?.split('/').pop() ?? content.conteudo_titulo ?? 'material'); } catch(e) { toast({ title:'Falha no download', description:e instanceof Error ? e.message : '', variant:'destructive' }); } };
  return <Dialog open onOpenChange={v => { if (!v && !busy) onClose(); }}><DialogContent className="w-[calc(100%-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{content.conteudo_titulo}</DialogTitle><DialogDescription>{content.descricao || 'Material de treinamento'}</DialogDescription></DialogHeader>
    {loading ? <p className="text-sm text-muted-foreground">Abrindo conteúdo…</p> : error ? <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => setAttempt(v => v+1)}>Tentar novamente</Button></div> : url && <div className="space-y-4">
      {content.conteudo_tipo === 'video' && embed ? <iframe title={content.conteudo_titulo ?? 'Vídeo do treinamento'} src={embed} className="w-full aspect-video rounded border border-border" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        : content.conteudo_tipo === 'video' && content.storage_path ? <video src={url} controls preload="metadata" className="w-full max-h-[60vh] rounded bg-muted" />
        : content.conteudo_tipo === 'arquivo' && pdf ? <iframe title={content.conteudo_titulo ?? 'PDF do treinamento'} src={url} className="w-full h-[55vh] border border-border rounded" /> : null}
      {content.storage_path ? <Button variant="outline" onClick={() => void download()}><Download className="h-4 w-4 mr-2" />Baixar arquivo</Button> : <Button variant="outline" asChild><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Abrir</a></Button>}
      <div className="border-t border-border pt-4"><Button disabled={busy || completed || !progressReady} onClick={() => void finish()}><Check className="h-4 w-4 mr-2" />{completed ? 'Concluído' : busy ? 'Salvando…' : 'Marcar como concluído'}</Button></div>
    </div>}
  </DialogContent></Dialog>;
}
