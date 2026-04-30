import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabaseExt } from "@/lib/supabaseExternal";

/**
 * Live marketing data hook.
 *
 * - Meta Ads metrics come from `meta_ads_daily`, aggregated SUMs filtered by
 *   the selected campaigns (so the user can include/exclude campaigns).
 * - Commercial metrics (mensagens, reuniões, vendas, faturamento) are computed
 *   live from the `leads` table for the selected month.
 *
 * `selectedMonth` must be in `YYYY-MM` format (e.g. "2026-04").
 */

export interface Campaign {
  campaign_id: string;
  campaign_name: string;
}

export interface MetaStats {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
}

export interface CloserBreakdown {
  closer: string;
  vendas: number;
  faturamento: number;
  /** Reuniões realizadas (contadas por data_reuniao). */
  reunioes: number;
  /** Reuniões realizadas (mesmo valor de `reunioes`, alias semântico). */
  reunioesRealizadas: number;
  /** Reuniões marcadas (leads do mês com etapa avançada). */
  reunioesMarcadas: number;
  /** Ticket médio realizado no mês. */
  ticketMedioRealizado: number;
}

export interface MetaCloser {
  closer: string;
  mes: string;
  meta_reunioes_marcadas: number | null;
  meta_reunioes_realizadas: number | null;
  meta_faturamento: number | null;
  meta_conversao: number | null;
}

export interface LeadsStats {
  mensagens: number;
  reunioesAgendadas: number;
  reunioesRealizadas: number;
  vendas: number;
  faturamento: number;
  porCloser: CloserBreakdown[];
}

const REUNIAO_AGENDADA_STAGES = [
  "Reunião Marcada",
  "Reunião Agendada",
  "Reunião Realizada",
  "Realizada",
  "Proposta Enviada",
  "Link Enviado",
  "Contrato Assinado",
];

const REUNIAO_REALIZADA_STAGES = [
  "Reunião Realizada",
  "Realizada",
  "Proposta Enviada",
  "Link Enviado",
  "Contrato Assinado",
];

function monthRange(monthYYYYMM: string) {
  const [yStr, mStr] = monthYYYYMM.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const inicio = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const fim = new Date(Date.UTC(y, m, 0, 23, 59, 59));
  return {
    inicioIso: inicio.toISOString(),
    fimIso: fim.toISOString(),
    inicioDate: inicio.toISOString().split("T")[0],
    fimDate: fim.toISOString().split("T")[0],
  };
}

