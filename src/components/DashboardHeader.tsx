import { BarChart3 } from "lucide-react";
import { MonthSelector } from "./MonthSelector";

interface DashboardHeaderProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}

export const DashboardHeader = ({ selectedMonth, onSelectMonth }: DashboardHeaderProps) => {
  return (
    <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard de Marketing</h1>
          <p className="text-sm text-muted-foreground">Análise de performance de campanhas</p>
        </div>
      </div>
      
      <MonthSelector selectedMonth={selectedMonth} onSelectMonth={onSelectMonth} />
    </header>
  );
};
