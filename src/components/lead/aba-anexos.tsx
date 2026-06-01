import { useState, useRef } from "react";
import { FileText, Video, Image as ImageIcon, Upload, Trash2, Download, Eye, FileSignature, FileQuestion, FileType2, Maximize2, Minimize2 } from "lucide-react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useLeadAnexos,
  useUploadAnexo,
  useDeleteAnexo,
  downloadAnexo,
  type LeadAnexo,
} from "@/hooks/use-lead-anexos";

const TIPO_OPTIONS = [
  { value: "contrato_assinado", label: "Contrato assinado" },
  { value: "transcricao", label: "Transcrição" },
  { value: "documento", label: "Documento" },
  { value: "outro", label: "Outro" },
];

const TIPO_META: Record<string, { label: string; cls: string; Icon: any }> = {
  contrato_assinado: { label: "Contrato assinado", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500", Icon: FileSignature },
  transcricao: { label: "Transcrição", cls: "border-blue-500/40 bg-blue-500/10 text-blue-400", Icon: Video },
  documento: { label: "Documento", cls: "border-slate-500/40 bg-slate-500/10 text-slate-300", Icon: FileText },
  imagem: { label: "Imagem", cls: "border-green-500/40 bg-green-500/10 text-green-400", Icon: ImageIcon },
  outro: { label: "Outro", cls: "border-amber-500/40 bg-amber-500/10 text-amber-400", Icon: FileQuestion },
};

function metaPorTipo(tipo: string) {
  return TIPO_META[tipo] ?? TIPO_META.documento;
}

function formatarTamanho(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AbaAnexos({ leadId }: { leadId: string }) {
  const { data: anexos, isLoading } = useLeadAnexos(leadId);
  const upload = useUploadAnexo(leadId);
  const remove = useDeleteAnexo(leadId);
  const [previewing, setPreviewing] = useState<LeadAnexo | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [tipoSel, setTipoSel] = useState<string>("documento");
  const [fileSel, setFileSel] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function abrirModal() {
    setTipoSel("documento");
    setFileSel(null);
    setModalOpen(true);
  }

  function handleConfirmUpload() {
    if (!fileSel) return;
    upload.mutate(
      { file: fileSel, tipo: tipoSel },
      { onSuccess: () => { setModalOpen(false); setFileSel(null); } }
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {anexos?.length ?? 0} {(anexos?.length ?? 0) === 1 ? "anexo" : "anexos"}
          </span>
        </div>
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={abrirModal}
            disabled={upload.isPending}
          >
            <Upload size={14} className="mr-1.5" />
            {upload.isPending ? "Enviando..." : "Adicionar anexo"}
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground text-center py-6">Carregando anexos...</p>}

      {!isLoading && (anexos?.length ?? 0) === 0 && (
        <div className="text-center py-8">
          <FileText size={24} className="mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-xs text-muted-foreground">
            Nenhum anexo ainda. Clique em "Adicionar anexo" para subir um arquivo.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {anexos?.map((a) => {
          const meta = metaPorTipo(a.tipo);
          const Icon = meta.Icon;
          return (
            <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
              <div className="mt-0.5 flex-shrink-0"><Icon size={16} className={meta.cls.split(" ").find(c => c.startsWith("text-"))} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">{a.nome_arquivo}</span>
                  <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                  {a.source === "readai" && (
                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500">Read.ai</Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatarTamanho(a.tamanho_bytes)}
                  {a.tamanho_bytes ? " · " : ""}
                  {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  {a.uploaded_by_nome ? ` · ${a.uploaded_by_nome}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {a.conteudo_texto && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewing(a)} title="Visualizar">
                    <Eye size={14} />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadAnexo(a)} title="Baixar">
                  <Download size={14} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => {
                  if (confirm(`Remover "${a.nome_arquivo}"?`)) remove.mutate(a);
                }} title="Remover">
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar anexo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Tipo do anexo</label>
              <select
                value={tipoSel}
                onChange={(e) => setTipoSel(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {TIPO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Arquivo</label>
              <input
                ref={fileRef}
                type="file"
                onChange={(e) => setFileSel(e.target.files?.[0] ?? null)}
                className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:font-medium hover:file:opacity-90"
              />
              {fileSel && (
                <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                  {fileSel.name} · {formatarTamanho(fileSel.size)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} disabled={upload.isPending}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirmUpload} disabled={!fileSel || upload.isPending}>
              {upload.isPending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewing} onOpenChange={(open) => !open && setPreviewing(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{previewing?.nome_arquivo}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <pre className="text-sm whitespace-pre-wrap font-sans p-4">{previewing?.conteudo_texto}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
