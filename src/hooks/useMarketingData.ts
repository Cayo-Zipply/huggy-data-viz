import { useState, useEffect, useMemo } from "react";
import { supabaseExt } from "@/lib/supabaseExternal";
import { marketingData as hardcodedData, type MonthData } from "@/data/marketingData";

interface MetaAdsRow {
  id: string;
  month: string;
  total_spend: number;
  total_impressions: number;
  avg_ctr: number;
  avg_cpc: number;
  avg_cpm: number;
  total_clicks: number;
  total_conversions: number;
}

interface PipelineCard {
  id: string;
  created_at: string;
  lead_status: string | null;
  deal_value: number | null;
  sdr_stage: string | null;
  closer_stage: string | null;
  pipe: string;
}

export interface LeadMetrics {
  mensagens: number;
  mensagensEfetivas: number;
  reunioesMarcadas: number;
  reunioesRealizadas: number;
  vendas: number;
  faturamento: number;
  ticketMedio: number;
}

const MONTH_NAMES_PT: Record<number, string> = {
  1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
  5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
  9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro",
};

// Hardcoded data covers up to this date (inclusive). Anything after uses Supabase.
const HARDCODED_CUTOFF = new Date("2025-03-01T00:00:00");

function monthKeyFromDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const m = d.getMonth();
  const names = ["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${names[m]}_${d.getFullYear()}`;
}

function monthLabelFromDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${MONTH_NAMES_PT[d.getMonth() + 1]} ${d.getFullYear()}`;
}

function isReuniaoMarcada(card: PipelineCard): boolean {
  if (card.sdr_stage === "reuniao_marcada") return true;
  if (card.pipe === "closer" && card.closer_stage) return true;
  return false;
}

function isReuniaoRealizada(card: PipelineCard): boolean {
  if (card.lead_status === "ganho") return true;
  if (card.closer_stage && ["reuniao_realizada", "no_show", "link_enviado", "contrato_assinado"].includes(card.closer_stage)) return true;
  return false;
}

function computeLeadMetrics(cards: PipelineCard[]): LeadMetrics {
  const mensagens = cards.length;
  const reunioesMarcadas = cards.filter(isReuniaoMarcada).length;
  const reunioesRealizadas = cards.filter(isReuniaoRealizada).length;
  const ganhos = cards.filter(c => c.lead_status === "ganho");
  const vendas = ganhos.length;
  const faturamento = ganhos.reduce((sum, c) => sum + (c.deal_value || 0), 0);
  const ticketMedio = vendas > 0 ? faturamento / vendas : 0;
  return { mensagens, mensagensEfetivas: mensagens, reunioesMarcadas, reunioesRealizadas, vendas, faturamento, ticketMedio };
}

const EMPTY_LEAD_METRICS: LeadMetrics = { mensagens: 0, mensagensEfetivas: 0, reunioesMarcadas: 0, reunioesRealizadas: 0, vendas: 0, faturamento: 0, ticketMedio: 0 };

export interface MonthOption {
  key: string;
  label: string;
  raw: string;
  source: "hardcoded" | "dynamic";
}

export function useMarketingData() {
  const [rows, setRows] = useState<MetaAdsRow[]>([]);
  const [allCards, setAllCards] = useState<PipelineCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [adsRes, cardsRes] = await Promise.all([
        supabaseExt.from("meta_ads_monthly").select("*").order("month", { ascending: false }),
        supabaseExt.from("pipeline_cards").select("id, created_at, lead_status, deal_value, sdr_stage, closer_stage, pipe"),
      ]);
      if (!adsRes.error && adsRes.data) setRows(adsRes.data as MetaAdsRow[]);
      if (!cardsRes.error && cardsRes.data) setAllCards(cardsRes.data as PipelineCard[]);
      setLoading(false);
    })();
  }, []);

  const cardsByMonth = useMemo(() => {
    const map: Record<string, PipelineCard[]> = {};
    for (const card of allCards) {
      const d = new Date(card.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = [];
      map[key].push(card);
    }
    return map;
  }, [allCards]);

  // Only dynamic rows from March 2025 onwards
  const dynamicRows = useMemo(() => rows.filter(r => new Date(r.month + "T00:00:00") >= HARDCODED_CUTOFF), [rows]);

  const months = useMemo<MonthOption[]>(() => {
    // Dynamic months (Mar 2025+) from Supabase
    const dynamic: MonthOption[] = dynamicRows.map(r => ({
      key: monthKeyFromDate(r.month),
      label: monthLabelFromDate(r.month),
      raw: r.month,
      source: "dynamic" as const,
    }));

    // Hardcoded months (Sep 2024 – Feb 2025)
    const hardcoded: MonthOption[] = Object.entries(hardcodedData).map(([key, d]) => ({
      key,
      label: `${d.month} ${d.year}`,
      raw: key,
      source: "hardcoded" as const,
    }));

    // Dynamic first (newest), then hardcoded (already ordered newest first)
    return [...dynamic, ...hardcoded];
  }, [dynamicRows]);

  const defaultMonth = months.length > 0 ? months[0].key : "fevereiro";

  const getLeadMetricsForRawDate = (rawDate: string): LeadMetrics => {
    const d = new Date(rawDate + "T00:00:00");
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return computeLeadMetrics(cardsByMonth[key] || []);
  };

  const getMonthData = (key: string): MonthData | null => {
    const opt = months.find(m => m.key === key);
    if (!opt) return null;

    // Hardcoded months — return original static data as-is
    if (opt.source === "hardcoded") {
      return hardcodedData[key] || null;
    }

    // Dynamic months — combine Meta Ads + pipeline leads
    const row = dynamicRows.find(r => monthKeyFromDate(r.month) === key);
    const leadMetrics = getLeadMetricsForRawDate(opt.raw);

    if (row) {
      const d = new Date(row.month + "T00:00:00");
      const cpa = leadMetrics.mensagens > 0 ? row.total_spend / leadMetrics.mensagens : 0;
      return {
        month: MONTH_NAMES_PT[d.getMonth() + 1],
        year: d.getFullYear(),
        investimento: row.total_spend,
        impressoes: row.total_impressions,
        ctr: row.avg_ctr,
        cpc: row.avg_cpc,
        cpm: row.avg_cpm,
        mensagens: leadMetrics.mensagens,
        mensagensEfetivas: leadMetrics.mensagensEfetivas,
        cpa,
        frequencia: 0,
        vendas: leadMetrics.vendas,
        faturamento: leadMetrics.faturamento,
      };
    }
    return null;
  };

  const getLeadMetrics = (key: string): LeadMetrics => {
    const opt = months.find(m => m.key === key);
    if (!opt) return EMPTY_LEAD_METRICS;
    if (opt.source === "hardcoded") return EMPTY_LEAD_METRICS;
    return getLeadMetricsForRawDate(opt.raw);
  };

  const getPreviousMonthData = (key: string): MonthData | null => {
    const idx = months.findIndex(m => m.key === key);
    if (idx < 0 || idx >= months.length - 1) return null;
    return getMonthData(months[idx + 1].key);
  };

  const getPreviousLeadMetrics = (key: string): LeadMetrics | null => {
    const idx = months.findIndex(m => m.key === key);
    if (idx < 0 || idx >= months.length - 1) return null;
    return getLeadMetrics(months[idx + 1].key);
  };

  return { months, defaultMonth, getMonthData, getPreviousMonthData, getLeadMetrics, getPreviousLeadMetrics, loading };
}
