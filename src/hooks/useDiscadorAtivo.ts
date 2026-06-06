import { useEffect, useRef, useState } from "react";
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

export function useDiscadorAtivo(email: string | null | undefined, enabled = true) {
  const [call, setCall] = useState<CallAtiva | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  // Medição local de duração (a API do IPBOX não devolve)
  const activeRef = useRef<{ leadId: string; inicio: number } | null>(null);

  useEffect(() => {
    if (!enabled || !email) {
      setCall(null);
      lastKeyRef.current = null;
      activeRef.current = null;
      return;
    }
    let cancelled = false;
    const tick = async () => {
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
    const id = setInterval(tick, 2500);
    return () => { cancelled = true; clearInterval(id); };
  }, [email, enabled]);

  return { call };
}
