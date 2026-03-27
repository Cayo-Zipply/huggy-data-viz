import { useState } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { HANDOFF_ITEMS } from "./types";

interface Props {
  leadName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function HandoffChecklist({ leadName, onConfirm, onCancel }: Props) {
  const [checks, setChecks] = useState<boolean[]>(HANDOFF_ITEMS.map(() => false));
  const allChecked = checks.every(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-yellow-400" />
          <h3 className="text-base font-bold text-foreground">Handoff SDR → Closer</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Antes de mover <strong className="text-foreground">{leadName}</strong> para o pipe de Closer, confirme todos os itens:
        </p>
        <div className="space-y-3 mb-6">
          {HANDOFF_ITEMS.map((item, i) => (
            <label key={i} className="flex items-center gap-3 cursor-pointer group">
              <div className={cn(
                "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                checks[i] ? "bg-green-500 border-green-500" : "border-muted-foreground group-hover:border-primary"
              )}>
                {checks[i] && <CheckCircle2 size={12} className="text-white" />}
              </div>
              <span className={cn("text-sm", checks[i] ? "text-foreground" : "text-muted-foreground")}>{item}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onConfirm} disabled={!allChecked}
            className={cn("flex-1 py-2 rounded-xl text-sm font-medium transition-all",
              allChecked ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground cursor-not-allowed")}>
            Confirmar Handoff
          </button>
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm border border-border text-muted-foreground hover:text-foreground">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
