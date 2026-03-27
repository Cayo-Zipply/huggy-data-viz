import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PipelineCard, PipelineTask } from "./types";
import { formatBRL } from "./types";
import { PipelineCardItem } from "./PipelineCard";

interface StageInfo {
  key: string;
  label: string;
  icon: any;
  color: string;
  bg: string;
}

interface Props {
  stage: StageInfo;
  cards: PipelineCard[];
  tasks: PipelineTask[];
  onUpdate: (u: Partial<PipelineCard> & { id: string }) => void;
  onUploadContract: (card: PipelineCard, file: File) => void;
  onDrop: (cardId: string, stage: string) => void;
  onMarkWon: (id: string) => void;
  onMarkLost: (id: string, reason: string) => void;
  onCreateTask: (task: Omit<PipelineTask, "id" | "created_at">) => void;
  onToggleTask: (taskId: string, status: string) => void;
}

export function StageColumn({ stage, cards, tasks, onUpdate, onUploadContract, onDrop, onMarkWon, onMarkLost, onCreateTask, onToggleTask }: Props) {
  const Icon = stage.icon;
  const [dragOver, setDragOver] = useState(false);
  const totalValue = cards.reduce((sum, c) => sum + (c.deal_value || 1621), 0);

  return (
    <div
      className={cn(
        "flex-1 min-w-[260px] max-w-[320px] flex flex-col rounded-xl border transition-all",
        dragOver ? "border-primary/50 bg-primary/5" : "border-border bg-card/30"
      )}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const id = e.dataTransfer.getData("cardId"); if (id) onDrop(id, stage.key); }}
    >
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", stage.bg.split(" ")[0])}>
            <Icon size={12} className={stage.color} />
          </div>
          <span className="text-sm font-medium text-foreground">{stage.label}</span>
          <span className="ml-auto text-xs text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">{cards.length}</span>
        </div>
        {cards.length > 0 && (
          <p className="text-[10px] text-emerald-400 mt-1">{formatBRL(totalValue)}</p>
        )}
      </div>
      <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[60vh]">
        {cards.map(card => (
          <div key={card.id} draggable onDragStart={e => e.dataTransfer.setData("cardId", card.id)} className="cursor-grab active:cursor-grabbing">
            <PipelineCardItem card={card} tasks={tasks} onUpdate={onUpdate} onUploadContract={onUploadContract}
              onMarkWon={onMarkWon} onMarkLost={onMarkLost} onCreateTask={onCreateTask} onToggleTask={onToggleTask} />
          </div>
        ))}
        {cards.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Nenhum card</p>}
      </div>
    </div>
  );
}
