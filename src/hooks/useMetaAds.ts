import { useState, useEffect, useMemo } from "react";
import { sbExt } from "@/lib/supabaseExternal";

export interface MetaAdsRow {
  date: string;
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  conversion_value: number;
  roas: number;
  frequency: number;
  objective: string;
}

export interface MetaAdsKPIs {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  roas: number;
  cpm: number;
  frequency: number;
  reach: number;
}

export interface CampaignSummary {
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  roas: number;
}

function calcKPIs(rows: MetaAdsRow[]): MetaAdsKPIs {
  if (!rows.length) return { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, conversions: 0, roas: 0, cpm: 0, frequency: 0, reach: 0 };
  const spend = rows.reduce((s, r) => s + Number(r.spend || 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions || 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks || 0), 0);
  const conversions = rows.reduce((s, r) => s + Number(r.conversions || 0), 0);
  const reach = rows.reduce((s, r) => s + Number(r.reach || 0), 0);
  const conversion_value = rows.reduce((s, r) => s + Number(r.conversion_value || 0), 0);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const roas = spend > 0 ? conversion_value / spend : 0;
  const frequency = reach > 0 ? impressions / reach : 0;
  return { spend, impressions, clicks, ctr, cpc, conversions, roas, cpm, frequency, reach };
}

function calcVariation(current: number, previous: number): number | undefined {
  if (!previous) return undefined;
  return ((current - previous) / previous) * 100;
}

function getMonthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function getPrevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

export function useMetaAds(year: number, month: number) {
  const [rows, setRows] = useState<MetaAdsRow[]>([]);
  const [prevRows, setPrevRows] = useState<MetaAdsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { from, to } = getMonthRange(year, month);
      const prev = getPrevMonth(year, month);
      const { from: pFrom, to: pTo } = getMonthRange(prev.year, prev.month);

      const [cur, prv] = await Promise.all([
        sbExt.from("meta_ads_daily").select("*").gte("date", from).lte("date", to),
        sbExt.from("meta_ads_daily").select("*").gte("date", pFrom).lte("date", pTo),
      ]);

      if (!cancelled) {
        setRows((cur.data as MetaAdsRow[]) || []);
        setPrevRows((prv.data as MetaAdsRow[]) || []);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [year, month]);

  const kpis = useMemo(() => calcKPIs(rows), [rows]);
  const prevKpis = useMemo(() => calcKPIs(prevRows), [prevRows]);

  const variations = useMemo(() => ({
    spend: calcVariation(kpis.spend, prevKpis.spend),
    impressions: calcVariation(kpis.impressions, prevKpis.impressions),
    clicks: calcVariation(kpis.clicks, prevKpis.clicks),
    ctr: calcVariation(kpis.ctr, prevKpis.ctr),
    cpc: calcVariation(kpis.cpc, prevKpis.cpc),
    conversions: calcVariation(kpis.conversions, prevKpis.conversions),
    roas: calcVariation(kpis.roas, prevKpis.roas),
  }), [kpis, prevKpis]);

  // Daily aggregation for line charts
  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; spend: number; ctr: number; impressions: number; clicks: number }>();
    rows.forEach((r) => {
      const existing = map.get(r.date) || { date: r.date, spend: 0, ctr: 0, impressions: 0, clicks: 0 };
      existing.spend += Number(r.spend || 0);
      existing.impressions += Number(r.impressions || 0);
      existing.clicks += Number(r.clicks || 0);
      map.set(r.date, existing);
    });
    return Array.from(map.values())
      .map((d) => ({ ...d, ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  // Campaign aggregation
  const campaigns = useMemo((): CampaignSummary[] => {
    const map = new Map<string, CampaignSummary>();
    rows.forEach((r) => {
      const name = r.campaign_name || "Sem nome";
      const existing = map.get(name) || { campaign_name: name, spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, conversions: 0, roas: 0 };
      existing.spend += Number(r.spend || 0);
      existing.impressions += Number(r.impressions || 0);
      existing.clicks += Number(r.clicks || 0);
      existing.conversions += Number(r.conversions || 0);
      map.set(name, existing);
    });
    return Array.from(map.values()).map((c) => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
      roas: c.spend > 0 ? 0 : 0, // needs conversion_value per campaign
    })).sort((a, b) => b.spend - a.spend);
  }, [rows]);

  // Fix roas per campaign
  const campaignsWithRoas = useMemo((): CampaignSummary[] => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const name = r.campaign_name || "Sem nome";
      map.set(name, (map.get(name) || 0) + Number(r.conversion_value || 0));
    });
    return campaigns.map((c) => ({
      ...c,
      roas: c.spend > 0 ? (map.get(c.campaign_name) || 0) / c.spend : 0,
    }));
  }, [campaigns, rows]);

  return { rows, loading, kpis, prevKpis, variations, dailyData, campaigns: campaignsWithRoas };
}
