import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Search, UserCircle, LayoutGrid, ListChecks, BarChart3, Target, Upload, Plus, ChevronDown, AlertTriangle } from "lucide-react";
import { usePipelineData } from "./pipeline/usePipelineData";
import { StageColumn } from "./pipeline/StageColumn";
import { PipelineFiltersBar, applyFilters, exportCSV, defaultFilters, type FilterState } from "./pipeline/PipelineFilters";
import { TasksPanel } from "./pipeline/TasksPanel";
import { CRMDashboard } from "./pipeline/CRMDashboard";
import { GoalsPanel } from "./pipeline/GoalsPanel";
import { HandoffChecklist } from "./pipeline/HandoffChecklist";
import { LeadDrawer } from "./pipeline/LeadDrawer";
import { CLOSERS, SDR_STAGES, CLOSER_STAGES, STAGE_CONFIG, STAGE_ORDER } from "./pipeline/types";
import type { PipelineCard, Stage } from "./pipeline/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/hooks/useLabels";

const SUB_TABS = [
  { key: "kanban", label: "Kanban", icon: LayoutGrid },
  { key: "hoje", label: "Hoje", icon: ListChecks },
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "metas", label: "Metas", icon: Target },
];

export function PipelinePanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeUser, setActiveUser] = useState<string>("all");
  const { profile, isAdmin } = useAuth();
  const currentUserName = useMemo(() => {
    const raw = (profile?.nome ?? profile?.email?.split("@")[0] ?? "Usuário").trim();
    return raw || "Usuário";
  }, [profile?.email, profile?.nome]);

  const { cards, tasks, goals, createCard, updateCard, moveCard, markWon, markLost, createTask, toggleTask, rescheduleTask, upsertGoal, importCSV } = usePipelineData(currentUserName);
  const [activePipe, setActivePipe] = useState<"sdr" | "closer" | "all">("all");
  const [subTab, setSubTab] = useState("kanban");
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [pendingHandoff, setPendingHandoff] = useState<{ cardId: string; targetStage: Stage } | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!profile) return;

    if (isAdmin) {
      setActiveUser(localStorage.getItem("crm_active_user") || "all");
      return;
    }

    setActiveUser(currentUserName);
  }, [currentUserName, isAdmin, profile]);

  useEffect(() => {
    if (isAdmin) {
      localStorage.setItem("crm_active_user", activeUser);
      return;
    }

    localStorage.removeItem("crm_active_user");
  }, [activeUser, isAdmin]);

  const ownerOptions = useMemo(() => {
    const pool = new Set<string>([
      currentUserName,
      ...CLOSERS,
      ...cards.map((card) => card.owner).filter(Boolean) as string[],
      ...tasks.map((task) => task.responsible).filter(Boolean) as string[],
      ...goals.map((goal) => goal.closer).filter(Boolean),
    ]);

    return Array.from(pool).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [cards, currentUserName, goals, tasks]);

  const showAllOwners = isAdmin && activeUser === "all";

  const visibleCards = useMemo(() => {
    let filtered = cards;

    if (!isAdmin) {
      filtered = filtered.filter((card) => card.owner === currentUserName || !card.owner);
    } else if (!showAllOwners) {
      filtered = filtered.filter((card) => card.owner === activeUser);
    }

    filtered = applyFilters(filtered, filters);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        (c.telefone || '').includes(q) ||
        (c.origem || '').toLowerCase().includes(q)
      );
    }
    // Sort newest first
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return filtered;
  }, [cards, isAdmin, currentUserName, showAllOwners, activeUser, filters, searchQuery]);

  const todayPending = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return tasks.filter((task) => {
      if (task.due_date > today || task.status !== "pendente") return false;
      if (showAllOwners) return true;
      return task.responsible === activeUser;
    }).length;
  }, [tasks, activeUser, showAllOwners]);

  const selectedCard = useMemo(() => {
    if (!selectedCardId) return null;
    return cards.find(c => c.id === selectedCardId) || null;
  }, [cards, selectedCardId]);

  const handleDrop = (cardId: string, targetStage: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card || card.stage === targetStage) return;
    // Handoff check: SDR â Closer
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
    reader.onload = (ev) => {
      const count = importCSV(ev.target?.result as string);
      toast({ title: `${count} leads importados!` });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const addLead = () => {
    if (!newLeadName.trim()) return;
    createCard({
      nome: newLeadName,
      telefone: newLeadPhone || null,
      owner: showAllOwners ? currentUserName : activeUser,
    });
    setNewLeadName(""); setNewLeadPhone(""); setShowNewLead(false);
    toast({ title: "Lead criado!" });
  };

  const getStages = () => {
    if (activePipe === "sdr") return SDR_STAGES;
    if (activePipe === "closer") return CLOSER_STAGES;
    return STAGE_ORDER;
  };

  const getCardsForStage = (stage: Stage) => visibleCards.filter(c => c.stage === stage);

  const sdrCount = visibleCards.filter(c => c.pipe === "sdr").length;
  const closerCount = visibleCards.filter(c => c.pipe === "closer").length;
  const viewLabel = showAllOwners ? "todos os responsáveis" : activeUser;

  const handleCardClick = (card: PipelineCard) => {
    setSelectedCardId(card.id);
    setDrawerOpen(true);
  };

  const handleDrawerOpenChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setSelectedCardId(null);
  };

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

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                Pipeline estilo CRM
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">Pipeline de Vendas</h2>
                <p className="text-sm text-muted-foreground">
                  {cards.length} leads totais · {visibleCards.length} visíveis · visão de {viewLabel}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isAdmin ? (
                <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  <UserCircle size={14} className="text-primary" />
                  <span>Visão</span>
                  <select
                    value={activeUser}
                    onChange={(e) => setActiveUser(e.target.value)}
                    className="bg-transparent text-foreground outline-none"
                  >
                    <option value="all">Todos</option>
                    {ownerOptions.map((owner) => (
                      <option key={owner} value={owner}>{owner}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="text-muted-foreground" />
                </label>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  <UserCircle size={14} className="text-primary" />
                  <span className="font-medium text-foreground">{currentUserName}</span>
                </div>
              )}

              <button
                onClick={() => setShowNewLead(!showNewLead)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus size={12} />Novo Lead
              </button>

              <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground transition-colors hover:bg-muted/40">
                <Upload size={12} />Importar CSV
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV} />
              </label>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar lead por nome, telefone ou origem"
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-10 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                { key: "all", label: "Todos", count: visibleCards.length },
                { key: "sdr", label: "SDR", count: sdrCount },
                { key: "closer", label: "Closer", count: closerCount },
              ] as const).map((pipe) => (
                <button
                  key={pipe.key}
                  onClick={() => setActivePipe(pipe.key)}
                  className={cn(
                    "rounded-xl border px-4 py-2 text-sm font-medium transition-all",
                    activePipe === pipe.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {pipe.label} <span className="text-xs">({pipe.count})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* New lead form */}
      {showNewLead && (
        <div className="border border-border rounded-2xl bg-card p-3 shadow-sm flex flex-col sm:flex-row gap-2">
          <input value={newLeadName} onChange={e => setNewLeadName(e.target.value)} placeholder="Nome do lead"
            className="flex-1 text-xs bg-muted/50 border border-border rounded px-3 py-2 text-foreground" autoFocus />
          <input value={newLeadPhone} onChange={e => setNewLeadPhone(e.target.value)} placeholder="Telefone"
            className="sm:w-40 text-xs bg-muted/50 border border-border rounded px-3 py-2 text-foreground" />
          <button onClick={addLead} className="text-xs px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Criar</button>
          <button onClick={() => setShowNewLead(false)} className="text-xs px-3 py-2 text-muted-foreground">Cancelar</button>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-muted/30 rounded-2xl p-1 overflow-x-auto">
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
          <div className="flex gap-3 overflow-x-auto rounded-2xl border border-border bg-muted/20 p-3 pb-4">
            {getStages().map(s => (
              <StageColumn key={s} stageKey={s} cards={getCardsForStage(s)} tasks={tasks}
                onUpdate={updateCard} onDrop={handleDrop} onMarkWon={markWon} onMarkLost={markLost}
                onCreateTask={createTask} onToggleTask={toggleTask} onCardClick={handleCardClick} />
            ))}
          </div>
        </>
      )}

      {subTab === "hoje" && <TasksPanel tasks={tasks} cards={cards} activeUser={activeUser} canViewAll={isAdmin} onToggle={toggleTask} onReschedule={rescheduleTask} />}
      {subTab === "dashboard" && <CRMDashboard cards={cards} activeUser={activeUser} canViewAll={isAdmin} owners={ownerOptions} />}
      {subTab === "metas" && <GoalsPanel cards={cards} goals={goals} activeUser={activeUser} canViewAll={isAdmin} owners={ownerOptions} onSave={upsertGoal} />}

      <LeadDrawer
        card={selectedCard}
        tasks={tasks}
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        onUpdate={updateCard}
        onMarkWon={markWon}
        onMarkLost={markLost}
        onCreateTask={createTask}
        onToggleTask={toggleTask}
      />
    </div>
  );
}
