import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Download, ExternalLink, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseExternal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { completeTraining, downloadTraining, embedTrainingUrl, safeLink, signedTrainingUrl, startTraining, trainingErrorMessage, type TrainingPlayable } from '@/lib/seTraining';

export function TrainingViewer({ content, onClose }: { content: TrainingPlayable; onClose: () => void }) {
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
      } catch (e) { if (active) setError(trainingErrorMessage(e, 'Não foi possível abrir o conteúdo.')); }
      finally { if (active) setLoading(false); }
    };
    void open(); return () => { active = false; };
  }, [content.conteudo_id, content.storage_path, content.url, user?.id, qc, attempt]);
  const finish = async () => {
    if (!user || !content.conteudo_id || !progressReady) return;
    setBusy(true);
    try { await completeTraining(supabase, content.conteudo_id, user.id); setCompleted(true); await qc.invalidateQueries({ queryKey:['se-training-suggestions'] }); await qc.invalidateQueries({ queryKey:['se-training-progress'] }); toast({ title:'Treinamento concluído' }); }
    catch(e) { toast({ title:'Não foi possível concluir', description:trainingErrorMessage(e), variant:'destructive' }); }
    finally { setBusy(false); }
  };
  const isVideo = content.conteudo_tipo === 'video';
  const embed = !content.storage_path ? embedTrainingUrl(content.url) : null;
  const originalLabel = embed?.includes('youtube-nocookie.com/') ? 'Abrir no YouTube' : embed?.includes('loom.com/') ? 'Abrir no Loom' : embed?.includes('vimeo.com/') ? 'Abrir no Vimeo' : 'Abrir original';
  const pdf = /\.pdf(?:$|\?)/i.test(content.storage_path ?? content.url ?? '');
  const download = async () => { if (!url) return; try { await downloadTraining(url, content.storage_path?.split('/').pop() ?? content.conteudo_titulo ?? 'material'); } catch(e) { toast({ title:'Falha no download', description:trainingErrorMessage(e), variant:'destructive' }); } };
  const player = isVideo && embed ? <iframe title={content.conteudo_titulo ?? 'Vídeo do treinamento'} src={embed} className="training-video-frame" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    : isVideo && url ? <video src={url} controls autoPlay playsInline className="training-video-frame object-contain" />
    : null;
  return <Dialog open onOpenChange={v => { if (!v && !busy) onClose(); }}><DialogContent className={isVideo ? 'training-video-dialog left-0 top-0 w-screen h-[100dvh] max-w-none translate-x-0 translate-y-0 flex flex-col gap-0 rounded-none sm:rounded-none border-0 p-0 [&>button]:hidden' : 'w-[calc(100%-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto'}>
    <DialogHeader className={isVideo ? 'flex-row items-start justify-between gap-3 space-y-0 border-b border-border p-4 text-left shrink-0' : ''}>
      <div className="min-w-0 space-y-1"><DialogTitle className="break-words">{content.conteudo_titulo}</DialogTitle><DialogDescription className={isVideo ? 'sr-only' : ''}>{content.descricao || 'Material de treinamento'}</DialogDescription></div>
      {isVideo && <Button variant="outline" size="sm" disabled={busy} onClick={onClose} className="shrink-0"><X className="mr-2 h-4 w-4" />Fechar</Button>}
    </DialogHeader>
    {loading ? <p className="text-sm text-muted-foreground p-4">Abrindo conteúdo…</p> : error ? <div role="alert" className="space-y-2 p-4"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => setAttempt(v => v+1)}>Tentar novamente</Button></div> : url && (isVideo ? <>
      <div className="training-video-stage min-h-0 flex-1 flex items-center justify-center">{player}</div>
      <footer className="shrink-0 border-t border-border p-4 flex flex-wrap items-center justify-between gap-3">
        {!content.storage_path ? <Button variant="link" size="sm" asChild className="text-muted-foreground"><a href={safeLink(content.url) ?? url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-3.5 w-3.5" />{originalLabel}</a></Button> : <span />}
        <Button disabled={busy || completed || !progressReady} onClick={() => void finish()}><Check className="h-4 w-4 mr-2" />{completed ? 'Concluído' : busy ? 'Salvando…' : 'Marcar como concluído'}</Button>
      </footer>
    </> : <div className="space-y-4">
      {content.conteudo_tipo === 'arquivo' && pdf && <iframe title={content.conteudo_titulo ?? 'PDF do treinamento'} src={url} className="w-full h-[55vh] border border-border rounded" />}
      {content.storage_path ? <Button variant="outline" onClick={() => void download()}><Download className="h-4 w-4 mr-2" />Baixar arquivo</Button> : <Button variant="outline" asChild><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Abrir</a></Button>}
      <div className="border-t border-border pt-4"><Button disabled={busy || completed || !progressReady} onClick={() => void finish()}><Check className="h-4 w-4 mr-2" />{completed ? 'Concluído' : busy ? 'Salvando…' : 'Marcar como concluído'}</Button></div>
    </div>)}
  </DialogContent></Dialog>;
}
