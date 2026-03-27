import { formatNumber } from "@/data/marketingData";

interface TrafficFunnelProps {
  impressoes: number;
  cliques: number;
  mensagens: number;
  vendas: number;
}

export const TrafficFunnel = ({ impressoes, cliques, mensagens, vendas }: TrafficFunnelProps) => {
  const formatValue = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)} mi`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)} mil`;
    }
    return formatNumber(value);
  };

  const pctCliques = impressoes > 0 ? ((cliques / impressoes) * 100).toFixed(2) : "0";
  const pctMensagens = cliques > 0 ? ((mensagens / cliques) * 100).toFixed(2) : "0";
  const pctVendas = mensagens > 0 ? ((vendas / mensagens) * 100).toFixed(2) : "0";

  return (
    <div className="bg-card border border-border rounded-lg p-6 opacity-0 animate-fade-in" style={{ animationDelay: '400ms' }}>
      <h3 className="text-foreground font-semibold mb-6">Funil de Tráfego</h3>
      
      <div className="relative flex flex-col items-center">
        {/* Impressões - Topo largo */}
        <div className="w-full max-w-[280px] relative">
          <div 
            className="h-20 gradient-funnel flex flex-col items-center justify-center"
            style={{
              clipPath: 'polygon(0% 0%, 100% 0%, 90% 100%, 10% 100%)',
            }}
          >
            <span className="text-xs text-primary-foreground font-medium">Impressões</span>
            <span className="text-lg font-bold text-primary-foreground">{formatValue(impressoes)}</span>
          </div>
        </div>

        {/* Taxa Impressões → Cliques */}
        <div className="my-1 text-xs font-semibold text-muted-foreground">{pctCliques}%</div>

        {/* Cliques */}
        <div className="w-[75%] max-w-[210px] relative">
          <div 
            className="h-16 bg-primary flex flex-col items-center justify-center"
            style={{
              clipPath: 'polygon(5% 0%, 95% 0%, 85% 100%, 15% 100%)',
            }}
          >
            <span className="text-xs text-primary-foreground font-medium">Cliques</span>
            <span className="text-lg font-bold text-primary-foreground">{formatValue(cliques)}</span>
          </div>
        </div>

        {/* Taxa Cliques → Mensagens */}
        <div className="my-1 text-xs font-semibold text-muted-foreground">{pctMensagens}%</div>

        {/* Mensagens */}
        <div className="w-[55%] max-w-[154px] relative">
          <div 
            className="h-14 flex flex-col items-center justify-center"
            style={{
              clipPath: 'polygon(8% 0%, 92% 0%, 80% 100%, 20% 100%)',
              backgroundColor: 'hsl(207, 90%, 45%)',
            }}
          >
            <span className="text-xs text-primary-foreground font-medium">Mensagens</span>
            <span className="text-lg font-bold text-primary-foreground">{formatValue(mensagens)}</span>
          </div>
        </div>

        {/* Taxa Mensagens → Vendas */}
        <div className="my-1 text-xs font-semibold text-muted-foreground">{pctVendas}%</div>

        {/* Vendas - Base estreita */}
        <div className="w-[35%] max-w-[98px] relative">
          <div 
            className="h-12 flex flex-col items-center justify-center"
            style={{
              clipPath: 'polygon(12% 0%, 88% 0%, 70% 100%, 30% 100%)',
              backgroundColor: 'hsl(207, 90%, 35%)',
            }}
          >
            <span className="text-xs text-primary-foreground font-medium">Vendas</span>
            <span className="text-lg font-bold text-primary-foreground">{vendas}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
