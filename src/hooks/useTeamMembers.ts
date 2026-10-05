import { useEffect, useState, useCallback } from "react";
import { supabaseExt as supabase } from "@/lib/supabaseExternal";

export interface TeamMember {
  id: string;
  nome: string;
  role: string | null;
  secondary_role: string | null;
  pode_ser_responsavel: boolean;
  visivel_dropdown_closer: boolean;
}

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [visibleCloserNames, setVisibleCloserNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    const [membersResult, visibleClosersResult] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("id, nome, role")
        .in("role", ["admin", "closer", "sdr"]),
      supabase
        .from("user_profiles")
        .select("nome")
        .eq("visivel_dropdown_closer", true)
        .order("nome", { ascending: true }),
    ]);

    const { data, error } = membersResult;

    if (error) {
      console.warn("useTeamMembers:", error.message);
      setMembers([]);
    }

    const normalized: TeamMember[] = (data ?? []).map((m: any) => ({
      id: m.id,
      nome: m.nome,
      role: m.role ?? null,
      secondary_role: null,
      pode_ser_responsavel: m.role === "closer" || m.role === "sdr" || m.role === "admin",
      visivel_dropdown_closer: false,
    }));
    setMembers(normalized);

    if (visibleClosersResult.error) {
      console.warn("useTeamMembers visible closers:", visibleClosersResult.error.message);
      setVisibleCloserNames([]);
    } else {
      setVisibleCloserNames((visibleClosersResult.data ?? []).map((profile: any) => profile.nome));
    }
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

  return { members, loading, allNames, closerNames, sdrNames, ownerNames, visibleCloserNames, refetch: fetchMembers };
}
