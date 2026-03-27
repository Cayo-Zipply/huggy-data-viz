import { BarChart3 } from "lucide-react";
import { MonthSelector } from "./MonthSelector";

interface DashboardHeaderProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}

export const DashboardHeader = ({ selectedMonth, onSelectMonth }: DashboardHeaderProps) => {
  return (
    <header className="flex items-center justify-end mb-8">
      <MonthSelector selectedMonth={selectedMonth} onSelectMonth={onSelectMonth} />
    </header>
  );
};
