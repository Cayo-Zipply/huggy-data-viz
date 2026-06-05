import { Phone } from "lucide-react";
import { useDiscadorAtivo } from "@/hooks/useDiscadorAtivo";

// MVP: ramal fixo do Paulo Grilo
const RAMAL = "6017";
const LOGIN = "Paulo Grilo";

export default function BalaoDiscando() {
  const { call, status } = useDiscadorAtivo(RAMAL, LOGIN, true);

  if (!call?.ativo) return null;

  const verb = status === "atendido" ? "Em ligação com" : "Discando para";
  const accent = status === "atendido" ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10";

  return (
    <div className={`fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-full border ${accent} px-4 py-2 shadow-lg backdrop-blur`}>
      <Phone className="w-4 h-4 text-foreground animate-pulse" />
      <span className="text-sm text-foreground">
        {verb} <strong>{call.nome || "—"}</strong>
        {call.telefone && <span className="text-muted-foreground ml-1">— {call.telefone}</span>}
      </span>
    </div>
  );
}
