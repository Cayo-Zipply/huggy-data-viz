import { Check, Play } from 'lucide-react';
import type { TrainingPlayable } from '@/lib/seTraining';
import { TrainingCover } from './TrainingCover';

export function TrainingCard({ content, cover, onOpen }: { content: TrainingPlayable; cover: string | null; onOpen: (content: TrainingPlayable) => void }) {
  return <button type="button" onClick={() => onOpen(content)} className="group w-64 shrink-0 snap-start text-left sm:w-72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
    <TrainingCover src={cover}>
      <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden>
        <span className="training-cover-chip flex h-12 w-12 items-center justify-center rounded-full"><Play className="h-5 w-5 fill-current" /></span>
      </span>
      {content.concluido_em && <span className="training-cover-chip absolute left-2 top-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"><Check className="h-3 w-3" />Assistido</span>}
      {content.duracao_min != null && <span className="training-cover-chip absolute bottom-2 right-2 rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums">{content.duracao_min} min</span>}
    </TrainingCover>
    <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug">{content.titulo}</h3>
  </button>;
}
