import { useMemo } from "react";
import { useLeads } from "@/hooks/useLeads";
import { Users, ShoppingCart, DollarSign, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const FUNNEL_STAGES = [
  { key: "fez contato", label: "Fez Contato", color: "bg-blue-500" },
  { key: "conectado", label: "Conectado", color: "bg-indigo-500" },
  { key: "sql", label: "SQL", color: "bg-violet-500" },
  { key: "reuniao marcada", label: "Reunião Marcada", color: "bg-amber-500" },
  { key: "reuniao realizada", label: "Reunião Realizada", color: "bg-orange-500" },
  { key: "comprou", label: "Comprou", color: "bg-emerald-500" },
];

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Dashboard() {
  const { leads, loading } = useLeads();

  const stats = useMemo(() => {
    const total = leads.length;
    const ganhos = leads.filter(l => l.status === "ganho");
    const vendas = ganhos.length;
    const faturamento = ganhos.reduce((s, l) => s + (l.deal_value || 0), 0);
    const conversao = total > 0 ? (vendas / total) * 100 : 0;

    const funnel = FUNNEL_STAGES.map(stage => {
      const count = stage.key === "comprou"
        ? leads.filter(l => l.status === "ganho").length
        : leads.filter(l => l.etapa_atual === stage.key && l.status !== "perdido" && l.status !== "ganho").length;
      return { ...stage, count };
    });

    // Count all leads that ever reached or passed each stage
    const stageOrder = FUNNEL_STAGES.map(s => s.key);
    const funnelCumulative = FUNNEL_STAGES.map((stage, idx) => {
      const reachedCount = leads.filter(l => {
        const currentIdx = stageOrder.indexOf(l.etapa_atual);
        const isWon = l.status === "ganho";
        return currentIdx >= idx || isWon;
      }).length;
      return { ...stage, count: reachedCount };
    });

    return { total, vendas, faturamento, conversao, funnel, funnelCumulative };
  }, [leads]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const maxFunnel = Math.max(...stats.funnelCumulative.map(f => f.count), 1);

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto">
      <h1 className="text-lg font-bold text-foreground">Dashboard</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Total Leads" value={String(stats.total)} color="text-blue-500" />
        <KPICard icon={ShoppingCart} label="Vendas" value={String(stats.vendas)} color="text-emerald-500" />
        <KPICard icon={DollarSign} label="Faturamento" value={formatBRL(stats.faturamento)} color="text-amber-500" />
        <KPICard icon={TrendingUp} label="Taxa Conversão" value={`${stats.conversao.toFixed(1)}%`} color="text-violet-500" />
      </div>

      {/* Funnel */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Funil de Vendas</h2>
        <div className="space-y-3">
          {stats.funnelCumulative.map(stage => (
            <div key={stage.key} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-36 shrink-0">{stage.label}</span>
              <div className="flex-1 bg-muted/30 rounded-full h-7 relative overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", stage.color)}
                  style={{ width: `${(stage.count / maxFunnel) * 100}%` }}
                />
                <span className="absolute inset-y-0 right-2 flex items-center text-xs font-medium text-foreground">
                  {stage.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current distribution */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Distribuição Atual</h2>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.funnel.map(stage => (
            <div key={stage.key} className="text-center p-3 bg-muted/20 rounded-lg">
              <div className={cn("w-3 h-3 rounded-full mx-auto mb-1", stage.color)} />
              <p className="text-lg font-bold text-foreground">{stage.count}</p>
              <p className="text-[10px] text-muted-foreground">{stage.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
