import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseExternal";

export interface CallAtiva {
  ativo: boolean;
  lead_id: string | null;
  nome: string | null;
  telefone: string | null;
  uid: string | null;
  estado_raw: any;
}

const ESTADOS_DISCANDO = ["DISCANDO", "CHAMANDO", "ORIGINANDO"];
const ESTADOS_ATENDIDO = ["ATENDIDO", "EM_ATENDIMENTO", "FALANDO", "EM ATENDIMENTO"];

function extractEstado(raw: any): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw.toUpperCase();
  const v = raw.estado || raw.status || raw.situacao || "";
  return String(v).toUpperCase();
}

export function statusDaChamada(call: CallAtiva | null): "discando" | "atendido" | "idle" {
  if (!call?.ativo) return "idle";
  const est = extractEstado(call.estado_raw);
  if (ESTADOS_ATENDIDO.some((e) => est.includes(e))) return "atendido";
  if (ESTADOS_DISCANDO.some((e) => est.includes(e))) return "discando";
  return "discando";
}

export function useDiscadorAtivo(ramal: string, login: string, enabled = true) {
  const [call, setCall] = useState<CallAtiva | null>(null);
  const lastOpenedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !ramal) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const { data } = await supabase.functions.invoke("ipbox-atendimento-ativo", {
          body: { ramal, login },
        });
        if (cancelled) return;
        const c = (data as CallAtiva) || null;
        setCall(c);

        if (c?.ativo && c.lead_id) {
          const status = statusDaChamada(c);
          const key = `${c.uid || c.lead_id}-${status}`;
          if (status === "atendido" && lastOpenedRef.current !== key) {
            lastOpenedRef.current = key;
            window.dispatchEvent(new CustomEvent("open-lead-card", { detail: { leadId: c.lead_id } }));
          }
        } else {
          lastOpenedRef.current = null;
        }
      } catch {
        /* ignore polling errors */
      }
    };
    tick();
    const id = setInterval(tick, 2500);
    return () => { cancelled = true; clearInterval(id); };
  }, [ramal, login, enabled]);

  return { call, status: statusDaChamada(call) };
}
