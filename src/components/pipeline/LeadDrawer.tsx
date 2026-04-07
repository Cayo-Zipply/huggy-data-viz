import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Phone, Mail, Building2, DollarSign, Paperclip, FileText, Upload,
  Clock, Trophy, XCircle, UserCircle, Plus, Check, History, Info, ListChecks, Zap,
  X, Copy, ExternalLink, MapPin, Megaphone, MessageSquare, Save, Loader2,
  AlertTriangle, Tag
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { PipelineCard as CardType, PipelineTask, LossCategory } from "./types";
import { CLOSERS, LOSS_CATEGORIES, STAGE_CONFIG, formatBRL, isStale, daysDiff } from "./types";
import type { PipelineLabel } from "@/hooks/useLabels";

interface Props {
  card: CardType | null;
  tasks: PipelineTask[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, u: Partial<CardType>) => void;
  onMarkWon: (id: string) => void;
  onMarkLost: (id: string, cat: string, reason: string) => void;
  onCreateTask: (task: Omit<PipelineTask, "id" | "created_at">) => void;
  onToggleTask: (id: string) => void;
  labels?: PipelineLabel[];
  cardLabels?: PipelineLabel[];
  onAddLabel?: (cardId: string, labelId: string) => void;
  onRemoveLabel?: (cardId: string, labelId: string) => void;
}

type Section = "dados" | "origem" | "historico" | "tarefas" | "acoes";

