import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MonthSelectorProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}

const months = [
  { key: 'novembro', label: 'Novembro 2024' },
  { key: 'dezembro', label: 'Dezembro 2024' },
  { key: 'janeiro', label: 'Janeiro 2025' },
  { key: 'fevereiro', label: 'Fevereiro 2025' },
];

export const MonthSelector = ({ selectedMonth, onSelectMonth }: MonthSelectorProps) => {
  return (
    <Select value={selectedMonth} onValueChange={onSelectMonth}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Selecione o mês" />
      </SelectTrigger>
      <SelectContent>
        {months.map((month) => (
          <SelectItem key={month.key} value={month.key}>
            {month.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
