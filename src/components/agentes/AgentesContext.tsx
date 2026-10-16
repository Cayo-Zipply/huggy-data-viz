import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
import { AgentChatDrawer } from "./AgentChatDrawer";

export interface Agente {
  id: string;
  nome: string;
  titulo?: string | null;
  saudacao?: string | null;
  cor?: string | null;
  avatar_url?: string | null;
  ferramentas?: string[] | null;
  ordem?: number | null;
}

export interface BriefingItem {
  prioridade: "alta" | "media" | "baixa";
  texto: string;
  lead_id?: string | null;
  tratativa?: string | null;
}

export interface Briefing {
  id: string;
  agente_id: string;
  titulo: string;
  resumo?: string | null;
  itens?: BriefingItem[] | null;
  lido_em?: string | null;
  data: string;
}

export const FERRAMENTA_LABELS: Record<string, string> = {
  metricas_periodo: "Leitura de período",
  metricas_mensal: "Tendência mês a mês",
  meta_vs_realizado: "Meta x realizado",
  motivos_perda: "Raio-X das perdas",
  qualidade_closers: "Qualidade das calls",
  negocios_parados: "Radar de parados",
  links_sem_assinatura: "Links sem assinatura",
  no_shows_pendentes: "No-shows sem remarcar",
  agenda: "Agenda do dia",
  contexto_lead: "Leitura da reunião",
  buscar_lead: "Localizar lead",
  comparativo: "Melhorou ou piorou?",
  preparar_mensagem_whatsapp: "Mensagem pronta no WhatsApp",
};

export const SUGESTOES: Record<string, string[]> = {
  black_ops: [
    "Meu fechamento melhorou ou piorou?",
    "Quanto falta para bater a meta e quanto preciso por dia?",
    "Onde está o maior ganho de receita do time este mês?",
    "Por que estamos perdendo negócios?",
  ],
  pipeline: [
    "Quem eu ataco hoje?",
    "Prepara a mensagem para os links sem assinatura",
    "Tenho no-show para remarcar?",
    "Estou melhor ou pior que mês passado?",
  ],
};

export function hojeEmSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function agentColor(a?: Agente | null) {
  return a?.cor || "#8B5CF6";
}

export function useAgentes() {
  return useQuery({
    queryKey: ["agentes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("agentes").select("*").eq("ativo", true).order("ordem");
      if (error) throw error;
      return (data ?? []) as Agente[];
    },
    refetchInterval: false,
    staleTime: 10 * 60_000,
  });
}

export function useBriefingsHoje() {
  const hoje = hojeEmSaoPaulo();
  return useQuery({
    queryKey: ["agente-briefings", hoje],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("agente_briefings").select("*").eq("data", hoje);
      if (error) throw error;
      return (data ?? []) as Briefing[];
    },
    refetchInterval: false,
  });
}

export interface ChatState {
  conversaId: string | null;
  msgs: any[];
  loaded: boolean;
  loading?: boolean;
}
const EMPTY_CHAT: ChatState = { conversaId: null, msgs: [], loaded: false };

interface Ctx {
  openChat: (agenteId: string, initialMessage?: string) => void;
  isOpen: boolean;
}
const AgentesCtx = createContext<Ctx>({ openChat: () => {}, isOpen: false });
const LAST_KEY = "agentes:ultimo";
export function ultimoAgente(): string {
  try { return localStorage.getItem(LAST_KEY) || "black_ops"; } catch { return "black_ops"; }
}
export const useAgentChat = () => useContext(AgentesCtx);

export function AgentesProvider({ children }: { children: ReactNode }) {
  const { data: agentes = [] } = useAgentes();
  const [state, setState] = useState<{ id: string; msg?: string; nonce: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<Record<string, ChatState>>({});
  const openChat = useCallback((id: string, msg?: string) => {
    try { localStorage.setItem(LAST_KEY, id); } catch { /* ignore */ }
    setState({ id, msg, nonce: Date.now() });
    setOpen(true);
  }, []);
  const fallback = (id: string): Agente => ({ id, nome: id === "pipeline" ? "Ghost" : "Atlas" });
  const lista = (["black_ops", "pipeline"] as const).map((id) => agentes.find((a) => a.id === id) ?? fallback(id));
  const agente = state ? agentes.find((a) => a.id === state.id) ?? fallback(state.id) : null;
  const setChat = useCallback((id: string, fn: (c: ChatState) => ChatState) =>
    setChats((all) => ({ ...all, [id]: fn(all[id] ?? EMPTY_CHAT) })), []);

  return (
    <AgentesCtx.Provider value={{ openChat, isOpen: open }}>
      {children}
      {agente && state && (
        <AgentChatDrawer
          key={state.id}
          agente={agente}
          agentes={lista}
          onSwitch={(id) => { if (id !== state.id) { try { localStorage.setItem(LAST_KEY, id); } catch { /* ignore */ } setState({ id, nonce: Date.now() }); } }}
          open={open}
          initialMessage={state.msg}
          nonce={state.nonce}
          chat={chats[state.id] ?? EMPTY_CHAT}
          setChat={(fn) => setChat(state.id, fn)}
          onClose={() => { setOpen(false); setState((s) => (s ? { ...s, msg: undefined } : s)); }}
        />
      )}
    </AgentesCtx.Provider>
  );
}