export function LeadDrawer({ card, tasks, open, onOpenChange, onUpdate, onMarkWon, onMarkLost, onCreateTask, onToggleTask, labels = [], cardLabels = [], onAddLabel, onRemoveLabel }: Props) {
  const [activeSection, setActiveSection] = useState<Section>("dados");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [lossCat, setLossCat] = useState<LossCategory>("preco");
  const [lossText, setLossText] = useState("");
  const [showLoss, setShowLoss] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [ntTitle, setNtTitle] = useState("");
  const [ntDate, setNtDate] = useState(new Date().toISOString().split("T")[0]);
  const [ntResp, setNtResp] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (card) {
      setNtResp(card.owner || "");
    }
  }, [card?.id, card?.owner]);

  if (!card) return null;

  const stale = isStale(card);
  const isLost = card.lead_status === "perdido";
  const isWon = card.lead_status === "ganho";
  const wa = card.telefone ? `https://wa.me/55${card.telefone.replace(/\D/g, "")}` : null;
  const cardTasks = tasks.filter(t => t.card_id === card.id);
  const pendingCount = cardTasks.filter(t => t.status === "pendente").length;
  const staleDays = daysDiff(card.stage_changed_at);
  const stageConf = STAGE_CONFIG[card.stage];
  const ownerOptions = Array.from(new Set([card.owner, ...CLOSERS, ...cardTasks.map((task) => task.responsible)].filter(Boolean) as string[]));

  const startEdit = (f: string, v: string) => { setEditing(f); setEditValue(v || ""); };
  const saveEdit = async (f: string) => {
    setSaving(true);
    let val: any = editValue || null;
    if (f === "deal_value" || f === "valor_divida") val = editValue ? parseFloat(editValue.replace(/[^\d.,]/g, "").replace(",", ".")) : null;
    if (f === "deal_value" && !val) val = 1621;
    onUpdate(card.id, { [f]: val } as any);
    setEditing(null);
    setTimeout(() => setSaving(false), 300);
  };

  const copyPhone = () => {
    if (card.telefone) {
      navigator.clipboard.writeText(card.telefone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const submitLoss = () => {
    const reason = lossCat === "outro" ? lossText : LOSS_CATEGORIES.find(l => l.key === lossCat)?.label || lossCat;
    if (lossCat === "outro" && !lossText.trim()) return;
    onMarkLost(card.id, lossCat, reason);
    setShowLoss(false);
  };

  const submitTask = () => {
    if (!ntTitle.trim()) return;
    onCreateTask({ card_id: card.id, title: ntTitle, due_date: ntDate, responsible: ntResp, status: "pendente", pipe_context: card.pipe, auto_generated: false });
    setNtTitle(""); setShowTaskForm(false);
  };

  const sections: { key: Section; label: string; icon: any }[] = [
    { key: "dados", label: "Dados", icon: Info },
    { key: "origem", label: "Origem", icon: Megaphone },
    { key: "historico", label: "Histórico", icon: History },
    { key: "tarefas", label: "Tarefas", icon: ListChecks },
    { key: "acoes", label: "Ações", icon: Zap },
  ];

  const renderEditableField = (field: string, label: string, icon: React.ReactNode, currentValue: string | null | undefined, type: string = "text") => (
    <div className="flex items-center gap-3 py-2">
      <div className="text-muted-foreground flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
        {editing === field ? (
          <div className="flex gap-1.5">
            <input value={editValue} onChange={e => setEditValue(e.target.value)} type={type}
              className="flex-1 text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus onKeyDown={e => e.key === "Enter" && saveEdit(field)} />
            <button onClick={() => saveEdit(field)} className="text-xs px-2.5 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-1">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            </button>
            <button onClick={() => setEditing(null)} className="text-xs px-2 py-1.5 bg-muted text-muted-foreground rounded-md hover:bg-muted/80">
              <X size={12} />
            </button>
          </div>
        ) : (
          <button onClick={() => startEdit(field, currentValue?.toString() || "")} className="text-sm text-foreground hover:text-primary transition-colors text-left w-full truncate">
            {currentValue || <span className="text-muted-foreground italic">Adicionar...</span>}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        {/* Header */}
        <div className="p-5 pb-3 border-b border-border">
          <SheetHeader className="mb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {editing === "nome" ? (
                  <div className="flex gap-1.5">
                    <input value={editValue} onChange={e => setEditValue(e.target.value)}
                      className="flex-1 text-lg font-bold bg-muted/50 border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus onKeyDown={e => e.key === "Enter" && saveEdit("nome")} />
                    <button onClick={() => saveEdit("nome")} className="px-2 py-1 bg-primary text-primary-foreground rounded-md text-xs">OK</button>
                  </div>
                ) : (
                  <SheetTitle className="text-lg font-bold cursor-pointer hover:text-primary transition-colors" onClick={() => startEdit("nome", card.nome)}>
                    {card.nome}
                  </SheetTitle>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Status badges */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className={cn("text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1", stageConf.bg, stageConf.color)}>
              <stageConf.icon size={12} />{stageConf.label}
            </span>
            {isWon && <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 font-medium">✅ Ganho</span>}
            {isLost && <span className="text-xs px-2 py-1 rounded-full bg-destructive/20 text-red-400 font-medium">❌ Perdido</span>}
            {stale && <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400">{staleDays}d parado</span>}
            {pendingCount > 0 && <span className="text-xs px-2 py-1 rounded-full bg-yellow-400/10 text-yellow-400">{pendingCount} tarefa(s)</span>}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2">
            {card.telefone && (
              <>
                <button onClick={copyPhone} className="text-xs px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-foreground flex items-center gap-1.5 transition-colors">
                  {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  {copied ? "Copiado!" : card.telefone}
                </button>
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 flex items-center gap-1.5 transition-colors">
                    <MessageSquare size={12} />WhatsApp
                  </a>
                )}
              </>
            )}
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 px-5 py-2 border-b border-border overflow-x-auto">
          {sections.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all whitespace-nowrap",
                activeSection === s.key ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
              <s.icon size={12} />{s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-5">
            {/* DADOS */}
            {activeSection === "dados" && (
              <div className="space-y-1">
                {renderEditableField("nome", "Nome", <UserCircle size={16} />, card.nome)}
                <Separator className="my-1" />
                {renderEditableField("telefone", "Telefone", <Phone size={16} />, card.telefone)}
                <Separator className="my-1" />
                {renderEditableField("email", "Email", <Mail size={16} />, card.email)}
                <Separator className="my-1" />
                {renderEditableField("cnpj", "CNPJ", <Building2 size={16} />, card.cnpj)}
                <Separator className="my-1" />
                {renderEditableField("deal_value", "Valor do Negócio", <DollarSign size={16} />, card.deal_value?.toString())}
                <Separator className="my-1" />
                {renderEditableField("valor_divida", "Valor da Dívida", <DollarSign size={16} />, card.valor_divida?.toString())}
                <Separator className="my-1" />

                {/* Owner */}
                <div className="flex items-center gap-3 py-2">
                  <UserCircle size={16} className="text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Closer Responsável</p>
                    <select value={card.owner || ""} onChange={e => onUpdate(card.id, { owner: e.target.value || null })}
                      className="w-full text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="">Sem dono</option>
                      {ownerOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <Separator className="my-1" />

                {/* Dates */}
                <div className="flex items-center gap-3 py-2">
                  <Clock size={16} className="text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Criado em</p>
                    <p className="text-sm text-foreground">{new Date(card.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 py-2">
                  <Clock size={16} className="text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Última mudança de etapa</p>
                    <p className="text-sm text-foreground">{new Date(card.stage_changed_at).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
                <Separator className="my-1" />

                {/* Contract */}
                <div className="flex items-center gap-3 py-2">
                  <Paperclip size={16} className="text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Contrato</p>
                    {card.contract_url ? (
                      <a href={card.contract_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                        <FileText size={14} />Ver contrato <ExternalLink size={10} />
                      </a>
                    ) : (
                      <label className="text-sm text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
                        <Upload size={14} />Anexar contrato (PDF)
                        <input type="file" accept=".pdf" className="hidden" onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) { const url = URL.createObjectURL(f); onUpdate(card.id, { contract_url: url }); }
                        }} />
                      </label>
                    )}
                  </div>
                </div>
                <Separator className="my-1" />

                {/* Notes */}
                <div className="py-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Notas / Observações</p>
                  {editing === "anotacoes" ? (
                    <div className="space-y-2">
                      <textarea value={editValue} onChange={e => setEditValue(e.target.value)}
                        className="w-full text-sm bg-muted/50 border border-border rounded-lg p-3 resize-none text-foreground focus:outline-none focus:ring-1 focus:ring-primary" rows={4} autoFocus />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit("anotacoes")} className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-1">
                          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}Salvar
                        </button>
                        <button onClick={() => setEditing(null)} className="text-xs px-3 py-1.5 bg-muted text-muted-foreground rounded-md hover:bg-muted/80">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => startEdit("anotacoes", card.anotacoes || "")}
                      className="w-full text-left text-sm p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/60 text-foreground min-h-[60px]">
                      {card.anotacoes || <span className="text-muted-foreground italic">Adicionar anotação...</span>}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ORIGEM */}
            {activeSection === "origem" && (
              <div className="space-y-1">
                <div className="flex items-center gap-3 py-2">
                  <Megaphone size={16} className="text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Origem</p>
                    <p className="text-sm text-foreground">{card.origem || <span className="text-muted-foreground italic">Não informado</span>}</p>
                  </div>
                </div>
                <Separator className="my-1" />
                <div className="flex items-center gap-3 py-2">
                  <DollarSign size={16} className="text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Valor do Negócio</p>
                    <p className="text-sm text-foreground font-semibold">{formatBRL(card.deal_value || 1621)}</p>
                  </div>
                </div>
                {isLost && card.loss_reason && (
                  <>
                    <Separator className="my-1" />
                    <div className="bg-destructive/5 rounded-lg p-3 border border-destructive/20">
                      <p className="text-xs text-muted-foreground mb-1">Motivo da Perda</p>
                      <p className="text-sm text-red-400">{card.loss_reason}</p>
                      {card.last_stage && <p className="text-xs text-muted-foreground mt-1">Última etapa: {STAGE_CONFIG[card.last_stage as keyof typeof STAGE_CONFIG]?.label || card.last_stage}</p>}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* HISTÓRICO */}
            {activeSection === "historico" && (
              <div>
                {card.history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem movimentações registradas</p>
                ) : (
                  <div className="space-y-0">
                    {[...card.history].reverse().map((h, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 flex-shrink-0 ring-2 ring-primary/20" />
                          {i < card.history.length - 1 && <div className="w-0.5 flex-1 bg-border min-h-[20px]" />}
                        </div>
                        <div className="pb-4">
                          <p className="text-sm text-foreground">
                            {h.from ? `${STAGE_CONFIG[h.from as keyof typeof STAGE_CONFIG]?.label || h.from} → ` : "Criado em "}
                            <strong>{STAGE_CONFIG[h.to as keyof typeof STAGE_CONFIG]?.label || h.to}</strong>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(h.at).toLocaleString("pt-BR")} · por {h.by}
                            {h.duration_days != null && ` · ${h.duration_days}d na etapa anterior`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAREFAS */}
            {activeSection === "tarefas" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{cardTasks.length} tarefa(s)</span>
                  <button onClick={() => setShowTaskForm(!showTaskForm)} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus size={12} />Nova tarefa
                  </button>
                </div>
                {showTaskForm && (
                  <div className="space-y-2 bg-muted/30 rounded-lg p-3 border border-border/50">
                    <input value={ntTitle} onChange={e => setNtTitle(e.target.value)} placeholder="Título da tarefa"
                      className="w-full text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                    <div className="flex gap-2">
                      <input type="date" value={ntDate} onChange={e => setNtDate(e.target.value)}
                        className="flex-1 text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-foreground" />
                      <select value={ntResp} onChange={e => setNtResp(e.target.value)}
                        className="text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-foreground">
                        <option value="">Sem responsável</option>
                        {ownerOptions.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <button onClick={submitTask} className="text-sm px-4 py-1.5 bg-primary text-primary-foreground rounded-md w-full hover:bg-primary/90">Criar tarefa</button>
                  </div>
                )}
                {cardTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                    <button onClick={() => onToggleTask(t.id)}
                      className={cn("flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        t.status === "concluida" ? "border-green-400 bg-green-400/20 text-green-400" : "border-muted-foreground text-transparent hover:border-primary")}>
                      <Check size={10} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm", t.status === "concluida" && "line-through text-muted-foreground")}>{t.title}</span>
                      <div className="flex gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{new Date(t.due_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                        {t.auto_generated && <span className="text-[10px] text-muted-foreground italic">auto</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* AÇÕES */}
            {activeSection === "acoes" && (
              <div className="space-y-3">
                {card.lead_status === "aberto" && (
                  <div className="flex gap-3">
                    <button onClick={() => onMarkWon(card.id)}
                      className="flex-1 text-sm py-2.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 flex items-center justify-center gap-2 transition-colors border border-green-500/20">
                      <Trophy size={16} />Marcar como Ganho
                    </button>
                    <button onClick={() => setShowLoss(true)}
                      className="flex-1 text-sm py-2.5 rounded-lg bg-destructive/10 text-red-400 hover:bg-destructive/20 flex items-center justify-center gap-2 transition-colors border border-destructive/20">
                      <XCircle size={16} />Marcar como Perdido
                    </button>
                  </div>
                )}
                {showLoss && (
                  <div className="space-y-3 bg-destructive/5 rounded-lg p-4 border border-destructive/20">
                    <p className="text-sm font-medium text-foreground">Motivo da perda</p>
                    <select value={lossCat} onChange={e => setLossCat(e.target.value as LossCategory)}
                      className="w-full text-sm bg-muted/50 border border-border rounded-md px-2.5 py-2 text-foreground">
                      {LOSS_CATEGORIES.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                    </select>
                    {lossCat === "outro" && (
                      <input value={lossText} onChange={e => setLossText(e.target.value)} placeholder="Descreva o motivo..."
                        className="w-full text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-foreground" />
                    )}
                    <div className="flex gap-2">
                      <button onClick={submitLoss} className="text-sm px-4 py-1.5 bg-destructive/20 text-red-400 rounded-md flex-1 hover:bg-destructive/30">Confirmar</button>
                      <button onClick={() => setShowLoss(false)} className="text-sm px-4 py-1.5 bg-muted text-muted-foreground rounded-md hover:bg-muted/80">Cancelar</button>
                    </div>
                  </div>
                )}
                {isLost && (
                  <div className="text-sm text-red-400/70 bg-destructive/5 rounded-lg p-3 border border-destructive/20">
                    <strong>Motivo:</strong> {card.loss_reason}
                    {card.last_stage && <span className="ml-2 text-muted-foreground">Última etapa: {STAGE_CONFIG[card.last_stage as keyof typeof STAGE_CONFIG]?.label || card.last_stage}</span>}
                  </div>
                )}
                {isWon && <div className="text-sm text-green-400 bg-green-500/5 rounded-lg p-3 text-center border border-green-500/20">✅ Negócio fechado</div>}
                {card.lead_status !== "aberto" && (
                  <button onClick={() => { onUpdate(card.id, { lead_status: "aberto", loss_reason: null, loss_category: null, last_stage: null } as any); }}
                    className="w-full text-sm py-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors">Reabrir lead</button>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
