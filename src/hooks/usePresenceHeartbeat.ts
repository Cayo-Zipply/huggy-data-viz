import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseExternal";

const SUPABASE_URL = "https://riyfdcmmabvpcubusujw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpeWZkY21tYWJ2cGN1YnVzdWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NTMyMDMsImV4cCI6MjA5MDIyOTIwM30.pCRIa4UEC9WQiBP8EwzVrO73qS1FbsQ9fvKzlUPD1Gc";

const INTERACTION_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"] as const;
const THROTTLE_MS = 5_000;
const PING_INTERVAL_MS = 60_000;
const AUSENTE_APOS_S = 300;

/**
 * Heartbeat de presença: montar UMA vez no layout autenticado.
 * Envia presence_ping ao montar, a cada 60s e em visibilitychange.
 * Erros são silenciosos (console.warn apenas).
 */
export function usePresenceHeartbeat() {
  const ultimaInteracaoRef = useRef<number>(Date.now());
  const lastTouchRef = useRef<number>(0);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Mantém o access_token atualizado para o fetch keepalive do pagehide.
    void supabase.auth.getSession().then(({ data }) => {
      tokenRef.current = data.session?.access_token ?? null;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      tokenRef.current = session?.access_token ?? null;
    });

    const onInteraction = () => {
      const now = Date.now();
      if (now - lastTouchRef.current < THROTTLE_MS) return;
      lastTouchRef.current = now;
      ultimaInteracaoRef.current = now;
    };

    const enviarPing = async () => {
      const segundos = Math.floor((Date.now() - ultimaInteracaoRef.current) / 1000);
      const estado =
        document.visibilityState === "hidden" || segundos > AUSENTE_APOS_S ? "ausente" : "ativo";
      try {
        const { error } = await (supabase as any).rpc("presence_ping", {
          p_estado: estado,
          p_segundos_sem_interacao: segundos,
        });
        if (error) console.warn("[presence] ping falhou:", error.message);
      } catch (err: any) {
        console.warn("[presence] ping falhou:", err?.message ?? err);
      }
    };

    const marcarOffline = () => {
      const token = tokenRef.current;
      if (!token) return;
      try {
        void fetch(`${SUPABASE_URL}/rest/v1/rpc/presence_ping`, {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ p_estado: "offline", p_segundos_sem_interacao: 0 }),
        });
      } catch (err: any) {
        console.warn("[presence] offline falhou:", err?.message ?? err);
      }
    };

    const onVisibility = () => void enviarPing();

    INTERACTION_EVENTS.forEach((ev) =>
      window.addEventListener(ev, onInteraction, { passive: true })
    );
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", marcarOffline);

    void enviarPing();
    const interval = window.setInterval(() => void enviarPing(), PING_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      INTERACTION_EVENTS.forEach((ev) => window.removeEventListener(ev, onInteraction));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", marcarOffline);
      sub.subscription.unsubscribe();
    };
  }, []);
}

/** Marca o usuário como offline (usar antes do signOut). */
export async function presenceOffline() {
  try {
    await (supabase as any).rpc("presence_ping", {
      p_estado: "offline",
      p_segundos_sem_interacao: 0,
    });
  } catch (err: any) {
    console.warn("[presence] offline falhou:", err?.message ?? err);
  }
}
