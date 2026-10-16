import { useLocation } from "react-router-dom";
import { AgentAvatar } from "./AgentAvatar";
import { agentColor, useAgentChat, useAgentes } from "./AgentesContext";

/** Botão flutuante: Atlas no Black Ops, Ghost no Pipe. */
export function AgentFab() {
  const { pathname } = useLocation();
  const { openChat } = useAgentChat();
  const { data: agentes = [] } = useAgentes();
  const id = pathname === "/sales-enablement" ? "black_ops" : pathname === "/pipeline" ? "pipeline" : null;
  if (!id) return null;
  const agente = agentes.find((a) => a.id === id) ?? { id, nome: id === "pipeline" ? "Ghost" : "Atlas" };
  return (
    <button
      onClick={() => openChat(id)}
      title={`Falar com ${agente.nome}`}
      className="fixed bottom-20 right-4 md:right-6 z-40 h-14 w-14 rounded-full overflow-hidden border-2 shadow-lg transition-transform hover:scale-105"
      style={{ borderColor: agentColor(agente) }}
    >
      <AgentAvatar agente={agente} className="h-full w-full" imgClassName="object-[center_25%]" />
    </button>
  );
}
