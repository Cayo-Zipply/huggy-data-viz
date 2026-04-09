import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const list = dynamicMonths || months;

  return (
    <Select value={selectedMonth} onValueChange={onSelectMonth}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Selecione o mês" />
      </SelectTrigger>
      <SelectContent>
        {list.map((month) => (
          <SelectItem key={month.key} value={month.key}>
            {month.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
