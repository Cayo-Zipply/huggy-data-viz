import { useState } from "react";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import type { PipelineCard, PipelineTask, Stage } from "./types";
import { STAGE_CONFIG, formatBRL } from "./types";
import { PipelineCardItem } from "./PipelineCard";
import type { PipelineLabel } from "@/hooks/useLabels";

interface Props {
  stageKey: Stage;
  cards: PipelineCard[];
  tasks: PipelineTask[];
  getCardLabels?: (cardId: string) => PipelineLabel[];
  bulkMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onUpdate: (id: string, u: Partial<PipelineCard>) => void;
  onDrop: (cardId: string, stage: string) => void;
  onMarkWon: (id: string) => void;
  onMarkLost: (id: string, cat: string, reason: string) => void;
  onCreateTask: (task: Omit<PipelineTask, "id" | "created_at">) => void;
  onToggleTask: (id: string) => void;
  onCardClick?: (card: PipelineCard) => void;
}

export function StageColumn({ stageKey, cards, tasks, getCardLabels, bulkMode, selectedIds, onToggleSelect, onUpdate, onDrop, onMarkWon, onMarkLost, onCreateTask, onToggleTask, onCardClick }: Props) {
  const cfg = STAGE_CONFIG[stageKey];
  const Icon = cfg.icon;
  const [dragOver, setDragOver] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const totalBruto = cards.reduce((s, c) => s + (c.deal_value || 1621), 0);
  const totalPonderado = cards.reduce((s, c) => s + (c.deal_value || 1621) * cfg.probability, 0);

  return (
    <div
      className={cn(
        "flex w-[320px] min-w-[320px] max-w-[320px] flex-col rounded-2xl border shadow-sm transition-all",
        dragOver ? "border-primary/60 bg-primary/5" : "border-border bg-card"
      )}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const id = e.dataTransfer.getData("cardId"); if (id) onDrop(id, stageKey); }}
    >
      <div className="sticky top-0 z-10 rounded-t-2xl border-b border-border bg-card/95 p-3 backdrop-blur">
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
      <div className="flex-1 space-y-2 overflow-y-auto bg-muted/20 p-2.5 max-h-[62vh]">
        {cards.map(card => (
          <div
            key={card.id}
            draggable={!bulkMode}
            onDragStart={e => e.dataTransfer.setData("cardId", card.id)}
            onClick={(e) => {
              if (bulkMode) {
                onToggleSelect?.(card.id);
                return;
              }
              const target = e.target as HTMLElement;
              const isInteractive = Boolean(target.closest("button, input, select, textarea, a, label"));
              if (!isInteractive) onCardClick?.(card);
            }}
            className={cn(
              "cursor-grab active:cursor-grabbing relative",
              bulkMode && "cursor-pointer",
              bulkMode && selectedIds?.has(card.id) && "ring-2 ring-primary rounded-2xl"
            )}
          >
            {bulkMode && (
              <div className={cn(
                "absolute top-2 left-2 z-20 w-5 h-5 rounded border-2 flex items-center justify-center text-[10px]",
                selectedIds?.has(card.id)
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-background border-border"
              )}>
                {selectedIds?.has(card.id) && "✓"}
              </div>
            )}
            <PipelineCardItem card={card} tasks={tasks} cardLabels={getCardLabels?.(card.id) || []} onUpdate={onUpdate}
              onMarkWon={onMarkWon} onMarkLost={onMarkLost} onCreateTask={onCreateTask} onToggleTask={onToggleTask}
              onCardClick={onCardClick} />
          </div>
        ))}
        {cards.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Nenhum lead</p>}
      </div>
    </div>
  );
}
