import { useEffect, useMemo, useState } from "react";
import { Phone, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList } from "recharts";
import { supabaseExt } from "@/lib/supabaseExternal";

interface Chamada {
  ipbox_user: string | null;
  resultado: string | null;
  iniciado_em: string | null;
}

interface Vendedor {
  nome: string;
}

interface Props {
  start: Date;
  end: Date;
  monthLabel: string;
}

function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rangeFromMonthKey(key: string): { start: Date; end: Date; label: string } {
  const [y, m] = key.split("-").map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  const label = start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return { start, end, label };
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyFromDate(d);
}

/**
 * Gráfico mostrando total de tentativas de ligação e ligações atendidas
 * por vendedor (ipbox_user) no período selecionado. Possui seletor de mês
 * próprio e lista TODOS os vendedores (SDR/Closer) — mesmo com 0 ligações.
 */
export function CallStatsChart({ start, end, monthLabel }: Props) {
  // Mês local do card (independente do dashboard). Inicia com o mês recebido.
  const [monthKey, setMonthKey] = useState<string>(() => monthKeyFromDate(start));
  const { start: rStart, end: rEnd, label: rLabel } = useMemo(
    () => rangeFromMonthKey(monthKey),
    [monthKey],
  );

  const [chamadas, setChamadas] = useState<Chamada[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(false);

  // Carrega lista de vendedores (SDR/Closer) uma única vez
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabaseExt as any)
        .from("user_profiles")
        .select("nome, role")
        .in("role", ["sdr", "closer", "admin"]);
      if (cancelled) return;
      if (error) {
        console.error("[CallStatsChart] erro vendedores:", error.message);
      } else {
        setVendedores((data || []).map((v: any) => ({ nome: v.nome })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabaseExt as any)
        .from("ipbox_chamadas")
        .select("ipbox_user, resultado, iniciado_em")
        .gte("iniciado_em", rStart.toISOString())
        .lte("iniciado_em", rEnd.toISOString())
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
  }, [rStart, rEnd]);

  const data = useMemo(() => {
    const map = new Map<string, { vendedor: string; tentativas: number; atendidas: number }>();
    // Pré-popula com todos os vendedores em 0
    for (const v of vendedores) {
      const key = (v.nome || "").trim();
      if (!key) continue;
      map.set(key, { vendedor: key, tentativas: 0, atendidas: 0 });
    }
    // Soma chamadas (case-insensitive primeiro nome match)
    const findKey = (raw: string): string => {
      const norm = raw.trim().toLowerCase();
      for (const k of map.keys()) {
        const kn = k.toLowerCase();
        if (kn === norm || kn.split(" ")[0] === norm.split(" ")[0]) return k;
      }
      return raw.trim();
    };
    for (const c of chamadas) {
      const raw = c.ipbox_user?.trim() || "—";
      const key = findKey(raw);
      const cur = map.get(key) || { vendedor: key, tentativas: 0, atendidas: 0 };
      cur.tentativas += 1;
      if (c.resultado === "ATENDIDO") cur.atendidas += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.tentativas - a.tentativas || a.vendedor.localeCompare(b.vendedor, "pt-BR"));
  }, [chamadas, vendedores]);

  const totalTent = data.reduce((s, d) => s + d.tentativas, 0);
  const totalAtend = data.reduce((s, d) => s + d.atendidas, 0);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Phone size={14} className="text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Ligações por Vendedor</h4>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMonthKey((k) => shiftMonth(k, -1))}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
              aria-label="Mês anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-medium min-w-[120px] text-center capitalize select-none">
              {rLabel}
            </span>
            <button
              onClick={() => setMonthKey((k) => shiftMonth(k, 1))}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
              aria-label="Próximo mês"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          {!loading && totalTent > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {totalTent} tentativa{totalTent === 1 ? "" : "s"} · {totalAtend} atendida{totalAtend === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-10">
          Nenhum vendedor cadastrado
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(data.length * 38, 200)}>
          <BarChart data={data} layout="vertical" margin={{ left: 110, right: 50, top: 10 }}>
            <XAxis type="number" tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="vendedor"
              tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
              width={105}
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
