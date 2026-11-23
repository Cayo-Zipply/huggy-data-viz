import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
import { Skeleton } from "@/components/ui/skeleton";

const brl = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const PAGINA = 1000;

async function todasAsPaginas<T>(montar: (de: number, ate: number) => PromiseLike<{ data: any; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await montar(de, de + PAGINA - 1);
    if (error) throw error;
    const linhas = (data ?? []) as T[];
    out.push(...linhas);
    if (linhas.length < PAGINA) break;
  }
  return out;
}

type Linha = { ad_name: string; gasto: number; leads: number; reunioes: number; contratos: number };

export function FunilPorCriativo() {
  const inicio = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 29); return iso(d); }, []);

  const q = useQuery({
    queryKey: ["funil-por-criativo-30d", inicio],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Linha[]> => {
      const gastos = await todasAsPaginas<{ ad_name: string | null; spend: number | string | null }>((de, ate) =>
        supabase.from("meta_ads_ad_daily" as any).select("ad_name, spend").gte("date", inicio).order("date").range(de, ate));
      const porAd = new Map<string, Linha>();
      for (const g of gastos) {
        const nome = (g.ad_name ?? "").trim();
        if (!nome) continue;
        const l = porAd.get(nome) ?? { ad_name: nome, gasto: 0, leads: 0, reunioes: 0, contratos: 0 };
        l.gasto += Number(g.spend ?? 0) || 0;
        porAd.set(nome, l);
      }
      const nomes = [...porAd.keys()].filter((k) => porAd.get(k)!.gasto > 0);
      // Leads por ad_name (em blocos para não estourar a URL).
      for (let i = 0; i < nomes.length; i += 40) {
        const bloco = nomes.slice(i, i + 40);
        const leads = await todasAsPaginas<{ ad_name: string; data_reuniao_realizada: string | null; contrato_assinado_em: string | null }>((de, ate) =>
          supabase.from("leads").select("id, ad_name, data_reuniao_realizada, contrato_assinado_em").in("ad_name", bloco).order("id").range(de, ate));
        for (const ld of leads) {
          const l = porAd.get(String(ld.ad_name ?? "").trim());
          if (!l) continue;
          l.leads += 1;
          if (ld.data_reuniao_realizada) l.reunioes += 1;
          if (ld.contrato_assinado_em) l.contratos += 1;
        }
      }
      return nomes.map((k) => porAd.get(k)!).sort((a, b) => b.gasto - a.gasto);
    },
  });

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Funil por criativo</h2>
        <p className="text-xs text-muted-foreground">Anúncios com gasto nos últimos 30 dias</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 font-medium">Anúncio</th>
              <th className="px-4 py-2 font-medium text-right">Gasto</th>
              <th className="px-4 py-2 font-medium text-right">Leads</th>
              <th className="px-4 py-2 font-medium text-right">Reuniões realizadas</th>
              <th className="px-4 py-2 font-medium text-right">Contratos</th>
              <th className="px-4 py-2 font-medium text-right">Custo/lead</th>
              <th className="px-4 py-2 font-medium text-right">Custo/reunião</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border tabular-nums">
            {q.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-4 py-2"><Skeleton className="h-5 w-full" /></td></tr>)
            ) : q.isError ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Não foi possível carregar o funil.</td></tr>
            ) : (q.data ?? []).length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Nenhum anúncio com gasto nos últimos 30 dias.</td></tr>
            ) : (
              q.data!.map((l) => (
                <tr key={l.ad_name}>
                  <td className="px-4 py-2 max-w-[320px] truncate" title={l.ad_name}>{l.ad_name}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">{brl(l.gasto)}</td>
                  <td className="px-4 py-2 text-right">{l.leads.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2 text-right">{l.reunioes.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2 text-right">{l.contratos.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">{brl(l.leads ? l.gasto / l.leads : null)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">{brl(l.reunioes ? l.gasto / l.reunioes : null)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-3 border-t border-border text-[11px] text-muted-foreground">Atribuição parcial: parte dos leads entra sem anúncio identificado</p>
    </section>
  );
}
