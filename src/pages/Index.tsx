import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { MetricCard } from "@/components/MetricCard";
import { TrafficFunnel } from "@/components/TrafficFunnel";
// ROICard metrics now integrated into TrafficFunnel
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
import { useMarketingOverrides } from "@/hooks/useMarketingOverrides";
import { useMarketingLive } from "@/hooks/useMarketingLive";
import { CampaignSelector } from "@/components/CampaignSelector";
import { FarolCloserCards } from "@/components/FarolCloserCards";

const Index = () => {
  const location = useLocation();
  const activeTab = location.pathname.replace("/", "") || "pipeline";
  const { profile } = useAuth();
  const pipelineName = profile?.nome ?? "Admin";
  const { cards, goals } = usePipelineData(pipelineName);
  const pipelineOwners = [...new Set(cards.map(c => c.owner).filter(Boolean))] as string[];

  // Marketing overrides from internal DB
  const { overrides: overridesList } = useMarketingOverrides();
  const overridesMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const o of overridesList) {
      map[o.month] = o;
    }
    return map;
  }, [overridesList]);

  // Dynamic marketing data with overrides
  const { months: dynamicMonths, defaultMonth, getMonthData, getPreviousMonthData, getLeadMetrics, getPreviousLeadMetrics, loading: marketingLoading } = useMarketingData(overridesMap);

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

  // Detect if current month is hardcoded (Sep 24 – Feb 25)
  const isHardcoded = dynamicMonths.find(m => m.key === selectedMonth)?.source === "hardcoded";

  // Convert selected month key (e.g. "abril_2026") to YYYY-MM using the raw
  // value from dynamicMonths (which is "2026-04-01" for dynamic entries).
  const selectedMonthYYYYMM = useMemo(() => {
    const opt = dynamicMonths.find(m => m.key === selectedMonth);
    if (!opt || opt.source === "hardcoded") return "";
    return opt.raw.slice(0, 7); // "2026-04-01" -> "2026-04"
  }, [dynamicMonths, selectedMonth]);

  // Live marketing data (Meta Ads from meta_ads_daily filtered by campaigns,
  // commercial metrics from leads). Only used for non-hardcoded months.
  const live = useMarketingLive(selectedMonthYYYYMM);

  const getVariation = (current: number, previous: number | undefined) => {
    if (!previous) return undefined;
    return calculateVariation(current, previous);
  };

  // For hardcoded months, use original salesData; for dynamic, use lead metrics
  const currentSales = isHardcoded ? salesData[selectedMonth] : null;

  // ============================================================
  // Effective metrics for the Marketing tab
  // ============================================================
  // Hardcoded months keep their static dataset. Dynamic months use:
  //  - meta_ads_daily aggregated by selected campaigns (Meta Ads metrics)
  //  - live counts from `leads` table (commercial metrics)
  // ============================================================

  const liveInvestimento = live.metaStats?.spend ?? 0;
  const liveImpressoes = live.metaStats?.impressions ?? 0;
  const liveCliques = live.metaStats?.clicks ?? 0;
  const liveCtr = liveImpressoes > 0 ? (liveCliques / liveImpressoes) * 100 : 0;
  const liveCpc = liveCliques > 0 ? liveInvestimento / liveCliques : 0;
  const liveCpm = liveImpressoes > 0 ? (liveInvestimento / liveImpressoes) * 1000 : 0;

  const prevLiveInvestimento = live.metaStatsPrev?.spend ?? 0;
  const prevLiveImpressoes = live.metaStatsPrev?.impressions ?? 0;
  const prevLiveCliques = live.metaStatsPrev?.clicks ?? 0;
  const prevLiveCtr = prevLiveImpressoes > 0 ? (prevLiveCliques / prevLiveImpressoes) * 100 : 0;
  const prevLiveCpc = prevLiveCliques > 0 ? prevLiveInvestimento / prevLiveCliques : 0;
  const prevLiveCpm = prevLiveImpressoes > 0 ? (prevLiveInvestimento / prevLiveImpressoes) * 1000 : 0;

  // Investimento / impressões / cliques: use live for dynamic months
  const investimentoView = isHardcoded ? (currentData?.investimento ?? 0) : liveInvestimento;
  const impressoesView = isHardcoded ? (currentData?.impressoes ?? 0) : liveImpressoes;
  const ctrView = isHardcoded ? (currentData?.ctr ?? 0) : liveCtr;
  const cpcView = isHardcoded ? (currentData?.cpc ?? 0) : liveCpc;
  const cpmView = isHardcoded ? (currentData?.cpm ?? 0) : liveCpm;
  const cliquesView = isHardcoded
    ? Math.round(((currentData?.impressoes ?? 0) * (currentData?.ctr ?? 0)) / 100)
    : liveCliques;

  const prevInvestimentoView = isHardcoded ? previousData?.investimento : prevLiveInvestimento;
  const prevImpressoesView = isHardcoded ? previousData?.impressoes : prevLiveImpressoes;
  const prevCtrView = isHardcoded ? previousData?.ctr : prevLiveCtr;
  const prevCpcView = isHardcoded ? previousData?.cpc : prevLiveCpc;
  const prevCpmView = isHardcoded ? previousData?.cpm : prevLiveCpm;

  // Mensagens/Vendas: hardcoded uses currentData (which has static values),
  // dynamic uses live counts from `leads`
  const effectiveMensagens = isHardcoded ? (currentData?.mensagens || 0) : (live.leadsStats?.mensagens ?? 0);
  const effectiveMensagensEfetivas = isHardcoded ? (currentData?.mensagensEfetivas || 0) : (live.leadsStats?.mensagens ?? 0);
  const effectiveVendas = isHardcoded ? (currentData?.vendas || 0) : (live.leadsStats?.vendas ?? 0);
  const effectiveFaturamento = isHardcoded ? (currentData?.faturamento || 0) : (live.leadsStats?.faturamento ?? 0);

  const prevEffectiveMensagens = isHardcoded
    ? (previousData?.mensagens || 0)
    : (live.leadsStatsPrev?.mensagens ?? 0);
  const prevEffectiveMensagensEfetivas = isHardcoded
    ? (previousData?.mensagensEfetivas || 0)
    : (live.leadsStatsPrev?.mensagens ?? 0);
  const prevEffectiveVendas = isHardcoded
    ? (previousData?.vendas || 0)
    : (live.leadsStatsPrev?.vendas ?? 0);

  // CPA from live data
  const liveCpa = effectiveVendas > 0 ? investimentoView / effectiveVendas : 0;
  const cpaView = isHardcoded ? (currentData?.cpa ?? 0) : liveCpa;
  const prevCpaView = isHardcoded
    ? previousData?.cpa
    : (prevEffectiveVendas > 0 ? (prevInvestimentoView ?? 0) / prevEffectiveVendas : undefined);

  const conversaoGeral = effectiveMensagens > 0
    ? (effectiveVendas / effectiveMensagens) * 100
    : 0;
  const previousConversaoGeral = prevEffectiveMensagens > 0
    ? (prevEffectiveVendas / prevEffectiveMensagens) * 100
    : undefined;

  // Reuniões — live for dynamic months, salesData for hardcoded
  const reunioesRealizadas = isHardcoded
    ? (currentSales?.funnel?.reunioes?.realizado || 0)
    : (live.leadsStats?.reunioesRealizadas ?? 0);
  const custoPorReuniao = reunioesRealizadas > 0
    ? investimentoView / reunioesRealizadas
    : 0;

  const prevSalesKey = previousData ? Object.keys(salesData).find(k => salesData[k] && previousData.month.toLowerCase().startsWith(k.substring(0, 3))) : null;
  const prevSales = prevSalesKey ? salesData[prevSalesKey] : null;
  const isHardcodedPrev = dynamicMonths.length > 1 && dynamicMonths[dynamicMonths.findIndex(m => m.key === selectedMonth) + 1]?.source === "hardcoded";
  const prevReunioes = isHardcodedPrev
    ? (prevSales?.funnel?.reunioes?.realizado || 0)
    : (live.leadsStatsPrev?.reunioesRealizadas ?? 0);
  const prevCustoPorReuniao = prevReunioes > 0 && (prevInvestimentoView ?? 0) > 0
    ? (prevInvestimentoView ?? 0) / prevReunioes
    : undefined;

  const conversaoReunioes = reunioesRealizadas > 0
    ? (effectiveVendas / reunioesRealizadas) * 100
    : 0;
  const prevConversaoReunioes = prevReunioes > 0
    ? (prevEffectiveVendas / prevReunioes) * 100
    : undefined;

  if (!selectedMonth) return null;

  return (
    <div className="min-h-screen bg-background">
      <main className="p-3 sm:p-4 lg:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-end gap-3 mb-8">
            {(activeTab === "marketing" || activeTab === "comercial") && !isHardcoded && (
              <CampaignSelector
                campaigns={live.campaigns}
                selected={live.selectedCampaigns}
                onChange={live.setSelectedCampaigns}
              />
            )}
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
          </div>

          {/* Marketing Tab */}
          {activeTab === "marketing" && (
            <>
              {/* Metricas principais */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <MetricCard title="Investimento" value={formatCurrency(investimentoView)} variation={getVariation(investimentoView, prevInvestimentoView)} invertColors delay={0} />
                <MetricCard title="Impressoes" value={formatNumber(impressoesView)} variation={getVariation(impressoesView, prevImpressoesView)} delay={50} />
                <MetricCard title={metricTooltips.ctr.label} value={formatPercent(ctrView)} variation={getVariation(ctrView, prevCtrView)} tooltip={metricTooltips.ctr.tooltip} delay={100} />
                <MetricCard title={metricTooltips.cpc.label} value={formatCurrency(cpcView)} variation={getVariation(cpcView, prevCpcView)} invertColors tooltip={metricTooltips.cpc.tooltip} delay={150} />
                <MetricCard title="Mensagens" value={formatNumber(effectiveMensagens)} variation={getVariation(effectiveMensagens, prevEffectiveMensagens)} delay={200} />
                <MetricCard title="Mensagens Efetivas" value={formatNumber(effectiveMensagensEfetivas)} variation={getVariation(effectiveMensagensEfetivas, prevEffectiveMensagensEfetivas)} delay={225} />
              </div>

              {/* Segunda linha de metricas */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <MetricCard title={metricTooltips.cpa.label} value={formatCurrency(cpaView)} variation={getVariation(cpaView, prevCpaView)} invertColors tooltip={metricTooltips.cpa.tooltip} delay={250} />
                <MetricCard title={metricTooltips.cpm.label} value={formatCurrency(cpmView)} variation={getVariation(cpmView, prevCpmView)} invertColors tooltip={metricTooltips.cpm.tooltip} delay={300} />
                <MetricCard title={metricTooltips.frequencia.label} value={formatPercent(currentData?.frequencia ?? 0)} variation={getVariation(currentData?.frequencia ?? 0, previousData?.frequencia)} tooltip={metricTooltips.frequencia.tooltip} delay={350} />
                <MetricCard title="Cliques" value={formatNumber(cliquesView)} delay={400} />
                <MetricCard title="Conversao Geral" value={formatPercent(conversaoGeral)} variation={getVariation(conversaoGeral, previousConversaoGeral)} delay={450} />
                <MetricCard title="Custo por Reuniao" value={custoPorReuniao > 0 ? formatCurrency(custoPorReuniao) : "N/A"} variation={getVariation(custoPorReuniao, prevCustoPorReuniao)} invertColors delay={500} />
                <MetricCard title="Conv. Reunioes" value={conversaoReunioes > 0 ? formatPercent(conversaoReunioes) : "N/A"} variation={getVariation(conversaoReunioes, prevConversaoReunioes)} delay={550} />
              </div>

              {/* Funil de trafego */}
              <TrafficFunnel
                impressoes={impressoesView}
                cliques={cliquesView}
                mensagens={effectiveMensagens}
                reunioes={reunioesRealizadas}
                vendas={effectiveVendas}
                investimento={investimentoView}
                faturamento={effectiveFaturamento}
              />
            </>
          )}

          {/* Comercial Tab */}
          {activeTab === "comercial" && (
            <>
              {isHardcoded ? (
                currentData && (
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
                )
              ) : (
                <div className="space-y-4 lg:space-y-6">
                  {/* Top KPIs (mesma fonte de dados do funil/marketing) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
                    <MetricCard title="Vendas" value={formatNumber(effectiveVendas)} variation={getVariation(effectiveVendas, prevEffectiveVendas)} delay={0} />
                    <MetricCard title="Faturamento" value={formatCurrency(effectiveFaturamento)} delay={50} />
                    <MetricCard title="Reuniões Realizadas" value={formatNumber(reunioesRealizadas)} variation={getVariation(reunioesRealizadas, prevReunioes)} delay={100} />
                    <MetricCard title="Mensagens" value={formatNumber(effectiveMensagens)} variation={getVariation(effectiveMensagens, prevEffectiveMensagens)} delay={150} />
                    <MetricCard title="Ticket Médio" value={effectiveVendas > 0 ? formatCurrency(effectiveFaturamento / effectiveVendas) : "—"} delay={200} />
                    <MetricCard title="Conv. Reuniões" value={conversaoReunioes > 0 ? formatPercent(conversaoReunioes) : "—"} variation={getVariation(conversaoReunioes, prevConversaoReunioes)} delay={250} />
                  </div>

                  {/* Farol por closer (pace + projeção por dias úteis) */}
                  <FarolCloserCards
                    porCloser={live.leadsStats?.porCloser ?? []}
                    metasCloser={live.metasCloser ?? []}
                    monthLabel={dynamicMonths.find(m => m.key === selectedMonth)?.label ?? ""}
                    selectedMonth={selectedMonthYYYYMM}
                    totalVendas={effectiveVendas}
                    totalFaturamento={effectiveFaturamento}
                    totalReunioesRealizadas={reunioesRealizadas}
                    investimento={investimentoView}
                  />

                  {/* Performance chart genérico */}
                  <PerformanceChart
                    investimento={investimentoView}
                    faturamento={effectiveFaturamento}
                  />
                </div>
              )}
            </>
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
