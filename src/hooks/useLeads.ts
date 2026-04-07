import { useEffect, useState, useCallback } from "react";
import { supabaseExt } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";

export interface Lead {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  etapa_atual: string;
  status: string;
  closer: string | null;
  deal_value: number | null;
  data_entrada: string | null;
  created_at: string;
  updated_at: string;
  anotacoes: string | null;
  loss_reason: string | null;
  valor_divida: number | null;
}

const db = supabaseExt as any;

export function useLeads() {
  const { profile, isCloser } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    let query = db.from("leads").select("*").order("created_at", { ascending: false });

    if (isCloser && profile?.email) {
      query = query.eq("closer", profile.email);
    }

    const { data, error } = await query;
    if (!error && data) {
      setLeads(data as Lead[]);
    }
    setLoading(false);
  }, [isCloser, profile?.email]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    const channelId = `leads-rt-${Date.now()}`;
    const channel = db
      .channel(channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        fetchLeads();
      })
      .subscribe();

    return () => { db.removeChannel(channel); };
  }, [fetchLeads]);

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    const { error } = await db.from("leads").update(updates).eq("id", id);
    if (!error) {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    }
    return { error };
  };

  return { leads, loading, refetch: fetchLeads, updateLead };
}
