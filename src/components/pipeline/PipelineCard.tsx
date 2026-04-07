import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Phone, Mail, Building2, DollarSign, Paperclip, FileText, Upload,
  ChevronDown, ChevronUp, Clock, Trophy, XCircle, UserCircle, Plus, Check, History, Info, ListChecks, Zap,
  AlertTriangle
} from "lucide-react";
import type { PipelineCard as CardType, PipelineTask, PipeType, LossCategory } from "./types";
import { CLOSERS, LOSS_CATEGORIES, STAGE_CONFIG, formatBRL, isStale, daysDiff } from "./types";
import type { PipelineLabel } from "@/hooks/useLabels";

interface Props {
  card: CardType;
  tasks: PipelineTask[];
  cardLabels?: PipelineLabel[];
  onUpdate: (id: string, u: Partial<CardType>) => void;
  onMarkWon: (id: string) => void;
  onMarkLost: (id: string, cat: string, reason: string) => void;
  onCreateTask: (task: Omit<PipelineTask, "id" | "created_at">) => void;
  onToggleTask: (id: string) => void;
  onCardClick?: (card: CardType) => void;
}

type Tab = "info" | "historico" | "tarefas" | "acoes";

export function PipelineCardItem({ card, tasks, cardLabels = [], onUpdate, onMarkWon, onMarkLost, onCreateTask, onToggleTask, onCardClick }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>("info");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [lossCat, setLossCat] = useState<LossCategory>("preco");
  const [lossText, setLossText] = useState("");
  const [showLoss, setShowLoss] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [ntTitle, setNtTitle] = useState("");
  const [ntDate, setNtDate] = useState(new Date().toISOString().split("T")[0]);
  const [ntResp, setNtResp] = useState(card.owner || "");

  const stale = isStale(card);
  const isLost = card.lead_status === "perdido";
  const isWon = card.lead_status === "ganho";
  const wa = card.telefone ? `https://wa.me/55${card.telefone.replace(/\D/g, "")}` : null;
  const cardTasks = tasks.filter(t => t.card_id === card.id);
  const pendingCount = cardTasks.filter(t => t.status === "pendente").length;
  const staleDays = daysDiff(card.stage_changed_at);
  const ownerOptions = Array.from(new Set([card.owner, ...CLOSERS, ...cardTasks.map((task) => task.responsible)].filter(Boolean) as string[]));

  const startEdit = (f: string, v: string) => { setEditing(f); setEditValue(v || ""); };
  const saveEdit = (f: string) => {
    let val: any = editValue || null;
    if (f === "deal_value" || f === "valor_divida") val = editValue ? parseFloat(editValue.replace(/[^\d.,]/g, "").replace(",", ".")) : null;
    if (f === "deal_value" && !val) val = 1621;
    onUpdate(card.id, { [f]: val } as any);
    setEditing(null);
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

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "info", label: "Info", icon: Info },
    { key: "historico", label: "Histórico", icon: History },
    { key: "tarefas", label: "Tarefas", icon: ListChecks },
    { key: "acoes", label: "Ações", icon: Zap },
  ];

  return (
    <div className={cn(
      "group overflow-hidden rounded-2xl border bg-background shadow-sm transition-all",
      stale && "border-red-500/60",
      isLost && "opacity-50 border-destructive/40",
      isWon && "border-green-500/40",
      !stale && !isLost && !isWon && "border-border hover:border-primary/30 hover:shadow-md"
    )}>
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onCardClick?.(card)}>
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-foreground text-sm truncate hover:text-primary transition-colors">{card.nome}</p>
              {isWon && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">Ganho</span>}
              {isLost && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/20 text-red-400 font-medium">Perdido</span>}
              {stale && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">{staleDays}d parado</span>}
              {(card.resumo_reuniao || card.transcricao_reuniao) && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">📎 Anexo</span>}
            </div>
            {card.telefone && (
              <a href={wa || "#"} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline flex items-center gap-1 mt-0.5">
                <Phone size={10} /> {card.telefone}
              </a>
            )}
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground p-0.5">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Quick badges */}
        <div className="flex flex-wrap gap-1 mt-2">
          {editing === "deal_value" ? (
            <div className="flex gap-1">
              <input value={editValue} onChange={e => setEditValue(e.target.value)}
                className="w-20 text-[10px] bg-muted/50 border border-border rounded px-1.5 py-0.5 text-foreground"
                autoFocus onKeyDown={e => e.key === "Enter" && saveEdit("deal_value")} />
              <button onClick={() => saveEdit("deal_value")} className="text-[10px] px-1.5 bg-primary/20 text-primary rounded">OK</button>
            </div>
          ) : (
            <button onClick={() => startEdit("deal_value", card.deal_value?.toString() || "1621")}
              className="text-[10px] px-1.5 py-0.5 bg-emerald-400/10 rounded text-emerald-400 hover:bg-emerald-400/20">
              {formatBRL(card.deal_value || 1621)}
            </button>
          )}
          {card.owner && card.owner === "SDR" ? (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 rounded text-amber-500 flex items-center gap-0.5 font-medium">
              <AlertTriangle size={9} />Atribuir responsável
            </span>
          ) : card.owner ? (
            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 rounded text-primary flex items-center gap-0.5"><UserCircle size={8} />{card.owner}</span>
          ) : null}
          {card.origem && <span className="text-[10px] px-1.5 py-0.5 bg-muted/50 rounded text-muted-foreground">{card.origem}</span>}
          <span className="text-[10px] px-1.5 py-0.5 bg-muted/50 rounded text-muted-foreground flex items-center gap-0.5">
            <Clock size={8} />{new Date(card.created_at).toLocaleDateString("pt-BR")}
          </span>
          {pendingCount > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-yellow-400/10 rounded text-yellow-400">{pendingCount} tarefa(s)</span>}
          {cardLabels.map(label => (
            <span key={label.id} className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: label.color + "20", color: label.color }}>
              {label.name}
            </span>
          ))}
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="mt-3 border-t border-border pt-2">
            {/* Tabs */}
            <div className="flex gap-1 mb-3">
              {tabs.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={cn("flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-all",
                    tab === t.key ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")}>
                  <t.icon size={10} />{t.label}
                </button>
              ))}
            </div>

            {/* Info tab */}
            {tab === "info" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <UserCircle size={12} className="text-muted-foreground flex-shrink-0" />
                    <select value={card.owner || ""} onChange={e => onUpdate(card.id, { owner: e.target.value || null })}
                    className="flex-1 text-xs bg-muted/50 border border-border rounded px-2 py-1 text-foreground">
                    <option value="">Sem dono</option>
                      {ownerOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {([
                  { key: "email", label: "Email", icon: Mail },
                  { key: "cnpj", label: "CNPJ", icon: Building2 },
                  { key: "valor_divida", label: "Valor da Dívida", icon: DollarSign },
                ] as const).map(f => (
                  <div key={f.key} className="flex items-center gap-2">
                    <f.icon size={12} className="text-muted-foreground flex-shrink-0" />
                    {editing === f.key ? (
                      <div className="flex-1 flex gap-1">
                        <input value={editValue} onChange={e => setEditValue(e.target.value)}
                          className="flex-1 text-xs bg-muted/50 border border-border rounded px-2 py-1 text-foreground"
                          autoFocus onKeyDown={e => e.key === "Enter" && saveEdit(f.key)} />
                        <button onClick={() => saveEdit(f.key)} className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">OK</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(f.key, (card as any)[f.key]?.toString() || "")}
                        className="flex-1 text-left text-xs text-muted-foreground hover:text-foreground truncate">
                        {(card as any)[f.key] || `Adicionar ${f.label}...`}
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Paperclip size={12} className="text-muted-foreground flex-shrink-0" />
                  {card.contract_url ? (
                    <a href={card.contract_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1"><FileText size={10} />Ver contrato</a>
                  ) : (
                    <label className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
                      <Upload size={10} />Anexar contrato (PDF)
                      <input type="file" accept=".pdf" className="hidden" onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) { const url = URL.createObjectURL(f); onUpdate(card.id, { contract_url: url }); }
                      }} />
                    </label>
                  )}
                </div>
                {editing === "anotacoes" ? (
                  <div className="space-y-1">
                    <textarea value={editValue} onChange={e => setEditValue(e.target.value)}
                      className="w-full text-xs bg-muted/50 border border-border rounded-lg p-2 resize-none text-foreground" rows={2} autoFocus />
                    <div className="flex gap-1">
                      <button onClick={() => saveEdit("anotacoes")} className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">Salvar</button>
                      <button onClick={() => setEditing(null)} className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => startEdit("anotacoes", card.anotacoes || "")}
                    className="w-full text-left text-xs p-2 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/60 text-muted-foreground">
                    {card.anotacoes || "Adicionar anotação..."}
                  </button>
                )}
              </div>
            )}

            {/* History tab */}
            {tab === "historico" && (
              <div className="space-y-0">
                {card.history.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Sem movimentações</p>
                ) : (
                  [...card.history].reverse().map((h, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        {i < card.history.length - 1 && <div className="w-0.5 flex-1 bg-border min-h-[16px]" />}
                      </div>
                      <div className="pb-3">
                        <p className="text-xs text-foreground">
                          {h.from ? `${STAGE_CONFIG[h.from as keyof typeof STAGE_CONFIG]?.label || h.from} → ` : "Criado em "}
                          <strong>{STAGE_CONFIG[h.to as keyof typeof STAGE_CONFIG]?.label || h.to}</strong>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(h.at).toLocaleString("pt-BR")} · por {h.by}
                          {h.duration_days != null && ` · ${h.duration_days}d na etapa anterior`}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tasks tab */}
            {tab === "tarefas" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{cardTasks.length} tarefa(s)</span>
                  <button onClick={() => setShowTaskForm(!showTaskForm)} className="text-[10px] text-primary hover:underline flex items-center gap-0.5"><Plus size={10} />Nova tarefa</button>
                </div>
                {showTaskForm && (
                  <div className="space-y-1.5 bg-muted/30 rounded-lg p-2">
                    <input value={ntTitle} onChange={e => setNtTitle(e.target.value)} placeholder="Título"
                      className="w-full text-xs bg-muted/50 border border-border rounded px-2 py-1 text-foreground" />
                    <div className="flex gap-1.5">
                      <input type="date" value={ntDate} onChange={e => setNtDate(e.target.value)}
                        className="flex-1 text-xs bg-muted/50 border border-border rounded px-2 py-1 text-foreground" />
                      <select value={ntResp} onChange={e => setNtResp(e.target.value)}
                        className="text-xs bg-muted/50 border border-border rounded px-2 py-1 text-foreground">
                        <option value="">Sem responsável</option>
                        {ownerOptions.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <button onClick={submitTask} className="text-xs px-3 py-1 bg-primary/20 text-primary rounded w-full">Criar</button>
                  </div>
                )}
                {cardTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    <button onClick={() => onToggleTask(t.id)}
                      className={cn("flex-shrink-0", t.status === "concluida" ? "text-green-400" : "text-muted-foreground")}>
                      <Check size={12} />
                    </button>
                    <span className={cn("flex-1 truncate", t.status === "concluida" && "line-through text-muted-foreground")}>{t.title}</span>
                    <span className="text-muted-foreground text-[10px]">{new Date(t.due_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                    {t.auto_generated && <span className="text-[9px] text-muted-foreground italic">auto</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Actions tab */}
            {tab === "acoes" && (
              <div className="space-y-2">
                {card.lead_status === "aberto" && (
                  <div className="flex gap-2">
                    <button onClick={() => onMarkWon(card.id)}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 flex items-center justify-center gap-1">
                      <Trophy size={12} />Ganho
                    </button>
                    <button onClick={() => setShowLoss(true)}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-destructive/10 text-red-400 hover:bg-destructive/20 flex items-center justify-center gap-1">
                      <XCircle size={12} />Perdido
                    </button>
                  </div>
                )}
                {showLoss && (
                  <div className="space-y-2 bg-destructive/5 rounded-lg p-3 border border-destructive/20">
                    <p className="text-xs font-medium text-foreground">Motivo da perda</p>
                    <select value={lossCat} onChange={e => setLossCat(e.target.value as LossCategory)}
                      className="w-full text-xs bg-muted/50 border border-border rounded px-2 py-1.5 text-foreground">
                      {LOSS_CATEGORIES.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                    </select>
                    {lossCat === "outro" && (
                      <input value={lossText} onChange={e => setLossText(e.target.value)} placeholder="Descreva o motivo..."
                        className="w-full text-xs bg-muted/50 border border-border rounded px-2 py-1 text-foreground" />
                    )}
                    <div className="flex gap-1">
                      <button onClick={submitLoss} className="text-xs px-3 py-1 bg-destructive/20 text-red-400 rounded flex-1">Confirmar</button>
                      <button onClick={() => setShowLoss(false)} className="text-xs px-3 py-1 bg-muted text-muted-foreground rounded">Cancelar</button>
                    </div>
                  </div>
                )}
                {isLost && (
                  <div className="text-xs text-red-400/70 bg-destructive/5 rounded-lg p-2">
                    <strong>Motivo:</strong> {card.loss_reason}
                    {card.last_stage && <span className="ml-2 text-muted-foreground">Última etapa: {STAGE_CONFIG[card.last_stage as keyof typeof STAGE_CONFIG]?.label || card.last_stage}</span>}
                  </div>
                )}
                {isWon && <div className="text-xs text-green-400 bg-green-500/5 rounded-lg p-2 text-center">✅ Negócio fechado</div>}
                {card.lead_status !== "aberto" && (
                  <button onClick={() => onUpdate(card.id, { lead_status: "aberto", loss_reason: null, loss_category: null, last_stage: null })}
                    className="w-full text-xs py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground">Reabrir lead</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
