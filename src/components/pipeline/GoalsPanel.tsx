import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Target, CheckCircle, AlertTriangle, TrendingDown } from "lucide-react";
import type { PipelineCard, PipelineGoal } from "./types";
import { CLOSERS, formatBRL, getBusinessDays, getBusinessDaysPassed, cardsReachedStage } from "./types";

interface Props {
  cards: PipelineCard[];
  goals: PipelineGoal[];
  activeUser: string;
  onSave: (g: PipelineGoal) => void;
}

function CloserGoals({ cards, goals, closer, onSave }: { cards: PipelineCard[]; goals: PipelineGoal[]; closer: string; onSave: (g: PipelineGoal) => void }) {
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

  const cc = cards.filter(c => c.owner === closer);
  const totalBiz = getBusinessDays(now.getFullYear(), now.getMonth());
  const passedBiz = getBusinessDaysPassed(now.getFullYear(), now.getMonth(), now);

  const realized = useMemo(() => {
    const rm = cardsReachedStage(cc, "reuniao_marcada").length;
    const rr = cardsReachedStage(cc, "reuniao_realizada").length;
    const ganhos = cc.filter(c => c.lead_status === "ganho");
    const fat = ganhos.reduce((s, c) => s + (c.deal_value || 0), 0);
    const total = cc.filter(c => c.lead_status !== "perdido").length;
    const conv = total > 0 ? (ganhos.length / total) * 100 : 0;
    return { rm, rr, fat, conv };
  }, [cc]);

  const project = (v: number) => passedBiz > 0 ? (v / passedBiz) * totalBiz : 0;
  const upd = (k: string, v: number) => { setMeta(p => ({ ...p, [k]: v })); setDirty(true); };
  const save = () => { onSave({ closer, month: monthKey, ...meta }); setDirty(false); };

  const Semaphore = ({ current, target, isCurrency, isPercent }: { current: number; target: number; isCurrency?: boolean; isPercent?: boolean }) => {
    if (target === 0) return null;
    const proj = project(current);
    const ratio = proj / target;
    const diff = proj - target;
    const icon = ratio >= 1.1 ? <CheckCircle size={14} className="text-green-400" /> :
      ratio >= 0.9 ? <AlertTriangle size={14} className="text-yellow-400" /> :
        <TrendingDown size={14} className="text-red-400" />;
    const color = ratio >= 1.1 ? "text-green-400" : ratio >= 0.9 ? "text-yellow-400" : "text-red-400";
    const fmt = (v: number) => isCurrency ? formatBRL(v) : isPercent ? `${v.toFixed(1)}%` : Math.round(v).toString();

    return (
      <div className="flex items-center gap-2 mt-1">
        {icon}
        <span className={cn("text-[10px]", color)}>
          Projeção: {fmt(proj)} · {diff >= 0 ? `+${fmt(Math.abs(diff))} acima` : `${fmt(Math.abs(diff))} abaixo`} da meta
        </span>
      </div>
    );
  };

  const rows = [
    { label: "Reuniões Marcadas", key: "reunioes_marcadas_meta", real: realized.rm },
    { label: "Reuniões Realizadas", key: "reunioes_realizadas_meta", real: realized.rr },
    { label: "Faturamento", key: "faturamento_meta", real: realized.fat, isCurrency: true },
    { label: "Conversão (%)", key: "conversao_meta", real: realized.conv, isPercent: true },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><Target size={14} />{closer}</h4>
        <span className="text-[10px] text-muted-foreground">{passedBiz}/{totalBiz} dias úteis</span>
      </div>
      <div className="space-y-4">
        {rows.map(r => {
          const metaVal = (meta as any)[r.key];
          const fmt = (v: number) => r.isCurrency ? formatBRL(v) : r.isPercent ? `${v.toFixed(1)}%` : v.toString();
          return (
            <div key={r.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="text-foreground font-medium">Realizado: {fmt(r.real)}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all",
                      metaVal > 0 && r.real >= metaVal ? "bg-green-500" : "bg-primary")}
                      style={{ width: metaVal > 0 ? `${Math.min(100, (r.real / metaVal) * 100)}%` : "0%" }} />
                  </div>
                </div>
                <div className="w-24">
                  <input type="number" value={metaVal || ""} onChange={e => upd(r.key, Number(e.target.value))}
                    placeholder="Meta" className="w-full text-xs bg-muted/50 border border-border rounded px-2 py-1 text-foreground text-right" />
                </div>
              </div>
              <Semaphore current={r.real} target={metaVal} isCurrency={r.isCurrency} isPercent={r.isPercent} />
            </div>
          );
        })}
      </div>
      {dirty && (
        <button onClick={save} className="w-full text-xs py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-all">Salvar Metas</button>
      )}
    </div>
  );
}

export function GoalsPanel({ cards, goals, activeUser, onSave }: Props) {
  const isAdmin = activeUser === "Cayo";
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground">Metas</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isAdmin ? CLOSERS.map(c => <CloserGoals key={c} cards={cards} goals={goals} closer={c} onSave={onSave} />) :
          <CloserGoals cards={cards} goals={goals} closer={activeUser} onSave={onSave} />}
      </div>
    </div>
  );
}
