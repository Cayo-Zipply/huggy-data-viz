import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MetricTooltip } from "./MetricTooltip";

interface MetricCardProps {
  title: string;
  value: string;
  variation?: number;
  delay?: number;
  invertColors?: boolean;
  tooltip?: string;
}

export const MetricCard = ({ title, value, variation, delay = 0, invertColors = false, tooltip }: MetricCardProps) => {
  const isPositive = invertColors ? (variation ?? 0) < 0 : (variation ?? 0) > 0;
  const showVariation = variation !== undefined && variation !== 0;

  return (
    <div 
      className="bg-card border border-border rounded-lg p-3 sm:p-4 opacity-0 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-muted-foreground text-xs sm:text-sm mb-1 truncate" title={title}>
        {title}
        {tooltip && <MetricTooltip text={tooltip} />}
      </p>
      <p className="text-sm sm:text-xl font-semibold text-foreground truncate" title={value}>{value}</p>
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
