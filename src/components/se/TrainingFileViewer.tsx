import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Download, ExternalLink, Loader2, Presentation, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseExternal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { downloadTraining, presentationHtml, signedTrainingUrl, trainingErrorMessage, trainingFileFormat, TRAINING_CLOSE_MESSAGE, type TrainingPlayable } from '@/lib/seTraining';
import { registerTrainingProgress, type MyProgress } from '@/lib/seProgress';
import { MY_TRAINING_PROGRESS_KEY } from '@/hooks/useMyTrainingProgress';

type Frame = { src: string } | { html: string };
type Action = 'apresentar' | 'aba' | 'baixar' | 'concluir' | null;

/** Modal de um arquivo do bucket privado: apresenta HTML/PDF em tela cheia dentro do Farol. */
export function TrainingFileViewer({ content, progress, onClose }: { content: TrainingPlayable; progress?: MyProgress; onClose: () => void }) {
  const { user } = useAuth(); const qc = useQueryClient(); const { toast } = useToast();
  const format = trainingFileFormat(content.storage_path);
  const urlRef = useRef<string | null>(null); const iframe = useRef<HTMLIFrameElement>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [completed, setCompleted] = useState(!!content.concluido_em || progress?.status === 'concluido');
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: [MY_TRAINING_PROGRESS_KEY] }), qc.invalidateQueries({ queryKey: ['se-training-progress'] })]);

  // A URL assinada (1h) só é gerada no primeiro clique e reaproveitada nos três botões.
  const fileUrl = async () => {
    if (urlRef.current) return urlRef.current;
    try { urlRef.current = await signedTrainingUrl(supabase, content.storage_path as string); return urlRef.current; }
    catch { toast({ title: 'Não consegui abrir o arquivo', variant: 'destructive' }); return null; }
  };
  const markStarted = async () => {
    if (!content.id || !user) return;
    try { await registerTrainingProgress(supabase, content.id, 0, null, false); void refresh(); } catch { /* progresso não impede a leitura */ }
  };
  const present = async () => {
    setAction('apresentar');
    try {
      const url = await fileUrl(); if (!url) return;
      void markStarted();
      let next: Frame = { src: url };
      if (format === 'apresentacao') {
        // O storage entrega HTML como texto puro; o conteúdo é lido e montado aqui para rodar como página.
        try { const r = await fetch(url); if (r.ok) next = { html: presentationHtml(await r.text()) }; } catch { /* cai na URL direta */ }
      }
      setFrame(next);
    } finally { setAction(null); }
  };
  const openTab = async () => {
    if (urlRef.current) { window.open(urlRef.current, '_blank', 'noopener'); void markStarted(); return; }
    // A aba é aberta já no clique para o navegador não bloquear enquanto a URL é gerada.
    const tab = window.open('', '_blank');
    setAction('aba');
    try {
      const url = await fileUrl();
      if (!url) { tab?.close(); return; }
      if (tab) { tab.opener = null; tab.location.href = url; } else window.open(url, '_blank', 'noopener');
      void markStarted();
    } finally { setAction(null); }
  };
  const download = async () => {
    setAction('baixar');
    try {
      const url = await fileUrl(); if (!url) return;
      await downloadTraining(url, content.storage_path?.split('/').pop() ?? content.titulo ?? 'material');
    } catch (e) { toast({ title: 'Falha no download', description: trainingErrorMessage(e), variant: 'destructive' }); }
    finally { setAction(null); }
  };
  const finish = async () => {
    if (!user || !content.id) return;
    setAction('concluir');
    try {
      await registerTrainingProgress(supabase, content.id, 0, null, true);
      setCompleted(true); await refresh(); toast({ title: 'Marcado como concluído' });
    } catch (e) { toast({ title: 'Não foi possível marcar como concluído', description: trainingErrorMessage(e), variant: 'destructive' }); }
    finally { setAction(null); }
  };

  useEffect(() => {
    if (!frame) return;
    const onMessage = (e: MessageEvent) => { if (e.source === iframe.current?.contentWindow && e.data === TRAINING_CLOSE_MESSAGE) setFrame(null); };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [frame]);

  const busy = action !== null;
  const viewable = format !== 'download';
  const spin = (a: Action, Icon: typeof Download) => action === a ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />;
  const title = content.titulo ?? 'Material de treinamento';

  return <Dialog open onOpenChange={v => { if (v) return; if (frame) setFrame(null); else if (action !== 'concluir') onClose(); }}>
    {frame ? <DialogContent onOpenAutoFocus={e => { e.preventDefault(); iframe.current?.focus(); }} className="training-video-dialog training-present left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex flex-col gap-0 rounded-none border-0 p-0 sm:rounded-none [&>button]:hidden">
      <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <DialogTitle className="min-w-0 truncate text-sm font-medium">{title}</DialogTitle>
        <DialogDescription className="sr-only">Apresentação em tela cheia</DialogDescription>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => void openTab()}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Abrir em nova aba</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Fechar" onClick={() => setFrame(null)}><X className="h-4 w-4" /></Button>
        </div>
      </header>
      {'html' in frame
        // Sem "allow-same-origin": os scripts da apresentação rodam, mas isolados da sessão do Farol.
        ? <iframe ref={iframe} title={title} srcDoc={frame.html} sandbox="allow-scripts allow-popups allow-forms allow-modals allow-pointer-lock allow-presentation" allow="fullscreen" allowFullScreen onLoad={e => e.currentTarget.focus()} className="min-h-0 w-full flex-1 border-0" />
        : <iframe ref={iframe} title={title} src={frame.src} allow="fullscreen" allowFullScreen onLoad={e => e.currentTarget.focus()} className="min-h-0 w-full flex-1 border-0" />}
    </DialogContent> : <DialogContent className="w-[calc(100%-2rem)] max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="break-words">{title}</DialogTitle><DialogDescription className="whitespace-pre-wrap break-words">{content.descricao || 'Material de treinamento'}</DialogDescription></DialogHeader>
      <div className="flex flex-wrap gap-2">
        {viewable && <Button disabled={busy} onClick={() => void present()}>{spin('apresentar', Presentation)}Apresentar</Button>}
        {viewable && <Button variant="outline" disabled={busy} onClick={() => void openTab()}>{spin('aba', ExternalLink)}Abrir em nova aba</Button>}
        <Button variant="outline" disabled={busy} onClick={() => void download()}>{spin('baixar', Download)}Baixar arquivo</Button>
      </div>
      <div className="border-t border-border pt-4"><Button variant={viewable ? 'outline' : 'default'} disabled={busy || completed} onClick={() => void finish()}><Check className="mr-2 h-4 w-4" />{completed ? 'Concluído' : action === 'concluir' ? 'Salvando…' : 'Marcar como concluído'}</Button></div>
    </DialogContent>}
  </Dialog>;
}
