import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Calendar, Clock, User, AlertCircle, ChevronRight } from "lucide-react";
import type { PipelineCard, PipelineTask } from "./types";
import { STAGE_CONFIG } from "./types";

interface Props {
  tasks: PipelineTask[];
  cards: PipelineCard[];
  activeUser: string;
  onToggle: (id: string) => void;
  onReschedule: (id: string, date: string) => void;
  onScrollToCard?: (cardId: string) => void;
}

export function TasksPanel({ tasks, cards, activeUser, onToggle, onReschedule }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const in3days = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
  const isAdmin = activeUser === "Cayo";

  const userTasks = tasks.filter(t => isAdmin || t.responsible === activeUser);
  const overdue = userTasks.filter(t => t.due_date < today && t.status === "pendente");
  const todayTasks = userTasks.filter(t => t.due_date === today && t.status === "pendente");
  const upcoming = userTasks.filter(t => t.due_date > today && t.due_date <= in3days && t.status === "pendente");
  const completed = userTasks.filter(t => t.status === "concluida").slice(0, 15);

  const getCard = (id: string) => cards.find(c => c.id === id);

  const TaskRow = ({ task }: { task: PipelineTask }) => {
    const card = getCard(task.card_id);
    const [showDate, setShowDate] = useState(false);
    const isOD = task.due_date < today && task.status === "pendente";

    return (
      <div className={cn("flex items-center gap-3 p-3 rounded-xl border bg-card/50 hover:bg-card transition-all",
        isOD && "border-destructive/30")}>
        <button onClick={() => onToggle(task.id)}
          className={cn("flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
            task.status === "concluida" ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground hover:border-primary")}>
          {task.status === "concluida" && <Check size={10} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm truncate", task.status === "concluida" && "line-through text-muted-foreground")}>{task.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {card && (
              <span className="text-[10px] text-primary flex items-center gap-0.5">
                <ChevronRight size={8} />{card.nome}
                <span className="text-muted-foreground ml-1">{STAGE_CONFIG[card.stage]?.label}</span>
              </span>
            )}
            {task.responsible && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><User size={8} />{task.responsible}</span>}
            <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted/50 rounded">{task.pipe_context.toUpperCase()}</span>
            {task.auto_generated && <span className="text-[10px] text-muted-foreground italic">auto</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn("text-[10px] flex items-center gap-0.5", isOD ? "text-red-400" : "text-muted-foreground")}>
            {isOD && <AlertCircle size={10} />}<Clock size={10} />{new Date(task.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
          </span>
          {task.status === "pendente" && (
            showDate ? (
              <input type="date" className="text-xs bg-muted/50 border border-border rounded px-2 py-1 text-foreground"
                onChange={e => { onReschedule(task.id, e.target.value); setShowDate(false); }} autoFocus />
            ) : (
              <button onClick={() => setShowDate(true)} className="text-[10px] text-muted-foreground hover:text-foreground"><Calendar size={12} /></button>
            )
          )}
        </div>
      </div>
    );
  };

  const Section = ({ title, items, color }: { title: string; items: PipelineTask[]; color?: string }) => (
    items.length > 0 ? (
      <div className="space-y-2">
        <h4 className={cn("text-xs font-medium uppercase tracking-wider", color || "text-foreground")}>{title} ({items.length})</h4>
        {items.map(t => <TaskRow key={t.id} task={t} />)}
      </div>
    ) : null
  );

  const totalPending = overdue.length + todayTasks.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Tarefas</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalPending} pendente(s) · {overdue.length} atrasada(s)
          </p>
        </div>
        <div className="flex gap-2">
          {overdue.length > 0 && <div className="bg-destructive/10 text-red-400 font-bold text-lg px-4 py-2 rounded-xl">{overdue.length}</div>}
          <div className="bg-primary/10 text-primary font-bold text-lg px-4 py-2 rounded-xl">{todayTasks.length}</div>
        </div>
      </div>

      <Section title="Atrasadas" items={overdue} color="text-red-400" />
      <Section title="Hoje" items={todayTasks} />
      <Section title="Próximos 3 dias" items={upcoming} color="text-muted-foreground" />

      {totalPending === 0 && <div className="text-center py-8 text-muted-foreground text-sm">🎉 Nenhuma tarefa pendente!</div>}

      <Section title="Concluídas recentes" items={completed} color="text-muted-foreground" />
    </div>
  );
}
