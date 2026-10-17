import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { supabase } from "@/lib/supabaseExternal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const CHIPS = ["Número errado", "Não respondeu o que perguntei", "Resposta genérica", "Muito longa"];

export function MsgFeedback({ id, cor, inicial }: { id?: string | null; cor: string; inicial?: number | null }) {
  const [nota, setNota] = useState<number>(inicial ?? 0);
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);
  if (!id) return null;
  const db = supabase as any;

  const like = async () => {
    const nova = nota === 1 ? 0 : 1;
    setNota(nova);
    setAberto(false);
    const { error } = await db.rpc("ag_feedback", { p_mensagem_id: id, p_nota: nova });
    if (error) setNota(nota);
  };
  const enviar = async (c?: string) => {
    setEnviando(true);
    const coment = (c ?? texto).trim() || null;
    const { error } = await db.rpc("ag_feedback", { p_mensagem_id: id, p_nota: -1, p_comentario: coment });
    setEnviando(false);
    if (error) return;
    setNota(-1); setAberto(false); setTexto(""); setOk(true);
    setTimeout(() => setOk(false), 2000);
  };

  return (
    <div className="space-y-1">
      <div className={cn("flex items-center gap-1 transition-opacity md:opacity-0 md:group-hover:opacity-100", (nota !== 0 || aberto) && "md:opacity-100")}>
        <button title="Útil" onClick={like} className="p-1 rounded hover:bg-muted">
          <ThumbsUp className="h-3.5 w-3.5" style={{ color: nota === 1 ? cor : "#8A8A8A" }} fill={nota === 1 ? cor : "none"} />
        </button>
        <button title="Não ajudou" onClick={() => setAberto((a) => !a)} className="p-1 rounded hover:bg-muted">
          <ThumbsDown className="h-3.5 w-3.5" style={{ color: nota === -1 ? "#F87171" : "#8A8A8A" }} fill={nota === -1 ? "#F87171" : "none"} />
        </button>
        {ok && <span className="text-[11px] text-muted-foreground">Valeu, isso melhora o agente</span>}
      </div>
      {aberto && (
        <div className="rounded-md border border-border p-2 space-y-2">
          <div className="flex flex-wrap gap-1">
            {CHIPS.map((c) => (
              <button key={c} disabled={enviando} onClick={() => enviar(c)} className="text-[11px] rounded-full border border-border px-2 py-0.5 hover:bg-muted">{c}</button>
            ))}
          </div>
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="O que faltou ou estava errado? (opcional)" className="text-xs min-h-[40px] resize-none" />
          <div className="flex justify-end">
            <Button size="sm" className="h-7" disabled={enviando} onClick={() => enviar()}>Enviar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
