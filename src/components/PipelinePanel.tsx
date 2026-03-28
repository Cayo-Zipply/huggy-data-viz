import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Settings, RefreshCw, UserCircle, LayoutGrid, ListChecks, BarChart3, Target, Upload, Plus } from "lucide-react";
import { usePipelineData } from "./pipeline/usePipelineData";
import { StageColumn } from "./pipeline/StageColumn";
import { PipelineFiltersBar, applyFilters, exportCSV, defaultFilters, type FilterState } from "./pipeline/PipelineFilters";
import { TasksPanel } from "./pipeline/TasksPanel";
import { CRMDashboard } from "./pipeline/CRMDashboard";
import { GoalsPanel } from "./pipeline/GoalsPanel";
import { HandoffChecklist } from "./pipeline/HandoffChecklist";
import { LeadDrawer } from "./pipeline/LeadDrawer";
import { CLOSERS, SDR_STAGES, CLOSER_STAGES, STAGE_CONFIG, STAGE_ORDER } from "./pipeline/types";
import type { PipeType, Stage, PipelineCard } from "./pipeline/types";
import { useToast } from "@/hooks/use-toast";

const SUB_TABS = [
  { key: "kanban", label: "Kanban", icon: LayoutGrid },
  { key: "hoje", label: "Hoje", icon: ListChecks },
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "metas", label: "Metas", icon: Target },
];

