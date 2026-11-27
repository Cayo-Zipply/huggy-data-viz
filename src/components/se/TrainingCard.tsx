import { FileText, Play, Presentation } from 'lucide-react';
import { trainingFileFormat, type TrainingPlayable } from '@/lib/seTraining';
import type { MyProgress } from '@/lib/seProgress';
import { TrainingCover } from './TrainingCover';
import { TrainingProgressBadge, TrainingProgressBar } from './TrainingProgressBadge';

export function TrainingCard({ content, cover, progress, onOpen }: { content: TrainingPlayable; cover: string | null; progress?: MyProgress; onOpen: (content: TrainingPlayable) => void }) {
  const format = content.tipo === 'arquivo' ? trainingFileFormat(content.storage_path) : 'download';
  const Icon = format === 'apresentacao' ? Presentation : format === 'pdf' ? FileText : Play;
  const done = progress?.status === 'concluido';
  return <button type="button" onClick={() => onOpen(content)} className="group w-64 shrink-0 snap-start text-left sm:w-72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
    <TrainingCover src={cover} icon={Icon}>
      <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden>
        <span className="training-cover-chip flex h-12 w-12 items-center justify-center rounded-full"><Icon className={Icon === Play ? 'h-5 w-5 fill-current' : 'h-5 w-5'} /></span>
      </span>
      <TrainingProgressBadge progress={progress} className="absolute left-2 top-2" />
      {content.duracao_min != null && <span className="training-cover-chip absolute bottom-2 right-2 rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums">{content.duracao_min} min</span>}
      {content.tipo === 'video' && <TrainingProgressBar percent={done ? 100 : progress?.percentual ?? 0} done={done} className="absolute inset-x-0 bottom-0 bg-white/25" />}
    </TrainingCover>
    <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug">{content.titulo}</h3>
  </button>;
}
