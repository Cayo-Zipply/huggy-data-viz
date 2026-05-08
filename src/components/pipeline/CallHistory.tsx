import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabaseExt } from "@/lib/supabaseExternal";
import { cn } from "@/lib/utils";

interface Chamada {
  id: string;
  ligacao_id: string | number | null;
  numero_discado: string | null;
  resultado: string | null;
  duracao: number | null;
  gravacao_url: string | null;
  ipbox_user: string | null;
  iniciado_em: string | null;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ResultadoBadge({ resultado }: { resultado: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    ATENDIDO: { label: "Atendido", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
    OCUPADO: { label: "Ocupado", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
    SEM_RESPOSTA: { label: "Sem resposta", cls: "bg-muted text-muted-foreground border-border" },
    CONGESTIONADO: { label: "Congestionado", cls: "bg-muted text-muted-foreground border-border" },
    NAO_DISCADO: { label: "Não discado", cls: "bg-muted text-muted-foreground border-border" },
    DESLIGADO_CLIENTE: { label: "Desligado pelo cliente", cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30" },
  };
  if (!resultado) {
    return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-muted text-muted-foreground border-border">Em andamento</span>;
  }
  const conf = map[resultado] || { label: resultado, cls: "bg-muted text-muted-foreground border-border" };
  return <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md border", conf.cls)}>{conf.label}</span>;
}

export function CallHistory({ leadId }: { leadId: string }) {
  const [chamadas, setChamadas] = useState<Chamada[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChamadas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabaseExt as any)
      .from("ipbox_chamadas")
      .select("id, ligacao_id, numero_discado, resultado, duracao, gravacao_url, ipbox_user, iniciado_em")
      .eq("lead_id", leadId)
      .order("iniciado_em", { ascending: false });
    if (error) {
      console.error("[CallHistory] erro:", error.message);
      toast.error("Erro ao carregar chamadas");
    } else {
      setChamadas((data as Chamada[]) || []);
    }
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    fetchChamadas();
  }, [fetchChamadas]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const pendentes = chamadas.filter((c) => c.resultado === null && c.ligacao_id);
    try {
      await Promise.all(
        pendentes.map((c) =>
          supabaseExt.functions
            .invoke("ipbox-update-chamada", { body: { ligacao_id: c.ligacao_id } })
            .catch((err) => console.error("[update-chamada]", err)),
        ),
      );
      await fetchChamadas();
      toast.success(pendentes.length ? `Atualizadas ${pendentes.length} chamada(s)` : "Histórico atualizado");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Phone size={14} className="text-primary" />
          <p className="text-xs font-medium text-foreground uppercase tracking-wider">Chamadas</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="text-xs px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 text-foreground flex items-center gap-1.5 disabled:opacity-50"
        >
          {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
        </div>
      ) : chamadas.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma chamada registrada</p>
      ) : (
        <div className="space-y-2">
          {chamadas.map((c) => {
            const dur = formatDuration(c.duracao);
            return (
              <div key={c.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground font-medium">{c.numero_discado || "—"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDateTime(c.iniciado_em)}
                      {c.ipbox_user && <> · por {c.ipbox_user}</>}
                      {dur && <> · {dur}</>}
                    </p>
                  </div>
                  <ResultadoBadge resultado={c.resultado} />
                </div>
                {c.gravacao_url && (
                  <audio src={c.gravacao_url} controls preload="none" className="h-8 w-full" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
