import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/data/marketingData";

interface FunilCriativoRow {
  criativo: string;
  leads: number;
  fez_contato: number;
  conectado: number;
  sql: number;
  reuniao_agendada: number;
  reuniao_realizada: number;
  link_enviado: number;
  contrato_assinado: number;
}

const STAGES: { key: keyof Omit<FunilCriativoRow, "criativo">; label: string }[] = [
  { key: "leads", label: "Leads" },
  { key: "fez_contato", label: "Fez Contato" },
  { key: "conectado", label: "Conectado" },
  { key: "sql", label: "SQL" },
  { key: "reuniao_agendada", label: "Reunião Agendada" },
  { key: "reuniao_realizada", label: "Reunião Realizada" },
  { key: "link_enviado", label: "Link Enviado" },
  { key: "contrato_assinado", label: "Contrato Assinado" },
];

const SEM_ATRIBUICAO = "(sem atribuição de anúncio)";

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const fmtPct = (v: number) => `${v.toFixed(v >= 10 ? 0 : 1).replace(".", ",")}%`;

type SortKey = "criativo" | "leads" | "contrato_assinado" | "conv";

export const FunilCriativo = () => {
  const [rows, setRows] = useState<FunilCriativoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("__all__");
  const [sortKey, setSortKey] = useState<SortKey>("leads");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (supabase as any)
      .rpc("fn_funil_criativo")
      .then(({ data }: any) => {
        if (cancelled) return;
        setRows(Array.isArray(data) ? (data as FunilCriativoRow[]) : []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "criativo") {
        av = a.criativo ?? "";
        bv = b.criativo ?? "";
        return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      }
      if (sortKey === "conv") {
        av = pct(a.contrato_assinado, a.leads);
        bv = pct(b.contrato_assinado, b.leads);
      } else {
        av = Number(a[sortKey] ?? 0);
        bv = Number(b[sortKey] ?? 0);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [rows, sortKey, sortAsc]);

  const totals = useMemo(() => {
    const t: any = { criativo: "Todos os criativos" };
    for (const s of STAGES) t[s.key] = rows.reduce((sum, r) => sum + Number(r[s.key] ?? 0), 0);
    return t as FunilCriativoRow;
  }, [rows]);

  const active: FunilCriativoRow | null = useMemo(() => {
    if (selected === "__all__") return totals;
    return rows.find(r => r.criativo === selected) ?? null;
  }, [selected, rows, totals]);

  const funnel = useMemo(() => {
    if (!active) return [];
    const topo = Number(active.leads ?? 0);
    return STAGES.map((s, i) => {
      const value = Number(active[s.key] ?? 0);
      const prev = i === 0 ? value : Number(active[STAGES[i - 1].key] ?? 0);
      return {
        label: s.label,
        value,
        pctTopo: pct(value, topo),
        pctStep: i === 0 ? 100 : pct(value, prev),
      };
    });
  }, [active]);

  // Maior gargalo: menor taxa step-to-step (ignora a primeira etapa)
  const gargaloIdx = useMemo(() => {
    let idx = -1;
    let worst = Infinity;
    funnel.forEach((f, i) => {
      if (i === 0) return;
      if (f.pctStep < worst) {
        worst = f.pctStep;
        idx = i;
      }
    });
    return idx;
  }, [funnel]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "criativo");
    }
  };

  const Th = ({ k, label, align = "right" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <th
      className={`px-2 py-2 text-${align} font-medium cursor-pointer select-none hover:text-foreground`}
      onClick={() => toggleSort(k)}
    >
      {label}
      {sortKey === k && <span className="ml-1 text-[10px]">{sortAsc ? "▲" : "▼"}</span>}
    </th>
  );

  return (
    <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Funil por Criativo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Este mês · atribuição via Tintim</p>
        </div>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground max-w-[280px]"
        >
          <option value="__all__">Todos os criativos</option>
          {sorted.map(r => (
            <option key={r.criativo} value={r.criativo}>
              {r.criativo === SEM_ATRIBUICAO ? "Sem atribuição de anúncio" : r.criativo}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados de criativo nos últimos 30 dias.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lista de criativos */}
          <div className="overflow-auto max-h-[420px] border border-border rounded-md">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-muted-foreground text-xs">
                <tr>
                  <Th k="criativo" label="Criativo" align="left" />
                  <Th k="leads" label="Leads" />
                  <Th k="contrato_assinado" label="Contratos" />
                  <Th k="conv" label="Conv." />
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => {
                  const isSel = selected === r.criativo;
                  const neutro = r.criativo === SEM_ATRIBUICAO;
                  return (
                    <tr
                      key={r.criativo}
                      onClick={() => setSelected(isSel ? "__all__" : r.criativo)}
                      className={`border-t border-border cursor-pointer hover:bg-muted/40 ${isSel ? "bg-muted/60" : ""}`}
                    >
                      <td className={`px-2 py-2 max-w-[220px] truncate ${neutro ? "text-muted-foreground italic" : "text-foreground"}`}>
                        {neutro ? "Sem atribuição de anúncio" : r.criativo}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatNumber(Number(r.leads ?? 0))}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatNumber(Number(r.contrato_assinado ?? 0))}</td>
                      <td className="px-2 py-2 text-right tabular-nums font-semibold">
                        {fmtPct(pct(Number(r.contrato_assinado ?? 0), Number(r.leads ?? 0)))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Funil do criativo selecionado */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 truncate">
              {selected === "__all__"
                ? "Todos os criativos"
                : selected === SEM_ATRIBUICAO
                  ? "Sem atribuição de anúncio"
                  : selected}
            </p>
            <div className="space-y-1.5">
              {funnel.map((f, i) => {
                const isGargalo = i === gargaloIdx;
                const width = Math.max(f.pctTopo, 6);
                return (
                  <div key={f.label} className="flex items-center gap-2">
                    <span className="w-[132px] shrink-0 text-[11px] text-muted-foreground text-right">{f.label}</span>
                    <div className="flex-1 min-w-0">
                      <div
                        className="h-8 rounded-sm flex items-center justify-between px-2"
                        style={{
                          width: `${width}%`,
                          minWidth: 74,
                          backgroundColor: isGargalo ? "hsl(0, 72%, 45%)" : "hsl(145, 60%, 35%)",
                        }}
                      >
                        <span className="text-xs font-bold text-white tabular-nums">{formatNumber(f.value)}</span>
                        <span className="text-[10px] text-white/80 tabular-nums">{fmtPct(f.pctTopo)}</span>
                      </div>
                    </div>
                    <span
                      className={`w-[64px] shrink-0 text-[11px] text-right tabular-nums ${isGargalo ? "text-destructive font-semibold" : "text-muted-foreground"}`}
                    >
                      {i === 0 ? "—" : fmtPct(f.pctStep)}
                    </span>
                  </div>
                );
              })}
            </div>
            {gargaloIdx > 0 && (
              <p className="text-[11px] text-muted-foreground mt-3">
                Maior gargalo: <span className="text-destructive font-semibold">{funnel[gargaloIdx].label}</span>{" "}
                ({fmtPct(funnel[gargaloIdx].pctStep)} da etapa anterior). Coluna à direita = conversão etapa a etapa.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
