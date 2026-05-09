import { useState } from "react";
import { useEmailDestinatarios, type EmailDestinatario, type EmailTipo, type EmailPapel } from "@/hooks/useEmailDestinatarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

type FormState = {
  id?: string;
  nome: string;
  email: string;
  tipo: EmailTipo;
  papel: EmailPapel;
  ativo: boolean;
};

const empty = (tipo: EmailTipo): FormState => ({
  nome: "",
  email: "",
  tipo,
  papel: "to",
  ativo: true,
});

export function EmailDestinatariosSection() {
  const { items, loading, create, update, remove } = useEmailDestinatarios();
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const juridicos = items.filter((i) => i.tipo === "juridico");
  const financeiros = items.filter((i) => i.tipo === "financeiro");

  const onSave = async () => {
    if (!editing) return;
    if (!editing.email.trim()) { toast.error("Informe o e-mail."); return; }
    setSaving(true);
    try {
      const payload = {
        nome: editing.nome.trim() || null,
        email: editing.email.trim().toLowerCase(),
        tipo: editing.tipo,
        papel: editing.papel,
        ativo: editing.ativo,
      };
      if (editing.id) {
        await update(editing.id, payload);
        toast.success("Atualizado.");
      } else {
        await create(payload as any);
        toast.success("Adicionado.");
      }
      setEditing(null);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item: EmailDestinatario) => {
    if (!confirm(`Remover ${item.email}?`)) return;
    try {
      await remove(item.id);
      toast.success("Removido.");
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || ""));
    }
  };

  const renderList = (list: EmailDestinatario[], tipo: EmailTipo) => (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Mail size={14} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold capitalize">{tipo}</h3>
          <span className="text-xs text-muted-foreground">({list.length})</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing(empty(tipo))}>
          <Plus size={12} className="mr-1" /> Adicionar
        </Button>
      </div>
      <div className="divide-y divide-border">
        {list.length === 0 && (
          <p className="p-4 text-xs text-muted-foreground text-center">Nenhum contato cadastrado.</p>
        )}
        {list.map((d) => (
          <div key={d.id} className="flex items-center gap-2 p-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{d.nome || d.email}</p>
              {d.nome && <p className="text-xs text-muted-foreground truncate">{d.email}</p>}
            </div>
            <select
              value={d.papel}
              onChange={(e) => update(d.id, { papel: e.target.value as EmailPapel })}
              className="text-xs bg-background border border-border rounded px-2 py-1"
            >
              <option value="to">Para</option>
              <option value="cc">Cópia</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={d.ativo}
                onChange={(e) => update(d.id, { ativo: e.target.checked })}
              />
              Ativo
            </label>
            <Button variant="ghost" size="icon" onClick={() => setEditing({
              id: d.id, nome: d.nome || "", email: d.email, tipo: d.tipo, papel: d.papel, ativo: d.ativo,
            })}>
              <Pencil size={14} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(d)}>
              <Trash2 size={14} className="text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Destinatários de E-mail</h2>
        <p className="text-sm text-muted-foreground">
          Contatos que recebem os e-mails automáticos quando um lead é fechado.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {renderList(juridicos, "juridico")}
          {renderList(financeiros, "financeiro")}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar contato" : "Novo contato"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs">Nome (opcional)</Label>
                <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">E-mail *</Label>
                <Input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <select
                    value={editing.tipo}
                    onChange={(e) => setEditing({ ...editing, tipo: e.target.value as EmailTipo })}
                    className="w-full text-sm bg-background border border-border rounded px-2 py-2"
                  >
                    <option value="juridico">Jurídico</option>
                    <option value="financeiro">Financeiro</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Papel</Label>
                  <select
                    value={editing.papel}
                    onChange={(e) => setEditing({ ...editing, papel: e.target.value as EmailPapel })}
                    className="w-full text-sm bg-background border border-border rounded px-2 py-2"
                  >
                    <option value="to">Para (TO)</option>
                    <option value="cc">Cópia (CC)</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.ativo} onChange={(e) => setEditing({ ...editing, ativo: e.target.checked })} />
                Ativo
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={onSave} disabled={saving}>
              {saving && <Loader2 size={12} className="animate-spin mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
