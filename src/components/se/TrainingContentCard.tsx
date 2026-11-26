import { CheckCircle2, Clock, ExternalLink, FileText, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TrainingPlayable } from '@/lib/seTraining';

export function TrainingContentCard({ content, recommended = false, onOpen }: { content: TrainingPlayable; recommended?: boolean; onOpen: (content: TrainingPlayable) => void }) {
  const Icon = content.conteudo_tipo === 'video' ? Play : content.conteudo_tipo === 'arquivo' ? FileText : ExternalLink;
  return <article className="border border-border bg-card rounded-lg p-4 flex flex-col gap-3 min-w-0">
    <div className="flex items-start gap-2"><Icon className="h-4 w-4 mt-0.5 text-primary shrink-0" /><h4 className="text-sm font-medium flex-1 break-words">{content.conteudo_titulo}</h4></div>
    {(recommended || content.concluido_em) && <div className="flex flex-wrap gap-2">{recommended && <Badge variant="outline" className="text-primary border-primary/30">Recomendado para você</Badge>}{content.concluido_em && <Badge variant="outline" className="text-success border-success/30"><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</Badge>}</div>}
    {content.descricao && <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{content.descricao}</p>}
    <div className="mt-auto flex items-center justify-between gap-2">{content.duracao_min != null ? <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Clock className="h-3 w-3" />{content.duracao_min} min</span> : <span />}<Button size="sm" variant="outline" onClick={() => onOpen(content)}>Abrir conteúdo</Button></div>
  </article>;
}