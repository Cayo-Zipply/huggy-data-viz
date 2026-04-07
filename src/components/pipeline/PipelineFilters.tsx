import { useState } from "react";
import { cn } from "@/lib/utils";
import { Filter, X, Download, CalendarIcon, ChevronDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PipelineCard, PipelineTask, LeadStatus, Stage } from "./types";
import { CLOSERS, STAGE_ORDER, STAGE_CONFIG, formatBRL, daysDiff } from "./types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

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

type DatePreset = "todos" | "hoje" | "este_mes" | "mes_passado" | "personalizado";

function getPresetLabel(preset: DatePreset): string {
  switch (preset) {
    case "todos": return "Todas as datas";
    case "hoje": return "Hoje";
    case "este_mes": return "Este mês";
    case "mes_passado": return "Mês passado";
    case "personalizado": return "Personalizado";
  }
}

function detectPreset(f: FilterState): DatePreset {
  if (!f.dateFrom && !f.dateTo) return "todos";
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const lastMonthStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
  const lastMonthEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");

  if (f.dateFrom === todayStr && f.dateTo === todayStr) return "hoje";
  if (f.dateFrom === monthStart && f.dateTo === monthEnd) return "este_mes";
  if (f.dateFrom === lastMonthStart && f.dateTo === lastMonthEnd) return "mes_passado";
  return "personalizado";
}

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onExport: () => void;
}

export function PipelineFiltersBar({ filters, onChange, onExport }: Props) {
  const [open, setOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [calFromOpen, setCalFromOpen] = useState(false);
  const [calToOpen, setCalToOpen] = useState(false);

  const hasF = filters.dateFrom || filters.dateTo || filters.closers.length || filters.status !== "todos" || filters.stages.length || filters.staleDays != null;
  const currentPreset = detectPreset(filters);

  const applyPreset = (preset: DatePreset) => {
    const now = new Date();
    let dateFrom = "";
    let dateTo = "";

    switch (preset) {
      case "hoje":
        dateFrom = dateTo = format(now, "yyyy-MM-dd");
        break;
      case "este_mes":
        dateFrom = format(startOfMonth(now), "yyyy-MM-dd");
        dateTo = format(endOfMonth(now), "yyyy-MM-dd");
        break;
      case "mes_passado":
        dateFrom = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
        dateTo = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
        break;
      case "todos":
        dateFrom = "";
        dateTo = "";
        break;
      case "personalizado":
        // keep current, just open filters
        setOpen(true);
        setPresetOpen(false);
        return;
    }

    onChange({ ...filters, dateFrom, dateTo });
    setPresetOpen(false);
  };

  const handleCalFromSelect = (date: Date | undefined) => {
    if (date) {
      onChange({ ...filters, dateFrom: format(date, "yyyy-MM-dd") });
    }
    setCalFromOpen(false);
  };

  const handleCalToSelect = (date: Date | undefined) => {
    if (date) {
      onChange({ ...filters, dateTo: format(date, "yyyy-MM-dd") });
    }
    setCalToOpen(false);
  };

  const dateLabel = currentPreset !== "todos" && currentPreset !== "personalizado"
    ? getPresetLabel(currentPreset)
    : filters.dateFrom || filters.dateTo
      ? `${filters.dateFrom ? format(new Date(filters.dateFrom + "T12:00:00"), "dd/MM", { locale: ptBR }) : "..."} – ${filters.dateTo ? format(new Date(filters.dateTo + "T12:00:00"), "dd/MM", { locale: ptBR }) : "..."}`
      : null;

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

        {/* Date preset dropdown + calendar */}
        <div className="relative">
          <Popover open={presetOpen} onOpenChange={setPresetOpen}>
            <PopoverTrigger asChild>
              <button className={cn(
                "flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 transition-all",
                dateLabel ? "border-primary/40 text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"
              )}>
                <CalendarIcon size={12} />
                {dateLabel || "Data"}
                <ChevronDown size={10} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1" align="end">
              <div className="flex flex-col min-w-[160px]">
                {(["todos", "hoje", "este_mes", "mes_passado", "personalizado"] as DatePreset[]).map(p => (
                  <button
                    key={p}
                    onClick={() => applyPreset(p)}
                    className={cn(
                      "text-left text-xs px-3 py-2 rounded hover:bg-accent transition-colors",
                      currentPreset === p ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                    )}
                  >
                    {getPresetLabel(p)}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Custom date range pickers (shown when date filter is active) */}
        {(filters.dateFrom || filters.dateTo || currentPreset === "personalizado") && (
          <div className="flex items-center gap-1">
            <Popover open={calFromOpen} onOpenChange={setCalFromOpen}>
              <PopoverTrigger asChild>
                <button className="text-[10px] px-2 py-1 border border-border rounded hover:border-primary/40 text-muted-foreground hover:text-foreground transition-all">
                  {filters.dateFrom ? format(new Date(filters.dateFrom + "T12:00:00"), "dd/MM/yyyy") : "De..."}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom ? new Date(filters.dateFrom + "T12:00:00") : undefined}
                  onSelect={handleCalFromSelect}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <span className="text-[10px] text-muted-foreground">–</span>
            <Popover open={calToOpen} onOpenChange={setCalToOpen}>
              <PopoverTrigger asChild>
                <button className="text-[10px] px-2 py-1 border border-border rounded hover:border-primary/40 text-muted-foreground hover:text-foreground transition-all">
                  {filters.dateTo ? format(new Date(filters.dateTo + "T12:00:00"), "dd/MM/yyyy") : "Até..."}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateTo ? new Date(filters.dateTo + "T12:00:00") : undefined}
                  onSelect={handleCalToSelect}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

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
