import { useState, useEffect } from "react";
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
  calculateVariation,
  formatCurrency,
  formatNumber,
  formatPercent,
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
import { useMarketingData } from "@/hooks/useMarketingData";

const Index = () => {
  const location = useLocation();
  const activeTab = location.pathname.replace("/", "") || "pipeline";
  const { profile } = useAuth();
  const pipelineName = profile?.nome ?? "Admin";
  const { cards, goals } = usePipelineData(pipelineName);
  const pipelineOwners = [...new Set(cards.map(c => c.owner).filter(Boolean))] as string[];

  // Dynamic marketing data
  const { months: dynamicMonths, defaultMonth, getMonthData, getPreviousMonthData, getLeadMetrics, getPreviousLeadMetrics, loading: marketingLoading } = useMarketingData();

  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Set default month once data loads
  useEffect(() => {
    if (defaultMonth && !selectedMonth) {
      setSelectedMonth(defaultMonth);
    }
  }, [defaultMonth, selectedMonth]);

  const currentData = getMonthData(selectedMonth);
  const previousData = getPreviousMonthData(selectedMonth);
  const currentLeadMetrics = getLeadMetrics(selectedMonth);
  const previousLeadMetrics = getPreviousLeadMetrics(selectedMonth);

  const getVariation = (current: number, previous: number | undefined) => {
    if (!previous) return undefined;
    return calculateVariation(current, previous);
  };

  // Derived values from currentData + lead metrics
  const cliques = currentData ? Math.round((currentData.impressoes * currentData.ctr) / 100) : 0;
  const conversaoGeral = currentLeadMetrics.mensagens > 0
    ? (currentLeadMetrics.vendas / currentLeadMetrics.mensagens) * 100
    : 0;
  const previousConversaoGeral = previousLeadMetrics && previousLeadMetrics.mensagens > 0
    ? (previousLeadMetrics.vendas / previousLeadMetrics.mensagens) * 100
    : undefined;

  const reunioesRealizadas = currentLeadMetrics.reunioesRealizadas;
  const custoPorReuniao = reunioesRealizadas > 0 && currentData
    ? currentData.investimento / reunioesRealizadas
    : 0;
  const prevReunioes = previousLeadMetrics?.reunioesRealizadas || 0;
  const prevCustoPorReuniao = prevReunioes > 0 && previousData
    ? previousData.investimento / prevReunioes
    : undefined;

  const conversaoReunioes = reunioesRealizadas > 0
    ? (currentLeadMetrics.vendas / reunioesRealizadas) * 100
    : 0;
  const prevConversaoReunioes = prevReunioes > 0 && previousLeadMetrics
    ? (previousLeadMetrics.vendas / prevReunioes) * 100
    : undefined;

  if (!selectedMonth) return null;

  return (
    <div className="min-h-screen bg-background">
      <main className="p-3 sm:p-4 lg:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <DashboardHeader
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
            months={dynamicMonths}
            hideMonthSelector={
              activeTab === "rentabilidade" ||
              activeTab === "consolidado" ||
              activeTab === "pipeline" ||
              activeTab === "ajuda" ||
              activeTab === "farol"
            }
          />

          {/* Marketing Tab */}
          {activeTab === "marketing" && currentData && (
            <>
              {/* Metricas principais */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <MetricCard title="Investimento" value={formatCurrency(currentData.investimento)} variation={getVariation(currentData.investimento, previousData?.investimento)} invertColors delay={0} />
                <MetricCard title="Impressoes" value={formatNumber(currentData.impressoes)} variation={getVariation(currentData.impressoes, previousData?.impressoes)} delay={50} />
                <MetricCard title={metricTooltips.ctr.label} value={formatPercent(currentData.ctr)} variation={getVariation(currentData.ctr, previousData?.ctr)} tooltip={metricTooltips.ctr.tooltip} delay={100} />
                <MetricCard title={metricTooltips.cpc.label} value={formatCurrency(currentData.cpc)} variation={getVariation(currentData.cpc, previousData?.cpc)} invertColors tooltip={metricTooltips.cpc.tooltip} delay={150} />
                <MetricCard title="Mensagens" value={formatNumber(currentLeadMetrics.mensagens)} variation={getVariation(currentLeadMetrics.mensagens, previousLeadMetrics?.mensagens)} delay={200} />
                <MetricCard title="Mensagens Efetivas" value={formatNumber(currentLeadMetrics.mensagensEfetivas)} variation={getVariation(currentLeadMetrics.mensagensEfetivas, previousLeadMetrics?.mensagensEfetivas)} delay={225} />
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
                <TrafficFunnel impressoes={currentData.impressoes} cliques={cliques} mensagens={currentLeadMetrics.mensagens} vendas={currentLeadMetrics.vendas} />
                <ROICard investimento={currentData.investimento} faturamento={currentLeadMetrics.faturamento} vendas={currentLeadMetrics.vendas} diasUteis={currentData.diasUteis} />
              </div>
            </>
          )}

          {/* Comercial Tab */}
          {activeTab === "comercial" && currentData && (
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
