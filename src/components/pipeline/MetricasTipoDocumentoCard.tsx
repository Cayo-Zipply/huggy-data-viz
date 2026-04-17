import { useEffect, useState } from "react";
import { Building2, User, Users } from "lucide-react";
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

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-foreground">Leads por Tipo de Documento</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          Comparativo CPF (pessoa física) vs CNPJ (empresa) para otimização de campanhas
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* CNPJ */}
        <div className="bg-muted/20 rounded-lg p-3 border border-blue-500/30">
          <div className="flex items-center gap-1.5 text-xs text-blue-500 font-medium">
            <Building2 size={12} /> CNPJ (Empresa)
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">{cnpj?.total_leads ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">
            {cnpj?.ganhos ?? 0} ganhos · {cnpj?.perdidos ?? 0} perdidos
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Conversão: <span className="text-foreground font-medium">{cnpjConv}%</span>
          </p>
          <p className="text-[10px] text-muted-foreground">
            Ticket: <span className="text-foreground">{formatBRL(Number(cnpj?.ticket_medio_ganho ?? 0))}</span>
          </p>
          <p className="text-xs text-emerald-400 font-medium mt-1">
            {formatBRL(Number(cnpj?.receita_total ?? 0))}
          </p>
        </div>

        {/* CPF */}
        <div className="bg-muted/20 rounded-lg p-3 border border-violet-500/30">
          <div className="flex items-center gap-1.5 text-xs text-violet-500 font-medium">
            <User size={12} /> CPF (Pessoa Física)
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">{cpf?.total_leads ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">
            {cpf?.ganhos ?? 0} ganhos · {cpf?.perdidos ?? 0} perdidos
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Conversão: <span className="text-foreground font-medium">{cpfConv}%</span>
          </p>
          <p className="text-[10px] text-muted-foreground">
            Ticket: <span className="text-foreground">{formatBRL(Number(cpf?.ticket_medio_ganho ?? 0))}</span>
          </p>
          <p className="text-xs text-emerald-400 font-medium mt-1">
            {formatBRL(Number(cpf?.receita_total ?? 0))}
          </p>
        </div>

        {/* Sem documento */}
        <div className="bg-muted/20 rounded-lg p-3 border border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Users size={12} /> Sem documento
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">{sem?.total_leads ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">
            {sem?.ganhos ?? 0} ganhos · {sem?.perdidos ?? 0} perdidos
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Conversão: <span className="text-foreground font-medium">{Number(sem?.taxa_conversao_pct ?? 0)}%</span>
          </p>
          <p className="text-[10px] text-muted-foreground">
            Ticket: <span className="text-foreground">{formatBRL(Number(sem?.ticket_medio_ganho ?? 0))}</span>
          </p>
        </div>
      </div>

      {/* Insight para marketing */}
      <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-xs font-semibold text-primary mb-1">📊 Insight para marketing</p>
        <p className="text-xs text-foreground">{insight}</p>
        {(sem?.total_leads ?? 0) > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {sem?.total_leads} leads sem documento preenchido — incentive o time a cadastrar CPF/CNPJ para dados mais precisos.
          </p>
        )}
      </div>
    </div>
  );
}
