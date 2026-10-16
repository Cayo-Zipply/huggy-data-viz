import { useEffect, useState } from "react";
import { MessageCircle, ChevronDown, ChevronRight } from "lucide-react";
import { supabaseExt } from "@/lib/supabaseExternal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const db = supabaseExt as any;

export function AbrirConversaButton({ leadId }: { leadId: string }) {
  const [link, setLink] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    db.from("leads").select("chatguru_link").eq("id", leadId).maybeSingle()
      .then(({ data }: any) => { if (alive) setLink(data?.chatguru_link || null); });
    return () => { alive = false; };
  }, [leadId]);

  const cls = "text-xs px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center gap-1.5 transition-colors";
  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className={`${cls} hover:bg-emerald-500/20`}>
        <MessageCircle size={12} />Abrir conversa no WhatsApp
      </a>
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <button disabled className={`${cls} opacity-50 cursor-not-allowed`}>
              <MessageCircle size={12} />Abrir conversa no WhatsApp
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Conversa ainda não registrada pelo ChatGuru</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface Msg { recebida_em: string; tipo: string | null; texto: string | null }

const fmt = (iso: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
};

const conteudo = (m: Msg) => {
  const t = (m.tipo || "").toLowerCase();
  if (t === "ptt" || t === "audio") return "🎤 Áudio";
  if (t === "image") return "📷 Imagem";
  if (t === "document") return "📄 Documento";
  return m.texto || "";
};

export function MensagensLeadSection({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setMsgs(null); setOpen(false); }, [leadId]);

  useEffect(() => {
    if (!open || msgs !== null) return;
    setLoading(true);
    db.rpc("fn_mensagens_lead", { p_lead_id: leadId }).then(({ data }: any) => {
      setMsgs(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, [open, msgs, leadId]);

  return (
    <div className="rounded-lg border border-border">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Mensagens do lead (WhatsApp){msgs !== null ? ` (${msgs.length})` : ""}
      </button>
      {open && (
        <div className="px-3 pb-3">
          <p className="text-xs text-muted-foreground mb-2">
            Mostra apenas mensagens recebidas do lead. Para a conversa completa, use o botão Abrir conversa.
          </p>
          {loading ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : !msgs || msgs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma mensagem registrada ainda.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {msgs.map((m, i) => (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg rounded-tl-none bg-muted px-3 py-1.5">
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">{conteudo(m)}</p>
                    <p className="text-[10px] text-muted-foreground text-right mt-0.5">{fmt(m.recebida_em)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
