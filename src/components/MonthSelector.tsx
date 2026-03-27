import { cn } from "@/lib/utils";

interface MonthSelectorProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}

export const MonthSelector = ({ selectedMonth, onSelectMonth }: MonthSelectorProps) => {
  const months = [
    { key: 'novembro', label: 'Nov 2024' },
    { key: 'dezembro', label: 'Dez 2024' },
    { key: 'janeiro', label: 'Jan 2025' },
    { key: 'fevereiro', label: 'Fev 2025' },
  ];

  return (
    <div className="flex gap-2">
      {months.map((month) => (
        <button
          key={month.key}
          onClick={() => onSelectMonth(month.key)}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
            selectedMonth === month.key
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          {month.label}
        </button>
      ))}
    </div>
  );
};
