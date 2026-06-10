import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar, Loader2, MessageSquare, Plus, Trash2 } from "lucide-react";
import { buildReuniaoMessage } from "@/lib/reuniaoMessage";
import { supabase } from "@/lib/supabaseExternal";
import { toast } from "sonner";

interface Reuniao {
  id: string;
  titulo: string;
  data_inicio: string;
  data_fim: string;
  convidados: Array<string | { email?: string }> | null;
}

interface Props {
  reuniao: Reuniao | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUpdated?: () => void;
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function durationMinutes(ini: string, fim: string): number {
  return Math.max(15, Math.round((new Date(fim).getTime() - new Date(ini).getTime()) / 60000));
}

function normalizeConvidados(c: Reuniao["convidados"]): string[] {
  if (!c) return [];
  return c.map(x => (typeof x === "string" ? x : x?.email ?? "")).filter(Boolean);
}

export function EditarReuniaoDialog({ reuniao, open, onOpenChange, onUpdated }: Props) {
  const [titulo, setTitulo] = useState("");
  const [dataHora, setDataHora] = useState("");
  const [duracao, setDuracao] = useState(60);
  const [convidados, setConvidados] = useState<string[]>([]);
  const [novoEmail, setNovoEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && reuniao) {
      setTitulo(reuniao.titulo);
      setDataHora(toLocalInput(reuniao.data_inicio));
      setDuracao(durationMinutes(reuniao.data_inicio, reuniao.data_fim));
      setConvidados(normalizeConvidados(reuniao.convidados));
      setNovoEmail("");
    }
  }, [open, reuniao]);

  if (!reuniao) return null;

  const addEmail = () => {
    const v = novoEmail.trim();
    if (!isEmail(v)) { toast.error("E-mail inválido"); return; }
    if (convidados.includes(v)) { toast.error("E-mail já adicionado"); return; }
    setConvidados([...convidados, v]);
    setNovoEmail("");
  };

  const remover = (e: string) => setConvidados(convidados.filter(x => x !== e));

  const salvar = async () => {
    if (!dataHora) { toast.error("Escolha data e hora."); return; }
    setLoading(true);
    try {
      const inicioISO = new Date(dataHora).toISOString();
      const { data, error } = await supabase.functions.invoke("atualizar-reuniao-meet", {
        body: {
          reuniao_id: reuniao.id,
          titulo,
          data_inicio: inicioISO,
          duracao_minutos: duracao,
          convidados,
        },
      });
      if (error || (data as any)?.error) {
        toast.error(`Erro: ${(data as any)?.error || error?.message || "desconhecido"}`);
        setLoading(false);
        return;
      }
      toast.success("Reunião atualizada e convidados notificados.");
      onUpdated?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar size={18} className="text-primary" />
            Editar reunião
          </DialogTitle>
          <DialogDescription>
            As alterações serão sincronizadas no Google Calendar e os convidados serão notificados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Título</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)}
              className="w-full text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Início</label>
              <input type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)}
                className="w-full text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Duração</label>
              <select value={duracao} onChange={e => setDuracao(Number(e.target.value))}
                className="w-full text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value={30}>30 min</option>
                <option value={60}>1 hora</option>
                <option value={90}>1h30</option>
                <option value={120}>2 horas</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Convidados</label>
            <div className="space-y-1.5 mt-1">
              {convidados.map(e => (
                <div key={e} className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-muted/50 rounded-md">
                  <span>{e}</span>
                  <button onClick={() => remover(e)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <div className="flex gap-1.5">
                <input value={novoEmail} onChange={e => setNovoEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addEmail())}
                  placeholder="adicionar e-mail"
                  className="flex-1 text-xs bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                <button onClick={addEmail} className="text-xs px-2 py-1.5 bg-muted rounded-md hover:bg-muted/80 flex items-center gap-1">
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => onOpenChange(false)} disabled={loading}
              className="flex-1 py-2 bg-muted text-foreground rounded-md text-sm hover:bg-muted/80 disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={salvar} disabled={loading}
              className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
              Salvar alterações
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
