import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MonthOption } from "@/hooks/useMarketingData";

interface MonthSelectorProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  months?: MonthOption[];
}

// Legacy static list (fallback)
export const months = [
  { key: 'setembro', label: 'Setembro 2024' },
  { key: 'outubro', label: 'Outubro 2024' },
  { key: 'novembro', label: 'Novembro 2024' },
  { key: 'dezembro', label: 'Dezembro 2024' },
  { key: 'janeiro', label: 'Janeiro 2025' },
  { key: 'fevereiro', label: 'Fevereiro 2025' },
];

export const MonthSelector = ({ selectedMonth, onSelectMonth, months: dynamicMonths }: MonthSelectorProps) => {
  const list = dynamicMonths || fallbackMonths;
  const currentIdx = list.findIndex(m => m.key === selectedMonth);
  const currentLabel = currentIdx >= 0 ? list[currentIdx].label : "—";

  // months[0] is newest, so "prev" (left arrow) goes to older = higher index
  const canGoNewer = currentIdx > 0;
  const canGoOlder = currentIdx < list.length - 1;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={!canGoNewer}
        onClick={() => canGoNewer && onSelectMonth(list[currentIdx - 1].key)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium min-w-[140px] text-center select-none">
        {currentLabel}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={!canGoOlder}
        onClick={() => canGoOlder && onSelectMonth(list[currentIdx + 1].key)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};
