import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    const { data } = await supabase
      .from("user_profiles")
      .select("id, nome, role, secondary_role, pode_ser_responsavel")
      .or("role.in.(admin,closer,sdr),secondary_role.in.(closer,sdr)");
    setMembers((data as TeamMember[]) ?? []);
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
