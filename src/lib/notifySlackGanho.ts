import { supabase } from "@/lib/supabaseExternal";

/**
 * Dispara o aviso de contrato fechado no #closer.
 * Fire-and-forget. A edge function é idempotente e valida o status do lead
 * internamente — pode chamar sem medo. Não bloqueia a UI.
 */
export function notifySlackGanho(leadId: string) {
  if (!leadId) return;
  void supabase.functions
    .invoke("notificar-ganho-slack", { body: { lead_id: leadId } })
    .then(({ data, error }) => {
      if (error) console.warn("[notifySlackGanho] error:", error);
      else if (data?.skipped) console.log("[notifySlackGanho] skipped:", data);
    })
    .catch((e) => console.warn("[notifySlackGanho] exception:", e));
}
