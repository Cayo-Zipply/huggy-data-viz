import { useState } from "react";
import { useLocation } from "react-router-dom";
import { MetricCard } from "@/components/MetricCard";
import { TrafficFunnel } from "@/components/TrafficFunnel";
import { ROICard } from "@/components/ROICard";
import { PerformanceChart } from "@/components/PerformanceChart";
import { DashboardHeader } from "@/components/DashboardHeader";
import { SalesFunnel } from "@/components/SalesFunnel";
import { ComparisonPanel } from "@/components/ComparisonPanel";
import { metricTooltips } from "@/components/MetricTooltip";
import {
  marketingData,
  calculateVariation,
  formatCurrency,
  formatNumber,
  formatPercent,
  getPreviousMonth,
} from "@/data/marketingData";
import { salesData } from "@/data/salesData";
import { RevenuePanel } from "@/components/RevenuePanel";
import { ConsolidatedPanel } from "@/components/ConsolidatedPanel";
import { PipelinePanel } from "@/components/PipelinePanel";
import { HelpPanel } from "@/components/HelpPanel";
import { FarolPanel } from "@/components/FarolPanel";
import { SalesPieChart } from "@/components/SalesPieChart";
import { usePipelineData } from "@/components/pipeline/usePipelineData";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const location = useLocation();
  const activeTab = location.pathname.replace("/", "") || "pipeline";
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const monthNames = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const key = monthNames[now.getMonth()];
    const available = Object.keys(marketingData);
    return available.includes(key) ? key : available[available.length - 1];
  });
  const { profile } = useAuth();
  const pipelineName = profile?.nome ?? "Admin";
  const { cards, goals } = usePipelineData(pipelineName);
  const pipelineOwners = [...new Set(cards.map(c => c.owner).filter(Boolean))] as string[];

  const currentData = marketingData[selectedMonth];
  const prevKey = getPreviousMonth(selectedMonth);
  const previousData = prevKey ? marketingData[prevKey] : null;

  const getVariation = (current: number, previous: number | undefined) => {
    if (!previous) return undefined;
    return calculateVariation(current, previous);
  };

  const cliques = Math.round(
    (currentData.impressoes * currentData.ctr) / 100
  );
  const conversaoGeral =
    (currentData.vendas / currentData.mensagensEfetivas) * 100;
  const previousConversaoGeral = previousData
    ? (previousData.vendas / previousData.mensagensEfetivas) * 100
    : undefined;

  const currentSales = salesData[selectedMonth];
  const reunioesRealizadas = currentSales?.funnel.reunioes.realizado || 0;
  const custoPorReuniao =
    reunioesRealizadas > 0
      ? currentData.investimento / reunioesRealizadas
      : 0;
  const prevSales = prevKey ? salesData[prevKey] : null;
  const prevReunioes = prevSales?.funnel.reunioes.realizado || 0;
  const prevCustoPorReuniao =
    prevReunioes > 0 && previousData
      ? previousData.investimento / prevReunioes
      : undefined;

  const conversaoReunioes =
    reunioesRealizadas > 0
      ? (currentSales.funnel.contratos.realizado / reunioesRealizadas) * 100
      : 0;
  const prevConversaoReunioes =
    prevReunioes > 0 && prevSales
      ? (prevSales.funnel.contratos.realizado / prevReunioes) * 100
      : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Main content — sem sidebar interna, AppSidebar ja cuida da navegacao */}
      <main className="p-3 sm:p-4 lg:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <DashboardHeader
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
            hideMonthSelector={
              activeTab === "rentabilidade" ||
              activeTab === "consolidado" ||
              activeTab === "pipeline" ||
              activeTab === "ajuda" ||
              activeTab === "farol"
            }
          />

          {/* Marketing Tab */}
          {activeTab === "marketing" && (
            <>
              {/* Metricas principais */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <MetricCard title="Investimento" value={formatCurrency(currentData.investimento)} variation={getVariation(currentData.investimento, previousData?.investimento)} invertColors delay={0} />
                <MetricCard title="Impressoes" value={formatNumber(currentData.impressoes)} variation={getVariation(currentData.impressoes, previousData?.impressoes)} delay={50} />
                <MetricCard title={metricTooltips.ctr.label} value={formatPercent(currentData.ctr)} variation={getVariation(currentData.ctr, previousData?.ctr)} tooltip={metricTooltips.ctr.tooltip} delay={100} />
                <MetricCard title={metricTooltips.cpc.label} value={formatCurrency(currentData.cpc)} variation={getVariation(currentData.cpc, previousData?.cpc)} invertColors tooltip={metricTooltips.cpc.tooltip} delay={150} />
                <MetricCard title="Mensagens" value={formatNumber(currentData.mensagens)} variation={getVariation(currentData.mensagens, previousData?.mensagens)} delay={200} />
                <MetricCard title="Mensagens Efetivas" value={formatNumber(currentData.mensagensEfetivas)} variation={getVariation(currentData.mensagensEfetivas, previousData?.mensagensEfetivas)} delay={225} />
              </div>

              {/* Segunda linha de metricas */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <MetricCard title={metricTooltips.cpa.label} value={formatCurrency(currentData.cpa)} variation={getVariation(currentData.cpa, previousData?.cpa)} invertColors tooltip={metricTooltips.cpa.tooltip} delay={250} />
                <MetricCard title={metricTooltips.cpm.label} value={formatCurrency(currentData.cpm)} variation={getVariation(currentData.cpm, previousData?.cpm)} invertColors tooltip={metricTooltips.cpm.tooltip} delay={300} />
                <MetricCard title={metricTooltips.frequencia.label} value={formatPercent(currentData.frequencia)} variation={getVariation(currentData.frequencia, previousData?.frequencia)} tooltip={metricTooltips.frequencia.tooltip} delay={350} />
                <MetricCard title="Cliques" value={formatNumber(cliques)} delay={400} />
                <MetricCard title="Conversao Geral" value={formatPercent(conversaoGeral)} variation={getVariation(conversaoGeral, previousConversaoGeral)} delay={450} />
                <MetricCard title="Custo por Reuniao" value={custoPorReuniao > 0 ? formatCurrency(custoPorReuniao) : "N/A"} variation={getVariation(custoPorReuniao, prevCustoPorReuniao)} invertColors delay={500} />
                <MetricCard title="Conv. Reunioes" value={conversaoReunioes > 0 ? formatPercent(conversaoReunioes) : "N/A"} variation={getVariation(conversaoReunioes, prevConversaoReunioes)} delay={550} />
              </div>

              {/* Funil de trafego */}
              <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-2">
                <TrafficFunnel impressoes={currentData.impressoes} cliques={cliques} mensagens={currentData.mensagens} vendas={currentData.vendas} />
                <ROICard investimento={currentData.investimento} faturamento={currentData.faturamento} vendas={currentData.vendas} diasUteis={currentData.diasUteis} />
              </div>
            </>
          )}

          {/* Comercial Tab */}
          {activeTab === "comercial" && (
            <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-2">
              <SalesFunnel data={salesData[selectedMonth] || salesData.novembro} investimento={currentData.investimento} />
              <PerformanceChart investimento={currentData.investimento} faturamento={currentData.faturamento} />
            </div>
          )}

          {/* Rentabilidade Tab */}
          {activeTab === "rentabilidade" && <RevenuePanel />}

          {/* Comparativo Tab */}
          {activeTab === "comparativo" && <ComparisonPanel />}

          {/* Consolidado Tab */}
          {activeTab === "consolidado" && <ConsolidatedPanel />}

          {/* Pipeline Tab — kept mounted to preserve state */}
          <div className={activeTab === "pipeline" ? "" : "hidden"}>
            <PipelinePanel />
          </div>

          {/* Farol Tab */}
          {activeTab === "farol" && <FarolPanel cards={cards} goals={goals} owners={pipelineOwners} />}

          {/* Ajuda Tab */}
          {activeTab === "ajuda" && <HelpPanel />}
        </div>
      </main>
    </div>
  );
};

export default Index;
