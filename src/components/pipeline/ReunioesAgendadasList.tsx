import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseExternal";
import { Calendar, Copy, ExternalLink, Loader2, Pencil, Video, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EditarReuniaoDialog } from "./EditarReuniaoDialog";

interface Reuniao {
  id: string;
  titulo: string;
  data_inicio: string;
  data_fim: string;
  meet_link: string | null;
  html_link: string | null;
  status: string;
  criado_por_nome: string | null;
  convidados: Array<string | { email?: string }> | null;
}

const statusStyle: Record<string, string> = {
  agendada: "bg-blue-500/20 text-blue-400",
  cancelada: "bg-red-500/20 text-red-400",
  realizada: "bg-emerald-500/20 text-emerald-400",
};

function fmt(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReunioesAgendadasList({ leadId, refreshKey }: { leadId: string; refreshKey?: number }) {
  const [items, setItems] = useState<Reuniao[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Reuniao | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("reunioes_agendadas")
      .select("id, titulo, data_inicio, data_fim, meet_link, html_link, status, criado_por_nome, convidados")
      .eq("lead_id", leadId)
      .order("data_inicio", { ascending: false });
    if (!error) setItems((data || []) as Reuniao[]);
    setLoading(false);
  }, [leadId]);

  useEffect(() => { fetchItems(); }, [fetchItems, refreshKey]);

  const copy = (s: string) => navigator.clipboard.writeText(s).then(() => toast.success("Copiado!"));

  const cancelar = async (r: Reuniao) => {
    if (!confirm(`Cancelar a reunião "${r.titulo}"? Os convidados serão notificados.`)) return;
    setCancelingId(r.id);
    try {
      const { data, error } = await supabase.functions.invoke("cancelar-reuniao-meet", {
        body: { reuniao_id: r.id },
      });
      if (error || (data as any)?.error) {
        toast.error(`Erro: ${(data as any)?.error || error?.message || "desconhecido"}`);
        return;
      }
      toast.success("Reunião cancelada.");
      fetchItems();
    } catch (e: any) {
      toast.error(`Erro: ${e?.message || e}`);
    } finally {
      setCancelingId(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>;
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <Calendar size={32} className="mx-auto mb-2 opacity-40" />
        Nenhuma reunião agendada
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map(r => (
        <div key={r.id} className="border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{r.titulo}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{fmt(r.data_inicio)}</p>
            </div>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium uppercase", statusStyle[r.status] || "bg-muted text-muted-foreground")}>
              {r.status}
            </span>
          </div>

          {r.criado_por_nome && (
            <p className="text-[10px] text-muted-foreground">Por {r.criado_por_nome}</p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {r.html_link && (
              <a href={r.html_link} target="_blank" rel="noopener noreferrer"
                className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-md hover:bg-primary/20 flex items-center gap-1">
                <ExternalLink size={11} />Calendar
              </a>
            )}
            {r.meet_link && (
              <button onClick={() => copy(r.meet_link!)}
                className="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md hover:bg-emerald-500/20 flex items-center gap-1">
                <Video size={11} /><Copy size={10} />Meet
              </button>
            )}
            {r.status === "agendada" && (
              <>
                <button onClick={() => setEditing(r)}
                  className="text-xs px-2 py-1 bg-muted text-foreground rounded-md hover:bg-muted/80 flex items-center gap-1">
                  <Pencil size={11} />Editar
                </button>
                <button onClick={() => cancelar(r)} disabled={cancelingId === r.id}
                  className="text-xs px-2 py-1 bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 disabled:opacity-50 flex items-center gap-1">
                  {cancelingId === r.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}Cancelar
                </button>
              </>
            )}
          </div>

          {r.convidados && r.convidados.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
              {r.convidados.map((c, i) => {
                const email = typeof c === "string" ? c : c?.email ?? "";
                if (!email) return null;
                return (
                  <span key={`${email}-${i}`} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{email}</span>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
