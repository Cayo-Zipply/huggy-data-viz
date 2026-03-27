import { useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { TrafficFunnel } from "@/components/TrafficFunnel";
import { ROICard } from "@/components/ROICard";
import { PerformanceChart } from "@/components/PerformanceChart";
import { DashboardHeader } from "@/components/DashboardHeader";
import { SalesFunnel } from "@/components/SalesFunnel";
import { 
  marketingData, 
  calculateVariation, 
  formatCurrency, 
  formatNumber, 
  formatPercent,
  getPreviousMonth,
} from "@/data/marketingData";
import { salesData } from "@/data/salesData";

const Index = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>("fevereiro");
  
  const currentData = marketingData[selectedMonth];
  const prevKey = getPreviousMonth(selectedMonth);
  const previousData = prevKey ? marketingData[prevKey] : null;

  const getVariation = (current: number, previous: number | undefined) => {
    if (!previous) return undefined;
    return calculateVariation(current, previous);
  };

  const cliques = Math.round((currentData.impressoes * currentData.ctr) / 100);

  const conversaoGeral = (currentData.vendas / currentData.mensagensEfetivas) * 100;
  const previousConversaoGeral = previousData 
    ? (previousData.vendas / previousData.mensagensEfetivas) * 100 
    : undefined;

  // Custo por reunião
  const currentSales = salesData[selectedMonth];
  const reunioesRealizadas = currentSales?.funnel.reunioes.realizado || 0;
  const custoPorReuniao = reunioesRealizadas > 0 ? currentData.investimento / reunioesRealizadas : 0;
  
  const prevSales = prevKey ? salesData[prevKey] : null;
  const prevReunioes = prevSales?.funnel.reunioes.realizado || 0;
  const prevCustoPorReuniao = prevReunioes > 0 && previousData ? previousData.investimento / prevReunioes : undefined;

  // Conversão reuniões → contratos
  const conversaoReunioes = reunioesRealizadas > 0 
    ? (currentSales.funnel.contratos.realizado / reunioesRealizadas) * 100 
    : 0;
  const prevConversaoReunioes = prevReunioes > 0 && prevSales
    ? (prevSales.funnel.contratos.realizado / prevReunioes) * 100
    : undefined;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <DashboardHeader 
          selectedMonth={selectedMonth} 
          onSelectMonth={setSelectedMonth} 
        />

        {/* Métricas principais */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
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
          <MetricCard
            title="Mensagens Efetivas"
            value={formatNumber(currentData.mensagensEfetivas)}
            variation={getVariation(currentData.mensagensEfetivas, previousData?.mensagensEfetivas)}
            delay={225}
          />
        </div>

        {/* Segunda linha de métricas */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
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
          <MetricCard
            title="Conversão Geral"
            value={formatPercent(conversaoGeral)}
            variation={getVariation(conversaoGeral, previousConversaoGeral)}
            delay={450}
          />
          <MetricCard
            title="Custo por Reunião"
            value={custoPorReuniao > 0 ? formatCurrency(custoPorReuniao) : "N/A"}
            variation={getVariation(custoPorReuniao, prevCustoPorReuniao)}
            invertColors
            delay={500}
          />
          <MetricCard
            title="Conv. Reuniões"
            value={conversaoReunioes > 0 ? formatPercent(conversaoReunioes) : "N/A"}
            variation={getVariation(conversaoReunioes, prevConversaoReunioes)}
            delay={550}
          />
        </div>

        {/* Seção inferior com funis, ROI e gráfico */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <TrafficFunnel
            impressoes={currentData.impressoes}
            cliques={cliques}
            mensagens={currentData.mensagens}
            vendas={currentData.vendas}
          />
          
          <SalesFunnel 
            data={salesData[selectedMonth] || salesData.novembro} 
            investimento={currentData.investimento}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
