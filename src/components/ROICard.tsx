import { formatCurrency } from "@/data/marketingData";
import { TrendingUp, CircleDollarSign, Target } from "lucide-react";

interface ROICardProps {
  investimento: number;
  faturamento: number;
  vendas: number;
  diasUteis?: string;
}

export const ROICard = ({ investimento, faturamento, vendas, diasUteis }: ROICardProps) => {
  const roi = ((faturamento - investimento) / investimento) * 100;
  const ticketMedio = vendas > 0 ? faturamento / vendas : 0;

  return (
    <div className="bg-card border border-border rounded-lg p-6 opacity-0 animate-fade-in" style={{ animationDelay: '500ms' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-foreground font-semibold">Resultados</h3>
        {diasUteis && (
          <span className="text-xs bg-warning/20 text-warning px-2 py-1 rounded">
            {diasUteis}
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
            <CircleDollarSign className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Faturamento</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(faturamento)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Vendas</p>
            <p className="text-xl font-bold text-foreground">{vendas}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-chart-orange/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-chart-orange" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">ROI</p>
            <p className="text-xl font-bold text-success">{roi.toFixed(1)}%</p>
          </div>
        </div>

        <div className="pt-3 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Ticket Médio</span>
            <span className="text-lg font-semibold text-foreground">{formatCurrency(ticketMedio)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
