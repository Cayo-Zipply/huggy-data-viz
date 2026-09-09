import { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  fmtData,
  fmtDataHora,
  usePendenciasEmail,
  type PendenciaEmail,
} from "@/hooks/usePendenciasEmail";
import { DispensarPendenciaDialog } from "@/components/pipeline/DispensarPendenciaDialog";

type FiltroSituacao = "abertos" | "vencido" | "no_prazo" | "dispensado" | "todos";

const SITUACAO_BADGE: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-600",
  no_prazo: "bg-amber-400/15 text-amber-600",
  vencido: "bg-destructive/15 text-destructive",
  dispensado: "bg-muted text-muted-foreground",
};

const SITUACAO_LABEL: Record<string, string> = {
  ok: "Enviados",
  no_prazo: "No prazo",
  vencido: "Vencido",
  dispensado: "Dispensado",
};

export default function PendenciasPosVenda() {
  const { items, loading, refetch } = usePendenciasEmail();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<FiltroSituacao>("abertos");
  const [closerFiltro, setCloserFiltro] = useState("all");
  const [dispensar, setDispensar] = useState<PendenciaEmail | null>(null);

  const closers = useMemo(
    () => Array.from(new Set(items.map((i) => i.closer).filter(Boolean))) as string[],
    [items]
  );

  const rows = useMemo(() => {
    return items.filter((i) => {
      const okSituacao =
        filtro === "todos"
          ? true
          : filtro === "abertos"
            ? i.situacao === "no_prazo" || i.situacao === "vencido"
            : i.situacao === filtro;
      const okCloser = !isAdmin || closerFiltro === "all" || i.closer === closerFiltro;
      return okSituacao && okCloser;
    });
  }, [items, filtro, closerFiltro, isAdmin]);

  const abrirCard = (leadId: string) => {
    navigate("/pipeline");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("open-lead-card", { detail: { leadId } }));
    }, 200);
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Pendências pós-venda</h1>
        <p className="text-sm text-muted-foreground">
          Ganhos que ainda precisam dos e-mails interno de jurídico e financeiro.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as FiltroSituacao)}
          className="text-xs rounded-lg border border-border bg-background px-2 py-1.5 text-foreground"
        >
          <option value="abertos">Vencidos + No prazo</option>
          <option value="vencido">Vencidos</option>
          <option value="no_prazo">No prazo</option>
          <option value="dispensado">Dispensados</option>
          <option value="todos">Todos</option>
        </select>
        {isAdmin && (
          <select
            value={closerFiltro}
            onChange={(e) => setCloserFiltro(e.target.value)}
            className="text-xs rounded-lg border border-border bg-background px-2 py-1.5 text-foreground"
          >
            <option value="all">Todos os closers</option>
            {closers.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-sm text-muted-foreground">
            Nenhuma pendência. Todos os ganhos estão com os e-mails enviados.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Empresa</th>
                {isAdmin && <th className="text-left px-3 py-2">Closer</th>}
                <th className="text-left px-3 py-2">Ganho em</th>
                <th className="text-left px-3 py-2">Prazo</th>
                <th className="text-left px-3 py-2">Falta</th>
                <th className="text-left px-3 py-2">Situação</th>
                <th className="text-right px-3 py-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.lead_id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <button
                      onClick={() => abrirCard(r.lead_id)}
                      className="text-foreground hover:text-primary hover:underline text-left font-medium"
                    >
                      {r.empresa || "—"}
                    </button>
                  </td>
                  {isAdmin && <td className="px-3 py-2 text-muted-foreground">{r.closer || "—"}</td>}
                  <td className="px-3 py-2 text-muted-foreground">{fmtData(r.dt_ganho)}</td>
                  <td className={cn("px-3 py-2", r.situacao === "vencido" ? "text-destructive font-medium" : "text-muted-foreground")}>
                    {fmtDataHora(r.prazo)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {(r.faltando || []).map((f) => (
                        <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {f === "juridico" ? "Jurídico" : "Financeiro"}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full", SITUACAO_BADGE[r.situacao])}>
                      {SITUACAO_LABEL[r.situacao] || r.situacao}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => abrirCard(r.lead_id)}
                        className="text-[11px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1"
                      >
                        <ExternalLink size={11} />Abrir card
                      </button>
                      {(r.situacao === "no_prazo" || r.situacao === "vencido") && (
                        <button
                          onClick={() => setDispensar(r)}
                          className="text-[11px] px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/70"
                        >
                          Já enviei por fora
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dispensar && (
        <DispensarPendenciaDialog
          open={!!dispensar}
          onOpenChange={(v) => !v && setDispensar(null)}
          leadId={dispensar.lead_id}
          empresa={dispensar.empresa}
          onDone={refetch}
        />
      )}
    </div>
  );
}
