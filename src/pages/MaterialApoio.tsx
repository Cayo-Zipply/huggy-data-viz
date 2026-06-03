import { useEffect, useState } from "react";
import { sbExt } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Copy, ExternalLink, Plus, Pencil, Power, X, Check, BookOpen } from "lucide-react";

const db = sbExt as any;

interface Material {
  id: string;
  categoria: string;
  titulo: string;
  conteudo: string | null;
  url: string | null;
  ordem: number;
  ativo: boolean;
}

const empty: Omit<Material, "id"> = {
  categoria: "",
  titulo: "",
  conteudo: "",
  url: "",
  ordem: 0,
  ativo: true,
};

export default function MaterialApoio() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Material | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<typeof empty>(empty);

  const load = async () => {
    setLoading(true);
    const { data, error } = await db
      .from("material_apoio")
      .select("*")
      .eq("ativo", true)
      .order("categoria", { ascending: true })
      .order("ordem", { ascending: true });
    if (error) {
      console.error(error);
      toast.error("Erro ao carregar material de apoio");
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado!");
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  const handleSave = async () => {
    const payload = {
      categoria: draft.categoria.trim() || "Geral",
      titulo: draft.titulo.trim(),
      conteudo: draft.conteudo?.trim() || null,
      url: draft.url?.trim() || null,
      ordem: Number(draft.ordem) || 0,
      ativo: draft.ativo,
    };
    if (!payload.titulo) { toast.error("Título obrigatório"); return; }
    if (editing) {
      const { error } = await db.from("material_apoio").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Atualizado");
    } else {
      const { error } = await db.from("material_apoio").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Criado");
    }
    setEditing(null); setCreating(false); setDraft(empty);
    load();
  };

  const handleDesativar = async (m: Material) => {
    if (!confirm(`Desativar "${m.titulo}"?`)) return;
    const { error } = await db.from("material_apoio").update({ ativo: false }).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Desativado");
    load();
  };

  const startEdit = (m: Material) => {
    setEditing(m); setCreating(false);
    setDraft({ categoria: m.categoria, titulo: m.titulo, conteudo: m.conteudo || "", url: m.url || "", ordem: m.ordem, ativo: m.ativo });
  };

  const startCreate = () => {
    setCreating(true); setEditing(null); setDraft(empty);
  };

  const grouped = items.reduce<Record<string, Material[]>>((acc, m) => {
    (acc[m.categoria] = acc[m.categoria] || []).push(m);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Material de Apoio</h1>
            <p className="text-xs text-muted-foreground">Recursos para o time comercial</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Novo material
          </button>
        )}
      </div>

      {(creating || editing) && (
        <div className="mb-6 bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{editing ? "Editar material" : "Novo material"}</h2>
            <button onClick={() => { setCreating(false); setEditing(null); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={draft.categoria} onChange={(e) => setDraft({ ...draft, categoria: e.target.value })} placeholder="Categoria" className="text-sm bg-background border border-border rounded px-2 py-1.5" />
            <input value={draft.titulo} onChange={(e) => setDraft({ ...draft, titulo: e.target.value })} placeholder="Título *" className="text-sm bg-background border border-border rounded px-2 py-1.5" />
          </div>
          <input value={draft.url || ""} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="URL (opcional)" className="w-full text-sm bg-background border border-border rounded px-2 py-1.5" />
          <textarea value={draft.conteudo || ""} onChange={(e) => setDraft({ ...draft, conteudo: e.target.value })} placeholder="Conteúdo (texto que pode ser copiado)" rows={6} className="w-full text-sm bg-background border border-border rounded px-2 py-1.5 font-mono" />
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">Ordem</label>
            <input type="number" value={draft.ordem} onChange={(e) => setDraft({ ...draft, ordem: Number(e.target.value) })} className="w-20 text-sm bg-background border border-border rounded px-2 py-1.5" />
            <button onClick={handleSave} className="ml-auto flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90">
              <Check className="h-4 w-4" /> Salvar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum material cadastrado.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">{cat}</h2>
              <div className="space-y-2">
                {list.map((m) => (
                  <div key={m.id} className="bg-card border border-border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{m.titulo}</p>
                        {m.conteudo && (
                          <pre className="mt-2 text-xs text-foreground bg-muted/40 border border-border rounded p-2 whitespace-pre-wrap font-sans max-h-40 overflow-auto">{m.conteudo}</pre>
                        )}
                        {m.url && (
                          <a href={m.url} target="_blank" rel="noreferrer" className="mt-2 text-xs text-primary hover:underline inline-flex items-center gap-1 break-all">
                            <ExternalLink className="h-3 w-3" /> {m.url}
                          </a>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {m.conteudo && (
                          <button onClick={() => handleCopy(m.conteudo!)} title="Copiar" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {m.url && (
                          <a href={m.url} target="_blank" rel="noreferrer" title="Abrir" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {isAdmin && (
                          <>
                            <button onClick={() => startEdit(m)} title="Editar" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDesativar(m)} title="Desativar" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded">
                              <Power className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
