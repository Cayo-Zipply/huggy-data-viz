import { useMemo, useState } from "react";
import { CalendarIcon, Check, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type Agrupamento = "criativo" | "conjunto" | "campanha";

export interface PeriodoFunil {
  desde: string;
  ate: string;
}

export interface FilterOption {
  name: string;
  leads: number;
}

interface MultiSelectProps {
  singular: string;
  plural: string;
  allLabel: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}

const MIN_DATE = new Date(2026, 3, 1);

const parseDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const toIsoDate = (date: Date) => format(date, "yyyy-MM-dd");

const lastDay = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0);

const todaySaoPaulo = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Number(value.year), Number(value.month) - 1, Number(value.day));
};

export const defaultPeriodoFunil = (): PeriodoFunil => {
  const today = todaySaoPaulo();
  return { desde: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), ate: toIsoDate(today) };
};

export const formatPeriodoLabel = ({ desde, ate }: PeriodoFunil) => {
  const start = parseDate(desde);
  const end = parseDate(ate);
  const isFullMonth = start.getDate() === 1 && end.getTime() === lastDay(end.getFullYear(), end.getMonth()).getTime();
  if (isFullMonth && start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    const label = format(start, "MMMM/yyyy", { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  return `${format(start, "dd/MM")} – ${format(end, "dd/MM/yyyy")}`;
};

const MultiSelect = ({ singular, plural, allLabel, options, selected, onChange }: MultiSelectProps) => {
  const [open, setOpen] = useState(false);
  const label = selected.length === 0 ? allLabel : selected.length === 1 ? selected[0] : `${selected.length} ${plural}`;
  const allSelected = options.length > 0 && selected.length === options.length;

  const toggle = (name: string) => {
    onChange(selected.includes(name) ? selected.filter((item) => item !== name) : [...selected, name]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 min-w-0 w-full sm:w-[210px] justify-between font-normal">
              <span className="truncate">{label}</span>
              <ChevronDown className="opacity-50" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        {selected.length === 1 && <TooltipContent className="max-w-sm">{selected[0]}</TooltipContent>}
      </Tooltip>
      <PopoverContent className="w-[min(340px,calc(100vw-24px))] p-0 pointer-events-auto" align="start">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">{singular}</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={allSelected} onClick={() => onChange(options.map((option) => option.name))}>
              Selecionar todos
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={selected.length === 0} onClick={() => onChange([])}>
              Limpar
            </Button>
          </div>
        </div>
        <Command>
          <CommandInput placeholder={`Buscar ${singular.toLowerCase()}…`} />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
            {options.map((option) => {
              const checked = selected.includes(option.name);
              return (
                <CommandItem key={option.name} value={option.name} onSelect={() => toggle(option.name)} className="gap-2">
                  <Checkbox checked={checked} className="pointer-events-none" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="min-w-0 flex-1 truncate">{option.name}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">{option.name}</TooltipContent>
                  </Tooltip>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{option.leads.toLocaleString("pt-BR")}</span>
                  {checked && <Check className="text-primary" />}
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

interface PeriodPickerProps {
  value: PeriodoFunil;
  onChange: (value: PeriodoFunil) => void;
}

const PeriodPicker = ({ value, onChange }: PeriodPickerProps) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>({ from: parseDate(value.desde), to: parseDate(value.ate) });
  const today = useMemo(todaySaoPaulo, []);
  const months = useMemo(() => {
    const list: Date[] = [];
    let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
    while (cursor >= MIN_DATE) {
      list.push(cursor);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
    }
    return list;
  }, [today]);

  const choose = (period: PeriodoFunil) => {
    onChange(period);
    setDraft({ from: parseDate(period.desde), to: parseDate(period.ate) });
    setOpen(false);
  };

  const shortcut = (kind: "current" | "previous" | "30" | "90") => {
    if (kind === "current") return choose(defaultPeriodoFunil());
    if (kind === "previous") {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return choose({ desde: toIsoDate(start), ate: toIsoDate(lastDay(start.getFullYear(), start.getMonth())) });
    }
    const days = kind === "30" ? 29 : 89;
    const start = new Date(today);
    start.setDate(start.getDate() - days);
    choose({ desde: toIsoDate(start < MIN_DATE ? MIN_DATE : start), ate: toIsoDate(today) });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 min-w-0 w-full sm:w-auto justify-start font-normal">
          <CalendarIcon />
          <span className="truncate">{formatPeriodoLabel(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(680px,calc(100vw-24px))] p-0 pointer-events-auto" align="start">
        <div className="grid sm:grid-cols-[180px_1fr]">
          <div className="border-b sm:border-b-0 sm:border-r p-2">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Atalhos</p>
            {[{ key: "current", label: "Este mês" }, { key: "previous", label: "Mês passado" }, { key: "30", label: "Últimos 30 dias" }, { key: "90", label: "Últimos 90 dias" }].map((item) => (
              <Button key={item.key} variant="ghost" size="sm" className="w-full justify-start" onClick={() => shortcut(item.key as "current" | "previous" | "30" | "90")}>{item.label}</Button>
            ))}
            <p className="px-2 pt-3 pb-1 text-xs font-medium text-muted-foreground">Meses</p>
            <ScrollArea className="h-36 sm:h-52">
              {months.map((month) => (
                <Button
                  key={toIsoDate(month)}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start capitalize"
                  onClick={() => choose({ desde: toIsoDate(month), ate: toIsoDate(month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear() ? today : lastDay(month.getFullYear(), month.getMonth())) })}
                >
                  {format(month, "MMMM/yyyy", { locale: ptBR })}
                </Button>
              ))}
            </ScrollArea>
          </div>
          <div className="p-2 overflow-x-auto">
            <Calendar
              mode="range"
              selected={draft}
              onSelect={setDraft}
              defaultMonth={draft?.from ?? today}
              disabled={{ before: MIN_DATE, after: today }}
              numberOfMonths={1}
              className="p-3 pointer-events-auto"
              locale={ptBR}
            />
            <div className="flex justify-end border-t p-2">
              <Button size="sm" disabled={!draft?.from || !draft.to} onClick={() => draft?.from && draft.to && choose({ desde: toIsoDate(draft.from), ate: toIsoDate(draft.to) })}>
                Aplicar período
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface FunilCriativoFiltersProps {
  periodo: PeriodoFunil;
  onPeriodoChange: (value: PeriodoFunil) => void;
  campanhas: FilterOption[];
  conjuntos: FilterOption[];
  criativos: FilterOption[];
  selectedCampanhas: string[];
  selectedConjuntos: string[];
  selectedCriativos: string[];
  onCampanhasChange: (values: string[]) => void;
  onConjuntosChange: (values: string[]) => void;
  onCriativosChange: (values: string[]) => void;
  agrupamento: Agrupamento;
  onAgrupamentoChange: (value: Agrupamento) => void;
}

export const FunilCriativoFilters = ({
  periodo, onPeriodoChange, campanhas, conjuntos, criativos,
  selectedCampanhas, selectedConjuntos, selectedCriativos,
  onCampanhasChange, onConjuntosChange, onCriativosChange,
  agrupamento, onAgrupamentoChange,
}: FunilCriativoFiltersProps) => (
  <div className="flex flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-center">
    <PeriodPicker value={periodo} onChange={onPeriodoChange} />
    <MultiSelect singular="Campanha" plural="campanhas" allLabel="Todas as campanhas" options={campanhas} selected={selectedCampanhas} onChange={onCampanhasChange} />
    <MultiSelect singular="Conjunto" plural="conjuntos" allLabel="Todos os conjuntos" options={conjuntos} selected={selectedConjuntos} onChange={onConjuntosChange} />
    <MultiSelect singular="Criativo" plural="criativos" allLabel="Todos os criativos" options={criativos} selected={selectedCriativos} onChange={onCriativosChange} />
    <ToggleGroup
      type="single"
      value={agrupamento}
      onValueChange={(value) => value && onAgrupamentoChange(value as Agrupamento)}
      variant="outline"
      size="sm"
      className={cn("h-9 w-full sm:w-auto rounded-md border bg-background p-0.5", "[&>button]:h-7 [&>button]:flex-1 sm:[&>button]:flex-none")}
    >
      <ToggleGroupItem value="criativo">Criativo</ToggleGroupItem>
      <ToggleGroupItem value="conjunto">Conjunto</ToggleGroupItem>
      <ToggleGroupItem value="campanha">Campanha</ToggleGroupItem>
    </ToggleGroup>
  </div>
);