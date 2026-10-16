import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Plus, Send, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseExternal";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./AgentAvatar";
import { agentColor, FERRAMENTA_LABELS, SUGESTOES, type Agente } from "./AgentesContext";

interface Msg {
  role: "user" | "assistant";
  conteudo: string;
  ferramentas_usadas?: string[] | null;
  erro?: boolean;
}

const MAX = 2000;

export function AgentChatDrawer({ agente, open, onClose, initialMessage, nonce }: { agente: Agente; open: boolean; onClose: () => void; initialMessage?: string; nonce: number }) {
  const db = supabase as any;
  const qc = useQueryClient();
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const sentNonce = useRef<number | null>(null);
  const cor = agentColor(agente);

  const { data: conversas = [] } = useQuery({
    queryKey: ["agente-conversas", agente.id],
    enabled: showHist,
    queryFn: async () => {
      const { data, error } = await db.from("agente_conversas").select("id, titulo, updated_at").eq("agente_id", agente.id).order("updated_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data as { id: string; titulo: string | null; updated_at: string }[];
    },
    refetchInterval: false,
  });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);
  useEffect(() => { if (!loading) taRef.current?.focus(); }, [loading, open]);

  const send = async (text: string) => {
    const mensagem = text.trim().slice(0, MAX);
    if (!mensagem || loading) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", conteudo: mensagem }]);
    setLoading(true);
    const body: Record<string, unknown> = { agente_id: agente.id, mensagem };
    if (conversaId) body.conversa_id = conversaId;
    const { data, error } = await supabase.functions.invoke("agente-chat", { body });
    setLoading(false);
    if (error || data?.error) {
      let msg = data?.error as string | undefined;
      if (!msg && (error as any)?.context?.json) {
        try { msg = (await (error as any).context.json())?.error; } catch { /* ignore */ }
      }
      setMsgs((m) => [...m, { role: "assistant", conteudo: msg || error?.message || "Não foi possível responder agora.", erro: true }]);
      return;
    }
    if (data?.conversa_id) setConversaId(data.conversa_id);
    setMsgs((m) => [...m, { role: "assistant", conteudo: data?.resposta ?? "", ferramentas_usadas: data?.ferramentas_usadas ?? [] }]);
    qc.invalidateQueries({ queryKey: ["agente-conversas", agente.id] });
  };

  useEffect(() => {
    if (initialMessage && sentNonce.current !== nonce) {
      sentNonce.current = nonce;
      setConversaId(null);
      setMsgs([]);
      void send(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, initialMessage]);

  const abrirConversa = async (id: string) => {
    setShowHist(false);
    setLoading(true);
    const { data } = await db.from("agente_mensagens").select("role, conteudo, ferramentas_usadas, created_at").eq("conversa_id", id).order("created_at");
    setLoading(false);
    setConversaId(id);
    setMsgs(((data ?? []) as Msg[]).filter((m) => m.role === "user" || m.role === "assistant"));
  };

  const nova = () => { setConversaId(null); setMsgs([]); setShowHist(false); };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col gap-0 [&>button]:hidden">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3" style={{ borderBottomColor: cor + "55" }}>
          <AgentAvatar agente={agente} className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <SheetTitle className="font-hud uppercase tracking-wider text-lg leading-none">{agente.nome}</SheetTitle>
            {agente.titulo && <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">{agente.titulo}</p>}
          </div>
          <Button variant="ghost" size="icon" title="Histórico" onClick={() => setShowHist((s) => !s)}><History className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" title="Nova conversa" onClick={nova}><Plus className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" title="Fechar" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {showHist ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Conversas recentes</p>
            {conversas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conversa ainda.</p>}
            {conversas.map((c) => (
              <button key={c.id} onClick={() => abrirConversa(c.id)} className={cn("w-full text-left rounded-md px-3 py-2 hover:bg-muted", c.id === conversaId && "bg-muted")}>
                <p className="text-sm truncate">{c.titulo || "Sem título"}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(c.updated_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {msgs.length === 0 && !loading && (
              <div className="space-y-3">
                {agente.saudacao && <p className="text-sm italic text-muted-foreground">“{agente.saudacao}”</p>}
                <div className="flex flex-wrap gap-2">
                  {(SUGESTOES[agente.id] ?? []).map((s) => (
                    <button key={s} onClick={() => (s.includes("[") ? setInput(s) : send(s))} className="text-xs rounded-full border px-3 py-1.5 hover:bg-muted transition-colors" style={{ borderColor: cor + "66" }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap">{m.conteudo}</div>
              </div>
            ) : (
              <div key={i} className="space-y-1">
                <div className={cn("prose prose-sm dark:prose-invert max-w-none text-sm [&_table]:text-xs [&_table]:w-full [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border [&_th]:px-2 [&_td]:px-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5", m.erro && "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive")}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.conteudo}</ReactMarkdown>
                </div>
                {!!m.ferramentas_usadas?.length && (
                  <p className="text-[11px] text-muted-foreground">Consultou: {m.ferramentas_usadas.map((f) => FERRAMENTA_LABELS[f] ?? f).join(", ")}</p>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{agente.nome} está analisando</span>
                <span className="flex gap-1">
                  {[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: cor, animationDelay: `${d * 150}ms` }} />)}
                </span>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}

        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={taRef}
              value={input}
              maxLength={MAX}
              rows={2}
              placeholder={`Pergunte ao ${agente.nome}…`}
              onChange={(e) => setInput(e.target.value.slice(0, MAX))}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              className="resize-none min-h-[44px] max-h-40"
            />
            <Button size="icon" disabled={loading || !input.trim()} onClick={() => send(input)} style={{ backgroundColor: cor }}><Send className="h-4 w-4" /></Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-right mt-1">{input.length}/{MAX}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