export function PipelinePanel() {
  const [activeUser, setActiveUser] = useState(() => localStorage.getItem("crm_active_user") || "Cayo");
  useEffect(() => { localStorage.setItem("crm_active_user", activeUser); }, [activeUser]);

  const { cards, tasks, goals, createCard, updateCard, moveCard, markWon, markLost, createTask, toggleTask, rescheduleTask, upsertGoal, importCSV } = usePipelineData(activeUser);
  const [activePipe, setActivePipe] = useState<"sdr" | "closer" | "all">("all");
  const [subTab, setSubTab] = useState("kanban");
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [pendingHandoff, setPendingHandoff] = useState<{ cardId: string; targetStage: Stage } | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [drawerCard, setDrawerCard] = useState<PipelineCard | null>(null);
  const { toast } = useToast();

  const isAdmin = activeUser === "Cayo";

  const visibleCards = useMemo(() => {
    let filtered = isAdmin ? cards : cards.filter(c => c.owner === activeUser || !c.owner);
    filtered = applyFilters(filtered, filters);
    return filtered;
  }, [cards, isAdmin, activeUser, filters]);

  const todayPending = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return tasks.filter(t => t.due_date <= today && t.status === "pendente" && (isAdmin || t.responsible === activeUser)).length;
  }, [tasks, isAdmin, activeUser]);

  const handleDrop = (cardId: string, targetStage: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card || card.stage === targetStage) return;
    // Handoff check: SDR → Closer
    if (card.pipe === "sdr" && STAGE_CONFIG[targetStage as Stage]?.pipe === "closer") {
      setPendingHandoff({ cardId, targetStage: targetStage as Stage });
      return;
    }
    moveCard(cardId, targetStage as Stage);
  };

  const confirmHandoff = () => {
    if (pendingHandoff) moveCard(pendingHandoff.cardId, pendingHandoff.targetStage);
    setPendingHandoff(null);
  };

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const count = await importCSV(ev.target?.result as string);
      toast({ title: `${count} leads importados!` });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const addLead = async () => {
    if (!newLeadName.trim()) return;
    await createCard({ nome: newLeadName, telefone: newLeadPhone || null, owner: activeUser });
    setNewLeadName(""); setNewLeadPhone(""); setShowNewLead(false);
    toast({ title: "Lead criado!" });
  };

  const getStages = () => {
    if (activePipe === "sdr") return SDR_STAGES;
    if (activePipe === "closer") return CLOSER_STAGES;
    return STAGE_ORDER;
  };

  const getCardsForStage = (stage: Stage) => {
    // Mirror: reuniao_marcada (SDR) also shows reuniao_agendada cards
    if (stage === "reuniao_marcada") {
      return visibleCards.filter(c => c.stage === "reuniao_marcada" || c.stage === "reuniao_agendada");
    }
    // Mirror: reuniao_agendada (Closer) also shows reuniao_marcada cards
    if (stage === "reuniao_agendada") {
      return visibleCards.filter(c => c.stage === "reuniao_agendada" || c.stage === "reuniao_marcada");
    }
    return visibleCards.filter(c => c.stage === stage);
  };

  const sdrCount = visibleCards.filter(c => c.pipe === "sdr").length;
  const closerCount = visibleCards.filter(c => c.pipe === "closer").length;

  return (
    <div className="space-y-4">
      {/* Handoff modal */}
      {pendingHandoff && (
        <HandoffChecklist
          leadName={cards.find(c => c.id === pendingHandoff.cardId)?.nome || ""}
          onConfirm={confirmHandoff}
          onCancel={() => setPendingHandoff(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Pipeline de Vendas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{cards.length} leads · {visibleCards.length} visíveis</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 border border-border rounded-lg px-3 py-1.5">
            <UserCircle size={14} className="text-primary" />
            <select value={activeUser} onChange={e => setActiveUser(e.target.value)}
              className="text-xs bg-transparent text-foreground outline-none cursor-pointer">
              {CLOSERS.map(c => <option key={c} value={c}>{c}{c === "Cayo" ? " (Admin)" : ""}</option>)}
            </select>
          </div>
          <button onClick={() => setShowNewLead(!showNewLead)}
            className="flex items-center gap-1.5 text-xs border border-primary/40 bg-primary/10 rounded-lg px-3 py-1.5 text-primary hover:bg-primary/20">
            <Plus size={12} />Novo Lead
          </button>
          <label className="flex items-center gap-1.5 text-xs border border-border/50 rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 cursor-pointer">
            <Upload size={12} />CSV
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV} />
          </label>
        </div>
      </div>

      {/* New lead form */}
      {showNewLead && (
        <div className="bg-card/50 border border-border rounded-xl p-3 flex flex-col sm:flex-row gap-2">
          <input value={newLeadName} onChange={e => setNewLeadName(e.target.value)} placeholder="Nome do lead"
            className="flex-1 text-xs bg-muted/50 border border-border rounded px-3 py-2 text-foreground" autoFocus />
          <input value={newLeadPhone} onChange={e => setNewLeadPhone(e.target.value)} placeholder="Telefone"
            className="sm:w-40 text-xs bg-muted/50 border border-border rounded px-3 py-2 text-foreground" />
          <button onClick={addLead} className="text-xs px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Criar</button>
          <button onClick={() => setShowNewLead(false)} className="text-xs px-3 py-2 text-muted-foreground">Cancelar</button>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-muted/30 rounded-xl p-1 overflow-x-auto">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const badge = tab.key === "hoje" ? todayPending : 0;
          return (
            <button key={tab.key} onClick={() => setSubTab(tab.key)}
              className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap relative",
                subTab === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <Icon size={14} />{tab.label}
              {badge > 0 && <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{badge}</span>}
            </button>
          );
        })}
      </div>

      {/* Kanban */}
      {subTab === "kanban" && (
        <>
          <PipelineFiltersBar filters={filters} onChange={setFilters} onExport={() => exportCSV(visibleCards, tasks)} />
          <div className="flex gap-2">
            {(["all", "sdr", "closer"] as const).map(p => (
              <button key={p} onClick={() => setActivePipe(p)}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all",
                  activePipe === p ? "bg-primary/20 text-primary border-primary/40" : "border-border text-muted-foreground hover:text-foreground")}>
                {p === "all" ? "Todos" : p === "sdr" ? "SDR" : "Closer"}
                <span className="text-xs bg-muted/50 rounded-full px-2 py-0.5">
                  {p === "all" ? visibleCards.length : p === "sdr" ? sdrCount : closerCount}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {getStages().map(s => (
              <StageColumn key={s} stageKey={s} cards={getCardsForStage(s)} tasks={tasks}
                onUpdate={updateCard} onDrop={handleDrop} onMarkWon={markWon} onMarkLost={markLost}
                onCreateTask={createTask} onToggleTask={toggleTask}
                onCardClick={(c) => setDrawerCard(c)} />
            ))}
          </div>
        </>
      )}

      {subTab === "hoje" && <TasksPanel tasks={tasks} cards={cards} activeUser={activeUser} onToggle={toggleTask} onReschedule={rescheduleTask} />}
      {subTab === "dashboard" && <CRMDashboard cards={cards} activeUser={activeUser} />}
      {subTab === "metas" && <GoalsPanel cards={cards} goals={goals} activeUser={activeUser} onSave={upsertGoal} />}

      {/* Lead Drawer */}
      <LeadDrawer
        card={drawerCard ? cards.find(c => c.id === drawerCard.id) || drawerCard : null}
        tasks={tasks}
        open={!!drawerCard}
        onOpenChange={(open) => { if (!open) setDrawerCard(null); }}
        onUpdate={updateCard}
        onMarkWon={markWon}
        onMarkLost={markLost}
        onCreateTask={createTask}
        onToggleTask={toggleTask}
      />
    </div>
  );
}
