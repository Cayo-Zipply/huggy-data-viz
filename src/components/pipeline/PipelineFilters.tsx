import { useState } from "react";
import { cn } from "@/lib/utils";
import { Filter, X, Download, ChevronDown } from "lucide-react";
import type { PipelineCard, PipelineTask, LeadStatus } from "./types";
import { CLOSERS, ALL_STAGES, getStageLabel, formatBRL } from "./types";

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  stageChangedFrom: string;
  stageChangedTo: string;
  closers: string[];
  status: LeadStatus | "todos";
  stages: string[];
}

export const defaultFilters: FilterState = {
  dateFrom: "", dateTo: "", stageChangedFrom: "", stageChangedTo: "",
  closers: [], status: "todos", stages: [],
};

export function applyFilters(cards: PipelineCard[], filters: FilterState): PipelineCard[] {
  return cards.filter(c => {
    if (filters.dateFrom && c.created_at < filters.dateFrom) return false;
    if (filters.dateTo && c.created_at > filters.dateTo + "T23:59:59") return false;
    if (filters.stageChangedFrom && c.stage_changed_at && c.stage_changed_at < filters.stageChangedFrom) return false;
    if (filters.stageChangedTo && c.stage_changed_at && c.stage_changed_at > filters.stageChangedTo + "T23:59:59") return false;
    if (filters.closers.length > 0 && !filters.closers.includes(c.owner || "")) return false;
    if (filters.status !== "todos" && c.lead_status !== filters.status) return false;
    if (filters.stages.length > 0) {
      const currentStage = c.pipe === "sdr" ? c.sdr_stage : c.closer_stage;
      if (!currentStage || !filters.stages.includes(currentStage)) return false;
    }
    return true;
  });
}

export function exportCSV(cards: PipelineCard[], tasks: PipelineTask[]) {
  const headers = ["Nome","Telefone","Origem","Data Entrada","Etapa Atual","Última Etapa","Status","Motivo Perda","Valor Negócio","Closer","Data Alteração Etapa","Anotações","Tarefas"];
  const rows = cards.map(c => {
    const cardTasks = tasks.filter(t => t.card_id === c.id).map(t => `${t.title} (${t.status})`).join("; ");
    return [
      c.nome, c.telefone || "", c.origem || "",
      new Date(c.created_at).toLocaleDateString("pt-BR"),
      getStageLabel(c), c.last_stage || "", c.lead_status,
      c.loss_reason || "", c.deal_value?.toString() || "1621",
      c.owner || "", c.stage_changed_at ? new Date(c.stage_changed_at).toLocaleDateString("pt-BR") : "",
      c.anotacoes || "", cardTasks,
    ].map(v => `"${(v || "").replace(/"/g, '""')}"`).join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "pipeline_export.csv"; a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onExport: () => void;
}

export function PipelineFiltersBar({ filters, onChange, onExport }: Props) {
  const [open, setOpen] = useState(false);
  const hasFilters = filters.dateFrom || filters.dateTo || filters.closers.length || filters.status !== "todos" || filters.stages.length;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setOpen(!open)}
          className={cn("flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 transition-all",
            hasFilters ? "border-primary/40 text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30")}>
          <Filter size={12} /> Filtros {hasFilters && <span className="bg-primary/20 rounded-full px-1.5 text-[10px]">●</span>}
        </button>
        {hasFilters && (
          <button onClick={() => onChange(defaultFilters)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <X size={12} /> Limpar
          </button>
        )}
        <button onClick={onExport} className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 ml-auto">
          <Download size={12} /> Exportar CSV
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 bg-card/50 border border-border rounded-xl p-3">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Data entrada (de)</label>
            <input type="date" value={filters.dateFrom} onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
              className="w-full text-xs bg-muted/50 border border-border rounded px-2 py-1.5 text-foreground" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Data entrada (até)</label>
            <input type="date" value={filters.dateTo} onChange={e => onChange({ ...filters, dateTo: e.target.value })}
              className="w-full text-xs bg-muted/50 border border-border rounded px-2 py-1.5 text-foreground" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Status</label>
            <select value={filters.status} onChange={e => onChange({ ...filters, status: e.target.value as any })}
              className="w-full text-xs bg-muted/50 border border-border rounded px-2 py-1.5 text-foreground">
              <option value="todos">Todos</option>
              <option value="aberto">Aberto</option>
              <option value="ganho">Ganho</option>
              <option value="perdido">Perdido</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Closer</label>
            <div className="flex gap-1 flex-wrap">
              {CLOSERS.map(c => (
                <button key={c} onClick={() => {
                  const next = filters.closers.includes(c) ? filters.closers.filter(x => x !== c) : [...filters.closers, c];
                  onChange({ ...filters, closers: next });
                }}
                  className={cn("text-[10px] px-2 py-1 rounded-full border transition-all",
                    filters.closers.includes(c) ? "bg-primary/20 text-primary border-primary/40" : "border-border text-muted-foreground")}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
