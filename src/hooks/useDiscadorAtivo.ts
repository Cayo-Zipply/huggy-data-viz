import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";

export interface CallAtiva {
  ativo: boolean;
  ramal?: string | null;
  lead_id: string | null;
  nome: string | null;
  telefone: string | null;
  uid?: string | null;
  etapa_atual?: string | null;
  estado_raw?: any;
}

// Verifica 1x (cache 30 min) se o usuário tem ramal IPBOX cadastrado.
// Se a checagem falhar, mantém o comportamento anterior (polling liberado).
function useTemRamalIpbox(email: string | null | undefined) {
  const q = useQuery({
    queryKey: ["ipbox_ramal", email?.toLowerCase()],
    enabled: !!email,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ipbox_agentes")
        .select("*")
        .ilike("email", String(email).toLowerCase())
        .limit(1);
      if (error) return true;
      const row = Array.isArray(data) ? data[0] : null;
      if (!row) return false;
      return row.ramal == null ? true : String(row.ramal).trim() !== "";
    },
  });
  return q.data === true;
}

export function useDiscadorAtivo(email: string | null | undefined, enabled = true) {
  const temRamal = useTemRamalIpbox(enabled ? email : null);
  const [call, setCall] = useState<CallAtiva | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  // Medição local de duração (a API do IPBOX não devolve)
  const activeRef = useRef<{ leadId: string; inicio: number } | null>(null);

  useEffect(() => {
    if (!enabled || !email || !temRamal) {
      setCall(null);
      lastKeyRef.current = null;
      activeRef.current = null;
      return;
    }
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { data } = await supabase.functions.invoke("ipbox-atendimento-ativo", {
          body: { email },
        });
        if (cancelled) return;
        const c = (data as CallAtiva) || null;
        setCall(c);

        if (c?.ativo && c.lead_id) {
          const key = c.uid || c.lead_id;
          if (lastKeyRef.current !== key) {
            lastKeyRef.current = key;
            activeRef.current = { leadId: c.lead_id, inicio: Date.now() };
            window.dispatchEvent(new CustomEvent("open-lead-card", { detail: { leadId: c.lead_id } }));
          }
        } else {
          // ativo virou false → se havia ligação em curso, gravar duração
          if (activeRef.current) {
            const { leadId, inicio } = activeRef.current;
            const dur = Math.round((Date.now() - inicio) / 1000);
            activeRef.current = null;
            try {
              await (supabase as any).from("leads").update({
                ultima_ligacao_fup: new Date().toISOString(),
                ultima_ligacao_fup_duracao_seg: dur,
                ultima_ligacao_fup_resultado: "Atendeu",
              }).eq("id", leadId);
            } catch { /* ignore */ }
          }
          lastKeyRef.current = null;
        }
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = setInterval(tick, 10_000);
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [email, enabled, temRamal]);

  return { call };
}
