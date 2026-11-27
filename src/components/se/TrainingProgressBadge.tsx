import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dateSE } from '@/lib/seTraining';
import type { MyProgress } from '@/lib/seProgress';

/** Selo do card: verde quando concluído, âmbar em andamento, nada quando não iniciado. */
export function TrainingProgressBadge({ progress, className }: { progress?: MyProgress; className?: string }) {
  const base = 'inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums shadow-sm';
  if (progress?.status === 'concluido') return <span title={progress.concluido_em ? `Concluído em ${dateSE(progress.concluido_em)}` : 'Concluído'} className={cn(base, 'bg-success text-success-foreground', className)}>Concluído<Check className="h-3 w-3" aria-hidden /></span>;
  if (progress?.status === 'em_andamento') return <span className={cn(base, 'bg-warning text-warning-foreground', className)}>Em andamento · {Math.round(progress.percentual ?? 0)}%</span>;
  return null;
}

export function TrainingProgressBar({ percent, done, className }: { percent: number; done: boolean; className?: string }) {
  const value = Math.min(100, Math.max(0, Math.round(percent)));
  return <div role="progressbar" aria-label="Progresso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className={cn('h-1 w-full overflow-hidden bg-foreground/20', className)}>
    <div className={cn('h-full transition-[width] duration-300', done ? 'bg-success' : 'bg-primary')} style={{ width: `${value}%` }} />
  </div>;
}
