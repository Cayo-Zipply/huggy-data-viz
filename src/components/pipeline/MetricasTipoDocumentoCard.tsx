import { useEffect, useMemo, useState } from "react";
import { sbExt } from "@/lib/supabaseExternal";
import { formatBRL } from "./types";

interface MetricaDoc {
  tipo_documento: string;
  total_leads: number;
  em_aberto: number;
  ganhos: number;
  perdidos: number;
  taxa_conversao_pct: number;
  ticket_medio_ganho: number;
  receita_total: number;
}

const db = sbExt as any;

function getMonthOptions(): { value: string; label: string }[] {
  const opts = [{ value: "all", label: "Panorama geral" }];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return opts;
}

function aggregate(rows: any[]): MetricaDoc[] {
  const buckets: Record<string, MetricaDoc> = {
    cnpj: { tipo_documento: "cnpj", total_leads: 0, em_aberto: 0, ganhos: 0, perdidos: 0, taxa_conversao_pct: 0, ticket_medio_ganho: 0, receita_total: 0 },
    cpf: { tipo_documento: "cpf", total_leads: 0, em_aberto: 0, ganhos: 0, perdidos: 0, taxa_conversao_pct: 0, ticket_medio_ganho: 0, receita_total: 0 },
    nao_preenchido: { tipo_documento: "nao_preenchido", total_leads: 0, em_aberto: 0, ganhos: 0, perdidos: 0, taxa_conversao_pct: 0, ticket_medio_ganho: 0, receita_total: 0 },
  };
  const ticketAcc: Record<string, { sum: number; count: number }> = {
    cnpj: { sum: 0, count: 0 }, cpf: { sum: 0, count: 0 }, nao_preenchido: { sum: 0, count: 0 },
  };
  for (const r of rows) {
    const tipo = (r.tipo_documento || "nao_preenchido") as string;
    const key = tipo === "cnpj" || tipo === "cpf" ? tipo : "nao_preenchido";
    const b = buckets[key];
    b.total_leads++;
    const etapa = (r.etapa_atual || "").toLowerCase();
    const isGanho = etapa.includes("contrato assinado") || etapa.includes("ganho");
    const isPerdido = etapa.includes("perdido");
    if (isGanho) {
      b.ganhos++;
      const v = Number(r.valor_divida || 0);
      b.receita_total += v;
      if (v > 0) { ticketAcc[key].sum += v; ticketAcc[key].count++; }
    } else if (isPerdido) {
      b.perdidos++;
    } else {
      b.em_aberto++;
    }
  }
  for (const k of Object.keys(buckets)) {
    const b = buckets[k];
    b.taxa_conversao_pct = b.total_leads > 0 ? Math.round((b.ganhos / b.total_leads) * 1000) / 10 : 0;
    b.ticket_medio_ganho = ticketAcc[k].count > 0 ? ticketAcc[k].sum / ticketAcc[k].count : 0;
  }
  return Object.values(buckets);
}

export function MetricasTipoDocumentoCard() {
  const [mes, setMes] = useState<string>("all");
  const [metricas, setMetricas] = useState<MetricaDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const monthOptions = useMemo(() => getMonthOptions(), []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      if (mes === "all") {
        const { data, error } = await db.from("vw_metricas_tipo_documento").select("*");
        if (!mounted) return;
        if (error) console.error("Erro métricas tipo_documento:", error);
        else setMetricas(data || []);
      } else {
        const [y, m] = mes.split("-").map(Number);
        const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
        const end = new Date(Date.UTC(y, m, 1)).toISOString();
        const { data, error } = await db
          .from("leads")
          .select("tipo_documento,etapa_atual,valor_divida,created_at")
          .gte("created_at", start)
          .lt("created_at", end);
        if (!mounted) return;
        if (error) {
          console.error("Erro leads p/ doc:", error);
          setMetricas([]);
        } else {
          setMetricas(aggregate(data || []));
        }
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [mes]);

  const cnpj = metricas.find((m) => m.tipo_documento === "cnpj");
  const cpf = metricas.find((m) => m.tipo_documento === "cpf");
  const sem = metricas.find((m) => m.tipo_documento === "nao_preenchido");
  const cnpjConv = Number(cnpj?.taxa_conversao_pct ?? 0);
  const cpfConv = Number(cpf?.taxa_conversao_pct ?? 0);

  const insight =
    cnpjConv > cpfConv
      ? `Leads com CNPJ convertem ${cnpjConv}% vs ${cpfConv}% do CPF. Considere investir mais em campanhas B2B.`
      : cpfConv > cnpjConv
      ? `Leads com CPF convertem ${cpfConv}% vs ${cnpjConv}% do CNPJ. PF está performando melhor.`
      : `Conversão equilibrada entre CPF e CNPJ.`;

  const Tile = ({ label, accent, total, ganhos, perdidos, conv, ticket, receita }: any) => (
    <div className="relative bg-card rounded-lg border border-border p-3 overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${accent}`} />
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider pl-1">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1 tabular-nums pl-1">{total}</p>
      <p className="text-[11px] text-muted-foreground pl-1">{ganhos} ganhos · {perdidos} perdidos</p>
      <div className="mt-2 pl-1 space-y-0.5 text-[11px]">
        <p className="text-muted-foreground">Conversão: <span className="text-foreground font-semibold tabular-nums">{conv}%</span></p>
        <p className="text-muted-foreground">Ticket: <span className="text-foreground font-medium tabular-nums">{formatBRL(ticket)}</span></p>
        {receita !== undefined && <p className="text-muted-foreground">Receita: <span className="text-foreground font-semibold tabular-nums">{formatBRL(receita)}</span></p>}
      </div>
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Leads por Tipo de Documento</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {mes === "all" ? "Panorama geral (todos os períodos)" : "Filtrado pelo mês selecionado"}
          </p>
        </div>
        <select
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="text-xs bg-background border border-border rounded px-2 py-1 text-foreground"
        >
          {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Tile label="CNPJ (Empresa)" accent="bg-blue-600" total={cnpj?.total_leads ?? 0} ganhos={cnpj?.ganhos ?? 0} perdidos={cnpj?.perdidos ?? 0} conv={cnpjConv} ticket={Number(cnpj?.ticket_medio_ganho ?? 0)} receita={Number(cnpj?.receita_total ?? 0)} />
            <Tile label="CPF (Pessoa Física)" accent="bg-violet-600" total={cpf?.total_leads ?? 0} ganhos={cpf?.ganhos ?? 0} perdidos={cpf?.perdidos ?? 0} conv={cpfConv} ticket={Number(cpf?.ticket_medio_ganho ?? 0)} receita={Number(cpf?.receita_total ?? 0)} />
            <Tile label="Sem documento" accent="bg-slate-400 dark:bg-slate-600" total={sem?.total_leads ?? 0} ganhos={sem?.ganhos ?? 0} perdidos={sem?.perdidos ?? 0} conv={Number(sem?.taxa_conversao_pct ?? 0)} ticket={Number(sem?.ticket_medio_ganho ?? 0)} />
          </div>
          <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border">
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1">Insight</p>
            <p className="text-xs text-foreground leading-relaxed">{insight}</p>
          </div>
        </>
      )}
    </div>
  );
}
