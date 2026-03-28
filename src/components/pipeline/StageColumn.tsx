import { useState } from "react";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import type { PipelineCard, PipelineTask, Stage } from "./types";
import { STAGE_CONFIG, formatBRL } from "./types";
import { PipelineCardItem } from "./PipelineCard";

interface Props {
  stageKey: Stage;
  cards: PipelineCard[];
  tasks: PipelineTask[];
  onUpdate: (id: string, u: Partial<PipelineCard>) => void;
  onDrop: (cardId: string, stage: string) => void;
  onMarkWon: (id: string) => void;
  onMarkLost: (id: string, cat: string, reason: string) => void;
  onCreateTask: (task: Omit<PipelineTask, "id" | "created_at">) => void;
  onToggleTask: (id: string) => void;
  onCardClick?: (card: PipelineCard) => void;
}

export function StageColumn({ stageKey, cards, tasks, onUpdate, onDrop, onMarkWon, onMarkLost, onCreateTask, onToggleTask, onCardClick }: Props) {
  const cfg = STAGE_CONFIG[stageKey];
  const Icon = cfg.icon;
  const [dragOver, setDragOver] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const totalBruto = cards.reduce((s, c) => s + (c.deal_value || 1621), 0);
  const totalPonderado = cards.reduce((s, c) => s + (c.deal_value || 1621) * cfg.probability, 0);

  return (
    <div
      className={cn(
        "flex-1 min-w-[240px] max-w-[300px] flex flex-col rounded-xl border transition-all",
        dragOver ? "border-primary/50 bg-primary/5" : "border-border bg-card/30"
      )}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const id = e.dataTransfer.getData("cardId"); if (id) onDrop(id, stageKey); }}
    >
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", cfg.bg.split(" ")[0])}>
            <Icon size={12} className={cfg.color} />
          </div>
          <span className="text-sm font-medium text-foreground flex-1">{cfg.label}</span>
          <span className="text-xs text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">{cards.length}</span>
          <button onClick={() => setShowTooltip(!showTooltip)} className="text-muted-foreground hover:text-foreground">
            <Info size={12} />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-emerald-400 font-medium">{formatBRL(totalPonderado)}</span>
          <span className="text-[10px] text-muted-foreground">({Math.round(cfg.probability * 100)}%)</span>
        </div>
        {totalBruto > 0 && (
          <span className="text-[10px] text-muted-foreground">Bruto: {formatBRL(totalBruto)}</span>
        )}
        {showTooltip && (
          <div className="mt-2 text-[10px] text-muted-foreground bg-muted/30 rounded-lg p-2 border border-border/50">
            <strong>Critério de saída:</strong> {cfg.exitCriteria}
          </div>
        )}
      </div>
      <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[55vh]">
        {cards.map(card => (
          <div key={card.id} draggable onDragStart={e => e.dataTransfer.setData("cardId", card.id)} className="cursor-grab active:cursor-grabbing">
            <PipelineCardItem card={card} tasks={tasks} onUpdate={onUpdate}
              onMarkWon={onMarkWon} onMarkLost={onMarkLost} onCreateTask={onCreateTask} onToggleTask={onToggleTask}
              onCardClick={onCardClick} />
          </div>
        ))}
        {cards.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Nenhum lead</p>}
      </div>
    </div>
  );
}
