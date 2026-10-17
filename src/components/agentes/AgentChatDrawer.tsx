import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Minus, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseExternal";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./AgentAvatar";
import { MsgFeedback } from "./MsgFeedback";
import { RascunhoCard, type Rascunho } from "./RascunhoCard";
import { agentColor, FERRAMENTA_LABELS, ferramentaLabel, SUBTITULO, SUGESTOES, type Agente, type ChatState } from "./AgentesContext";

interface Msg {
  id?: string | null;
  feedback?: number | null;
  role: "user" | "assistant";
  conteudo: string;
  ferramentas_usadas?: string[] | null;
  erro?: boolean;
  rascunhos?: Rascunho[];
}

const MAX = 2000;
const DOZE_HORAS = 12 * 60 * 60 * 1000;

const nomeFerramenta = (f: any) => (typeof f === "string" ? f : f?.nome ?? "");

async function carregarConversa(db: any, id: string): Promise<Msg[]> {
  const [{ data }, { data: acoes }] = await Promise.all([
    db.from("agente_mensagens").select("id, role, conteudo, ferramentas_usadas, created_at, feedback, feedback_comentario").eq("conversa_id", id).order("created_at", { ascending: true }),
    db.from("agente_acoes").select("id, lead_id, texto, motivo, status, enviado_em").eq("conversa_id", id).order("created_at"),
  ]);
  let rasc = (acoes ?? []) as Rascunho[];
  const ids = [...new Set(rasc.map((a) => a.lead_id).filter(Boolean))];
  if (ids.length) {
    const { data: ls } = await db.from("leads").select("id, nome").in("id", ids);
    const map = new Map(((ls ?? []) as any[]).map((l) => [l.id, l.nome]));
    rasc = rasc.map((a) => ({ ...a, empresa: map.get(a.lead_id) ?? null }));
  }
  const lista = ((data ?? []) as any[])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ id: m.id, feedback: m.feedback, role: m.role, conteudo: m.conteudo ?? "", ferramentas_usadas: (m.ferramentas_usadas ?? []).map(nomeFerramenta).filter(Boolean) })) as Msg[];
  if (rasc.length) {
    let last = -1;
    lista.forEach((m, i) => { if (m.role === "assistant") last = i; });
    if (last >= 0) lista[last] = { ...lista[last], rascunhos: rasc };
    else lista.push({ role: "assistant", conteudo: "", rascunhos: rasc });
  }
  return lista;
}

