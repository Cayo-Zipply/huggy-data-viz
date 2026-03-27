import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Phone, Mail, Building2, DollarSign, Paperclip, FileText, Upload,
  ChevronDown, ChevronUp, Clock, Trophy, XCircle, UserCircle, Plus, Check
} from "lucide-react";
import type { PipelineCard as CardType, PipelineTask, PipeType } from "./types";
import { CLOSERS, formatBRL, getStageLabel } from "./types";

interface Props {
  card: CardType;
  tasks: PipelineTask[];
  onUpdate: (u: Partial<CardType> & { id: string }) => void;
  onUploadContract: (card: CardType, file: File) => void;
  onMarkWon: (id: string) => void;
  onMarkLost: (id: string, reason: string) => void;
  onCreateTask: (task: Omit<PipelineTask, "id" | "created_at">) => void;
  onToggleTask: (taskId: string, status: string) => void;
}

export function PipelineCardItem({ card, tasks, onUpdate, onUploadContract, onMarkWon, onMarkLost, onCreateTask, onToggleTask }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [lossReason, setLossReason] = useState("");
  const [showLossForm, setShowLossForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState(new Date().toISOString().split("T")[0]);
  const [newTaskResp, setNewTaskResp] = useState(card.owner || "Cayo");

  const isLost = card.lead_status === "perdido";
  const isWon = card.lead_status === "ganho";
  const whatsappLink = card.telefone ? `https://wa.me/55${card.telefone.replace(/\D/g, "")}` : null;
  const cardTasks = tasks.filter(t => t.card_id === card.id);

  const startEdit = (field: string, value: string) => { setEditing(field); setEditValue(value || ""); };
  const saveEdit = (field: string) => {
    let val: any = editValue || null;
    if (field === "deal_value" || field === "valor_divida") {
      val = editValue ? parseFloat(editValue.replace(/[^\d.,]/g, "").replace(",", ".")) : null;
      if (field === "deal_value" && !val) val = 1621;
    }
    onUpdate({ id: card.id, [field]: val } as any);
    setEditing(null);
  };

  const submitLoss = () => {
    if (!lossReason.trim()) return;
    onMarkLost(card.id, lossReason);
    setShowLossForm(false);
    setLossReason("");
  };

  const submitTask = () => {
    if (!newTaskTitle.trim()) return;
    onCreateTask({
      card_id: card.id,
      title: newTaskTitle,
      due_date: newTaskDate,
      responsible: newTaskResp,
      status: "pendente",
      pipe_context: card.pipe,
      auto_generated: false,
    });
    setNewTaskTitle("");
    setShowTaskForm(false);
  };

  return (
    <div className={cn(
      "bg-card border border-border rounded-xl overflow-hidden transition-all group",
      isLost && "opacity-60",
      isWon && "border-green-500/40",
      !isLost && !isWon && "hover:border-primary/30"
    )}>
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-foreground text-sm truncate">{card.nome}</p>
              {isWon && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">Ganho</span>}
              {isLost && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/20 text-red-400 font-medium">Perdido</span>}
            </div>
            {card.telefone && (
              <a href={whatsappLink || "#"} target="_blank" rel="noopener noreferrer"
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1 mt-0.5">
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
          {/* Deal value - inline editable */}
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
              <DollarSign size={8} className="inline mr-0.5" />{formatBRL(card.deal_value || 1621)}
            </button>
          )}
          {card.owner && (
            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 rounded text-primary flex items-center gap-0.5">
              <UserCircle size={8} /> {card.owner}
            </span>
          )}
          {card.origem && <span className="text-[10px] px-1.5 py-0.5 bg-muted/50 rounded text-muted-foreground">{card.origem}</span>}
          {card.created_at && (
            <span className="text-[10px] px-1.5 py-0.5 bg-muted/50 rounded text-muted-foreground flex items-center gap-0.5">
              <Clock size={8} /> {new Date(card.created_at).toLocaleDateString("pt-BR")}
            </span>
          )}
          {card.contract_url && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-400/10 rounded text-blue-400 flex items-center gap-0.5">
              <FileText size={8} /> Contrato
            </span>
          )}
          {cardTasks.filter(t => t.status === "pendente").length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-yellow-400/10 rounded text-yellow-400">
              {cardTasks.filter(t => t.status === "pendente").length} tarefa(s)
            </span>
          )}
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            {/* Owner select */}
            <div className="flex items-center gap-2">
              <UserCircle size={12} className="text-muted-foreground flex-shrink-0" />
              <select value={card.owner || ""} onChange={e => onUpdate({ id: card.id, owner: e.target.value || null } as any)}
                className="flex-1 text-xs bg-muted/50 border border-border rounded px-2 py-1 text-foreground">
                <option value="">Sem dono</option>
                {CLOSERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Custom fields */}
            {([
              { key: "email", label: "Email", icon: Mail },
              { key: "cnpj", label: "CNPJ", icon: Building2 },
              { key: "valor_divida", label: "Valor da Dívida", icon: DollarSign },
            ] as const).map(field => (
              <div key={field.key} className="flex items-center gap-2">
                <field.icon size={12} className="text-muted-foreground flex-shrink-0" />
                {editing === field.key ? (
                  <div className="flex-1 flex gap-1">
                    <input value={editValue} onChange={e => setEditValue(e.target.value)}
                      className="flex-1 text-xs bg-muted/50 border border-border rounded px-2 py-1 text-foreground"
                      autoFocus onKeyDown={e => e.key === "Enter" && saveEdit(field.key)} />
                    <button onClick={() => saveEdit(field.key)} className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">OK</button>
                  </div>
                ) : (
                  <button onClick={() => startEdit(field.key, (card as any)[field.key]?.toString() || "")}
                    className="flex-1 text-left text-xs text-muted-foreground hover:text-foreground truncate">
                    {(card as any)[field.key] || `Adicionar ${field.label}...`}
                  </button>
                )}
              </div>
            ))}

            {/* Contract */}
            <div className="flex items-center gap-2">
              <Paperclip size={12} className="text-muted-foreground flex-shrink-0" />
              {card.contract_url ? (
                <a href={card.contract_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <FileText size={10} /> Ver contrato
                </a>
              ) : (
                <label className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
                  <Upload size={10} /> Anexar contrato (PDF)
                  <input type="file" accept=".pdf" className="hidden" onChange={e => {
                    const f = e.target.files?.[0]; if (f) onUploadContract(card, f);
                  }} />
                </label>
              )}
            </div>

            {/* Notes */}
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

            {/* Tasks */}
            <div className="border-t border-border pt-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Tarefas</span>
                <button onClick={() => setShowTaskForm(!showTaskForm)} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                  <Plus size={10} /> Nova tarefa
                </button>
              </div>
              {showTaskForm && (
                <div className="space-y-1.5 bg-muted/30 rounded-lg p-2">
                  <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Título da tarefa"
                    className="w-full text-xs bg-muted/50 border border-border rounded px-2 py-1 text-foreground" />
                  <div className="flex gap-1.5">
                    <input type="date" value={newTaskDate} onChange={e => setNewTaskDate(e.target.value)}
                      className="flex-1 text-xs bg-muted/50 border border-border rounded px-2 py-1 text-foreground" />
                    <select value={newTaskResp} onChange={e => setNewTaskResp(e.target.value)}
                      className="text-xs bg-muted/50 border border-border rounded px-2 py-1 text-foreground">
                      {CLOSERS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <button onClick={submitTask} className="text-xs px-3 py-1 bg-primary/20 text-primary rounded w-full">Criar</button>
                </div>
              )}
              {cardTasks.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-xs">
                  <button onClick={() => onToggleTask(t.id, t.status === "pendente" ? "concluida" : "pendente")}
                    className={cn("flex-shrink-0", t.status === "concluida" ? "text-green-400" : "text-muted-foreground")}>
                    <Check size={12} />
                  </button>
                  <span className={cn("flex-1 truncate", t.status === "concluida" && "line-through text-muted-foreground")}>{t.title}</span>
                  <span className="text-muted-foreground text-[10px]">{new Date(t.due_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            {card.lead_status === "aberto" && (
              <div className="border-t border-border pt-2 flex gap-2">
                <button onClick={() => onMarkWon(card.id)}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 flex items-center justify-center gap-1">
                  <Trophy size={12} /> Ganho
                </button>
                <button onClick={() => setShowLossForm(true)}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-destructive/10 text-red-400 hover:bg-destructive/20 flex items-center justify-center gap-1">
                  <XCircle size={12} /> Perdido
                </button>
              </div>
            )}
            {showLossForm && (
              <div className="space-y-1.5 bg-destructive/5 rounded-lg p-2 border border-destructive/20">
                <input value={lossReason} onChange={e => setLossReason(e.target.value)} placeholder="Motivo da perda (obrigatório)"
                  className="w-full text-xs bg-muted/50 border border-border rounded px-2 py-1 text-foreground" autoFocus
                  onKeyDown={e => e.key === "Enter" && submitLoss()} />
                <div className="flex gap-1">
                  <button onClick={submitLoss} className="text-xs px-3 py-1 bg-destructive/20 text-red-400 rounded flex-1">Confirmar</button>
                  <button onClick={() => setShowLossForm(false)} className="text-xs px-3 py-1 bg-muted text-muted-foreground rounded">Cancelar</button>
                </div>
              </div>
            )}
            {isLost && card.loss_reason && (
              <div className="text-xs text-red-400/70 bg-destructive/5 rounded-lg p-2">
                <strong>Motivo:</strong> {card.loss_reason}
                {card.last_stage && <span className="ml-2 text-muted-foreground">Última etapa: {card.last_stage}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
