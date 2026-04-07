import { useState } from "react";
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
import { SalesPieChart } from "@/components/SalesPieChart";
import { MarketingMetaPanel } from "@/components/MarketingMetaPanel";

const Index = ({ initialTab }: { initialTab?: string }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>("fevereiro");

  // O tab ativo agora vem direto da rota via initialTab (controlado pelo AppSidebar)
  const activeTab = initialTab || "pipeline";

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
              activeTab === "ajuda"
            }
          />

          {/* Marketing Tab */}
          {activeTab === "marketing" && <MarketingMetaPanel />}

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

          {/* Pipeline Tab */}
          {activeTab === "pipeline" && <PipelinePanel />}

          {/* Ajuda Tab */}
          {activeTab === "ajuda" && <HelpPanel />}
        </div>
      </main>
    </div>
  );
};

export default Index;
