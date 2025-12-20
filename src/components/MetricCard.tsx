import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  variation?: number;
  delay?: number;
  invertColors?: boolean;
}

export const MetricCard = ({ title, value, variation, delay = 0, invertColors = false }: MetricCardProps) => {
  const isPositive = invertColors ? (variation ?? 0) < 0 : (variation ?? 0) > 0;
  const showVariation = variation !== undefined && variation !== 0;

  return (
    <div 
      className="bg-card border border-border rounded-lg p-4 opacity-0 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-muted-foreground text-sm mb-1">{title}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      {showVariation && (
        <div className={cn(
          "flex items-center gap-1 mt-1 text-sm",
          isPositive ? "text-success" : "text-destructive"
        )}>
          {isPositive ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span>{Math.abs(variation).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
};
