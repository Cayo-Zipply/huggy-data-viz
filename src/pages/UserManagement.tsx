import { useEffect, useState } from "react";
import { supabaseExt as supabase } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Shield, Users, UserCheck, Plus, Trash2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserRow {
  id: string;
  email: string;
  nome: string;
  role: string | null;
  funcoes: string[] | null;
  user_id: string | null;
  created_at: string;
}

const ROLES = [
  { value: "", label: "Sem papel" },
  { value: "admin", label: "Admin" },
  { value: "sdr", label: "SDR" },
  { value: "closer", label: "Closer" },
];

const ROLE_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
  admin: { label: "Admin", cls: "text-red-500 bg-red-500/10", icon: Shield },
  sdr: { label: "SDR", cls: "text-blue-500 bg-blue-500/10", icon: Users },
  closer: { label: "Closer", cls: "text-green-500 bg-green-500/10", icon: UserCheck },
};

export default function UserManagement() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);

  // Add user form state
  const [newEmail, setNewEmail] = useState("");
  const [newNome, setNewNome] = useState("");
  const [newRole, setNewRole] = useState<string>("sdr");
  const [newFuncoes, setNewFuncoes] = useState<string[]>(["sdr"]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("user_profiles")
      .select("id, nome, email, role, funcoes, user_id, created_at")
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar usuários", description: error.message, variant: "destructive" });
    }
    setUsers(((data as UserRow[]) || []).map(u => ({ ...u, funcoes: u.funcoes || [] })));
    setLoading(false);
  };

  const adminUpdate = async (id: string, updates: Record<string, any>) => {
    const { data, error } = await (supabase as any).functions.invoke("admin-update-user", {
      body: { id, updates },
    });
    if (error) return { ok: false, message: error.message };
    if (data?.error) return { ok: false, message: data.error };
    return { ok: true };
  };

  const updateRole = async (u: UserRow, newRole: string) => {
    setUpdating(u.id);
    const update: any = { role: newRole || null };
    if (newRole === "admin") update.funcoes = ["sdr", "closer"];
    else if (newRole === "sdr" || newRole === "closer") {
      const current = u.funcoes || [];
      if (!current.includes(newRole)) update.funcoes = Array.from(new Set([...current, newRole]));
    }
    const res = await adminUpdate(u.id, update);
    if (!res.ok) toast({ title: "Erro", description: res.message, variant: "destructive" });
    else toast({ title: "Atualizado", description: `Role alterada para ${newRole || "sem papel"}.` });
    await fetchUsers();
    setUpdating(null);
  };

  const toggleFuncao = async (u: UserRow, funcao: "sdr" | "closer") => {
    const current = new Set(u.funcoes || []);
    if (current.has(funcao)) current.delete(funcao);
    else current.add(funcao);
    const next = Array.from(current);
    if ((u.role === "sdr" || u.role === "closer") && !next.includes(u.role)) {
      toast({
        title: "Função obrigatória",
        description: `Usuário com role "${u.role}" precisa ter a função "${u.role}" marcada.`,
        variant: "destructive",
      });
      return;
    }
    setUpdating(u.id);
    const res = await adminUpdate(u.id, { funcoes: next });
    if (!res.ok) toast({ title: "Erro", description: res.message, variant: "destructive" });
    await fetchUsers();
    setUpdating(null);
  };

  const addUser = async () => {
    if (!newEmail.trim() || !newNome.trim()) {
      toast({ title: "Preencha nome e e-mail", variant: "destructive" });
      return;
    }
    const email = newEmail.trim().toLowerCase();
    if (users.some(u => u.email.toLowerCase() === email)) {
      toast({ title: "E-mail já cadastrado", variant: "destructive" });
      return;
    }
    let funcoes = newFuncoes;
    if (newRole === "admin") funcoes = ["sdr", "closer"];
    const { error } = await (supabase as any).from("user_profiles").insert({
      email,
      nome: newNome.trim(),
      role: newRole || null,
      funcoes,
      user_id: null,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Usuário adicionado", description: "Será vinculado no primeiro login com Google." });
    setShowAdd(false);
    setNewEmail(""); setNewNome(""); setNewRole("sdr"); setNewFuncoes(["sdr"]);
    fetchUsers();
  };

  const deleteUser = async (u: UserRow) => {
    if (u.user_id) return;
    const { error } = await (supabase as any).from("user_profiles").delete().eq("id", u.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    setConfirmDelete(null);
    fetchUsers();
  };

  if (!isAdmin) return <Navigate to="/pipeline" replace />;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Usuários</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Defina papel (admin / sdr / closer) e funções no pipe (SDR / Closer) de cada usuário.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Adicionar usuário
        </button>
      </div>

      <div className="mb-4 flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg p-3">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Alterações de papel/funções só passam a valer no <strong>próximo login</strong> do usuário afetado.
        </span>
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
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Nome</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">E-mail</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Role</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Funções no pipe</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const badge = u.role ? ROLE_BADGE[u.role] : null;
                const ativo = !!u.user_id;
                const funcoes = u.funcoes || [];
                return (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{u.nome || "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${ativo ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}>
                        {ativo ? "Ativo" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role ?? ""}
                        onChange={(e) => updateRole(u, e.target.value)}
                        disabled={updating === u.id}
                        className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      {badge && (
                        <span className={`ml-2 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.cls}`}>
                          <badge.icon className="h-3 w-3" />
                          {badge.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        {(["sdr", "closer"] as const).map((f) => (
                          <label key={f} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={funcoes.includes(f)}
                              disabled={updating === u.id || u.role === "admin"}
                              onChange={() => toggleFuncao(u, f)}
                              className="rounded border-border"
                            />
                            <span className="text-foreground capitalize">{f.toUpperCase()}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setConfirmDelete(u)}
                        disabled={ativo}
                        title={ativo ? "Não é possível excluir usuário já vinculado" : "Excluir"}
                        className="inline-flex items-center gap-1 text-xs text-destructive hover:bg-destructive/10 px-2 py-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {users.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Nenhum usuário cadastrado
            </p>
          )}
        </div>
      )}

      {/* Modal: Adicionar usuário */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Adicionar usuário</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Nome</label>
                <input value={newNome} onChange={e => setNewNome(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">E-mail</label>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" placeholder="usuario@penaquadros.com" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Role</label>
                <select value={newRole} onChange={e => {
                  setNewRole(e.target.value);
                  if (e.target.value === "admin") setNewFuncoes(["sdr", "closer"]);
                  else if (e.target.value === "sdr" || e.target.value === "closer") {
                    setNewFuncoes(prev => prev.includes(e.target.value) ? prev : [...prev, e.target.value]);
                  }
                }} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm">
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Funções no pipe</label>
                <div className="flex gap-3">
                  {(["sdr", "closer"] as const).map(f => (
                    <label key={f} className="inline-flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={newFuncoes.includes(f)}
                        disabled={newRole === "admin"}
                        onChange={() => setNewFuncoes(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])}
                      />
                      {f.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowAdd(false)} className="text-sm px-3 py-2 rounded-lg border border-border">Cancelar</button>
              <button onClick={addUser} className="text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90">Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">Excluir usuário?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              <strong>{confirmDelete.nome}</strong> ({confirmDelete.email}) será removido. Como ainda não fez login, não há sessão ativa. Após excluir, esse e-mail não conseguirá mais entrar no sistema.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="text-sm px-3 py-2 rounded-lg border border-border">Cancelar</button>
              <button onClick={() => deleteUser(confirmDelete)} className="text-sm px-3 py-2 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
