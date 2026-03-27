import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Target, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import type { PipelineCard, PipelineGoal } from "./types";
import { CLOSERS, formatBRL, getBusinessDays, getBusinessDaysPassed } from "./types";

interface Props {
  cards: PipelineCard[];
  goals: PipelineGoal[];
  activeUser: string;
  onSaveGoal: (goal: Omit<PipelineGoal, "id">) => void;
}

function CloserGoals({ cards, goals, closer, onSave }: {
  cards: PipelineCard[];
  goals: PipelineGoal[];
  closer: string;
  onSave: (goal: Omit<PipelineGoal, "id">) => void;
}) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const goal = goals.find(g => g.closer === closer && g.month === monthKey);

  const [meta, setMeta] = useState({
    reunioes_marcadas_meta: goal?.reunioes_marcadas_meta || 0,
    reunioes_realizadas_meta: goal?.reunioes_realizadas_meta || 0,
    faturamento_meta: goal?.faturamento_meta || 0,
    conversao_meta: goal?.conversao_meta || 0,
  });
  const [dirty, setDirty] = useState(false);

  const closerCards = cards.filter(c => c.owner === closer);
  const totalBizDays = getBusinessDays(now.getFullYear(), now.getMonth());
  const passedBizDays = getBusinessDaysPassed(now.getFullYear(), now.getMonth(), now);

  const realized = useMemo(() => {
    const reunioesMarcadas = closerCards.filter(c =>
      (c.pipe === "sdr" && c.sdr_stage === "reuniao_marcada") ||
      (c.pipe === "closer" && c.closer_stage === "reuniao_agendada")
    ).length;
    const reunioesRealizadas = closerCards.filter(c => c.pipe === "closer" && c.closer_stage === "reuniao_realizada").length;
    const ganhos = closerCards.filter(c => c.lead_status === "ganho");
    const faturamento = ganhos.reduce((s, c) => s + (c.deal_value || 0), 0);
    const total = closerCards.filter(c => c.lead_status !== "perdido").length;
    const conversao = total > 0 ? (ganhos.length / total) * 100 : 0;
    return { reunioesMarcadas, reunioesRealizadas, faturamento, conversao };
  }, [closerCards]);

  const project = (current: number) => {
    if (passedBizDays === 0) return 0;
    return Math.round((current / passedBizDays) * totalBizDays);
  };

  const update = (key: string, val: number) => {
    setMeta(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const save = () => {
    onSave({ closer, month: monthKey, ...meta });
    setDirty(false);
  };

  const StatusIcon = ({ current, target }: { current: number; target: number }) => {
    const projected = project(current);
    if (target === 0) return null;
    if (projected >= target) return <CheckCircle size={12} className="text-green-400" />;
    if (projected >= target * 0.8) return <AlertTriangle size={12} className="text-yellow-400" />;
    return <AlertTriangle size={12} className="text-red-400" />;
  };

  const rows = [
    { label: "Reuniões Marcadas", metaKey: "reunioes_marcadas_meta", realized: realized.reunioesMarcadas, isCurrency: false },
    { label: "Reuniões Realizadas", metaKey: "reunioes_realizadas_meta", realized: realized.reunioesRealizadas, isCurrency: false },
    { label: "Faturamento", metaKey: "faturamento_meta", realized: realized.faturamento, isCurrency: true },
    { label: "Conversão (%)", metaKey: "conversao_meta", realized: realized.conversao, isCurrency: false, isPercent: true },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><Target size={14} /> {closer}</h4>
        <span className="text-[10px] text-muted-foreground">{passedBizDays}/{totalBizDays} dias úteis</span>
      </div>

      <div className="space-y-3">
        {rows.map(row => {
          const metaVal = (meta as any)[row.metaKey];
          const projected = project(row.realized);
          return (
            <div key={row.metaKey} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{row.label}</span>
                <StatusIcon current={row.realized} target={metaVal} />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                    <span>Realizado: <strong className="text-foreground">{row.isCurrency ? formatBRL(row.realized) : row.isPercent ? `${row.realized.toFixed(1)}%` : row.realized}</strong></span>
                    <span>Projeção: {row.isCurrency ? formatBRL(projected) : row.isPercent ? `${projected.toFixed(1)}%` : projected}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", metaVal > 0 && row.realized >= metaVal ? "bg-green-500" : "bg-primary")}
                      style={{ width: metaVal > 0 ? `${Math.min(100, (row.realized / metaVal) * 100)}%` : "0%" }} />
                  </div>
                </div>
                <div className="w-20">
                  <input type="number" value={metaVal || ""} onChange={e => update(row.metaKey, Number(e.target.value))}
                    placeholder="Meta"
                    className="w-full text-xs bg-muted/50 border border-border rounded px-2 py-1 text-foreground text-right" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {dirty && (
        <button onClick={save} className="w-full text-xs py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-all">
          Salvar Metas
        </button>
      )}
    </div>
  );
}

export function GoalsPanel({ cards, goals, activeUser, onSaveGoal }: Props) {
  const isAdmin = activeUser === "Cayo";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground">Metas</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isAdmin
          ? CLOSERS.map(c => <CloserGoals key={c} cards={cards} goals={goals} closer={c} onSave={onSaveGoal} />)
          : <CloserGoals cards={cards} goals={goals} closer={activeUser} onSave={onSaveGoal} />}
      </div>
    </div>
  );
}
