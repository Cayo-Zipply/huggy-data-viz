import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/hooks/useLabels";
import { useSlaRules, type SlaRule } from "@/hooks/useSlaRules";
import { useMotivosPerda } from "@/hooks/useMotivosPerda";
import { useMarketingOverrides, type MarketingOverride } from "@/hooks/useMarketingOverrides";
import { useMarketingData } from "@/hooks/useMarketingData";
import { Navigate } from "react-router-dom";
import { Plus, Trash2, Palette, Tag, Settings as SettingsIcon, X, Clock, AlertTriangle, Shield, BarChart3, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_ORDER, STAGE_CONFIG } from "@/components/pipeline/types";
import { useToast } from "@/hooks/use-toast";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#14b8a6",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#64748b",
];

const CATEGORIAS = ["Preço", "Timing", "Concorrência", "Qualificação", "Outros"];

const ACAO_OPTIONS = [
  { value: "destacar", label: "Apenas destacar no Kanban" },
  { value: "destacar_notificar", label: "Destacar + Notificação" },
  { value: "destacar_notificar_reatribuir", label: "Destacar + Notificação + Reatribuir" },
];

export default function Settings() {
  const { isAdmin } = useAuth();
  const { labels, createLabel, deleteLabel, updateLabel } = useLabels();
  const { rules, upsertRule } = useSlaRules();
  const { motivos, createMotivo, updateMotivo, toggleAtivo } = useMotivosPerda();
  const { overrides, upsert: upsertOverride, getOverride } = useMarketingOverrides();
  const { months: marketingMonths } = useMarketingData();
  const { toast } = useToast();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [activeSection, setActiveSection] = useState<"etiquetas" | "sla" | "motivos" | "metricas">("etiquetas");

  // Motivos de perda state
  const [newMotivoNome, setNewMotivoNome] = useState("");
  const [newMotivoCategoria, setNewMotivoCategoria] = useState("Outros");

  // Marketing overrides state
  const [selectedOverrideMonth, setSelectedOverrideMonth] = useState("");
  const [overrideForm, setOverrideForm] = useState<Record<string, string>>({});

  if (!isAdmin) return <Navigate to="/pipeline" replace />;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createLabel(newName.trim(), newColor);
    setNewName("");
    setNewColor("#3b82f6");
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    await updateLabel(id, editName.trim(), editColor);
    setEditingId(null);
  };

  const startEdit = (label: { id: string; name: string; color: string }) => {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
  };

  const handleSaveSla = async (etapa: string, field: string, value: any) => {
    const existing = rules.find(r => r.etapa === etapa);
    const update: any = { etapa, ...(existing || {}), [field]: value };
    await upsertRule(update);
    toast({ title: "SLA salvo", description: `SLA de ${STAGE_CONFIG[etapa as keyof typeof STAGE_CONFIG]?.label || etapa} atualizado.` });
  };

  const handleCreateMotivo = async () => {
    if (!newMotivoNome.trim()) return;
    await createMotivo(newMotivoNome.trim(), newMotivoCategoria);
    setNewMotivoNome("");
    setNewMotivoCategoria("Outros");
  };

  const sections = [
    { key: "etiquetas" as const, label: "Etiquetas", icon: Tag },
    { key: "sla" as const, label: "Regras de SLA", icon: Clock },
    { key: "motivos" as const, label: "Motivos de Perda", icon: AlertTriangle },
  ];

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <SettingsIcon size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gerenciar etiquetas, SLAs e motivos de perda</p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl">
        {sections.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all",
              activeSection === s.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <s.icon size={14} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Labels Section */}
      {activeSection === "etiquetas" && (
        <div className="border border-border rounded-2xl bg-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Tag size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Etiquetas</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Crie etiquetas para organizar os leads no pipeline</p>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1">Nome da etiqueta</label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="Ex: Urgente, VIP, Follow-up..."
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyDown={e => e.key === "Enter" && handleCreate()} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Cor</label>
                <div className="flex gap-1">
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setNewColor(c)}
                      className={cn("w-6 h-6 rounded-full border-2 transition-all", newColor === c ? "border-foreground scale-110" : "border-transparent")}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <button onClick={handleCreate} disabled={!newName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-all">
                <Plus size={14} />Criar
              </button>
            </div>
            {labels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma etiqueta criada ainda</p>
            ) : (
              <div className="space-y-2">
                {labels.map(label => (
                  <div key={label.id} className="flex items-center gap-3 py-2 px-3 rounded-lg border border-border bg-background group">
                    {editingId === label.id ? (
                      <>
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: editColor }} />
                        <input value={editName} onChange={e => setEditName(e.target.value)}
                          className="flex-1 text-sm bg-muted/50 border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus onKeyDown={e => e.key === "Enter" && handleUpdate(label.id)} />
                        <div className="flex gap-0.5">
                          {PRESET_COLORS.map(c => (
                            <button key={c} onClick={() => setEditColor(c)}
                              className={cn("w-4 h-4 rounded-full border transition-all", editColor === c ? "border-foreground" : "border-transparent")}
                              style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <button onClick={() => handleUpdate(label.id)} className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded">OK</button>
                        <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
                        <span className="text-sm text-foreground flex-1">{label.name}</span>
                        <button onClick={() => startEdit(label)} className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                          <Palette size={14} />
                        </button>
                        <button onClick={() => deleteLabel(label.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SLA Rules Section */}
      {activeSection === "sla" && (
        <div className="border border-border rounded-2xl bg-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Configuração de SLAs</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Defina o tempo máximo que um lead pode ficar em cada etapa</p>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-muted-foreground py-2 px-2">Etapa</th>
                    <th className="text-left text-xs text-muted-foreground py-2 px-2">SLA (horas)</th>
                    <th className="text-left text-xs text-muted-foreground py-2 px-2">Ação ao estourar</th>
                  </tr>
                </thead>
                <tbody>
                  {STAGE_ORDER.map(stageKey => {
                    const cfg = STAGE_CONFIG[stageKey];
                    const rule = rules.find(r => r.etapa === stageKey);
                    const slaHoras = rule?.sla_horas ?? 24;
                    const acao = rule?.acao_ao_estourar ?? "destacar";
                    return (
                      <tr key={stageKey} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <cfg.icon size={12} className={cfg.color} />
                            <span className="text-foreground text-xs font-medium">{cfg.label}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min={1}
                            value={slaHoras}
                            onChange={e => handleSaveSla(stageKey, "sla_horas", parseInt(e.target.value) || 24)}
                            className="w-20 text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={acao}
                            onChange={e => handleSaveSla(stageKey, "acao_ao_estourar", e.target.value)}
                            className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
                          >
                            {ACAO_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Loss Reasons Section */}
      {activeSection === "motivos" && (
        <div className="border border-border rounded-2xl bg-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Motivos de Perda</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Configure os motivos disponíveis ao marcar um lead como perdido</p>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1">Nome do motivo</label>
                <input value={newMotivoNome} onChange={e => setNewMotivoNome(e.target.value)}
                  placeholder="Ex: Cliente sem interesse..."
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyDown={e => e.key === "Enter" && handleCreateMotivo()} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Categoria</label>
                <select value={newMotivoCategoria} onChange={e => setNewMotivoCategoria(e.target.value)}
                  className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground">
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={handleCreateMotivo} disabled={!newMotivoNome.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-all">
                <Plus size={14} />Adicionar
              </button>
            </div>
            {motivos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum motivo cadastrado</p>
            ) : (
              <div className="space-y-2">
                {motivos.map(m => (
                  <div key={m.id} className={cn(
                    "flex items-center gap-3 py-2 px-3 rounded-lg border border-border bg-background group",
                    !m.ativo && "opacity-50"
                  )}>
                    <span className="text-sm text-foreground flex-1">{m.nome}</span>
                    <span className="text-[10px] bg-muted/50 text-muted-foreground rounded px-1.5 py-0.5">{m.categoria}</span>
                    <button onClick={() => toggleAtivo(m.id)}
                      className={cn("text-xs px-2 py-1 rounded border transition-colors", m.ativo ? "border-emerald-500/30 text-emerald-500" : "border-border text-muted-foreground")}>
                      {m.ativo ? "Ativo" : "Inativo"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
