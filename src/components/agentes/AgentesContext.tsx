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
};

export const SUGESTOES: Record<string, string[]> = {
  black_ops: [
    "Qual meu ticket médio dos últimos 3 meses?",
    "Como estou contra a meta este mês?",
    "Por que estamos perdendo negócios?",
    "Quem está com a melhor nota de reunião?",
  ],
  pipeline: [
    "Quem eu ataco hoje?",
    "Quais links estão sem assinatura?",
    "Tenho no-show para remarcar?",
    "Me dá a tratativa do lead [empresa]",
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

interface Ctx {
  openChat: (agenteId: string, initialMessage?: string) => void;
}
const AgentesCtx = createContext<Ctx>({ openChat: () => {} });
export const useAgentChat = () => useContext(AgentesCtx);

export function AgentesProvider({ children }: { children: ReactNode }) {
  const { data: agentes = [] } = useAgentes();
  const [state, setState] = useState<{ id: string; msg?: string; nonce: number } | null>(null);
  const openChat = useCallback((id: string, msg?: string) => setState({ id, msg, nonce: Date.now() }), []);
  const agente = agentes.find((a) => a.id === state?.id) ?? (state ? { id: state.id, nome: state.id === "pipeline" ? "Ghost" : "Atlas" } : null);

  return (
    <AgentesCtx.Provider value={{ openChat }}>
      {children}
      {agente && state && (
        <AgentChatDrawer
          key={state.id}
          agente={agente}
          open
          initialMessage={state.msg}
          nonce={state.nonce}
          onClose={() => setState(null)}
        />
      )}
    </AgentesCtx.Provider>
  );
}
