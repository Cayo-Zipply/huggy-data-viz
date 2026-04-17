import { useEffect, useState } from "react";
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

export function MetricasTipoDocumentoCard() {
  const [metricas, setMetricas] = useState<MetricaDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await db
        .from("vw_metricas_tipo_documento")
        .select("*");
      if (!mounted) return;
      if (error) {
        console.error("Erro ao carregar métricas tipo_documento:", error);
      } else {
        setMetricas(data || []);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs text-muted-foreground">Carregando métricas por documento...</p>
      </div>
    );
  }

  const cnpj = metricas.find((m) => m.tipo_documento === "cnpj");
  const cpf = metricas.find((m) => m.tipo_documento === "cpf");
  const sem = metricas.find((m) => m.tipo_documento === "nao_preenchido");

  const cnpjConv = Number(cnpj?.taxa_conversao_pct ?? 0);
  const cpfConv = Number(cpf?.taxa_conversao_pct ?? 0);

  const insight =
    cnpjConv > cpfConv
      ? `Leads com CNPJ convertem ${cnpjConv}% vs ${cpfConv}% do CPF. Considere investir mais em campanhas B2B (empresas com dívida tributária).`
      : cpfConv > cnpjConv
      ? `Leads com CPF convertem ${cpfConv}% vs ${cnpjConv}% do CNPJ. Campanhas focadas em pessoa física estão performando melhor.`
      : `Conversão equilibrada entre CPF e CNPJ. Diversifique investimento de campanha.`;

  const Tile = ({
    label,
    accent,
    total,
    ganhos,
    perdidos,
    conv,
    ticket,
    receita,
  }: {
    label: string;
    accent: string;
    total: number;
    ganhos: number;
    perdidos: number;
    conv: number;
    ticket: number;
    receita?: number;
  }) => (
    <div className="relative bg-card rounded-lg border border-border p-3 overflow-hidden shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
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
    <div className="bg-card border border-border rounded-lg p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-foreground">Leads por Tipo de Documento</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          Comparativo CPF (pessoa física) vs CNPJ (empresa) para otimização de campanhas
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile label="CNPJ (Empresa)" accent="bg-blue-600" total={cnpj?.total_leads ?? 0} ganhos={cnpj?.ganhos ?? 0} perdidos={cnpj?.perdidos ?? 0} conv={cnpjConv} ticket={Number(cnpj?.ticket_medio_ganho ?? 0)} receita={Number(cnpj?.receita_total ?? 0)} />
        <Tile label="CPF (Pessoa Física)" accent="bg-violet-600" total={cpf?.total_leads ?? 0} ganhos={cpf?.ganhos ?? 0} perdidos={cpf?.perdidos ?? 0} conv={cpfConv} ticket={Number(cpf?.ticket_medio_ganho ?? 0)} receita={Number(cpf?.receita_total ?? 0)} />
        <Tile label="Sem documento" accent="bg-slate-400 dark:bg-slate-600" total={sem?.total_leads ?? 0} ganhos={sem?.ganhos ?? 0} perdidos={sem?.perdidos ?? 0} conv={Number(sem?.taxa_conversao_pct ?? 0)} ticket={Number(sem?.ticket_medio_ganho ?? 0)} />
      </div>

      {/* Insight para marketing */}
      <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border">
        <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1">Insight para marketing</p>
        <p className="text-xs text-foreground leading-relaxed">{insight}</p>
        {(sem?.total_leads ?? 0) > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {sem?.total_leads} leads sem documento preenchido — incentive o time a cadastrar CPF/CNPJ para dados mais precisos.
          </p>
        )}
      </div>
    </div>
  );
}