function previousMonth(monthYYYYMM: string): string {
  const [yStr, mStr] = monthYYYYMM.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function fetchCampaigns(monthYYYYMM: string): Promise<Campaign[]> {
  const { inicioDate, fimDate } = monthRange(monthYYYYMM);
  const { data, error } = await supabaseExt
    .from("meta_ads_daily")
    .select("campaign_id, campaign_name")
    .gte("date", inicioDate)
    .lte("date", fimDate);
  if (error) throw error;
  const unique = new Map<string, string>();
  (data ?? []).forEach((r: any) => {
    if (r.campaign_id) unique.set(r.campaign_id, r.campaign_name ?? r.campaign_id);
  });
  return Array.from(unique.entries())
    .map(([campaign_id, campaign_name]) => ({ campaign_id, campaign_name }))
    .sort((a, b) => a.campaign_name.localeCompare(b.campaign_name, "pt-BR"));
}

async function fetchMetaStats(
  monthYYYYMM: string,
  campaignIds: string[],
): Promise<MetaStats> {
  if (campaignIds.length === 0) {
    return { spend: 0, impressions: 0, clicks: 0, reach: 0 };
  }
  const { inicioDate, fimDate } = monthRange(monthYYYYMM);
  const { data, error } = await supabaseExt
    .from("meta_ads_daily")
    .select("spend, impressions, clicks, reach")
    .gte("date", inicioDate)
    .lte("date", fimDate)
    .in("campaign_id", campaignIds);
  if (error) throw error;
  const rows = data ?? [];
  return {
    spend: rows.reduce((s: number, r: any) => s + Number(r.spend ?? 0), 0),
    impressions: rows.reduce((s: number, r: any) => s + Number(r.impressions ?? 0), 0),
    clicks: rows.reduce((s: number, r: any) => s + Number(r.clicks ?? 0), 0),
    reach: rows.reduce((s: number, r: any) => s + Number(r.reach ?? 0), 0),
  };
}

async function fetchLeadsStats(monthYYYYMM: string): Promise<LeadsStats> {
  const { inicioIso, fimIso } = monthRange(monthYYYYMM);

  // mensagens = leads criados no mês
  const { count: mensagensCount } = await supabaseExt
    .from("leads")
    .select("*", { count: "exact", head: true })
    .gte("created_at", inicioIso)
    .lte("created_at", fimIso);

  // reuniões marcadas: leads criados no mês que chegaram pelo menos à etapa de reunião
  const { data: reunMarcadasRows } = await supabaseExt
    .from("leads")
    .select("etapa_atual, closer")
    .gte("created_at", inicioIso)
    .lte("created_at", fimIso);

  const reunMarcadasNorm = (reunMarcadasRows ?? []).filter((r: any) => {
    const e = String(r.etapa_atual ?? "").toLowerCase();
    return (
      e.includes("reuni") ||
      e.includes("proposta") ||
      e.includes("contrato") ||
      e.includes("link enviado") ||
      e.includes("no show")
    );
  });

  // reuniões realizadas: leads do mês cuja etapa atual é "Reunião Realizada",
  // "Link Enviado" ou que viraram venda (Contrato Assinado / ganho).
  // Usamos created_at do lead para limitar ao mês selecionado.
  const reunRealizadasRows = (reunMarcadasRows ?? []).filter((r: any) => {
    const e = String(r.etapa_atual ?? "").toLowerCase().trim();
    return (
      e.includes("reuni") && e.includes("realiz") ||
      e.includes("link enviado") ||
      e.includes("proposta") ||
      e.includes("contrato assinado") ||
      e === "ganho"
    );
  });

  // vendas e faturamento por data_venda no mês
  const { data: vendasRows } = await supabaseExt
    .from("leads")
    .select("valor_negocio, data_venda, closer")
    .eq("status", "ganho")
    .gte("data_venda", inicioIso)
    .lte("data_venda", fimIso);

  const vendas = vendasRows?.length ?? 0;
  const faturamento = (vendasRows ?? []).reduce(
    (s: number, l: any) => s + Number(l.valor_negocio ?? 0),
    0,
  );

  // Breakdown por closer
  const map = new Map<string, CloserBreakdown>();
  const ensure = (name: string) => {
    const key = (name || "Sem closer").trim() || "Sem closer";
    if (!map.has(key)) {
      map.set(key, {
        closer: key,
        vendas: 0,
        faturamento: 0,
        reunioes: 0,
        reunioesRealizadas: 0,
        reunioesMarcadas: 0,
        ticketMedioRealizado: 0,
      });
    }
    return map.get(key)!;
  };
  (reunRealizadasRows ?? []).forEach((r: any) => {
    const b = ensure(r.closer);
    b.reunioes += 1;
    b.reunioesRealizadas += 1;
  });
  reunMarcadasNorm.forEach((r: any) => {
    ensure(r.closer).reunioesMarcadas += 1;
  });
  (vendasRows ?? []).forEach((l: any) => {
    const b = ensure(l.closer);
    b.vendas += 1;
    b.faturamento += Number(l.valor_negocio ?? 0);
  });
  map.forEach((b) => {
    b.ticketMedioRealizado = b.vendas > 0 ? b.faturamento / b.vendas : 0;
  });
  const porCloser = Array.from(map.values())
    .filter((c) => c.closer !== "Sem closer")
    .sort((a, b) => b.faturamento - a.faturamento || b.vendas - a.vendas);

  return {
    mensagens: mensagensCount ?? 0,
    reunioesAgendadas: reunMarcadasNorm.length,
    reunioesRealizadas: reunRealizadasRows?.length ?? 0,
    vendas,
    faturamento,
    porCloser,
  };
}

export function useMarketingLive(selectedMonth: string) {
  const enabled = !!selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth);

  // 1. Campanhas disponíveis no mês selecionado
  const campaignsQuery = useQuery({
    queryKey: ["meta-campaigns", selectedMonth],
    queryFn: () => fetchCampaigns(selectedMonth),
    enabled,
    staleTime: 60_000,
  });

  // 2. Estado das campanhas selecionadas
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);

  // Sempre que o conjunto de campanhas disponíveis muda, seleciona TODAS por
  // padrão (incluindo quando o mês é trocado).
  const availableIdsKey = useMemo(
    () =>
      (campaignsQuery.data ?? [])
        .map((c) => c.campaign_id)
        .sort()
        .join(","),
    [campaignsQuery.data],
  );

  useEffect(() => {
    if (!campaignsQuery.data) return;
    setSelectedCampaigns(campaignsQuery.data.map((c) => c.campaign_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableIdsKey]);

  // 3. Meta Ads stats (mês atual + anterior, filtrado por campanhas)
  const prevMonth = enabled ? previousMonth(selectedMonth) : "";

  const metaQuery = useQuery({
    queryKey: ["meta-ads-stats", selectedMonth, selectedCampaigns],
    queryFn: () => fetchMetaStats(selectedMonth, selectedCampaigns),
    enabled: enabled && selectedCampaigns.length >= 0,
    staleTime: 60_000,
  });

  const metaPrevQuery = useQuery({
    queryKey: ["meta-ads-stats", prevMonth, selectedCampaigns],
    queryFn: () => fetchMetaStats(prevMonth, selectedCampaigns),
    enabled: enabled && !!prevMonth,
    staleTime: 60_000,
  });

  // 4. Leads stats (mês atual + anterior, sem filtro de campanha)
  const leadsQuery = useQuery({
    queryKey: ["marketing-leads-stats", selectedMonth],
    queryFn: () => fetchLeadsStats(selectedMonth),
    enabled,
    staleTime: 60_000,
  });

  const leadsPrevQuery = useQuery({
    queryKey: ["marketing-leads-stats", prevMonth],
    queryFn: () => fetchLeadsStats(prevMonth),
    enabled: enabled && !!prevMonth,
    staleTime: 60_000,
  });

  // 5. Metas dos closers para o mês selecionado
  const metasQuery = useQuery({
    queryKey: ["metas-closer", selectedMonth],
    queryFn: async (): Promise<MetaCloser[]> => {
      const { data, error } = await supabaseExt
        .from("metas")
        .select("closer, mes, meta_reunioes_marcadas, meta_reunioes_realizadas, meta_faturamento, meta_conversao")
        .eq("mes", selectedMonth);
      if (error) throw error;
      return (data ?? []) as MetaCloser[];
    },
    enabled,
    staleTime: 60_000,
  });

  return {
    campaigns: campaignsQuery.data ?? [],
    selectedCampaigns,
    setSelectedCampaigns,
    metaStats: metaQuery.data,
    metaStatsPrev: metaPrevQuery.data,
    leadsStats: leadsQuery.data,
    leadsStatsPrev: leadsPrevQuery.data,
    metasCloser: metasQuery.data ?? [],
    loading:
      campaignsQuery.isLoading ||
      metaQuery.isLoading ||
      leadsQuery.isLoading,
  };
}
