import { useState } from "react";
import { cn } from "@/lib/utils";
import { agentColor, type Agente } from "./AgentesContext";

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/** Retrato do agente: avatar_url → /avatars/{id}.png → iniciais sobre a cor. */
export function AgentAvatar({ agente, className, imgClassName, style }: { agente: Agente; className?: string; imgClassName?: string; style?: React.CSSProperties }) {
  const sources = [agente.avatar_url, `/avatars/${agente.id}.png`].filter(Boolean) as string[];
  const [idx, setIdx] = useState(0);
  const src = sources[idx];
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ backgroundColor: agentColor(agente), ...style }}>
      {src ? (
        <img src={src} alt={agente.nome} className={cn("h-full w-full object-cover", imgClassName)} onError={() => setIdx((i) => i + 1)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-hud font-bold text-foreground">{iniciais(agente.nome)}</div>
      )}
    </div>
  );
}