export function AgentChatDrawer({ agente, agentes, onSwitch, open, onClose, initialMessage, nonce, chat, setChat }: { agente: Agente; agentes: Agente[]; onSwitch: (id: string) => void; open: boolean; onClose: () => void; initialMessage?: string; nonce: number; chat: ChatState; setChat: (fn: (c: ChatState) => ChatState) => void }) {
  const db = supabase as any;
  const qc = useQueryClient();
  const conversaId = chat.conversaId;
  const msgs = chat.msgs as Msg[];
  const setConversaId = (id: string | null) => setChat((c) => ({ ...c, conversaId: id }));
  const setMsgs = (v: Msg[] | ((m: Msg[]) => Msg[])) => setChat((c) => ({ ...c, msgs: typeof v === "function" ? v(c.msgs as Msg[]) : v }));
  const [input, setInput] = useState("");
  const loading = !!chat.loading;
  const setLoading = (v: boolean) => setChat((c) => ({ ...c, loading: v }));
  const [carregando, setCarregando] = useState(false);
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

  // Carrega a conversa mais recente na primeira abertura (sem mensagem inicial)
  useEffect(() => {
    if (chat.loaded || initialMessage) return;
    setChat((c) => ({ ...c, loaded: true }));
    (async () => {
      setCarregando(true);
      try {
        const { data: conv } = await db.from("agente_conversas").select("id, titulo, updated_at").eq("agente_id", agente.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        if (conv && Date.now() - new Date(conv.updated_at).getTime() <= DOZE_HORAS) {
          const lista = await carregarConversa(db, conv.id);
          setChat((c) => (c.conversaId || c.msgs.length ? c : { ...c, conversaId: conv.id, msgs: lista }));
        }
      } finally {
        setCarregando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    let novoId: string | null = null;
    const cid = data?.conversa_id ?? conversaId;
    if (cid) {
      const { data: ult } = await db.from("agente_mensagens").select("id").eq("conversa_id", cid).eq("role", "assistant").order("created_at", { ascending: false }).limit(1);
      novoId = ult?.[0]?.id ?? null;
    }
    setMsgs((m) => [...m, { id: novoId, role: "assistant", conteudo: data?.resposta ?? "", ferramentas_usadas: (data?.ferramentas_usadas ?? []).map(nomeFerramenta).filter(Boolean), rascunhos: Array.isArray(data?.rascunhos) ? data.rascunhos : [] }]);
    qc.invalidateQueries({ queryKey: ["agente-conversas", agente.id] });
  };

  useEffect(() => {
    if (initialMessage && sentNonce.current !== nonce) {
      sentNonce.current = nonce;
      setChat((c) => ({ ...c, conversaId: null, msgs: [], loaded: true }));
      void send(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, initialMessage]);

  const abrirConversa = async (id: string) => {
    setShowHist(false);
    setCarregando(true);
    const lista = await carregarConversa(db, id);
    setCarregando(false);
    setChat((c) => ({ ...c, conversaId: id, msgs: lista }));
  };

  const nova = () => { setChat((c) => ({ ...c, conversaId: null, msgs: [] })); setShowHist(false); };

  return (
    <div className={cn("fixed z-[60] flex flex-col bg-card border border-border shadow-2xl overflow-hidden inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[420px] md:h-[640px] md:max-h-[calc(100vh-3rem)] md:rounded-2xl", !open && "hidden")}>
        <div className="flex items-center gap-1 border-b border-border px-2 py-2">
          <div className="flex flex-1 min-w-0 gap-1">
            {agentes.map((a) => {
              const ativo = a.id === agente.id;
              return (
                <button key={a.id} onClick={() => onSwitch(a.id)} className={cn("flex items-center gap-2 rounded-lg border-2 px-2 py-1 min-w-0 transition-colors", !ativo && "border-transparent opacity-60 hover:opacity-100")} style={ativo ? { borderColor: agentColor(a) } : undefined}>
                  <AgentAvatar agente={a} className="h-8 w-8 rounded-full shrink-0" imgClassName="object-[center_25%]" />
                  <span className="text-left min-w-0">
                    <span className="block font-hud uppercase tracking-wider text-sm leading-none">{a.nome}</span>
                    <span className="block text-[9px] text-muted-foreground truncate mt-0.5">{SUBTITULO[a.id] ?? a.titulo ?? ""}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Histórico" onClick={() => setShowHist((s) => !s)}><History className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Nova conversa" onClick={nova}><Plus className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Minimizar" onClick={onClose}><Minus className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Fechar" onClick={onClose}><X className="h-4 w-4" /></Button>
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
              <div key={m.id ?? i} className="group space-y-1">
                <div className={cn("prose prose-sm dark:prose-invert max-w-none text-sm [&_table]:text-xs [&_table]:w-full [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border [&_th]:px-2 [&_td]:px-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5", m.erro && "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive")}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.conteudo}</ReactMarkdown>
                </div>
                {!!m.ferramentas_usadas?.length && (
                  <p className="text-[11px] text-muted-foreground">Consultou: {m.ferramentas_usadas.map((f) => ferramentaLabel(f)).join(", ")}</p>
                )}
                {m.rascunhos?.map((r) => <RascunhoCard key={r.id} r={r} />)}
                {!m.erro && <MsgFeedback id={m.id} cor={cor} inicial={m.feedback} />}
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
    </div>
  );
}
