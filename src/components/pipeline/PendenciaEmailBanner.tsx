import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePendenciasEmail } from "@/hooks/usePendenciasEmail";

const KEY = "pendencia-email-banner-dismissed";

export function PendenciaEmailBanner() {
  const { countVencidos } = usePendenciasEmail();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(KEY) === "1");

  if (dismissed || countVencidos === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-[12px] text-destructive">
      <AlertTriangle size={13} className="shrink-0" />
      <span className="flex-1">
        Você tem {countVencidos} ganho(s) com e-mail pendente vencido
      </span>
      <button
        onClick={() => navigate("/pendencias-pos-venda")}
        className="underline font-medium hover:opacity-80"
      >
        ver
      </button>
      <button
        onClick={() => { sessionStorage.setItem(KEY, "1"); setDismissed(true); }}
        className="opacity-70 hover:opacity-100"
        title="Dispensar"
      >
        <X size={13} />
      </button>
    </div>
  );
}
