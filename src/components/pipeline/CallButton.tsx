import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabaseExt } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const SOFTPHONE_URL = "https://linkfyscale.ipboxcloud.com.br:9139/ipbox/";
const IN_CALL_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

interface CallButtonProps {
  leadId: string;
  className?: string;
  size?: "sm" | "md";
  onCallSynced?: () => void;
}

export function CallButton({ leadId, className, size = "md", onCallSynced }: CallButtonProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [ending, setEnding] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const syncTimers = useRef<number[]>([]);

  const dims = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  const icon = size === "sm" ? 12 : 14;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      syncTimers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const scheduleSync = (ligacaoId: string | number | undefined) => {
    if (!ligacaoId) return;
    const run = async () => {
      try {
        await supabaseExt.functions.invoke("ipbox-update-chamada", {
          body: { ligacao_id: ligacaoId },
        });
        onCallSynced?.();
      } catch (err) {
        console.error("[ipbox-update-chamada]", err);
      }
    };
    syncTimers.current.push(window.setTimeout(run, 30_000));
    syncTimers.current.push(window.setTimeout(run, 180_000));
  };

  async function handleCall(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!profile?.id) {
      toast.error("Perfil de usuário não encontrado");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabaseExt.functions.invoke("ipbox-click-to-call", {
        body: { lead_id: leadId, lovable_user_id: profile.id },
      });
      if (error || (data && data.error) || (data && data.ok === false)) {
        toast.error(data?.error || error?.message || "Erro ao discar");
        return;
      }
      toast.success(`Discando ${data?.numero ?? ""}... atenda no softphone`);
      setInCall(true);
      scheduleSync(data?.ligacao_id);
      timeoutRef.current = window.setTimeout(() => setInCall(false), IN_CALL_TIMEOUT_MS);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao discar");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnd(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!profile?.id) return;
    setEnding(true);
    try {
      const { data, error } = await supabaseExt.functions.invoke("ipbox-end-call", {
        body: { lovable_user_id: profile.id },
      });
      if (error || (data && data.error)) {
        toast.error(data?.error || error?.message || "Erro ao encerrar");
        return;
      }
      toast.success("Chamada encerrada");
      setInCall(false);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao encerrar");
    } finally {
      setEnding(false);
    }
  }

  function openSoftphone(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    window.open(SOFTPHONE_URL, "_blank", "noopener,noreferrer");
  }

  if (inCall) {
    return (
      <div data-in-call="true" className={cn("inline-flex items-center gap-1.5", className)} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleEnd}
          disabled={ending}
          title="Encerrar chamada"
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors shrink-0",
            dims,
          )}
        >
          {ending ? <Loader2 size={icon} className="animate-spin" /> : <PhoneOff size={icon} />}
        </button>
        <button
          onClick={openSoftphone}
          title="Abrir softphone IPBOX (mudo, espera, transferência ficam dentro do softphone)"
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors shrink-0",
            dims,
          )}
        >
          <ExternalLink size={icon} />
        </button>
        {size !== "sm" && (
          <span className="text-[10px] text-red-600 dark:text-red-400 font-medium animate-pulse">Em chamada</span>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleCall}
      disabled={loading}
      title="Discar via IPBOX"
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors shrink-0",
        dims,
        className,
      )}
    >
      {loading ? <Loader2 size={icon} className="animate-spin" /> : <Phone size={icon} />}
    </button>
  );
}
