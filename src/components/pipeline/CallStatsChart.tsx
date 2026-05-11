import { useEffect, useMemo, useState } from "react";
import { Phone, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList } from "recharts";
import { supabaseExt } from "@/lib/supabaseExternal";

interface Chamada {
  ipbox_user: string | null;
  resultado: string | null;
  iniciado_em: string | null;
}

interface Props {
  start: Date;
  end: Date;
  monthLabel: string;
}

/**
 * Gráfico mostrando total de tentativas de ligação e ligações atendidas
 * por vendedor (ipbox_user) no período selecionado.
 */
export function CallStatsChart({ start, end, monthLabel }: Props) {
  const [chamadas, setChamadas] = useState<Chamada[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabaseExt as any)
        .from("ipbox_chamadas")
        .select("ipbox_user, resultado, iniciado_em")
        .gte("iniciado_em", start.toISOString())
        .lte("iniciado_em", end.toISOString())
        .limit(10000);
      if (!cancelled) {
        if (error) {
          console.error("[CallStatsChart] erro:", error.message);
          setChamadas([]);
        } else {
          setChamadas((data as Chamada[]) || []);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [start, end]);

  const data = useMemo(() => {
    const map = new Map<string, { vendedor: string; tentativas: number; atendidas: number }>();
    for (const c of chamadas) {
      const key = c.ipbox_user?.trim() || "—";
      const cur = map.get(key) || { vendedor: key, tentativas: 0, atendidas: 0 };
      cur.tentativas += 1;
      if (c.resultado === "ATENDIDO") cur.atendidas += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.tentativas - a.tentativas);
  }, [chamadas]);

  const totalTent = data.reduce((s, d) => s + d.tentativas, 0);
  const totalAtend = data.reduce((s, d) => s + d.atendidas, 0);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Phone size={14} className="text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Ligações por Vendedor</h4>
          <span className="text-[10px] text-muted-foreground">· {monthLabel}</span>
        </div>
        {!loading && totalTent > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {totalTent} tentativa{totalTent === 1 ? "" : "s"} · {totalAtend} atendida{totalAtend === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-10">
          Nenhuma ligação registrada no período
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(data.length * 44, 180)}>
          <BarChart data={data} layout="vertical" margin={{ left: 90, right: 50, top: 10 }}>
            <XAxis type="number" tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="vendedor"
              tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
              width={85}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(222,47%,9%)",
                border: "1px solid hsl(222,47%,16%)",
                borderRadius: 8,
                fontSize: 12,
                color: "hsl(210,40%,98%)",
              }}
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="tentativas" name="Tentativas" fill="hsl(207,90%,54%)" radius={[0, 4, 4, 0]}>
              <LabelList
                dataKey="tentativas"
                position="right"
                style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
            <Bar dataKey="atendidas" name="Atendidas" fill="hsl(142,76%,40%)" radius={[0, 4, 4, 0]}>
              <LabelList
                dataKey="atendidas"
                position="right"
                style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
