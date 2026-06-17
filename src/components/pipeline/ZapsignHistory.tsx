import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Send, Eye, CheckCircle2, AlertTriangle, ExternalLink, Copy } from "lucide-react";
import { supabase } from "@/lib/supabaseExternal";
import { toast } from "sonner";

type Signatario = {
  nome: string;
  email: string;
  status: string;
  times_viewed: number;
  first_opened_at: string | null;
  last_view_at: string | null;
  signed_at: string | null;
  sign_url?: string | null;
  token?: string | null;
};
type Evento = { tipo: string; titulo: string; em: string; detalhe?: string };
type Resp = {
  ok: boolean;
  doc_status?: string;
  assinado?: boolean;
  enviado_em?: string | null;
  signatarios?: Signatario[];
  eventos?: Evento[];
  sem_contrato?: boolean;
  error?: string;
};

function fmtBR(iso: string) {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const time = d.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date} às ${time}`;
  } catch {
    return iso;
  }
}

function statusBadgeClass(status: string, docStatus?: string) {
  if (docStatus === "refused" || status === "Recusado")
    return "bg-red-500/15 text-red-500 border-red-500/30";
  if (status === "Assinado") return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
  if (status.startsWith("Abriu")) return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function eventoIcon(tipo: string) {
  if (tipo === "enviado") return <Send size={14} className="text-blue-500" />;
  if (tipo === "aberto") return <Eye size={14} className="text-amber-500" />;
  if (tipo === "assinado") return <CheckCircle2 size={14} className="text-emerald-500" />;
  if (tipo === "recusado") return <AlertTriangle size={14} className="text-red-500" />;
  return <Send size={14} className="text-muted-foreground" />;
}

export function ZapsignHistory({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Resp | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke("get-zapsign-status", {
        body: { lead_id: leadId },
      });
      if (error) {
        // Try parse body for sem_contrato/404
        let parsed: any = null;
        try {
          const ctxBody = (error as any)?.context?.body;
          if (ctxBody) parsed = typeof ctxBody === "string" ? JSON.parse(ctxBody) : ctxBody;
        } catch { /* ignore */ }
        if (parsed?.sem_contrato) setData({ ok: false, sem_contrato: true });
        else setData({ ok: false, error: parsed?.error || error.message });
      } else {
        setData(resp as Resp);
      }
    } catch (e) {
      setData({ ok: false, error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground uppercase tracking-wider">Histórico do contrato</p>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border bg-background hover:bg-muted text-foreground disabled:opacity-60"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Atualizar
        </button>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" /> Carregando histórico...
        </div>
      )}

      {!loading && data?.sem_contrato && (
        <p className="text-xs text-muted-foreground">Contrato ainda não foi gerado para este lead.</p>
      )}

      {!loading && data && !data.ok && !data.sem_contrato && (
        <p className="text-xs text-muted-foreground">Não foi possível carregar o histórico agora. Tente novamente.</p>
      )}

      {data?.ok && (
        <>
          {data.signatarios && data.signatarios.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.signatarios.map((s, i) => (
                <span
                  key={i}
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${statusBadgeClass(
                    data.doc_status === "refused" ? "Recusado" : s.status,
                    data.doc_status,
                  )}`}
                  title={s.email}
                >
                  {s.nome.split(" ")[0]}: {data.doc_status === "refused" ? "Recusado" : s.status}
                </span>
              ))}
            </div>
          )}

          {data.eventos && data.eventos.length > 0 ? (
            <ol className="relative border-l border-border ml-1.5 space-y-2.5 pl-3">
              {data.eventos.map((ev, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[19px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background border border-border">
                    {eventoIcon(ev.tipo)}
                  </span>
                  <p className="text-xs text-foreground">{ev.titulo}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {fmtBR(ev.em)}{ev.detalhe ? ` · ${ev.detalhe}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-muted-foreground">Sem eventos registrados ainda.</p>
          )}
        </>
      )}
    </div>
  );
}
