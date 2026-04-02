import { useState, useMemo } from "react";
import { useLeads, type Lead } from "@/hooks/useLeads";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Phone, Clock, Search, ChevronDown, MoreVertical, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const STAGES = [
  { key: "fez contato", label: "Fez Contato", color: "bg-blue-500" },
  { key: "conectado", label: "Conectado", color: "bg-indigo-500" },
  { key: "sql", label: "SQL", color: "bg-violet-500" },
  { key: "reuniao marcada", label: "Reunião Marcada", color: "bg-amber-500" },
  { key: "reuniao realizada", label: "Reunião Realizada", color: "bg-orange-500" },
  { key: "comprou", label: "Comprou", color: "bg-emerald-500" },
  { key: "perdido", label: "Perdido", color: "bg-destructive" },
];

function daysSince(dateStr: string | null) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatBRL(v: number | null) {
  if (!v) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Pipeline() {
  const { leads, loading, updateLead } = useLeads();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moveMenu, setMoveMenu] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search) return leads;
    const s = search.toLowerCase();
    return leads.filter(l =>
      l.nome?.toLowerCase().includes(s) ||
      l.telefone?.includes(s) ||
      l.origem?.toLowerCase().includes(s)
    );
  }, [leads, search]);

  const getStageLeads = (stageKey: string) => {
    if (stageKey === "perdido") return filtered.filter(l => l.status === "perdido");
    if (stageKey === "comprou") return filtered.filter(l => l.status === "ganho" || l.etapa_atual === "comprou");
    return filtered.filter(l => l.etapa_atual === stageKey && l.status !== "perdido" && l.status !== "ganho");
  };

  const moveLead = async (leadId: string, targetStage: string) => {
    const updates: Partial<Lead> = { etapa_atual: targetStage };
    if (targetStage === "comprou") updates.status = "ganho";
    else if (targetStage === "perdido") updates.status = "perdido";
    else updates.status = "aberto";
    await updateLead(leadId, updates);
    setMoveMenu(null);
  };

  const handleDrop = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("leadId");
    if (id) moveLead(id, stageKey);
  };

  const openDrawer = (lead: Lead) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        <h1 className="text-lg font-bold text-foreground">Pipeline</h1>
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar lead..."
            className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-input bg-background text-foreground w-56"
          />
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-3 h-full min-w-max">
          {STAGES.map(stage => {
            const stageLeads = getStageLeads(stage.key);
            return (
              <div
                key={stage.key}
                className="w-[260px] flex flex-col rounded-xl border border-border bg-card/30"
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, stage.key)}
              >
                {/* Column header */}
                <div className="p-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2.5 h-2.5 rounded-full", stage.color)} />
                    <span className="text-sm font-medium text-foreground flex-1">{stage.label}</span>
                    <span className="text-xs text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                      {stageLeads.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-180px)]">
                  {stageLeads.map(lead => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={e => e.dataTransfer.setData("leadId", lead.id)}
                      onClick={() => openDrawer(lead)}
                      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors relative"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-medium text-foreground truncate flex-1">{lead.nome}</p>
                        <button
                          onClick={e => { e.stopPropagation(); setMoveMenu(moveMenu === lead.id ? null : lead.id); }}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                        >
                          <MoreVertical size={14} />
                        </button>
                      </div>

                      {lead.telefone && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Phone size={10} /> {lead.telefone}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        {lead.origem && (
                          <span className="text-[10px] bg-muted/50 text-muted-foreground rounded px-1.5 py-0.5 truncate max-w-[100px]">
                            {lead.origem}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
                          <Clock size={9} /> {daysSince(lead.data_entrada || lead.created_at)}d
                        </span>
                      </div>

                      {lead.deal_value && (
                        <p className="text-xs text-emerald-500 font-medium mt-1">{formatBRL(lead.deal_value)}</p>
                      )}

                      {/* Move menu */}
                      {moveMenu === lead.id && (
                        <div className="absolute right-0 top-6 z-50 bg-popover border border-border rounded-lg shadow-lg p-1 min-w-[160px]">
                          <p className="text-[10px] text-muted-foreground px-2 py-1">Mover para:</p>
                          {STAGES.filter(s => s.key !== stage.key).map(s => (
                            <button
                              key={s.key}
                              onClick={e => { e.stopPropagation(); moveLead(lead.id, s.key); }}
                              className="w-full text-left text-xs px-2 py-1.5 hover:bg-accent rounded flex items-center gap-2"
                            >
                              <div className={cn("w-2 h-2 rounded-full", s.color)} />
                              {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhum lead</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lead Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{selectedLead.nome}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <Section label="Telefone" value={selectedLead.telefone} />
                <Section label="Email" value={selectedLead.email} />
                <Section label="Origem" value={selectedLead.origem} />
                <Section label="Etapa" value={selectedLead.etapa_atual} />
                <Section label="Status" value={selectedLead.status} />
                <Section label="Closer" value={selectedLead.closer} />
                <Section label="Valor" value={formatBRL(selectedLead.deal_value)} />
                <Section label="Valor Dívida" value={formatBRL(selectedLead.valor_divida)} />
                <Section label="Data Entrada" value={selectedLead.data_entrada ? new Date(selectedLead.data_entrada).toLocaleDateString("pt-BR") : "—"} />
                <Section label="Criado em" value={new Date(selectedLead.created_at).toLocaleDateString("pt-BR")} />
                {selectedLead.anotacoes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Anotações</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{selectedLead.anotacoes}</p>
                  </div>
                )}
                {selectedLead.loss_reason && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Motivo da Perda</p>
                    <p className="text-sm text-foreground">{selectedLead.loss_reason}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Section({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}
