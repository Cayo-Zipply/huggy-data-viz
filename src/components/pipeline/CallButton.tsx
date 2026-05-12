import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Loader2, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { supabaseExt } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const SOFTPHONE_URL = "https://linkfyscale.ipboxcloud.com.br:9139/ipbox/";
const IN_CALL_TIMEOUT_MS = 5 * 60 * 1000; // 5 min
const POLL_INTERVAL_MS = 4000;

type CallState = "idle" | "dialing" | "answered";

interface CallButtonProps {
  leadId: string;
  className?: string;
  size?: "sm" | "md";
  onCallSynced?: () => void;
}

// Heurística: detecta se a chamada foi atendida pelo cliente
function detectAnswered(row: any): boolean {
  if (!row) return false;
  if (row.atendido_em || row.answered_at || row.atendida_em) return true;
  const status = String(row.status ?? row.estado ?? "").toUpperCase();
  if (["ATENDIDA", "ATENDIDO", "ANSWERED", "INPROGRESS", "IN_PROGRESS", "ON_CALL"].includes(status)) {
    return true;
  }
  // resultado ATENDIDO com duracao significa chamada já terminou (atendida + finalizada)
  return false;
}

function isTerminal(row: any): boolean {
  return !!(row && row.resultado);
}

export function CallButton({ leadId, className, size = "md", onCallSynced }: CallButtonProps) {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [callState, setCallState] = useState<CallState>("idle");
  const [ending, setEnding] = useState(false);
  const ligacaoIdRef = useRef<string | number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const syncTimers = useRef<number[]>([]);

  const dims = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  const icon = size === "sm" ? 12 : 14;

  const clearAllTimers = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    syncTimers.current.forEach((t) => window.clearTimeout(t));
    syncTimers.current = [];
    timeoutRef.current = null;
    pollTimerRef.current = null;
  };

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  const resetCall = () => {
    clearAllTimers();
    ligacaoIdRef.current = null;
    setCallState("idle");
  };

  const pollStatus = async () => {
    const ligacaoId = ligacaoIdRef.current;
    if (!ligacaoId) return;
    try {
      // pede ao backend pra buscar status atualizado no IPBOX
      await supabaseExt.functions
        .invoke("ipbox-update-chamada", { body: { ligacao_id: ligacaoId } })
        .catch(() => null);
      const { data: row } = await (supabaseExt as any)
        .from("ipbox_chamadas")
        .select("*")
        .eq("ligacao_id", ligacaoId)
        .maybeSingle();

      if (isTerminal(row)) {
        onCallSynced?.();
        resetCall();
        return;
      }
      if (detectAnswered(row) && callState !== "answered") {
        setCallState("answered");
      }
    } catch (err) {
      console.error("[CallButton] poll", err);
    } finally {
      // reagenda enquanto não estiver idle
      if (ligacaoIdRef.current) {
        pollTimerRef.current = window.setTimeout(pollStatus, POLL_INTERVAL_MS);
      }
    }
  };

  async function resolveEmail(): Promise<string | null> {
    const fromCtx = profile?.email ?? user?.email;
    if (fromCtx) return fromCtx;
    try {
      const { supabase } = await import("@/lib/supabaseExternal");
      const { data } = await supabase.auth.getUser();
      return data.user?.email ?? null;
    } catch {
      return null;
    }
  }

  async function handleCall(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!profile?.id) {
      toast.error("Perfil de usuário não encontrado");
      return;
    }
    const email = await resolveEmail();
    if (!email) {
      toast.error("Email do usuário não encontrado");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        lead_id: leadId,
        lovable_user_id: profile?.id ?? user?.id,
        email,
      };
      console.log("[CallButton] ipbox-click-to-call payload:", payload);
      const { data, error } = await supabaseExt.functions.invoke("ipbox-click-to-call", {
        body: payload,
      });
      if (error || (data && data.error) || (data && data.ok === false)) {
        toast.error(data?.error || error?.message || "Erro ao discar");
        return;
      }
      toast.success(`Discando ${data?.numero ?? ""}... atenda no softphone`);
      ligacaoIdRef.current = data?.ligacao_id ?? null;
      setCallState("dialing");
      // safety timeout: derruba UI após 5min
      timeoutRef.current = window.setTimeout(() => resetCall(), IN_CALL_TIMEOUT_MS);
      // inicia polling
      pollTimerRef.current = window.setTimeout(pollStatus, POLL_INTERVAL_MS);
      // sync de fallback (gravação aparece com delay)
      if (ligacaoIdRef.current) {
        const lid = ligacaoIdRef.current;
        syncTimers.current.push(
          window.setTimeout(
            () =>
              supabaseExt.functions
                .invoke("ipbox-update-chamada", { body: { ligacao_id: lid } })
                .then(() => onCallSynced?.())
                .catch(() => null),
            180_000,
          ),
        );
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao discar");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnd(e: React.MouseEvent, opts?: { silent?: boolean }) {
    e.stopPropagation();
    e.preventDefault();
    if (!profile?.id) return;
    setEnding(true);
    try {
      const email = await resolveEmail();
      const payload = {
        lovable_user_id: profile?.id ?? user?.id,
        email,
      };
      console.log("[CallButton] ipbox-end-call payload:", payload);
      const { data, error } = await supabaseExt.functions.invoke("ipbox-end-call", {
        body: payload,
      });
      if (error || (data && data.error)) {
        toast.error(data?.error || error?.message || "Erro ao encerrar");
        return;
      }
      if (!opts?.silent) {
        toast.success(callState === "dialing" ? "Discagem cancelada" : "Chamada encerrada");
      }
      resetCall();
      onCallSynced?.();
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

  if (callState !== "idle") {
    const isDialing = callState === "dialing";
    return (
      <div
        data-in-call="true"
        className={cn("inline-flex items-center gap-1.5", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => handleEnd(e)}
          disabled={ending}
          title={isDialing ? "Cancelar discagem" : "Encerrar chamada"}
          className={cn(
            "inline-flex items-center justify-center rounded-full text-white disabled:opacity-50 transition-colors shrink-0",
            isDialing
              ? "bg-muted-foreground/70 hover:bg-muted-foreground"
              : "bg-red-600 hover:bg-red-700",
            dims,
          )}
        >
          {ending ? (
            <Loader2 size={icon} className="animate-spin" />
          ) : isDialing ? (
            <X size={icon} />
          ) : (
            <PhoneOff size={icon} />
          )}
        </button>
        <button
          onClick={openSoftphone}
          title="Abrir softphone IPBOX"
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors shrink-0",
            dims,
          )}
        >
          <ExternalLink size={icon} />
        </button>
        {size !== "sm" && (
          <span
            className={cn(
              "text-[10px] font-medium",
              isDialing
                ? "text-muted-foreground animate-pulse"
                : "text-red-600 dark:text-red-400 animate-pulse",
            )}
          >
            {isDialing ? "Chamando..." : "Em chamada"}
          </span>
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
