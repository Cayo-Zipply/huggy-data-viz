import { useEffect, useState, useCallback } from "react";
import { supabaseExt as supabase } from "@/lib/supabaseExternal";

export interface TeamMember {
  id: string;
  nome: string;
  role: string | null;
  secondary_role: string | null;
  pode_ser_responsavel: boolean;
}

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    // cayo's user_profiles has only: id, nome, role, email, user_id, avatar_url
    // (no secondary_role / pode_ser_responsavel). Query a safe column set and
    // backfill the missing fields locally so the rest of the app keeps working.
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, nome, role")
      .in("role", ["admin", "closer", "sdr"]);

    if (error) {
      console.warn("useTeamMembers:", error.message);
      setMembers([]);
      setLoading(false);
      return;
    }

    const normalized: TeamMember[] = (data ?? []).map((m: any) => ({
      id: m.id,
      nome: m.nome,
      role: m.role ?? null,
      secondary_role: null,
      pode_ser_responsavel: m.role === "closer" || m.role === "sdr" || m.role === "admin",
    }));
    setMembers(normalized);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const hasRole = (m: TeamMember, role: string) =>
    m.role === role || m.secondary_role === role;

  const closers = members.filter(m => hasRole(m, "closer") || hasRole(m, "admin"));
  const sdrs = members.filter(m => hasRole(m, "sdr") || hasRole(m, "admin"));
  const allNames = members.map(m => m.nome);
  const closerNames = closers.map(m => m.nome);
  const sdrNames = sdrs.map(m => m.nome);

  // Owner-eligible members (configured in Settings)
  const ownerEligible = members.filter(m => m.pode_ser_responsavel);
  const ownerNames = ownerEligible.map(m => m.nome);

  return { members, loading, allNames, closerNames, sdrNames, ownerNames, refetch: fetchMembers };
}
