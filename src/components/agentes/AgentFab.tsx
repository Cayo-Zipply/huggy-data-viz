import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
import { AgentAvatar } from "./AgentAvatar";
import { ultimoAgente, useAgentChat, useAgentes, useBriefingsHoje, type Agente } from "./AgentesContext";

/** Atalho global para Atlas e Ghost (canto inferior direito). */
export function AgentFab() {
  const { pathname } = useLocation();
  const { openChat, isOpen } = useAgentChat();
  const { data: agentes = [] } = useAgentes();
  const { data: briefings = [] } = useBriefingsHoje();
  const { data: rascunhos = 0 } = useQuery({
    queryKey: ["agente-acoes-rascunho"],
    queryFn: async () => {
      const { count } = await (supabase as any).from("agente_acoes").select("id", { count: "exact", head: true }).eq("status", "rascunho");
      return count ?? 0;
    },
    refetchInterval: false,
  });
  if (isOpen) return null;
  const get = (id: string, nome: string): Agente => agentes.find((a) => a.id === id) ?? { id, nome };
  const atlas = get("black_ops", "Atlas");
  const ghost = get("pipeline", "Ghost");
  const badge = briefings.some((b) => !b.lido_em) || rascunhos > 0;
  const padrao = pathname === "/sales-enablement" ? "black_ops" : pathname === "/pipeline" ? "pipeline" : ultimoAgente();

  return (
    <button
      onClick={() => openChat(padrao)}
      title="Falar com Atlas ou Ghost"
      className="group fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 h-[52px] w-[66px] md:h-14 md:w-[70px] transition-transform hover:scale-105"
    >
      <AgentAvatar agente={ghost} className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-10 md:h-11 md:w-11 rounded-full border-2 border-[#0EA5E9] shadow-md" imgClassName="object-[center_25%]" />
      <AgentAvatar agente={atlas} className="absolute right-0 top-0 h-[52px] w-[52px] md:h-14 md:w-14 rounded-full border-2 border-[#7C3AED] shadow-lg" imgClassName="object-[center_25%]" />
      {badge && <span className="absolute right-0 top-0 h-3 w-3 rounded-full bg-destructive ring-2 ring-background" />}
    </button>
  );
}
