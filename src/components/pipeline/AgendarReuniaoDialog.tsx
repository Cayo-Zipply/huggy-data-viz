import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar, Copy, ExternalLink, Loader2, Plus, Trash2, Video, X } from "lucide-react";
import { supabase } from "@/lib/supabaseExternal";
import { toast } from "sonner";
import type { PipelineCard } from "./types";

interface Props {
  card: PipelineCard | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: () => void;
}

const FIXO_PQA = "contato@penaquadros.com";
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

function nextBusinessDayAt14(): string {
  // Returns local datetime-local string YYYY-MM-DDTHH:mm in São Paulo time
  const now = new Date();
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(14, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AgendarReuniaoDialog({ card, open, onOpenChange, onCreated }: Props) {
  const tituloDefault = useMemo(
    () => card ? `${card.empresa || card.nome} | Reunião Inicial | PQA` : "",
    [card],
  );

  const descricaoDefault = useMemo(
    () => card
      ? `Reunião agendada via O Farol — Pena Quadros.\n\nCliente: ${card.nome}\nEmpresa: ${card.empresa || "—"}\nCNPJ: ${card.cnpj || "—"}\nTelefone: ${card.telefone || "—"}\n\nCloser responsável: ${card.owner || "—"}\n\nLink do Meet: gerado automaticamente`
      : "",
    [card],
  );

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataHora, setDataHora] = useState("");
  const [duracao, setDuracao] = useState(60);
  const [extras, setExtras] = useState<string[]>([]);
  const [novoExtra, setNovoExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{ meet_link: string; html_link: string; convidados: string[] } | null>(null);

  useEffect(() => {
    if (open && card) {
      setTitulo(tituloDefault);
      setDescricao(descricaoDefault);
      setDataHora(nextBusinessDayAt14());
      setDuracao(60);
      setExtras([]);
      setNovoExtra("");
      setResultado(null);
    }
  }, [open, card, tituloDefault, descricaoDefault]);

  if (!card) return null;

  const leadEmailValido = !!(card.email && isEmail(card.email));

  const addExtra = () => {
    const v = novoExtra.trim();
    if (!isEmail(v)) { toast.error("E-mail inválido"); return; }
    if (extras.includes(v) || v === FIXO_PQA || v === card.email) { toast.error("E-mail já adicionado"); return; }
    setExtras([...extras, v]);
    setNovoExtra("");
  };

  const removerExtra = (e: string) => setExtras(extras.filter(x => x !== e));

  const criar = async () => {
    if (!leadEmailValido) {
      toast.error("Lead sem e-mail válido — adicione no card antes de agendar.");
      return;
    }
    if (!dataHora) { toast.error("Escolha data e hora."); return; }

    setLoading(true);
    try {
      const inicioISO = new Date(dataHora).toISOString();

      const { data, error } = await supabase.functions.invoke("criar-reuniao-meet", {
        body: {
          lead_id: card.id,
          data_inicio: inicioISO,
          duracao_minutos: duracao,
          titulo,
          descricao,
          convidados_extras: extras,
        },
      });

      if (error || (data as any)?.error) {
        const msg = (data as any)?.error || error?.message || "Erro desconhecido";
        const status = (data as any)?.gmail_status || (data as any)?.calendar_status;
        if (status === 401 || status === 403) {
          toast.error("Permissão Google insuficiente. Faça logout/login para reautorizar com acesso ao Calendar.");
        } else {
          toast.error(`Erro: ${msg}`);
        }
        setLoading(false);
        return;
      }

      const out = data as { meet_link: string; html_link: string; convidados: string[] };
      setResultado(out);
      toast.success("Reunião criada! Convites enviados pelo Google Calendar.");
      onCreated?.();
    } catch (e: any) {
      toast.error(`Erro: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Copiado!"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video size={18} className="text-primary" />
            {resultado ? "Reunião agendada" : "Agendar reunião"}
          </DialogTitle>
          <DialogDescription>
            {resultado ? "Convites enviados pelo Google Calendar." : "Cria evento no Google Calendar com link do Meet."}
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
              <Video size={16} className="text-emerald-400 flex-shrink-0" />
              <span className="text-sm flex-1 truncate">{resultado.meet_link}</span>
              <button onClick={() => copy(resultado.meet_link)} className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80 flex items-center gap-1">
                <Copy size={12} />Copiar
              </button>
            </div>
            <a href={resultado.html_link} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
              <ExternalLink size={14} />Abrir no Google Calendar
            </a>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Convidados</p>
              <div className="flex flex-wrap gap-1.5">
                {resultado.convidados.map((c: any, i) => {
                  const email = typeof c === "string" ? c : c?.email ?? "";
                  if (!email) return null;
                  return <span key={`${email}-${i}`} className="text-xs px-2 py-1 bg-muted rounded-full">{email}</span>;
                })}
              </div>
            </div>
            <button onClick={() => onOpenChange(false)} className="w-full py-2 bg-muted text-foreground rounded-md text-sm hover:bg-muted/80">
              Fechar
            </button>
          </div>
        ) : (
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
                <div className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-muted/50 rounded-md">
                  <span>{FIXO_PQA}</span>
                  <span className="text-[10px] text-muted-foreground">fixo PQA</span>
                </div>
                {leadEmailValido ? (
                  <div className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-muted/50 rounded-md">
                    <span>{card.email}</span>
                    <span className="text-[10px] text-muted-foreground">lead</span>
                  </div>
                ) : (
                  <p className="text-xs text-amber-400 px-1">Lead sem e-mail cadastrado — adicione o e-mail no card antes de agendar.</p>
                )}
                {extras.map(e => (
                  <div key={e} className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-muted/50 rounded-md">
                    <span>{e}</span>
                    <button onClick={() => removerExtra(e)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-1.5">
                  <input value={novoExtra} onChange={e => setNovoExtra(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addExtra())}
                    placeholder="adicionar e-mail extra"
                    className="flex-1 text-xs bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button onClick={addExtra} className="text-xs px-2 py-1.5 bg-muted rounded-md hover:bg-muted/80 flex items-center gap-1">
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Descrição</label>
              <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={6}
                className="w-full text-xs bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono" />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => onOpenChange(false)} disabled={loading}
                className="flex-1 py-2 bg-muted text-foreground rounded-md text-sm hover:bg-muted/80 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={criar} disabled={loading || !leadEmailValido}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
                Criar reunião
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
