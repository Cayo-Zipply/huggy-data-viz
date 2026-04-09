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

function rowToMonthData(row: MetaAdsRow): MonthData {
  const d = new Date(row.month + "T00:00:00");
  const cpa = row.total_conversions > 0 ? row.total_spend / row.total_conversions : 0;
  return {
    month: MONTH_NAMES_PT[d.getMonth() + 1],
    year: d.getFullYear(),
    investimento: row.total_spend,
    impressoes: row.total_impressions,
    ctr: row.avg_ctr,
    cpc: row.avg_cpc,
    cpm: row.avg_cpm,
    mensagens: row.total_conversions,
    mensagensEfetivas: row.total_conversions,
    cpa,
    frequencia: 0,
    vendas: 0, // calculated from leads
    faturamento: 0, // calculated from leads
  };
}

export interface MonthOption {
  key: string;
  label: string;
  raw: string; // original date string
}

export function useMarketingData() {
  const [rows, setRows] = useState<MetaAdsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [useDynamic, setUseDynamic] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabaseExt
        .from("meta_ads_monthly")
        .select("*")
        .order("month", { ascending: false });

      if (!error && data && data.length > 0) {
        setRows(data as MetaAdsRow[]);
        setUseDynamic(true);
      }
      setLoading(false);
    })();
  }, []);

  const months = useMemo<MonthOption[]>(() => {
    if (useDynamic) {
      return rows.map(r => ({
        key: monthKeyFromDate(r.month),
        label: monthLabelFromDate(r.month),
        raw: r.month,
      }));
    }
    // fallback to hardcoded
    return Object.entries(hardcodedData).map(([key, d]) => ({
      key,
      label: `${d.month} ${d.year}`,
      raw: key,
    }));
  }, [rows, useDynamic]);

  const defaultMonth = months.length > 0 ? months[0].key : "fevereiro";

  const getMonthData = (key: string): MonthData | null => {
    if (useDynamic) {
      const row = rows.find(r => monthKeyFromDate(r.month) === key);
      return row ? rowToMonthData(row) : null;
    }
    return hardcodedData[key] || null;
  };

  const getPreviousMonthData = (key: string): MonthData | null => {
    const idx = months.findIndex(m => m.key === key);
    if (idx < 0 || idx >= months.length - 1) return null;
    return getMonthData(months[idx + 1].key);
  };

  return { months, defaultMonth, getMonthData, getPreviousMonthData, loading, useDynamic };
}
