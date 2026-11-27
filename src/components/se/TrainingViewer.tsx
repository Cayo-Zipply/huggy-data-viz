import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Download, ExternalLink, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseExternal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { TrainingFileViewer } from './TrainingFileViewer';
import { TrainingProgressBar } from './TrainingProgressBadge';
import { MY_TRAINING_PROGRESS_KEY } from '@/hooks/useMyTrainingProgress';
import { downloadTraining, embedTrainingUrl, safeLink, signedTrainingUrl, trainingErrorMessage, type TrainingPlayable } from '@/lib/seTraining';
import { SAVE_EVERY_MS, advanceWatched, canConclude, loadYoutubeApi, registerTrainingProgress, watchedPercent, youtubeVideoId, type MyProgress, type YTPlayer } from '@/lib/seProgress';

type ViewerProps = { content: TrainingPlayable; progress?: MyProgress; onClose: () => void };

function TrainingMediaViewer({ content, progress, onClose }: ViewerProps) {
  const { user } = useAuth(); const qc = useQueryClient(); const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [progressReady, setProgressReady] = useState(false);
  const wasDone = !!content.concluido_em || progress?.status === 'concluido';
  const [completed, setCompleted] = useState(wasDone); const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(wasDone ? 100 : Math.round(progress?.percentual ?? 0));
  const [attempt, setAttempt] = useState(0);
  const [ytFailed, setYtFailed] = useState(false);
  const isVideo = content.tipo === 'video';
  const embed = !content.storage_path ? embedTrainingUrl(content.url) : null;
  const youtubeId = isVideo && !content.storage_path && !ytFailed ? youtubeVideoId(content.url) : null;
  // Só é medido o que o player informa: YouTube e vídeo próprio. Loom/Vimeo seguem com conclusão manual.
  const measured = isVideo && (!!youtubeId || !embed);
  // Retoma de onde parou; quem já concluiu recomeça do início.
  const resumeAt = wasDone ? 0 : Math.max(0, Math.floor(content.segundos_assistidos ?? 0));
  const watched = useRef({ max: Math.max(0, content.segundos_assistidos ?? 0), last: resumeAt, duration: 0, sentAt: Date.now(), sentMax: Math.max(0, content.segundos_assistidos ?? 0) });
  const holder = useRef<HTMLDivElement>(null);
  const refresh = useCallback(() => Promise.all([qc.invalidateQueries({ queryKey: [MY_TRAINING_PROGRESS_KEY] }), qc.invalidateQueries({ queryKey: ['se-training-progress'] })]), [qc]);

  const save = useCallback(async (ended: boolean) => {
    const w = watched.current;
    if (!content.id || !w.duration) return;
    const max = w.max; const concluir = ended && canConclude(max, w.duration);
    if (!concluir && max <= w.sentMax) return;
    w.sentAt = Date.now(); w.sentMax = max;
    try {
      const saved = await registerTrainingProgress(supabase, content.id, max, w.duration, concluir);
      const local = watchedPercent(max, w.duration);
      setPercent(p => Math.max(p, saved.percentual ?? local));
      if (saved.concluido ?? (concluir || local > 90)) setCompleted(true);
    } catch { w.sentMax = -1; /* tenta de novo na próxima amostra */ }
  }, [content.id]);
  const track = useCallback((now: number, duration: number) => {
    const w = watched.current;
    if (duration > 0) w.duration = duration;
    w.max = advanceWatched(w.max, w.last, now); w.last = now;
  }, []);
  const sample = useCallback((now: number, duration: number) => {
    track(now, duration);
    if (Date.now() - watched.current.sentAt >= SAVE_EVERY_MS) void save(false);
  }, [track, save]);
  const flush = useCallback((now: number, duration: number, ended: boolean) => { track(now, duration); void save(ended).then(refresh); }, [track, save, refresh]);
  // Ao fechar, grava o que faltou e atualiza os selos dos cards.
  useEffect(() => () => { void save(false).then(refresh); }, [save, refresh]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setProgressReady(false);
    const open = async () => {
      try {
        if (!content.id || !user) throw new Error('Entre novamente para abrir o conteúdo.');
        const resolved = content.storage_path ? await signedTrainingUrl(supabase, content.storage_path) : safeLink(content.url);
        if (!resolved) throw new Error('Este conteúdo ainda não tem um endereço válido.');
        // Vídeo medido registra o progresso pelo player; os demais entram como "em andamento" ao abrir.
        if (!measured) await registerTrainingProgress(supabase, content.id, 0, null, false);
        if (active) { setUrl(resolved); setProgressReady(true); }
        if (!measured) void refresh();
      } catch (e) { if (active) setError(trainingErrorMessage(e, 'Não foi possível abrir o conteúdo.')); }
      finally { if (active) setLoading(false); }
    };
    void open(); return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.id, content.storage_path, content.url, user?.id, attempt]);

  // YouTube IFrame Player API: amostra a posição a cada segundo tocando e grava no pause e no fim.
  useEffect(() => {
    const host = holder.current;
    if (!youtubeId || !url || !host) return;
    let cancelled = false; let player: YTPlayer | null = null; let timer: ReturnType<typeof setInterval> | undefined;
    const mount = document.createElement('div'); host.appendChild(mount);
    loadYoutubeApi().then(YT => {
      if (cancelled) return;
      player = new YT.Player(mount, {
        host: 'https://www.youtube-nocookie.com', videoId: youtubeId, width: '100%', height: '100%',
        playerVars: { autoplay: 1, rel: 0, playsinline: 1, start: resumeAt },
        events: { onStateChange: (e: { data: number; target: YTPlayer }) => { if (e.data === 2 || e.data === 0) flush(e.target.getCurrentTime(), e.target.getDuration(), e.data === 0); } },
      });
      timer = setInterval(() => {
        const p = player as (YTPlayer & { getPlayerState?: () => number }) | null;
        if (p?.getPlayerState?.() === 1) sample(p.getCurrentTime(), p.getDuration());
      }, 1000);
    }).catch(() => { if (!cancelled) setYtFailed(true); });
    return () => { cancelled = true; if (timer) clearInterval(timer); try { player?.destroy(); } catch { /* player já removido */ } host.replaceChildren(); };
  }, [youtubeId, url, loading, resumeAt, sample, flush]);

  const finish = async () => {
    if (!user || !content.id || !progressReady) return;
    setBusy(true);
    try { await registerTrainingProgress(supabase, content.id, 0, null, true); setCompleted(true); setPercent(100); await refresh(); toast({ title:'Marcado como concluído' }); }
    catch(e) { toast({ title:'Não foi possível marcar como concluído', description:trainingErrorMessage(e), variant:'destructive' }); }
    finally { setBusy(false); }
  };
  const originalLabel = embed?.includes('youtube-nocookie.com/') ? 'Abrir no YouTube' : embed?.includes('loom.com/') ? 'Abrir no Loom' : embed?.includes('vimeo.com/') ? 'Abrir no Vimeo' : 'Abrir original';
  const pdf = /\.pdf(?:$|\?)/i.test(content.storage_path ?? content.url ?? '');
  const download = async () => { if (!url) return; try { await downloadTraining(url, content.storage_path?.split('/').pop() ?? content.titulo ?? 'material'); } catch(e) { toast({ title:'Falha no download', description:trainingErrorMessage(e), variant:'destructive' }); } };
  const player = youtubeId ? <div ref={holder} className="training-video-frame" />
    : isVideo && embed ? <iframe title={content.titulo ?? 'Vídeo do treinamento'} src={embed} className="training-video-frame" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    : isVideo && url ? <video src={url} controls autoPlay playsInline className="training-video-frame object-contain"
        onLoadedMetadata={e => { const v = e.currentTarget; if (resumeAt > 0 && resumeAt < v.duration - 5) v.currentTime = resumeAt; }}
        onTimeUpdate={e => { const v = e.currentTarget; if (!v.seeking && !v.paused) sample(v.currentTime, v.duration); }}
        onPause={e => { if (!e.currentTarget.ended) flush(e.currentTarget.currentTime, e.currentTarget.duration, false); }}
        onEnded={e => flush(e.currentTarget.currentTime, e.currentTarget.duration, true)} />
    : null;
  const manualButton = <Button disabled={busy || completed || !progressReady} onClick={() => void finish()}><Check className="h-4 w-4 mr-2" />{completed ? 'Concluído' : busy ? 'Salvando…' : 'Marcar como concluído'}</Button>;
  return <Dialog open onOpenChange={v => { if (!v && !busy) onClose(); }}><DialogContent className={isVideo ? 'training-video-dialog left-0 top-0 w-screen h-[100dvh] max-w-none translate-x-0 translate-y-0 flex flex-col gap-0 rounded-none sm:rounded-none border-0 p-0 [&>button]:hidden' : 'w-[calc(100%-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto'}>
    <DialogHeader className={isVideo ? 'flex-row items-start justify-between gap-3 space-y-0 border-b border-border p-4 text-left shrink-0' : ''}>
      <div className="min-w-0 space-y-1"><DialogTitle className="break-words">{content.titulo}</DialogTitle><DialogDescription className={isVideo ? 'sr-only' : ''}>{content.descricao || 'Material de treinamento'}</DialogDescription></div>
      {isVideo && <Button variant="outline" size="sm" disabled={busy} onClick={onClose} className="shrink-0"><X className="mr-2 h-4 w-4" />Fechar</Button>}
    </DialogHeader>
    {loading ? <p className="text-sm text-muted-foreground p-4">Abrindo conteúdo…</p> : error ? <div role="alert" className="space-y-2 p-4"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => setAttempt(v => v+1)}>Tentar novamente</Button></div> : url && (isVideo ? <>
      <div className="training-video-stage min-h-0 flex-1 flex items-center justify-center">{player}</div>
      {measured && <div className="shrink-0 space-y-1.5 border-t border-border px-4 py-3">
        <TrainingProgressBar percent={percent} done={completed} className="h-2 rounded-full" />
        <p className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{percent}% assistido{completed ? ' · Concluído ✓' : ''}</p>
      </div>}
      {content.descricao && <p className="max-h-[22dvh] shrink-0 overflow-y-auto whitespace-pre-wrap break-words border-t border-border px-4 py-3 text-sm text-muted-foreground">{content.descricao}</p>}
      {(!content.storage_path || !measured) && <footer className="shrink-0 border-t border-border p-4 flex flex-wrap items-center justify-between gap-3">
        {!content.storage_path ? <Button variant="link" size="sm" asChild className="text-muted-foreground"><a href={safeLink(content.url) ?? url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-3.5 w-3.5" />{originalLabel}</a></Button> : <span />}
        {!measured && manualButton}
      </footer>}
    </> : <div className="space-y-4">
      {content.tipo === 'arquivo' && pdf && <iframe title={content.titulo ?? 'PDF do treinamento'} src={url} className="w-full h-[55vh] border border-border rounded" />}
      {content.storage_path ? <Button variant="outline" onClick={() => void download()}><Download className="h-4 w-4 mr-2" />Baixar arquivo</Button> : <Button variant="outline" asChild><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Abrir</a></Button>}
      <div className="border-t border-border pt-4">{manualButton}</div>
    </div>)}
  </DialogContent></Dialog>;
}

/** Arquivos do bucket privado abrem no visualizador próprio; vídeos e links seguem como antes. */
export function TrainingViewer(props: ViewerProps) {
  return props.content.tipo !== 'video' && props.content.storage_path ? <TrainingFileViewer {...props} /> : <TrainingMediaViewer {...props} />;
}
