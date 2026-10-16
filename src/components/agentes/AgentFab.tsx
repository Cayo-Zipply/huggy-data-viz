import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
import { AgentAvatar } from "./AgentAvatar";
import { agentColor, ultimoAgente, useAgentChat, useAgentes, useBriefingsHoje, type Agente } from "./AgentesContext";

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
  const lista: Agente[] = agentes.length ? agentes : [{ id: "black_ops", nome: "Atlas" }, { id: "pipeline", nome: "Ghost" }];
  const badge = briefings.some((b) => !b.lido_em) || rascunhos > 0;
  const ids = lista.map((a) => a.id);
  const ult = ultimoAgente();
  const padrao = pathname === "/sales-enablement" ? "black_ops" : pathname === "/pipeline" ? "pipeline" : ids.includes(ult) ? ult : ids[0];
  // Primeiro da lista (ordem) fica na frente; demais empilhados atrás, à esquerda.
  const atras = lista.slice(1).reverse();
  const largura = 52 + atras.length * 18;

  return (
    <button
      onClick={() => openChat(padrao)}
      title={`Falar com ${lista.map((a) => a.nome).join(", ")}`}
      className="group fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 h-[52px] md:h-14 transition-transform hover:scale-105"
      style={{ width: largura }}
    >
      {atras.map((a, i) => (
        <AgentAvatar key={a.id} agente={a} className="absolute top-1/2 -translate-y-1/2 h-10 w-10 md:h-11 md:w-11 rounded-full border-2 shadow-md" imgClassName="object-[center_25%]" style={{ left: i * 18, borderColor: agentColor(a) }} />
      ))}
      <AgentAvatar agente={lista[0]} className="absolute right-0 top-0 h-[52px] w-[52px] md:h-14 md:w-14 rounded-full border-2 shadow-lg" imgClassName="object-[center_25%]" style={{ borderColor: agentColor(lista[0]) }} />
      {badge && <span className="absolute right-0 top-0 h-3 w-3 rounded-full bg-destructive ring-2 ring-background" />
    </button>
  );
}
