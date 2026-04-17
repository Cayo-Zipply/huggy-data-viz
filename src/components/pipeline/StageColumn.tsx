import { useState } from "react";
import { cn } from "@/lib/utils";
import { Info, AlertTriangle } from "lucide-react";
import type { PipelineCard, PipelineTask, Stage } from "./types";
import { STAGE_CONFIG, formatBRL, daysDiff } from "./types";
import { PipelineCardItem } from "./PipelineCard";
import type { PipelineLabel } from "@/hooks/useLabels";
import type { SlaRule } from "@/hooks/useSlaRules";

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
  slaRule?: SlaRule;
  ownerOptions?: string[];
}

export function StageColumn({ stageKey, cards, tasks, getCardLabels, bulkMode, selectedIds, onToggleSelect, onUpdate, onDrop, onMarkWon, onMarkLost, onCreateTask, onToggleTask, onCardClick, slaRule, ownerOptions }: Props) {
  const cfg = STAGE_CONFIG[stageKey];
  const Icon = cfg.icon;
  const [dragOver, setDragOver] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const slaHoras = slaRule?.sla_horas ?? 24;

  // Count SLA breaches
  const slaBreached = cards.filter(c => {
    if (c.lead_status !== "aberto") return false;
    const hoursInStage = daysDiff(c.stage_changed_at) * 24;
    return hoursInStage >= slaHoras;
  }).length;

  const totalBruto = cards.reduce((s, c) => s + (c.deal_value || 1621), 0);
  const totalPonderado = cards.reduce((s, c) => s + (c.deal_value || 1621) * cfg.probability, 0);

  return (
    <div
      className={cn(
        "flex w-[300px] min-w-[300px] max-w-[300px] flex-col rounded-lg border transition-colors",
        dragOver ? "border-primary/50 bg-primary/5" : "border-border bg-card/50"
      )}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const id = e.dataTransfer.getData("cardId"); if (id) onDrop(id, stageKey); }}
    >
      <div className="sticky top-0 z-10 rounded-t-lg border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground flex-1 truncate">{cfg.label}</span>
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{cards.length}</span>
          {slaBreached > 0 && (
            <span className="text-[10px] font-medium bg-red-50 text-red-700 border border-red-200 rounded-md px-1.5 py-0.5 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">
              {slaBreached} SLA
            </span>
          )}
          <button onClick={() => setShowTooltip(!showTooltip)} className="text-muted-foreground hover:text-foreground">
            <Info size={12} />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[11px] tabular-nums">
          <span className="font-semibold text-foreground">{formatBRL(totalPonderado)}</span>
          <span className="text-muted-foreground">· {Math.round(cfg.probability * 100)}%</span>
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
      <div className="flex-1 space-y-2 overflow-y-auto p-2 max-h-[62vh]">
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
              bulkMode && selectedIds?.has(card.id) && "ring-1 ring-primary rounded-lg"
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
            <PipelineCardItem card={card} tasks={tasks} cardLabels={getCardLabels?.(card.id) || []} slaHoras={slaRule?.sla_horas} ownerOptions={ownerOptions} onUpdate={onUpdate}
              onMarkWon={onMarkWon} onMarkLost={onMarkLost} onCreateTask={onCreateTask} onToggleTask={onToggleTask}
              onCardClick={onCardClick} />
          </div>
        ))}
        {cards.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Nenhum lead</p>}
      </div>
    </div>
  );
}
