import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TeamMember {
  id: string;
  nome: string;
  role: string | null;
  secondary_role: string | null;
}

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, nome, role, secondary_role")
        .or("role.in.(admin,closer,sdr),secondary_role.in.(closer,sdr)");
      setMembers((data as TeamMember[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  const hasRole = (m: TeamMember, role: string) =>
    m.role === role || m.secondary_role === role;

  const closers = members.filter(m => hasRole(m, "closer") || hasRole(m, "admin"));
  const sdrs = members.filter(m => hasRole(m, "sdr") || hasRole(m, "admin"));
  const allNames = members.map(m => m.nome);
  const closerNames = closers.map(m => m.nome);
  const sdrNames = sdrs.map(m => m.nome);

  return { members, loading, allNames, closerNames, sdrNames };
}
