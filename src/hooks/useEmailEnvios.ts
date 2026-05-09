import { useEffect, useState, useCallback } from "react";
import { sbExt } from "@/lib/supabaseExternal";

export type EmailTipo = "juridico" | "financeiro";
export type EmailEnvioStatus = "rascunho" | "enviado" | "erro";

export interface EmailEnvioDestinatario {
  email: string;
  nome?: string | null;
  papel: "to" | "cc";
  selecionado?: boolean;
}

export interface EmailEnvio {
  id: string;
  lead_id: string;
  tipo: EmailTipo;
  status: EmailEnvioStatus;
  assunto: string | null;
  corpo: string | null;
  destinatarios: EmailEnvioDestinatario[] | null;
  anexo_nome: string | null;
  anexo_url: string | null;
  anexo_path?: string | null;
  enviado_em: string | null;
  created_at: string;
  remetente_email?: string | null;
  remetente_nome?: string | null;
}

const db = sbExt as any;

export function useEmailEnvios(leadId: string | null) {
  const [items, setItems] = useState<EmailEnvio[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!leadId) { setItems([]); return; }
    setLoading(true);
    const { data, error } = await db
      .from("email_envios")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    if (error) console.error("[useEmailEnvios] fetch:", error);
    setItems((data as EmailEnvio[]) || []);
    setLoading(false);
  }, [leadId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const update = useCallback(async (id: string, patch: Partial<EmailEnvio>) => {
    const { error } = await db.from("email_envios").update(patch).eq("id", id);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  // Latest draft/envio per tipo (juridico/financeiro)
  const latestByTipo = (tipo: EmailTipo): EmailEnvio | null =>
    items.find((e) => e.tipo === tipo) || null;

  return { items, loading, refetch: fetchAll, update, latestByTipo };
}
