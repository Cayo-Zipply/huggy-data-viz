import { useEffect, useMemo, useState } from "react";
import { sbExt } from "@/lib/supabaseExternal";
import { formatBRL } from "./types";

const db = sbExt as any;

interface Faixa {
  label: string;
  min: number;
  max: number; // exclusive; Infinity for top
}

const FAIXAS: Faixa[] = [
  { label: "Até R$ 50k", min: 0, max: 50_000 },
  { label: "R$ 50k – 100k", min: 50_000, max: 100_000 },
  { label: "R$ 100k – 300k", min: 100_000, max: 300_000 },
  { label: "R$ 300k – 1M", min: 300_000, max: 1_000_000 },
  { label: "Acima de R$ 1M", min: 1_000_000, max: Infinity },
];

function monthOptions() {
  const opts = [{ value: "all", label: "Todos os períodos" }];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return opts;
}

export function FechamentosPorFaixaDivida() {
  const [mes, setMes] = useState<string>("all");
  const [faixaSel, setFaixaSel] = useState<string>("all");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const months = useMemo(() => monthOptions(), []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      let q = db
        .from("leads")
        .select("id,nome,empresa,closer,valor_divida,etapa_atual,data_reuniao_realizada,contrato_assinado_em,created_at")
        .or("etapa_atual.eq.Contrato Assinado,etapa_atual.eq.Ganho");
      if (mes !== "all") {
        const [y, m] = mes.split("-").map(Number);
        const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
        const end = new Date(Date.UTC(y, m, 1)).toISOString();
        q = q.gte("created_at", start).lt("created_at", end);
      }
      const { data, error } = await q;
      if (!mounted) return;
      if (error) { console.error("Erro fechamentos:", error); setRows([]); }
      else setRows(data || []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [mes]);

  const stats = FAIXAS.map((f) => {
    const items = rows.filter((r) => {
      const v = Number(r.valor_divida || 0);
      return v >= f.min && v < f.max;
    });
    const total = items.reduce((s, r) => s + Number(r.valor_divida || 0), 0);
    return { ...f, count: items.length, total, items };
  });

  const totalGeral = stats.reduce((s, x) => s + x.total, 0);
  const countGeral = stats.reduce((s, x) => s + x.count, 0);

  const visibleItems =
    faixaSel === "all"
      ? rows
      : stats.find((s) => s.label === faixaSel)?.items ?? [];

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Fechamentos por Valor da Dívida</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {countGeral} contratos · {formatBRL(totalGeral)} em dívida total
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="text-xs bg-background border border-border rounded px-2 py-1 text-foreground"
          >
            {months.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={faixaSel}
            onChange={(e) => setFaixaSel(e.target.value)}
            className="text-xs bg-background border border-border rounded px-2 py-1 text-foreground"
          >
            <option value="all">Todas as faixas</option>
            {FAIXAS.map((f) => <option key={f.label} value={f.label}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            {stats.map((s) => {
              const active = faixaSel === s.label;
              return (
                <button
                  key={s.label}
                  onClick={() => setFaixaSel(active ? "all" : s.label)}
                  className={`text-left rounded-md border p-2 transition ${active ? "border-primary bg-primary/5" : "border-border bg-background hover:border-muted-foreground/30"}`}
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">{s.count}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">{formatBRL(s.total)}</p>
                </button>
              );
            })}
          </div>

          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Lead</th>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Closer</th>
                  <th className="text-right px-2 py-1.5 font-medium text-muted-foreground">Dívida</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 ? (
                  <tr><td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">Nenhum fechamento nesta faixa.</td></tr>
                ) : visibleItems.slice(0, 50).map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-2 py-1.5 text-foreground truncate max-w-[200px]">{r.nome || "—"}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.closer || "—"}</td>
                    <td className="px-2 py-1.5 text-right text-foreground tabular-nums">{formatBRL(Number(r.valor_divida || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleItems.length > 50 && (
              <p className="text-[11px] text-muted-foreground text-center py-1.5 border-t border-border">
                Mostrando 50 de {visibleItems.length}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
