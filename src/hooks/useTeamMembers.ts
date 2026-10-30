import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabaseExt as supabase } from "@/lib/supabaseExternal";

const EMPTY_MEMBERS: never[] = [];
const EMPTY_NAMES: string[] = [];

export interface TeamMember {
  id: string;
  nome: string;
  role: string | null;
  secondary_role: string | null;
  pode_ser_responsavel: boolean;
  visivel_dropdown_closer: boolean;
}

async function fetchTeam(): Promise<{ members: TeamMember[]; visibleCloserNames: string[] }> {
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
  if (error) console.warn("useTeamMembers:", error.message);

  const members: TeamMember[] = (error ? [] : data ?? []).map((m: any) => ({
    id: m.id,
    nome: m.nome,
    role: m.role ?? null,
    secondary_role: null,
    pode_ser_responsavel: m.role === "closer" || m.role === "sdr" || m.role === "admin",
    visivel_dropdown_closer: false,
  }));

  let visibleCloserNames: string[] = [];
  if (visibleClosersResult.error) {
    console.warn("useTeamMembers visible closers:", visibleClosersResult.error.message);
  } else {
    visibleCloserNames = (visibleClosersResult.data ?? []).map((profile: any) => profile.nome);
  }
  return { members, visibleCloserNames };
}

// user_profiles: buscado 1x e compartilhado entre todas as telas (cache 30 min).
export function useTeamMembers() {
  const q = useQuery({
    queryKey: ["user_profiles", "team"],
    queryFn: fetchTeam,
    staleTime: 30 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });
  const members = q.data?.members ?? EMPTY_MEMBERS;
  const visibleCloserNames = q.data?.visibleCloserNames ?? EMPTY_NAMES;
  const loading = q.isLoading;
  const fetchMembers = useCallback(async () => { await q.refetch(); }, [q.refetch]);

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
