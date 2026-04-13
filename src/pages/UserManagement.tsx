import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Shield, Users, UserCheck } from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  nome: string;
  role: string | null;
  secondary_role: string | null;
  user_id: string | null;
  created_at: string;
}

const ROLES = [
  { value: "", label: "Sem papel", color: "text-muted-foreground" },
  { value: "admin", label: "Admin", icon: Shield, color: "text-red-500" },
  { value: "sdr", label: "SDR", icon: Users, color: "text-blue-500" },
  { value: "closer", label: "Closer", icon: UserCheck, color: "text-green-500" },
];

const SECONDARY_ROLES = [
  { value: "", label: "Nenhum" },
  { value: "sdr", label: "SDR" },
  { value: "closer", label: "Closer" },
];

export default function UserManagement() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data } = await (supabase as any)
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: true });
    setUsers(data || []);
    setLoading(false);
  };

  const updateRole = async (userId: string, newRole: string) => {
    setUpdating(userId);
    await (supabase as any)
      .from("user_profiles")
      .update({ role: newRole || null, updated_at: new Date().toISOString() })
      .eq("id", userId);
    await fetchUsers();
    setUpdating(null);
  };

  const updateSecondaryRole = async (userId: string, newRole: string) => {
    setUpdating(userId);
    await (supabase as any)
      .from("user_profiles")
      .update({ secondary_role: newRole || null, updated_at: new Date().toISOString() })
      .eq("id", userId);
    await fetchUsers();
    setUpdating(null);
  };

  if (!isAdmin) return <Navigate to="/pipeline" replace />;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Gerenciar Usuários</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Defina o papel de cada usuário no sistema
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Usuário</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">E-mail</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Função Principal</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Função Secundária</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{u.nome || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-muted ${
                      ROLES.find((r) => r.value === u.role)?.color || ""
                    }`}>
                      {ROLES.find((r) => r.value === u.role)?.label || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.secondary_role ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                        {SECONDARY_ROLES.find((r) => r.value === u.secondary_role)?.label || u.secondary_role}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 space-y-1">
                    <select
                      value={u.role ?? ""}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      disabled={updating === u.id}
                      className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 w-full"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <select
                      value={u.secondary_role ?? ""}
                      onChange={(e) => updateSecondaryRole(u.id, e.target.value)}
                      disabled={updating === u.id}
                      className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 w-full"
                    >
                      {SECONDARY_ROLES.filter(r => r.value !== u.role).map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Nenhum usuário cadastrado
            </p>
          )}
        </div>
      )}
    </div>
  );
}
