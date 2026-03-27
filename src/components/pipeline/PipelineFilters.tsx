import { useState } from "react";
import { cn } from "@/lib/utils";
import { Filter, X, Download } from "lucide-react";
import type { PipelineCard, PipelineTask, LeadStatus, Stage } from "./types";
import { CLOSERS, STAGE_ORDER, STAGE_CONFIG, formatBRL, daysDiff } from "./types";

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  stageChangedFrom: string;
  stageChangedTo: string;
  closers: string[];
  status: LeadStatus | "todos";
  stages: string[];
  staleDays: number | null;
}

export const defaultFilters: FilterState = {
  dateFrom: "", dateTo: "", stageChangedFrom: "", stageChangedTo: "",
  closers: [], status: "todos", stages: [], staleDays: null,
};

export function applyFilters(cards: PipelineCard[], f: FilterState): PipelineCard[] {
  return cards.filter(c => {
    if (f.dateFrom && c.created_at < f.dateFrom) return false;
    if (f.dateTo && c.created_at > f.dateTo + "T23:59:59") return false;
    if (f.stageChangedFrom && c.stage_changed_at < f.stageChangedFrom) return false;
    if (f.stageChangedTo && c.stage_changed_at > f.stageChangedTo + "T23:59:59") return false;
    if (f.closers.length > 0 && !f.closers.includes(c.owner || "")) return false;
    if (f.status !== "todos" && c.lead_status !== f.status) return false;
    if (f.stages.length > 0 && !f.stages.includes(c.stage)) return false;
    if (f.staleDays != null && daysDiff(c.stage_changed_at) < f.staleDays) return false;
    return true;
  });
}

export function exportCSV(cards: PipelineCard[], tasks: PipelineTask[]) {
  const headers = ["Nome","Telefone","Origem","Data Entrada","Etapa Atual","Última Etapa","Status","Motivo Perda","Valor Negócio","Probabilidade","Valor Ponderado","Closer","Data Última Mudança","Dias na Etapa","Anotações","Tarefas Pendentes"];
  const rows = cards.map(c => {
    const prob = STAGE_CONFIG[c.stage]?.probability || 0;
    const pending = tasks.filter(t => t.card_id === c.id && t.status === "pendente").map(t => t.title).join("; ");
    return [
      c.nome, c.telefone || "", c.origem || "",
      new Date(c.created_at).toLocaleDateString("pt-BR"),
      STAGE_CONFIG[c.stage]?.label || c.stage, c.last_stage ? (STAGE_CONFIG[c.last_stage as Stage]?.label || c.last_stage) : "",
      c.lead_status, c.loss_reason || "",
      c.deal_value?.toString() || "1621", `${Math.round(prob * 100)}%`,
      (c.deal_value * prob).toFixed(2), c.owner || "",
      new Date(c.stage_changed_at).toLocaleDateString("pt-BR"),
      daysDiff(c.stage_changed_at).toString(),
      c.anotacoes || "", pending,
    ].map(v => `"${(v || "").replace(/"/g, '""')}"`).join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "pipeline_export.csv"; a.click();
}

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onExport: () => void;
}

export function PipelineFiltersBar({ filters, onChange, onExport }: Props) {
  const [open, setOpen] = useState(false);
  const hasF = filters.dateFrom || filters.dateTo || filters.closers.length || filters.status !== "todos" || filters.stages.length || filters.staleDays != null;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap items-center">
        {/* Quick status filters */}
        {(["todos", "aberto", "ganho", "perdido"] as const).map(s => (
          <button key={s} onClick={() => onChange({ ...filters, status: s })}
            className={cn("text-[11px] px-3 py-1 rounded-full border transition-all capitalize",
              filters.status === s ? "bg-primary/20 text-primary border-primary/40" : "border-border text-muted-foreground hover:text-foreground")}>
            {s === "todos" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1) + "s"}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => setOpen(!open)}
          className={cn("flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 transition-all",
            hasF ? "border-primary/40 text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}>
          <Filter size={12} />Filtros
        </button>
        {hasF && <button onClick={() => onChange(defaultFilters)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><X size={12} />Limpar</button>}
        <button onClick={onExport} className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30">
          <Download size={12} />CSV
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 bg-card/50 border border-border rounded-xl p-3">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Entrada (de)</label>
            <input type="date" value={filters.dateFrom} onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
              className="w-full text-xs bg-muted/50 border border-border rounded px-2 py-1.5 text-foreground" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Entrada (até)</label>
            <input type="date" value={filters.dateTo} onChange={e => onChange({ ...filters, dateTo: e.target.value })}
              className="w-full text-xs bg-muted/50 border border-border rounded px-2 py-1.5 text-foreground" />
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
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Parados há mais de (dias)</label>
            <input type="number" value={filters.staleDays ?? ""} onChange={e => onChange({ ...filters, staleDays: e.target.value ? Number(e.target.value) : null })}
              placeholder="Ex: 7" className="w-full text-xs bg-muted/50 border border-border rounded px-2 py-1.5 text-foreground" />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="text-[10px] text-muted-foreground block mb-1">Etapas</label>
            <div className="flex gap-1 flex-wrap">
              {STAGE_ORDER.map(s => (
                <button key={s} onClick={() => {
                  const next = filters.stages.includes(s) ? filters.stages.filter(x => x !== s) : [...filters.stages, s];
                  onChange({ ...filters, stages: next });
                }}
                  className={cn("text-[10px] px-2 py-1 rounded-full border transition-all",
                    filters.stages.includes(s) ? "bg-primary/20 text-primary border-primary/40" : "border-border text-muted-foreground")}>
                  {STAGE_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
