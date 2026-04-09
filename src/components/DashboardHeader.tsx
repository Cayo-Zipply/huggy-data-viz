import { MonthSelector } from "./MonthSelector";
import type { MonthOption } from "@/hooks/useMarketingData";

interface DashboardHeaderProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  hideMonthSelector?: boolean;
  months?: MonthOption[];
}

export const DashboardHeader = ({ selectedMonth, onSelectMonth, hideMonthSelector, months }: DashboardHeaderProps) => {
  if (hideMonthSelector) return null;
  return (
    <header className="flex items-center justify-end mb-8">
      <MonthSelector selectedMonth={selectedMonth} onSelectMonth={onSelectMonth} months={months} />
    </header>
  );
};
