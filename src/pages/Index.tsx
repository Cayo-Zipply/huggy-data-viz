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
import { FunilCriativo } from "@/components/FunilCriativo";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const location = useLocation();
  const activeTab = location.pathname.replace("/", "") || "pipeline";
  const { profile } = useAuth();
  const pipelineName = profile?.nome ?? "Admin";
  const { cards, goals, upsertGoal, refresh } = usePipelineData(pipelineName);
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

  // Overrides manuais para métricas comerciais (vendas, faturamento, reuniões)
  const overrideAtual = selectedMonthYYYYMM ? overridesMap[selectedMonthYYYYMM] : null;
  const prevMonthYYYYMM = useMemo(() => {
    if (!selectedMonthYYYYMM) return "";
    const [y, m] = selectedMonthYYYYMM.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }, [selectedMonthYYYYMM]);
  const overridePrev = prevMonthYYYYMM ? overridesMap[prevMonthYYYYMM] : null;

  // Mensagens/Vendas: hardcoded uses currentData (which has static values),
  // dynamic uses live counts from `leads`
  let effectiveMensagens = isHardcoded ? (currentData?.mensagens || 0) : (live.leadsStats?.mensagens ?? 0);
  let effectiveMensagensEfetivas = isHardcoded ? (currentData?.mensagensEfetivas || 0) : (live.leadsStats?.mensagens ?? 0);
  let effectiveVendas = isHardcoded
    ? (currentData?.vendas || 0)
    : (overrideAtual?.manual_vendas ?? live.leadsStats?.vendas ?? 0);
  let effectiveFaturamento = isHardcoded
    ? (currentData?.faturamento || 0)
    : (overrideAtual?.manual_faturamento ?? live.leadsStats?.faturamento ?? 0);
  let reunioesRealizadas = isHardcoded
    ? (currentSales?.funnel?.reunioes?.realizado || 0)
    : (overrideAtual?.manual_reunioes ?? live.leadsStats?.reunioesRealizadas ?? 0);
  let reunioesMarcadas: number | undefined = isHardcoded
    ? undefined
    : (live.leadsStats?.reunioesAgendadas ?? 0);

  // Snapshot congelado de meses encerrados (farol_snapshot_mensal).
  // Se o mês selecionado é diferente do mês corrente e há snapshot,
  // sobrescreve os números do funil/cards e as taxas são recalculadas.
  const currentYYYYMM = useMemo(
    () => new Date().toISOString().slice(0, 7),
    []
  );
  const [snapshot, setSnapshot] = useState<any>(null);
  useEffect(() => {
    setSnapshot(null);
    if (!selectedMonthYYYYMM || selectedMonthYYYYMM === currentYYYYMM) return;
    let cancelled = false;
    supabase
      .from("farol_snapshot_mensal" as any)
      .select("*")
      .eq("mes", selectedMonthYYYYMM)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setSnapshot(data);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMonthYYYYMM, currentYYYYMM]);

  if (snapshot) {
    effectiveVendas = Number(snapshot.vendas) || 0;
    effectiveFaturamento = Number(snapshot.faturamento) || 0;
    effectiveMensagens = Number(snapshot.mensagens) || 0;
    effectiveMensagensEfetivas = Number(snapshot.mensagens) || 0;
    reunioesRealizadas = Number(snapshot.reunioes_realizadas) || 0;
    reunioesMarcadas = Number(snapshot.reunioes_marcadas) || 0;
  }

  // Faturamento / Vendas — espelho exato do Farol: soma da RPC
  // `farol_metricas_time` (mesma fonte usada em FarolPanel). Garante que
  // o card Faturamento do Marketing bate 1:1 com o Farol.
  const [farolTimeRows, setFarolTimeRows] = useState<any[] | null>(null);
  useEffect(() => {
    setFarolTimeRows(null);
    if (!selectedMonthYYYYMM || isHardcoded) return;
    let cancelled = false;
    (supabase as any)
      .rpc("farol_metricas_time", { p_mes: selectedMonthYYYYMM })
      .then(({ data, error }: any) => {
        if (cancelled) return;
        if (!error && Array.isArray(data)) setFarolTimeRows(data);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMonthYYYYMM, isHardcoded]);

  if (!snapshot && farolTimeRows && !isHardcoded && overrideAtual?.manual_faturamento == null) {
    effectiveFaturamento = farolTimeRows.reduce(
      (s, r: any) => s + Number(r.faturamento || 0),
      0,
    );
  }
  if (!snapshot && farolTimeRows && !isHardcoded && overrideAtual?.manual_vendas == null) {
    effectiveVendas = farolTimeRows.reduce(
      (s, r: any) => s + Number(r.contratos || 0),
      0,
    );
  }


  // Fonte oficial de reuniões (marcadas/realizadas) no funil de Marketing:
  // RPC `farol_metricas_sdr` (mesma usada na aba SDR). Evita duplicação de
  // cards espelho SDR/Closer e usa data_reuniao em fuso America/Sao_Paulo.
  // Snapshot de meses encerrados tem precedência.
  const [sdrReunioes, setSdrReunioes] = useState<{ marcadas: number; realizadas: number } | null>(null);
  useEffect(() => {
    setSdrReunioes(null);
    if (!selectedMonthYYYYMM || isHardcoded) return;
    let cancelled = false;
    (supabase as any)
      .rpc("farol_metricas_sdr", { p_mes: selectedMonthYYYYMM })
      .then(({ data, error }: any) => {
        if (cancelled || error || !Array.isArray(data)) return;
        const marcadas = data.reduce((s: number, r: any) => s + Number(r.reunioes_marcadas ?? 0), 0);
        const realizadas = data.reduce((s: number, r: any) => s + Number(r.reunioes_realizadas ?? 0), 0);
        setSdrReunioes({ marcadas, realizadas });
      });
    return () => { cancelled = true; };
  }, [selectedMonthYYYYMM, isHardcoded]);

  if (!snapshot && sdrReunioes && !isHardcoded) {
    reunioesMarcadas = sdrReunioes.marcadas;
    reunioesRealizadas = sdrReunioes.realizadas;
  }


  const prevEffectiveMensagens = isHardcoded
    ? (previousData?.mensagens || 0)
    : (live.leadsStatsPrev?.mensagens ?? 0);
  const prevEffectiveMensagensEfetivas = isHardcoded
    ? (previousData?.mensagensEfetivas || 0)
    : (live.leadsStatsPrev?.mensagens ?? 0);
  const prevEffectiveVendas = isHardcoded
    ? (previousData?.vendas || 0)
    : (overridePrev?.manual_vendas ?? live.leadsStatsPrev?.vendas ?? 0);

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

  const custoPorReuniao = reunioesRealizadas > 0
    ? investimentoView / reunioesRealizadas
    : 0;

  const prevSalesKey = previousData ? Object.keys(salesData).find(k => salesData[k] && previousData.month.toLowerCase().startsWith(k.substring(0, 3))) : null;
  const prevSales = prevSalesKey ? salesData[prevSalesKey] : null;
  const isHardcodedPrev = dynamicMonths.length > 1 && dynamicMonths[dynamicMonths.findIndex(m => m.key === selectedMonth) + 1]?.source === "hardcoded";
  const prevReunioes = isHardcodedPrev
    ? (prevSales?.funnel?.reunioes?.realizado || 0)
    : (overridePrev?.manual_reunioes ?? live.leadsStatsPrev?.reunioesRealizadas ?? 0);
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

          {/* Dashboard Tab (Marketing + Comercial unificados) — kept mounted */}
          <div className={activeTab === "marketing" || activeTab === "comercial" ? "" : "hidden"}>
            <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4">Marketing</h2>
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
              reunioesMarcadas={reunioesMarcadas}
              reunioes={reunioesRealizadas}
              vendas={effectiveVendas}
              investimento={investimentoView}
              faturamento={effectiveFaturamento}
            />

            {/* ===== Bloco Comercial ===== */}
            <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-border">
              <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4">Comercial</h2>
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
                  <MetricCard title="Reuniões Realizadas" value={formatNumber(reunioesRealizadas)} variation={getVariation(reunioesRealizadas, prevReunioes)} tooltip="Conta leads em Reunião Realizada, Link Enviado ou Contrato Assinado, pela data da última mudança de etapa. Fonte única usada em Marketing, Farol e Pipeline." delay={100} />
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
            </div>

            {/* ===== Funil por Criativo ===== */}
            <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-border">
              <FunilCriativo />
            </div>
          </div>


          {/* Rentabilidade Tab — kept mounted */}
          <div className={activeTab === "rentabilidade" ? "" : "hidden"}>
            <RevenuePanel />
          </div>

          {/* Comparativo Tab — kept mounted */}
          <div className={activeTab === "comparativo" ? "" : "hidden"}>
            <ComparisonPanel />
          </div>

          {/* Consolidado Tab — kept mounted */}
          <div className={activeTab === "consolidado" ? "" : "hidden"}>
            <ConsolidatedPanel />
          </div>

          {/* Pipeline Tab — kept mounted to preserve state */}
          <div className={activeTab === "pipeline" ? "" : "hidden"}>
            <PipelinePanel />
          </div>

          {/* Farol Tab — kept mounted to preserve state and avoid reload flicker */}
          <div className={activeTab === "farol" ? "" : "hidden"}>
            <FarolPanel cards={cards} goals={goals} owners={pipelineOwners} onSaveGoal={upsertGoal} onRefresh={refresh} />
          </div>

          {/* Ajuda Tab — kept mounted */}
          <div className={activeTab === "ajuda" ? "" : "hidden"}>
            <HelpPanel />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
