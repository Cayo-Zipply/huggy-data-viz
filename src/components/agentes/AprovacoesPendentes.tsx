import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type Venda = Record<string, any>;
type Pedido = Record<string, any>;

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (v?: string, hora = false) => {
  if (!v) return "—";
  const d = new Date(v.length === 10 ? v + "T12:00:00" : v);
  return isNaN(d.getTime()) ? v : d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", ...(hora ? { hour: "2-digit", minute: "2-digit" } : {}) });
};
const pick = (o: any, ...ks: string[]) => { for (const k of ks) if (o?.[k] != null && o[k] !== "") return o[k]; return undefined; };
const vendasDe = (p: Pedido): Venda[] => {
  const v = pick(p, "vendas", "itens", "leads");
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return []; } }
  return Array.isArray(v) ? v : [];
};
const valorVenda = (v: Venda) => Number(pick(v, "valor", "valor_venda", "deal_value", "faturamento")) || 0;
const totalDe = (p: Pedido) => Number(pick(p, "total", "valor_total")) || vendasDe(p).reduce((s, v) => s + valorVenda(v), 0);

export function AprovacoesPendentes() {
  const qc = useQueryClient();
  const { data: pedidos = [] } = useQuery({
    queryKey: ["ag_aprovacoes_pendentes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("ag_aprovacoes_pendentes");
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as Pedido[];
    },
  });
  const [acao, setAcao] = useState<{ p: Pedido; aprovar: boolean } | null>(null);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!pedidos.length) return null;

  const confirmar = async () => {
    if (!acao) return;
    setEnviando(true);
    const args: any = { p_aprovacao_id: pick(acao.p, "id", "aprovacao_id"), p_aprovar: acao.aprovar };
    if (!acao.aprovar && obs.trim()) args.p_observacao = obs.trim();
    const { data, error } = await (supabase as any).rpc("ag_decidir_retirada", args);
    setEnviando(false);
    if (error) toast.error(error.message || "Não foi possível concluir.");
    else {
      const msg = typeof data === "string" ? data : pick(data, "mensagem", "message", "resultado");
      toast.success(msg || (acao.aprovar ? "Pedido aprovado e executado." : "Pedido recusado."));
    }
    setAcao(null); setObs("");
    qc.invalidateQueries({ queryKey: ["ag_aprovacoes_pendentes"] });
  };

  const n = acao ? vendasDe(acao.p).length : 0;

  return (
    <div className="mb-8 border border-amber-500/40 bg-amber-500/5 rounded-md p-4">
      <h2 className="font-hud uppercase tracking-wider text-amber-500 text-lg mb-3">Aprovações pendentes ({pedidos.length})</h2>
      <div className="space-y-4">
        {pedidos.map((p, i) => (
          <div key={pick(p, "id", "aprovacao_id") ?? i} className="border border-border rounded p-3 bg-card/50">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span><b>{pick(p, "solicitante_nome", "solicitado_por_nome", "solicitado_por", "solicitante", "pedido_por") ?? "—"}</b> · <span className="text-muted-foreground">{dt(pick(p, "criado_em", "created_at", "solicitado_em"), true)}</span></span>
              <span className="font-semibold tabular-nums">Total: {brl(totalDe(p))}</span>
            </div>
            {pick(p, "motivo") && <p className="text-sm text-muted-foreground mt-1">Motivo: {p.motivo}</p>}
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-xs">
                <thead><tr className="text-muted-foreground text-left"><th className="py-1">Empresa</th><th>Closer</th><th className="text-right">Valor</th><th className="text-right">Data da venda</th></tr></thead>
                <tbody>
                  {vendasDe(p).map((v, j) => (
                    <tr key={j} className="border-t border-border/50">
                      <td className="py-1">{pick(v, "empresa", "nome", "lead_nome") ?? "—"}</td>
                      <td>{pick(v, "closer", "owner") ?? "—"}</td>
                      <td className="text-right tabular-nums">{brl(valorVenda(v))}</td>
                      <td className="text-right">{dt(pick(v, "data_venda"))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end mt-3">
              <Button size="sm" variant="outline" onClick={() => { setObs(""); setAcao({ p, aprovar: false }); }}>Recusar</Button>
              <Button size="sm" onClick={() => setAcao({ p, aprovar: true })}>Aprovar e executar</Button>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!acao} onOpenChange={(o) => !o && !enviando && setAcao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{acao?.aprovar ? "Aprovar pedido" : "Recusar pedido"}</AlertDialogTitle>
            <AlertDialogDescription>
              {acao?.aprovar
                ? `Isso retira ${n} venda(s) (${brl(totalDe(acao.p))}) do faturamento. Confirmar?`
                : "Adicione uma observação (opcional)."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {acao && !acao.aprovar && <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação" />}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={enviando} onClick={(e) => { e.preventDefault(); confirmar(); }}>
              {enviando ? "Enviando…" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
