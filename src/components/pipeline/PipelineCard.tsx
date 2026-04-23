import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Phone, Mail, Building2, DollarSign, Paperclip, FileText, Upload,
  ChevronDown, ChevronUp, Clock, Trophy, XCircle, UserCircle, Plus, Check, History, Info, ListChecks, Zap,
  AlertTriangle, Calendar, User
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PipelineCard as CardType, PipelineTask, PipeType, LossCategory } from "./types";
import { LOSS_CATEGORIES, STAGE_CONFIG, formatBRL, isStale, daysDiff } from "./types";
import type { PipelineLabel } from "@/hooks/useLabels";

interface Props {
  card: CardType;
  tasks: PipelineTask[];
  cardLabels?: PipelineLabel[];
  slaHoras?: number;
  ownerOptions?: string[];
  onUpdate: (id: string, u: Partial<CardType>) => void;
  onMarkWon: (id: string) => void;
  onMarkLost: (id: string, cat: string, reason: string) => void;
  onCreateTask: (task: Omit<PipelineTask, "id" | "created_at">) => void;
  onToggleTask: (id: string) => void;
  onCardClick?: (card: CardType) => void;
}

type Tab = "info" | "historico" | "tarefas" | "acoes";

export function PipelineCardItem({ card, tasks, cardLabels = [], slaHoras, ownerOptions: ownerOptionsProp, onUpdate, onMarkWon, onMarkLost, onCreateTask, onToggleTask, onCardClick }: Props) {
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
  const ownerOptions = ownerOptionsProp || Array.from(new Set([card.owner, ...cardTasks.map((task) => task.responsible)].filter(Boolean) as string[]));

  // SLA status
  const hoursInStage = staleDays * 24;
  const slaStatus = slaHoras && card.lead_status === "aberto"
    ? hoursInStage >= slaHoras ? "estourado" : hoursInStage >= slaHoras * 0.75 ? "proximo" : "dentro"
    : "dentro";

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

  // Status accent bar color (left side, 3px)
  const accentColor = isWon
    ? "bg-emerald-600"
    : isLost
    ? "bg-red-600"
    : slaStatus === "estourado"
    ? "bg-red-600"
    : slaStatus === "proximo"
    ? "bg-amber-500"
    : stale
    ? "bg-amber-500"
    : "bg-slate-300 dark:bg-slate-600";

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-lg border border-border bg-card transition-colors",
      "shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] hover:bg-accent/40",
      isLost && "opacity-60"
    )}>
      {/* Status accent — left bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", accentColor)} />

      <div className="p-3 pl-4">
        {/* Header — name + chevron */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onCardClick?.(card)}>
            <p className="font-medium text-foreground text-sm truncate">{card.nome}</p>
            {card.empresa && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{card.empresa}</p>
            )}
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground p-0.5">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Badges line — discreet, text-only */}
        {(isWon || isLost || stale || card.fim_de_semana || card.tipo_documento || card.contrato_status || slaStatus !== "dentro") && (
          <div className="flex flex-wrap gap-1 mt-2">
            {isWon && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">Ganho</span>}
            {isLost && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">Perdido</span>}
            {slaStatus === "estourado" && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">SLA</span>}
            {slaStatus === "proximo" && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">SLA próx.</span>}
            {stale && slaStatus === "dentro" && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">{staleDays}d parado</span>}
            {card.tipo_documento === "cnpj" && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900">CNPJ</span>}
            {card.tipo_documento === "cpf" && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900">CPF</span>}
            {card.fim_de_semana && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">FDS</span>}
            {(card.resumo_reuniao || card.transcricao_reuniao) && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">Anexo</span>}
            {card.contrato_status === "assinado" && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">Assinado</span>}
            {card.contrato_status === "enviado" && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">Em assinatura</span>}
            {card.contrato_status === "gerado" && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900">Contrato</span>}
            {card.contrato_status === "recusado" && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">Recusado</span>}
          </div>
        )}

        {/* Metadata grid — owner + value */}
        <div className="flex items-center justify-between gap-2 mt-2.5 text-xs">
          <span className={cn(
            "truncate",
            card.owner === "SDR" ? "text-amber-700 dark:text-amber-400 font-medium" : "text-muted-foreground"
          )}>
            {card.owner === "SDR" ? "Atribuir responsável" : (card.owner || "Sem closer")}
          </span>
          {editing === "deal_value" ? (
            <div className="flex gap-1">
              <input value={editValue} onChange={e => setEditValue(e.target.value)}
                className="w-20 text-xs bg-muted/50 border border-border rounded px-1.5 py-0.5 text-foreground"
                autoFocus onKeyDown={e => e.key === "Enter" && saveEdit("deal_value")} />
              <button onClick={() => saveEdit("deal_value")} className="text-xs px-1.5 bg-primary text-primary-foreground rounded">OK</button>
            </div>
          ) : (
            <button onClick={() => startEdit("deal_value", card.deal_value?.toString() || "1621")}
              className="font-semibold text-foreground hover:text-primary transition-colors">
              {formatBRL(card.deal_value || 1621)}
            </button>
          )}
        </div>

        {/* Bottom row — origem + date + tasks (subtle) */}
        <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2 min-w-0">
            {card.origem && <span className="truncate">{card.origem}</span>}
            {pendingCount > 0 && <span className="text-amber-700 dark:text-amber-400">{pendingCount} tarefa{pendingCount > 1 ? "s" : ""}</span>}
          </div>
          <span className="shrink-0">{new Date(card.created_at).toLocaleDateString("pt-BR")}</span>
        </div>

        {/* Telefone (linha sutil) */}
        {card.telefone && (
          <a href={wa || "#"} target="_blank" rel="noopener noreferrer"
            className="block mt-1.5 text-[11px] text-muted-foreground hover:text-foreground truncate">
            {card.telefone}
          </a>
        )}

        {/* Custom labels */}
        {cardLabels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {cardLabels.map(label => (
              <span key={label.id} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium border" style={{ backgroundColor: label.color + "15", color: label.color, borderColor: label.color + "30" }}>
                {label.name}
              </span>
            ))}
          </div>
        )}

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
                    <button onClick={() => onMarkLost(card.id, "", "")}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-destructive/10 text-red-400 hover:bg-destructive/20 flex items-center justify-center gap-1">
                      <XCircle size={12} />Perdido
                    </button>
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
