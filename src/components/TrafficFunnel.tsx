import { formatNumber, formatCurrency, formatPercent } from "@/data/marketingData";

interface TrafficFunnelProps {
  impressoes: number;
  cliques: number;
  mensagens: number;
  reunioes: number;
  vendas: number;
  investimento: number;
  faturamento: number;
}

const formatValue = (value: number): string => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)} mi`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)} mil`;
  return formatNumber(value);
};

interface SideCardProps {
  label: string;
  value: string;
  icon: string;
}

const SideCard = ({ label, value, icon }: SideCardProps) => (
  <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2 min-w-0">
    <span className="text-base shrink-0">{icon}</span>
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground leading-tight truncate">{label}</p>
      <p className="text-sm font-bold text-foreground leading-tight">{value}</p>
    </div>
  </div>
);

interface FunnelStageProps {
  label: string;
  value: number;
  widthPct: number;
  color: string;
}

const FunnelStage = ({ label, value, widthPct, color }: FunnelStageProps) => (
  <div className="flex items-center justify-center flex-col" style={{ width: `${widthPct}%` }}>
    <div
      className="w-full h-14 flex items-center justify-center rounded-sm"
      style={{
        backgroundColor: color,
        clipPath: 'polygon(4% 0%, 96% 0%, 90% 100%, 10% 100%)',
      }}
    >
      <span className="text-white font-bold text-base">{formatValue(value)}</span>
    </div>
    <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
  </div>
);

const ConversionArrow = ({ pct }: { pct: string }) => (
  <div className="flex items-center gap-1 text-muted-foreground my-0.5">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
    <span className="text-xs font-semibold">{pct}%</span>
  </div>
);

export const TrafficFunnel = ({
  impressoes, cliques, mensagens, reunioes, vendas,
  investimento, faturamento,
}: TrafficFunnelProps) => {
  const roi = investimento > 0 ? ((faturamento - investimento) / investimento) : 0;
  const roas = investimento > 0 ? faturamento / investimento : 0;
  const ticketMedio = vendas > 0 ? faturamento / vendas : 0;
  const taxaConversao = mensagens > 0 ? (vendas / mensagens) * 100 : 0;

  const custoLead = mensagens > 0 ? investimento / mensagens : 0;
  const custoReuniao = reunioes > 0 ? investimento / reunioes : 0;
  const cpa = vendas > 0 ? investimento / vendas : 0;

  const pctCliques = impressoes > 0 ? ((cliques / impressoes) * 100).toFixed(2) : "0";
  const pctMensagens = cliques > 0 ? ((mensagens / cliques) * 100).toFixed(2) : "0";
  const pctReunioes = mensagens > 0 ? ((reunioes / mensagens) * 100).toFixed(2) : "0";
  const pctVendas = reunioes > 0 ? ((vendas / reunioes) * 100).toFixed(2) : "0";

  return (
    <div className="bg-card border border-border rounded-lg p-4 sm:p-6 opacity-0 animate-fade-in col-span-full" style={{ animationDelay: '400ms' }}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 lg:gap-6 items-start">
        
        {/* Left — Marketing */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Marketing</h4>
          <SideCard icon="📈" label="Investimento" value={formatCurrency(investimento)} />
          <SideCard icon="💰" label="Faturamento" value={formatCurrency(faturamento)} />
          <SideCard icon="🔄" label="ROAS" value={roas.toFixed(2)} />
          <SideCard icon="📊" label="Taxa de Conversão" value={formatPercent(taxaConversao)} />
          <SideCard icon="🎫" label="Ticket Médio" value={formatCurrency(ticketMedio)} />
        </div>

        {/* Center — Funnel */}
        <div className="flex flex-col items-center w-full lg:w-[280px]">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Funil</h4>
          
          <FunnelStage label="Impressões" value={impressoes} widthPct={100} color="hsl(var(--foreground) / 0.85)" />
          <ConversionArrow pct={pctCliques} />
          
          <FunnelStage label="Cliques" value={cliques} widthPct={82} color="hsl(145, 60%, 40%)" />
          <ConversionArrow pct={pctMensagens} />
          
          <FunnelStage label="Mensagens" value={mensagens} widthPct={65} color="hsl(var(--foreground) / 0.7)" />
          <ConversionArrow pct={pctReunioes} />
          
          <FunnelStage label="Reuniões" value={reunioes} widthPct={48} color="hsl(145, 60%, 35%)" />
          <ConversionArrow pct={pctVendas} />
          
          <FunnelStage label="Vendas" value={vendas} widthPct={32} color="hsl(var(--foreground) / 0.5)" />
        </div>

        {/* Right — Comercial */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Comercial</h4>
          <SideCard icon="🎯" label="Custo por Lead" value={formatCurrency(custoLead)} />
          <SideCard icon="📅" label="Custo por Reunião" value={reunioes > 0 ? formatCurrency(custoReuniao) : "N/A"} />
          <SideCard icon="💵" label="CPA" value={vendas > 0 ? formatCurrency(cpa) : "N/A"} />
          <SideCard icon="📈" label="ROI" value={investimento > 0 ? `${(roi * 100).toFixed(1)}%` : "N/A"} />
          <SideCard icon="🏷️" label="Conv. Reuniões" value={reunioes > 0 ? formatPercent((vendas / reunioes) * 100) : "N/A"} />
        </div>
      </div>
    </div>
  );
};
