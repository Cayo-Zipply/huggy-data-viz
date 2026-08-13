import { useRef, useState } from "react";
import { Upload, Loader2, Copy, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseExternal";
import type { PipelineCard as CardType, ContractStatus } from "./types";

const MAX_SIZE = 10 * 1024 * 1024;

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...(buf.subarray(i, i + chunk) as unknown as number[]));
  }
  return btoa(binary);
}

interface Props {
  card: CardType;
  onUpdate: (id: string, updates: Partial<CardType>) => void;
}

export function UploadContratoSection({ card, onUpdate }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<"novo" | "substituir" | null>(null);
  const [linkEstavel, setLinkEstavel] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const docToken = (card as any).zapsign_doc_token as string | null | undefined;
  const isSigned = card.contrato_status === "assinado";
  const canReplace = !!docToken && !isSigned;

  const pick = (f: File | null) => {
    if (!f) { setFile(null); return; }
    if (f.size > MAX_SIZE) {
      toast.error("Arquivo muito grande, envie até 10 MB");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(f);
  };

  const enviar = async (mode: "novo" | "substituir") => {
    if (!file) { toast.error("Selecione um arquivo (.docx ou .pdf)"); return; }
    setLoading(mode);
    try {
      const file_type = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "docx";
      const file_base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("upload-contract-zapsign", {
        body: { lead_id: card.id, file_base64, file_type, file_name: file.name, mode },
      });
      if (error) {
        toast.error(error.message || "Falha ao enviar o contrato");
        return;
      }
      if (data?.success) {
        toast.success(data.message || "Contrato enviado!");
        if (data.link_estavel) setLinkEstavel(data.link_estavel);
        onUpdate(card.id, {
          contrato_status: "enviado" as ContractStatus,
          ...(data.link_estavel ? { contract_url: data.link_estavel } : {}),
        } as Partial<CardType>);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      } else if (data?.ja_assinado) {
        toast.error("Contrato já assinado — gere um novo contrato.");
      } else if (data?.duplicate_guard) {
        toast.warning("Envio em andamento, aguarde alguns segundos.");
      } else {
        toast.error(data?.zapsign_error || data?.message || "Não foi possível enviar o contrato");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar o contrato");
    } finally {
      setLoading(null);
    }
  };

  const copiarLink = async () => {
    const link = linkEstavel || card.contract_url;
    if (!link) return;
    try { await navigator.clipboard.writeText(link); toast.success("Link copiado!"); }
    catch { toast.error("Não foi possível copiar"); }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-foreground uppercase tracking-wider">Subir contrato manualmente</p>

      <input
        ref={inputRef}
        type="file"
        accept=".docx,.pdf"
        onChange={(e) => pick(e.target.files?.[0] || null)}
        className="block w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:bg-background file:text-foreground file:text-xs hover:file:bg-muted"
      />
      {file && <p className="text-[11px] text-foreground truncate">Selecionado: {file.name}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => enviar("novo")}
          disabled={!file || loading !== null}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading === "novo" ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          Subir e gerar link de assinatura
        </button>
        <button
          type="button"
          onClick={() => enviar("substituir")}
          disabled={!file || !canReplace || loading !== null}
          title={isSigned ? "Contrato já assinado — gere um novo" : (!docToken ? "Nenhum contrato enviado ainda para este lead" : undefined)}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-border bg-background hover:bg-muted text-foreground disabled:opacity-50"
        >
          {loading === "substituir" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Substituir contrato (mantém o mesmo link)
        </button>
      </div>

      {(linkEstavel || card.contract_url) && (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={linkEstavel || card.contract_url || ""}
            className="flex-1 min-w-0 text-[11px] px-2 py-1.5 rounded-md border border-border bg-background text-foreground"
          />
          <button
            type="button"
            onClick={copiarLink}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary"
          >
            <Copy size={12} /> Copiar link
          </button>
        </div>
      )}

      <div className="flex gap-2 text-[11px] text-muted-foreground bg-background/60 rounded-md p-2 border border-border/50">
        <Info size={13} className="shrink-0 mt-0.5" />
        <span>
          O <strong>Substituir</strong> troca o arquivo mantendo o <strong>mesmo link</strong> para o cliente (desde que ele tenha recebido o link estável do farol) e é feito em silêncio — o ZapSign não dispara e-mail/WhatsApp novo.
          Só funciona antes do cliente assinar; depois de assinado é preciso gerar um contrato novo.
        </span>
      </div>
    </div>
  );
}
