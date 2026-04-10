import { useState } from "react";
import { Pencil, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { supabaseExt } from "@/lib/supabaseExternal";

interface Anotacao {
  id: string;
  lead_id: string;
  texto: string;
  autor_nome: string | null;
  autor_user_id: string | null;
  source: string | null;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  anotacao: Anotacao;
  currentUserId: string | null;
  isAdmin: boolean;
  onUpdate: () => void;
}

const db = supabaseExt as any;

export function ObservacaoItem({ anotacao, currentUserId, isAdmin, onUpdate }: Props) {
  const [editando, setEditando] = useState(false);
  const [textoEditado, setTextoEditado] = useState(anotacao.texto);
  const [salvando, setSalvando] = useState(false);

  const podeEditar = isAdmin || (currentUserId && currentUserId === anotacao.autor_user_id);

  async function salvarEdicao() {
    if (!textoEditado.trim()) return;
    setSalvando(true);
    const { error } = await db
      .from("lead_anotacoes")
      .update({ texto: textoEditado.trim() })
      .eq("id", anotacao.id);
    setSalvando(false);
    if (error) {
      toast.error("Erro ao editar: " + error.message);
      return;
    }
    setEditando(false);
    onUpdate();
  }

  const hasImages = anotacao.texto.includes("![print]");

  return (
    <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-[10px] text-muted-foreground">
          {anotacao.autor_nome ?? "Usuário"}
          {" · "}
          {new Date(anotacao.created_at).toLocaleString("pt-BR")}
          {anotacao.is_edited && (
            <span className="text-muted-foreground/60 italic ml-1">(editado)</span>
          )}
          {anotacao.source === "readai" && (
            <span className="text-primary/60 ml-1">• Read.ai</span>
          )}
        </p>
        {podeEditar && !editando && (
          <button
            onClick={() => { setEditando(true); setTextoEditado(anotacao.texto); }}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/50 shrink-0"
            title="Editar observação"
          >
            <Pencil size={12} />
          </button>
        )}
      </div>

      {editando ? (
        <div className="space-y-2">
          <textarea
            value={textoEditado}
            onChange={e => setTextoEditado(e.target.value)}
            rows={4}
            autoFocus
            className="w-full text-sm bg-muted/50 border border-border rounded-lg p-3 resize-none text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-2 justify-end">
            <button
              disabled={salvando}
              onClick={() => { setTextoEditado(anotacao.texto); setEditando(false); }}
              className="text-xs px-3 py-1.5 bg-muted text-muted-foreground rounded-md hover:bg-muted/80"
            >
              Cancelar
            </button>
            <button
              disabled={salvando || !textoEditado.trim()}
              onClick={salvarEdicao}
              className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-1"
            >
              {salvando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      ) : hasImages ? (
        <div className="space-y-2">
          {anotacao.texto.split(/!\[print\]\([^)]+\)/).map((text, ti) => (
            text.trim() ? <span key={`t-${ti}`} className="text-sm text-foreground whitespace-pre-wrap">{text}</span> : null
          ))}
          {anotacao.texto.match(/!\[print\]\((data:image\/[^)]+)\)/g)?.map((match, mi) => {
            const src = match.match(/\(([^)]+)\)/)?.[1];
            return src ? <img key={`img-${mi}`} src={src} alt="anexo" className="max-h-40 rounded-md border border-border mt-1" /> : null;
          })}
        </div>
      ) : (
        <p className="text-sm text-foreground whitespace-pre-wrap">{anotacao.texto}</p>
      )}
    </div>
  );
}

export type { Anotacao };
