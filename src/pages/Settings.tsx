import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/hooks/useLabels";
import { Navigate } from "react-router-dom";
import { Plus, Trash2, Palette, Tag, Settings as SettingsIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#14b8a6",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#64748b",
];

export default function Settings() {
  const { isAdmin } = useAuth();
  const { labels, createLabel, deleteLabel, updateLabel } = useLabels();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  if (!isAdmin) return <Navigate to="/pipeline" replace />;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createLabel(newName.trim(), newColor);
    setNewName("");
    setNewColor("#3b82f6");
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    await updateLabel(id, editName.trim(), editColor);
    setEditingId(null);
  };

  const startEdit = (label: { id: string; name: string; color: string }) => {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
  };

  return (
    <div className="flex-1 p-6 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <SettingsIcon size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gerenciar etiquetas e preferências do pipeline</p>
        </div>
      </div>

      {/* Labels Section */}
      <div className="border border-border rounded-2xl bg-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Etiquetas</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Crie etiquetas para organizar os leads no pipeline</p>
        </div>

        <div className="p-4 space-y-4">
          {/* Create new label */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">Nome da etiqueta</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Ex: Urgente, VIP, Follow-up..."
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={e => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Cor</label>
              <div className="flex gap-1">
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setNewColor(c)}
                    className={cn("w-6 h-6 rounded-full border-2 transition-all", newColor === c ? "border-foreground scale-110" : "border-transparent")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <button onClick={handleCreate} disabled={!newName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-all">
              <Plus size={14} />Criar
            </button>
          </div>

          {/* Existing labels */}
          {labels.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma etiqueta criada ainda</p>
          ) : (
            <div className="space-y-2">
              {labels.map(label => (
                <div key={label.id} className="flex items-center gap-3 py-2 px-3 rounded-lg border border-border bg-background group">
                  {editingId === label.id ? (
                    <>
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: editColor }} />
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        className="flex-1 text-sm bg-muted/50 border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus onKeyDown={e => e.key === "Enter" && handleUpdate(label.id)} />
                      <div className="flex gap-0.5">
                        {PRESET_COLORS.map(c => (
                          <button key={c} onClick={() => setEditColor(c)}
                            className={cn("w-4 h-4 rounded-full border transition-all", editColor === c ? "border-foreground" : "border-transparent")}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <button onClick={() => handleUpdate(label.id)} className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded">OK</button>
                      <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
                      <span className="text-sm text-foreground flex-1">{label.name}</span>
                      <button onClick={() => startEdit(label)} className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        <Palette size={14} />
                      </button>
                      <button onClick={() => deleteLabel(label.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
