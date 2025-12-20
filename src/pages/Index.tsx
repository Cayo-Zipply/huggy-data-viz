import { useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { TrafficFunnel } from "@/components/TrafficFunnel";
import { ROICard } from "@/components/ROICard";
import { PerformanceChart } from "@/components/PerformanceChart";
import { DashboardHeader } from "@/components/DashboardHeader";
import { 
  marketingData, 
  calculateVariation, 
  formatCurrency, 
  formatNumber, 
  formatPercent 
} from "@/data/marketingData";

const Index = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>("dezembro");
  
  const currentData = marketingData[selectedMonth];
  const previousData = selectedMonth === "dezembro" ? marketingData.novembro : null;

  const getVariation = (current: number, previous: number | undefined) => {
    if (!previous) return undefined;
    return calculateVariation(current, previous);
  };

  // Calcular cliques a partir de impressões e CTR
  const cliques = Math.round((currentData.impressoes * currentData.ctr) / 100);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <DashboardHeader 
          selectedMonth={selectedMonth} 
          onSelectMonth={setSelectedMonth} 
        />

        {/* Métricas principais */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <MetricCard
            title="Investimento"
            value={formatCurrency(currentData.investimento)}
            variation={getVariation(currentData.investimento, previousData?.investimento)}
            invertColors
            delay={0}
          />
          <MetricCard
            title="Impressões"
            value={formatNumber(currentData.impressoes)}
            variation={getVariation(currentData.impressoes, previousData?.impressoes)}
            delay={50}
          />
          <MetricCard
            title="CTR"
            value={formatPercent(currentData.ctr)}
            variation={getVariation(currentData.ctr, previousData?.ctr)}
            delay={100}
          />
          <MetricCard
            title="CPC"
            value={formatCurrency(currentData.cpc)}
            variation={getVariation(currentData.cpc, previousData?.cpc)}
            invertColors
            delay={150}
          />
          <MetricCard
            title="Mensagens"
            value={formatNumber(currentData.mensagens)}
            variation={getVariation(currentData.mensagens, previousData?.mensagens)}
            delay={200}
          />
        </div>

        {/* Segunda linha de métricas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="CPA"
            value={formatCurrency(currentData.cpa)}
            variation={getVariation(currentData.cpa, previousData?.cpa)}
            invertColors
            delay={250}
          />
          <MetricCard
            title="CPM"
            value={formatCurrency(currentData.cpm)}
            variation={getVariation(currentData.cpm, previousData?.cpm)}
            invertColors
            delay={300}
          />
          <MetricCard
            title="Frequência"
            value={formatPercent(currentData.frequencia)}
            variation={getVariation(currentData.frequencia, previousData?.frequencia)}
            delay={350}
          />
          <MetricCard
            title="Cliques"
            value={formatNumber(cliques)}
            delay={400}
          />
        </div>

        {/* Seção inferior com funil, ROI e gráfico */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TrafficFunnel
            impressoes={currentData.impressoes}
            cliques={cliques}
            mensagens={currentData.mensagens}
            vendas={currentData.vendas}
          />
          
          <ROICard
            investimento={currentData.investimento}
            faturamento={currentData.faturamento}
            vendas={currentData.vendas}
            diasUteis={currentData.diasUteis}
          />
          
          <PerformanceChart
            investimento={currentData.investimento}
            faturamento={currentData.faturamento}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
