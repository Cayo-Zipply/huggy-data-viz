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

interface ExternalLead {
  id: string;
  data_entrada: string | null;
  status: string | null;
  etapa_atual: string | null;
  valor_negocio: number | null;
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

const REUNIOES_STAGES = [
  "Reunião Marcada", "Reunião Agendada", "Reunião Realizada",
  "No Show", "Link Enviado", "Contrato Assinado",
];

function isReuniaoMarcada(etapa: string | null): boolean {
  if (!etapa) return false;
  return REUNIOES_STAGES.some(k => etapa.includes(k.split(" ")[0]));
}

function isReuniaoRealizada(lead: ExternalLead): boolean {
  if (lead.status === "ganho") return true;
  const etapa = lead.etapa_atual;
  if (!etapa) return false;
  const realizadaKeywords = ["Realizada", "No Show", "Link Enviado", "Contrato Assinado"];
  return realizadaKeywords.some(k => etapa.includes(k.split(" ")[0]));
}

function computeLeadMetrics(leads: ExternalLead[]): LeadMetrics {
  const mensagens = leads.length;
  const reunioesMarcadas = leads.filter(l => isReuniaoMarcada(l.etapa_atual)).length;
  const reunioesRealizadas = leads.filter(l => isReuniaoRealizada(l)).length;
  const ganhos = leads.filter(l => l.status === "ganho");
  const vendas = ganhos.length;
  const faturamento = ganhos.reduce((sum, l) => sum + (Number(l.valor_negocio) || 0), 0);
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

export interface MarketingOverrideData {
  manual_mensagens?: number | null;
  manual_reunioes?: number | null;
  manual_vendas?: number | null;
  manual_faturamento?: number | null;
  manual_impressoes?: number | null;
  manual_cliques?: number | null;
  manual_investimento?: number | null;
  manual_ctr?: number | null;
  manual_cpc?: number | null;
  manual_cpm?: number | null;
}

export function useMarketingData(overrides?: Record<string, MarketingOverrideData>) {
  const [rows, setRows] = useState<MetaAdsRow[]>([]);
  const [allLeads, setAllLeads] = useState<ExternalLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [adsRes, leadsRes] = await Promise.all([
        supabaseExt.from("meta_ads_monthly").select("*").order("month", { ascending: false }),
        supabaseExt.from("leads").select("id, data_entrada, status, etapa_atual, valor_negocio"),
      ]);
      if (!adsRes.error && adsRes.data) setRows(adsRes.data as MetaAdsRow[]);
      if (!leadsRes.error && leadsRes.data) setAllLeads(leadsRes.data as ExternalLead[]);
      setLoading(false);
    })();
  }, []);

  const leadsByMonth = useMemo(() => {
    const map: Record<string, ExternalLead[]> = {};
    for (const lead of allLeads) {
      if (!lead.data_entrada) continue;
      const prefix = lead.data_entrada.slice(0, 7);
      if (!map[prefix]) map[prefix] = [];
      map[prefix].push(lead);
    }
    return map;
  }, [allLeads]);

  const dynamicRows = useMemo(() => rows.filter(r => new Date(r.month + "T00:00:00") >= HARDCODED_CUTOFF), [rows]);

  const months = useMemo<MonthOption[]>(() => {
    const dynamic: MonthOption[] = dynamicRows.map(r => ({
      key: monthKeyFromDate(r.month),
      label: monthLabelFromDate(r.month),
      raw: r.month,
      source: "dynamic" as const,
    }));

    const hardcoded: MonthOption[] = Object.entries(hardcodedData).map(([key, d]) => ({
      key,
      label: `${d.month} ${d.year}`,
      raw: key,
      source: "hardcoded" as const,
    }));

    return [...dynamic, ...hardcoded];
  }, [dynamicRows]);

  const defaultMonth = months.length > 0 ? months[0].key : "fevereiro";

  const getLeadMetricsForMonth = (monthStr: string): LeadMetrics => {
    const prefix = monthStr.slice(0, 7);
    return computeLeadMetrics(leadsByMonth[prefix] || []);
  };

  const getOverrideForMonth = (rawMonth: string): MarketingOverrideData | undefined => {
    if (!overrides) return undefined;
    // Try exact match first (e.g. "2026-04-01"), then prefix match
    return overrides[rawMonth] || overrides[rawMonth.slice(0, 7)];
  };

  const getLeadMetrics = (key: string): LeadMetrics => {
    const opt = months.find(m => m.key === key);
    if (!opt) return EMPTY_LEAD_METRICS;
    if (opt.source === "hardcoded") return EMPTY_LEAD_METRICS;

    const computed = getLeadMetricsForMonth(opt.raw);
    const ov = getOverrideForMonth(opt.raw);

    const mensagens = ov?.manual_mensagens ?? computed.mensagens;
    const reunioesRealizadas = ov?.manual_reunioes ?? computed.reunioesRealizadas;
    const vendas = ov?.manual_vendas ?? computed.vendas;
    const faturamento = ov?.manual_faturamento != null ? Number(ov.manual_faturamento) : computed.faturamento;
    const ticketMedio = vendas > 0 ? faturamento / vendas : 0;

    return {
      mensagens,
      mensagensEfetivas: mensagens,
      reunioesMarcadas: computed.reunioesMarcadas,
      reunioesRealizadas,
      vendas,
      faturamento,
      ticketMedio,
    };
  };

  const getMonthData = (key: string): MonthData | null => {
    const opt = months.find(m => m.key === key);
    if (!opt) return null;

    if (opt.source === "hardcoded") {
      return hardcodedData[key] || null;
    }

    const row = dynamicRows.find(r => monthKeyFromDate(r.month) === key);
    const leadMetrics = getLeadMetrics(key);
    const ov = getOverrideForMonth(opt.raw);

    if (row) {
      const d = new Date(row.month + "T00:00:00");
      const investimento = ov?.manual_investimento != null ? Number(ov.manual_investimento) : row.total_spend;
      const impressoes = ov?.manual_impressoes ?? row.total_impressions;
      const ctr = ov?.manual_ctr != null ? Number(ov.manual_ctr) : row.avg_ctr;
      const cpc = ov?.manual_cpc != null ? Number(ov.manual_cpc) : row.avg_cpc;
      const cpm = ov?.manual_cpm != null ? Number(ov.manual_cpm) : row.avg_cpm;
      const cpa = leadMetrics.mensagens > 0 ? investimento / leadMetrics.mensagens : 0;

      return {
        month: MONTH_NAMES_PT[d.getMonth() + 1],
        year: d.getFullYear(),
        investimento,
        impressoes,
        ctr,
        cpc,
        cpm,
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
