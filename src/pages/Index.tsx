import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
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
import { BarChart3, Users, GitCompare, DollarSign, PieChart, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { RevenuePanel } from "@/components/RevenuePanel";
import { ConsolidatedPanel } from "@/components/ConsolidatedPanel";

import { PipelinePanel } from "@/components/PipelinePanel";
import { HelpPanel } from "@/components/HelpPanel";
import { SalesPieChart } from "@/components/SalesPieChart";

const tabs = [
  { key: "marketing", label: "Funil de Marketing", icon: BarChart3 },
  { key: "comercial", label: "Funil Comercial", icon: Users },
  { key: "comparativo", label: "Comparativo", icon: GitCompare },
  { key: "rentabilidade", label: "Rentabilidade", icon: DollarSign },
  { key: "consolidado", label: "Consolidado", icon: PieChart },
  { key: "pipeline", label: "Pipeline", icon: GitCompare },
  { key: "ajuda", label: "Ajuda", icon: HelpCircle },
];

const Index = ({ initialTab }: { initialTab?: string }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>("fevereiro");
  const [activeTab, setActiveTab] = useState(initialTab || "marketing");
  
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

  const currentSales = salesData[selectedMonth];
  const reunioesRealizadas = currentSales?.funnel.reunioes.realizado || 0;
  const custoPorReuniao = reunioesRealizadas > 0 ? currentData.investimento / reunioesRealizadas : 0;
  
  const prevSales = prevKey ? salesData[prevKey] : null;
  const prevReunioes = prevSales?.funnel.reunioes.realizado || 0;
  const prevCustoPorReuniao = prevReunioes > 0 && previousData ? previousData.investimento / prevReunioes : undefined;

  const conversaoReunioes = reunioesRealizadas > 0 
    ? (currentSales.funnel.contratos.realizado / reunioesRealizadas) * 100 
    : 0;
  const prevConversaoReunioes = prevReunioes > 0 && prevSales
    ? (prevSales.funnel.contratos.realizado / prevReunioes) * 100
    : undefined;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - desktop only */}
      <aside className="w-56 lg:w-64 bg-card border-r border-border flex-shrink-0 hidden md:flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Dashboard PQA</h2>
            <p className="text-xs text-muted-foreground">Análise de performance</p>
          </div>
          <ThemeToggle />
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                  activeTab === tab.key
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile tabs - bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex z-50 safe-area-bottom">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors min-w-0",
                activeTab === tab.key ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon size={16} />
              <span className="truncate px-0.5 leading-tight">{tab.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-24 md:pb-8 overflow-auto">
        <div className="md:hidden flex justify-end mb-2">
          <ThemeToggle />
        </div>
        <div className="max-w-7xl mx-auto">
          <DashboardHeader 
            selectedMonth={selectedMonth} 
            onSelectMonth={setSelectedMonth}
            hideMonthSelector={activeTab === "rentabilidade" || activeTab === "consolidado" || activeTab === "pipeline" || activeTab === "ajuda"}
          />

          {/* Marketing Tab */}
          {activeTab === "marketing" && (
            <>
              {/* Métricas principais */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4 mb-4 sm:mb-6">
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
                  title={metricTooltips.ctr.label}
                  value={formatPercent(currentData.ctr)}
                  variation={getVariation(currentData.ctr, previousData?.ctr)}
                  tooltip={metricTooltips.ctr.tooltip}
                  delay={100}
                />
                <MetricCard
                  title={metricTooltips.cpc.label}
                  value={formatCurrency(currentData.cpc)}
                  variation={getVariation(currentData.cpc, previousData?.cpc)}
                  invertColors
                  tooltip={metricTooltips.cpc.tooltip}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <MetricCard
                  title={metricTooltips.cpa.label}
                  value={formatCurrency(currentData.cpa)}
                  variation={getVariation(currentData.cpa, previousData?.cpa)}
                  invertColors
                  tooltip={metricTooltips.cpa.tooltip}
                  delay={250}
                />
                <MetricCard
                  title={metricTooltips.cpm.label}
                  value={formatCurrency(currentData.cpm)}
                  variation={getVariation(currentData.cpm, previousData?.cpm)}
                  invertColors
                  tooltip={metricTooltips.cpm.tooltip}
                  delay={300}
                />
                <MetricCard
                  title={metricTooltips.frequencia.label}
                  value={formatPercent(currentData.frequencia)}
                  variation={getVariation(currentData.frequencia, previousData?.frequencia)}
                  tooltip={metricTooltips.frequencia.tooltip}
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

              {/* Funil de tráfego */}
              <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-2">
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
              </div>
            </>
          )}

          {/* Comercial Tab */}
          {activeTab === "comercial" && (
            <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-2">
              <SalesFunnel 
                data={salesData[selectedMonth] || salesData.novembro} 
                investimento={currentData.investimento}
              />
              <PerformanceChart
                investimento={currentData.investimento}
                faturamento={currentData.faturamento}
              />
            </div>
          )}

          {/* Rentabilidade Tab */}
          {activeTab === "rentabilidade" && (
            <RevenuePanel />
          )}

          {/* Comparativo Tab */}
          {activeTab === "comparativo" && (
            <ComparisonPanel />
          )}

          {/* Consolidado Tab */}
          {activeTab === "consolidado" && (
            <ConsolidatedPanel />
          )}


          {/* Pipeline Tab */}
          {activeTab === "pipeline" && (
            <PipelinePanel />
          )}

          {/* Ajuda Tab */}
          {activeTab === "ajuda" && (
            <HelpPanel />
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
