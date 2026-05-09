import { useEffect, useState, useCallback } from "react";
import { sbExt } from "@/lib/supabaseExternal";

export type EmailTipo = "juridico" | "financeiro";
export type EmailPapel = "to" | "cc";

export interface EmailDestinatario {
  id: string;
  nome: string | null;
  email: string;
  tipo: EmailTipo;
  papel: EmailPapel;
  ativo: boolean;
  created_at?: string;
}

const db = sbExt as any;

export function useEmailDestinatarios() {
  const [items, setItems] = useState<EmailDestinatario[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db
      .from("email_destinatarios")
      .select("*")
      .order("tipo", { ascending: true })
      .order("papel", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) console.error("[useEmailDestinatarios] fetch:", error);
    setItems((data as EmailDestinatario[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (payload: Omit<EmailDestinatario, "id" | "created_at">) => {
    const { error } = await db.from("email_destinatarios").insert(payload);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  const update = useCallback(async (id: string, patch: Partial<EmailDestinatario>) => {
    const { error } = await db.from("email_destinatarios").update(patch).eq("id", id);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  const remove = useCallback(async (id: string) => {
    const { error } = await db.from("email_destinatarios").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  return { items, loading, refetch: fetchAll, create, update, remove };
}
