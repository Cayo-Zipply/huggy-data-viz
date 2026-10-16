import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MetricTooltipProps {
  text: string;
}

export const MetricTooltip = ({ text }: MetricTooltipProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help inline-block ml-1" />
    </TooltipTrigger>
    <TooltipContent className="max-w-[280px] text-xs">
      {text}
    </TooltipContent>
  </Tooltip>
);

export const metricTooltips: Record<string, { label: string; tooltip: string }> = {
  ctr: {
    label: "CTR (Taxa de Cliques no Link)",
    tooltip: "A porcentagem de impressões que receberam um clique no link em relação ao número total de impressões.",
  },
  cpc: {
    label: "CPC (Custo por Clique)",
    tooltip: "O custo médio de cada clique no link do anúncio.",
  },
  cpa: {
    label: "CAC (custo por contrato)",
    tooltip: "Valor do investimento dividido pelo número de contratos fechados.",
  },
  cpm: {
    label: "CPM (Custo por 1.000 Impressões)",
    tooltip: "O custo médio para 1.000 impressões do anúncio.",
  },
  frequencia: {
    label: "Frequência",
    tooltip: "A média de vezes que seu anúncio foi visualizado por uma mesma conta da Central de Contas. Esta métrica é estimada.",
  },
};
