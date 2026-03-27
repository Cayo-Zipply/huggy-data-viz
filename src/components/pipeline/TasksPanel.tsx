import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Calendar, Clock, User, AlertCircle } from "lucide-react";
import type { PipelineCard, PipelineTask } from "./types";

interface Props {
  tasks: PipelineTask[];
  cards: PipelineCard[];
  activeUser: string;
  onToggleTask: (taskId: string, status: string) => void;
  onReschedule: (taskId: string, date: string) => void;
}

export function TasksPanel({ tasks, cards, activeUser, onToggleTask, onReschedule }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const isAdmin = activeUser === "Cayo";

  const userTasks = tasks.filter(t => {
    if (!isAdmin && t.responsible !== activeUser) return false;
    return true;
  });

  const todayTasks = userTasks.filter(t => t.due_date <= today && t.status === "pendente");
  const upcomingTasks = userTasks.filter(t => t.due_date > today && t.status === "pendente");
  const completedTasks = userTasks.filter(t => t.status === "concluida").slice(0, 20);

  const getCard = (cardId: string) => cards.find(c => c.id === cardId);

  const TaskRow = ({ task }: { task: PipelineTask }) => {
    const card = getCard(task.card_id);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const isOverdue = task.due_date < today && task.status === "pendente";

    return (
      <div className={cn("flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50 hover:bg-card transition-all",
        isOverdue && "border-destructive/30")}>
        <button onClick={() => onToggleTask(task.id, task.status === "pendente" ? "concluida" : "pendente")}
          className={cn("flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
            task.status === "concluida" ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground hover:border-primary")}>
          {task.status === "concluida" && <Check size={10} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm truncate", task.status === "concluida" && "line-through text-muted-foreground")}>{task.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {card && <span className="text-[10px] text-primary">{card.nome}</span>}
            {task.responsible && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><User size={8} /> {task.responsible}</span>}
            <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted/50 rounded">{task.pipe_context.toUpperCase()}</span>
            {task.auto_generated && <span className="text-[10px] text-muted-foreground italic">auto</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn("text-[10px] flex items-center gap-0.5",
            isOverdue ? "text-red-400" : "text-muted-foreground")}>
            {isOverdue && <AlertCircle size={10} />}
            <Clock size={10} /> {new Date(task.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
          </span>
          {task.status === "pendente" && (
            showDatePicker ? (
              <input type="date" className="text-xs bg-muted/50 border border-border rounded px-2 py-1 text-foreground"
                onChange={e => { onReschedule(task.id, e.target.value); setShowDatePicker(false); }} autoFocus />
            ) : (
              <button onClick={() => setShowDatePicker(true)} className="text-[10px] text-muted-foreground hover:text-foreground">
                <Calendar size={12} />
              </button>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Tarefas de Hoje</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {todayTasks.length} pendente(s) para hoje · {upcomingTasks.length} próximas
          </p>
        </div>
        <div className="bg-primary/10 text-primary font-bold text-lg px-4 py-2 rounded-xl">
          {todayTasks.length}
        </div>
      </div>

      {/* Today */}
      {todayTasks.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-foreground uppercase tracking-wider">Hoje & Atrasadas</h4>
          {todayTasks.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">
          🎉 Nenhuma tarefa pendente para hoje!
        </div>
      )}

      {/* Upcoming */}
      {upcomingTasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-foreground uppercase tracking-wider">Próximas</h4>
          {upcomingTasks.slice(0, 10).map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      )}

      {/* Completed */}
      {completedTasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Concluídas recentes</h4>
          {completedTasks.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      )}
    </div>
  );
}
