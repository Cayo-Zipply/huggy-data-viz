import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/hooks/useMarketingLive";

interface CampaignSelectorProps {
  campaigns: Campaign[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

/** Remove emojis/símbolos comuns do início ("🟢 - ", "✅ ", etc.). */
function cleanCampaignName(name: string): string {
  return name
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/^[-–—•·\s]+/u, "")
    .trim();
}

export function CampaignSelector({
  campaigns,
  selected,
  onChange,
}: CampaignSelectorProps) {
  const [open, setOpen] = useState(false);

  const allIds = useMemo(() => campaigns.map((c) => c.campaign_id), [campaigns]);
  const allSelected = selected.length === campaigns.length && campaigns.length > 0;
  const noneSelected = selected.length === 0;

  const label = useMemo(() => {
    if (campaigns.length === 0) return "Sem campanhas no mês";
    if (allSelected) return `Todas as campanhas (${campaigns.length})`;
    if (noneSelected) return "Nenhuma campanha";
    return `${selected.length} de ${campaigns.length} campanhas`;
  }, [allSelected, noneSelected, selected.length, campaigns.length]);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 justify-between min-w-[220px] font-normal"
          disabled={campaigns.length === 0}
        >
          <span className="truncate text-sm">{label}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Campanhas
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange(allIds)}
              disabled={allSelected}
            >
              Todas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange([])}
              disabled={noneSelected}
            >
              Limpar
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-[280px]">
          <div className="p-1">
            {campaigns.map((c) => {
              const checked = selected.includes(c.campaign_id);
              return (
                <button
                  key={c.campaign_id}
                  type="button"
                  onClick={() => toggle(c.campaign_id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-left",
                    "hover:bg-accent transition-colors",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(c.campaign_id)}
                    className="pointer-events-none"
                  />
                  <span className="flex-1 truncate">
                    {cleanCampaignName(c.campaign_name)}
                  </span>
                  {checked && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              );
            })}
            {campaigns.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nenhuma campanha disponível neste mês.
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
