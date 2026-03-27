import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Settings, RefreshCw, Link2, UserCircle, LayoutGrid, ListChecks, BarChart3, Target } from "lucide-react";
import { usePipelineData } from "./pipeline/usePipelineData";
import { StageColumn } from "./pipeline/StageColumn";
import { PipelineFiltersBar, applyFilters, exportCSV, defaultFilters, type FilterState } from "./pipeline/PipelineFilters";
import { TasksPanel } from "./pipeline/TasksPanel";
import { CRMDashboard } from "./pipeline/CRMDashboard";
import { GoalsPanel } from "./pipeline/GoalsPanel";
import { CLOSERS, SDR_STAGES, CLOSER_STAGES } from "./pipeline/types";
import type { PipeType } from "./pipeline/types";
import { useToast } from "@/hooks/use-toast";

const SUB_TABS = [
  { key: "kanban", label: "Kanban", icon: LayoutGrid },
  { key: "tarefas", label: "Tarefas", icon: ListChecks },
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "metas", label: "Metas", icon: Target },
];

export function PipelinePanel() {
  const { cards, tasks, goals, loading, fetchAll, updateCard, moveCard, markWon, markLost, createTask, updateTaskStatus, updateTaskDate, upsertGoal, uploadContract } = usePipelineData();
  const [activePipe, setActivePipe] = useState<PipeType>("sdr");
  const [subTab, setSubTab] = useState("kanban");
  const [showWebhook, setShowWebhook] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const { toast } = useToast();

  // User selector
  const [activeUser, setActiveUser] = useState(() => localStorage.getItem("pipeline_active_user") || "Cayo");
  useEffect(() => { localStorage.setItem("pipeline_active_user", activeUser); }, [activeUser]);

  const isAdmin = activeUser === "Cayo";
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";
  const webhookUrl = projectId ? `https://${projectId}.supabase.co/functions/v1/webhook-zapier` : "";

  // Filter cards by user visibility + filters
  const visibleCards = useMemo(() => {
    let filtered = isAdmin ? cards : cards.filter(c => c.owner === activeUser || !c.owner);
    filtered = applyFilters(filtered, filters);
    return filtered;
  }, [cards, isAdmin, activeUser, filters]);

  const todayPendingCount = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return tasks.filter(t => t.due_date <= today && t.status === "pendente" && (isAdmin || t.responsible === activeUser)).length;
  }, [tasks, isAdmin, activeUser]);

  const stages = activePipe === "sdr" ? SDR_STAGES : CLOSER_STAGES;
  const getCardsForStage = (key: string) => {
    if (activePipe === "sdr") return visibleCards.filter(c => c.pipe === "sdr" && c.sdr_stage === key);
    return visibleCards.filter(c => c.pipe === "closer" && c.closer_stage === key);
  };

  const sdrCount = visibleCards.filter(c => c.pipe === "sdr").length;
  const closerCount = visibleCards.filter(c => c.pipe === "closer").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Pipeline de Vendas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{cards.length} leads no total</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* User selector */}
          <div className="flex items-center gap-1.5 border border-border rounded-lg px-3 py-1.5">
            <UserCircle size={14} className="text-primary" />
            <select value={activeUser} onChange={e => setActiveUser(e.target.value)}
              className="text-xs bg-transparent text-foreground outline-none cursor-pointer">
              {CLOSERS.map(c => <option key={c} value={c}>{c}{c === "Cayo" ? " (Admin)" : ""}</option>)}
            </select>
          </div>
          <button onClick={() => setShowWebhook(!showWebhook)}
            className="flex items-center gap-1.5 text-xs border border-border/50 rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30">
            <Settings size={12} /> Webhook
          </button>
          <button onClick={fetchAll}
            className="flex items-center gap-1.5 text-xs border border-border/50 rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Webhook */}
      {showWebhook && (
        <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
          <p className="text-sm font-medium text-foreground flex items-center gap-2"><Link2 size={14} /> Webhook — Google Sheets</p>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-card border border-border rounded-lg p-2.5 text-foreground break-all select-all">{webhookUrl}</code>
            <button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast({ title: "Copiado!" }); }}
              className="px-3 py-1.5 text-xs bg-primary/20 text-primary rounded-lg hover:bg-primary/30 flex-shrink-0">Copiar</button>
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-muted/30 rounded-xl p-1 overflow-x-auto">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const badge = tab.key === "tarefas" ? todayPendingCount : 0;
          return (
            <button key={tab.key} onClick={() => setSubTab(tab.key)}
              className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap relative",
                subTab === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <Icon size={14} /> {tab.label}
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Kanban view */}
      {subTab === "kanban" && (
        <>
          {/* Filters */}
          <PipelineFiltersBar filters={filters} onChange={setFilters} onExport={() => exportCSV(visibleCards, tasks)} />

          {/* Pipe toggle */}
          <div className="flex gap-2">
            <button onClick={() => setActivePipe("sdr")}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all",
                activePipe === "sdr" ? "bg-primary/20 text-primary border-primary/40" : "border-border text-muted-foreground hover:text-foreground")}>
              Pipe SDR <span className="text-xs bg-muted/50 rounded-full px-2 py-0.5">{sdrCount}</span>
            </button>
            <button onClick={() => setActivePipe("closer")}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all",
                activePipe === "closer" ? "bg-primary/20 text-primary border-primary/40" : "border-border text-muted-foreground hover:text-foreground")}>
              Pipe Closer <span className="text-xs bg-muted/50 rounded-full px-2 py-0.5">{closerCount}</span>
            </button>
          </div>

          {/* Kanban board */}
          {loading ? (
            <div className="text-center py-16 text-muted-foreground">Carregando pipeline...</div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {stages.map(stage => (
                <StageColumn key={stage.key} stage={stage}
                  cards={getCardsForStage(stage.key)} tasks={tasks}
                  onUpdate={updateCard} onUploadContract={uploadContract}
                  onDrop={moveCard} onMarkWon={markWon} onMarkLost={markLost}
                  onCreateTask={createTask} onToggleTask={updateTaskStatus} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Tasks view */}
      {subTab === "tarefas" && (
        <TasksPanel tasks={tasks} cards={cards} activeUser={activeUser}
          onToggleTask={updateTaskStatus} onReschedule={updateTaskDate} />
      )}

      {/* Dashboard view */}
      {subTab === "dashboard" && <CRMDashboard cards={cards} activeUser={activeUser} />}

      {/* Goals view */}
      {subTab === "metas" && (
        <GoalsPanel cards={cards} goals={goals} activeUser={activeUser} onSaveGoal={upsertGoal} />
      )}
    </div>
  );
}
