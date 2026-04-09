import { useState, useEffect, useMemo } from "react";
import { supabaseExt } from "@/lib/supabaseExternal";
import { marketingData as hardcodedData, type MonthData } from "@/data/marketingData";

interface MetaAdsRow {
  id: string;
  month: string; // e.g. "2025-01-01"
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

function monthKeyFromDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const m = d.getMonth(); // 0-based
  const names = ["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${names[m]}_${d.getFullYear()}`;
}

function monthLabelFromDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const monthNum = d.getMonth() + 1;
  return `${MONTH_NAMES_PT[monthNum]} ${d.getFullYear()}`;
}

/** Check if a lead reached "reunião marcada" stage or beyond */
function isReuniaoMarcada(card: PipelineCard): boolean {
  // SDR stage reuniao_marcada or any closer stage means meeting was scheduled
  if (card.sdr_stage === "reuniao_marcada") return true;
  if (card.pipe === "closer" && card.closer_stage) return true;
  return false;
}

/** Check if a lead had a meeting realized */
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

  return {
    mensagens,
    mensagensEfetivas: mensagens,
    reunioesMarcadas,
    reunioesRealizadas,
    vendas,
    faturamento,
    ticketMedio,
  };
}

function rowToMonthData(row: MetaAdsRow, leadMetrics: LeadMetrics): MonthData {
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

export interface MonthOption {
  key: string;
  label: string;
  raw: string; // original date string YYYY-MM-DD
}

export function useMarketingData() {
  const [rows, setRows] = useState<MetaAdsRow[]>([]);
  const [allCards, setAllCards] = useState<PipelineCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [useDynamic, setUseDynamic] = useState(false);

  useEffect(() => {
    (async () => {
      // Fetch meta ads and pipeline cards in parallel
      const [adsRes, cardsRes] = await Promise.all([
        supabaseExt
          .from("meta_ads_monthly")
          .select("*")
          .order("month", { ascending: false }),
        supabaseExt
          .from("pipeline_cards")
          .select("id, created_at, lead_status, deal_value, sdr_stage, closer_stage, pipe"),
      ]);

      if (!adsRes.error && adsRes.data && adsRes.data.length > 0) {
        setRows(adsRes.data as MetaAdsRow[]);
        setUseDynamic(true);
      }
      if (!cardsRes.error && cardsRes.data) {
        setAllCards(cardsRes.data as PipelineCard[]);
      }
      setLoading(false);
    })();
  }, []);

  // Group cards by month (based on created_at)
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

  const months = useMemo<MonthOption[]>(() => {
    if (useDynamic) {
      return rows.map(r => ({
        key: monthKeyFromDate(r.month),
        label: monthLabelFromDate(r.month),
        raw: r.month,
      }));
    }
    return Object.entries(hardcodedData).map(([key, d]) => ({
      key,
      label: `${d.month} ${d.year}`,
      raw: key,
    }));
  }, [rows, useDynamic]);

  const defaultMonth = months.length > 0 ? months[0].key : "fevereiro";

  const getLeadMetricsForMonth = (rawDate: string): LeadMetrics => {
    const d = new Date(rawDate + "T00:00:00");
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const cards = cardsByMonth[key] || [];
    return computeLeadMetrics(cards);
  };

  const getMonthData = (key: string): MonthData | null => {
    if (useDynamic) {
      const row = rows.find(r => monthKeyFromDate(r.month) === key);
      const monthOpt = months.find(m => m.key === key);
      const rawDate = row?.month || monthOpt?.raw || "";
      const leadMetrics = rawDate ? getLeadMetricsForMonth(rawDate) : computeLeadMetrics([]);
      if (row) return rowToMonthData(row, leadMetrics);
      // No ads data but might have leads — return with zeroed ads
      if (rawDate) {
        const d = new Date(rawDate + "T00:00:00");
        return {
          month: MONTH_NAMES_PT[d.getMonth() + 1],
          year: d.getFullYear(),
          investimento: 0, impressoes: 0, ctr: 0, cpc: 0, cpm: 0,
          mensagens: leadMetrics.mensagens,
          mensagensEfetivas: leadMetrics.mensagensEfetivas,
          cpa: 0, frequencia: 0,
          vendas: leadMetrics.vendas,
          faturamento: leadMetrics.faturamento,
        };
      }
      return null;
    }
    return hardcodedData[key] || null;
  };

  const getLeadMetrics = (key: string): LeadMetrics => {
    if (useDynamic) {
      const row = rows.find(r => monthKeyFromDate(r.month) === key);
      const rawDate = row?.month || "";
      if (rawDate) return getLeadMetricsForMonth(rawDate);
    }
    return { mensagens: 0, mensagensEfetivas: 0, reunioesMarcadas: 0, reunioesRealizadas: 0, vendas: 0, faturamento: 0, ticketMedio: 0 };
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

  return { months, defaultMonth, getMonthData, getPreviousMonthData, getLeadMetrics, getPreviousLeadMetrics, loading, useDynamic };
}
