import { useState } from "react";
import { MessageCircle, Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabaseExternal";
import { edgeErrorMessage } from "@/lib/edgeError";
import { toast } from "@/hooks/use-toast";

export interface Rascunho {
  id: string;
  lead_id?: string | null;
  empresa?: string | null;
  texto: string;
  motivo?: string | null;
  status?: string | null;
  enviado_em?: string | null;
}

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

export function RascunhoCard({ r }: { r: Rascunho }) {
  const empresa = r.empresa || "o lead";
  const [texto, setTexto] = useState(r.texto ?? "");
  const [status, setStatus] = useState(r.status || "rascunho");
  const [enviadoEm, setEnviadoEm] = useState(r.enviado_em ?? null);
  const [erro, setErro] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); toast({ title: "Texto copiado" }); }
    catch { toast({ title: "Não foi possível copiar", variant: "destructive" }); }
  };

  const enviar = async () => {
    if (sending) return;
    setConfirm(false);
    setSending(true);
    setErro(null);
    const { data, error } = await supabase.functions.invoke("agente-acao", { body: { acao_id: r.id, texto } });
    setSending(false);
    if (!error && data?.ok === true) { setStatus("enviada"); setEnviadoEm(new Date().toISOString()); return; }
    setErro(data?.error || (await edgeErrorMessage(error, data, "Não foi possível enviar.")));
  };

  const descartar = async () => {
    const { data, error } = await supabase.functions.invoke("agente-acao", { body: { acao_id: r.id, descartar: true } });
    if (error || data?.error) { toast({ title: await edgeErrorMessage(error, data, "Erro ao descartar"), variant: "destructive" }); return; }
    setStatus("descartada");
  };

  const header = (
    <div className="flex items-center gap-2 text-sm font-medium">
      <MessageCircle className="h-4 w-4 text-[#25D366]" /> Mensagem para {empresa}
    </div>
  );

  if (status === "enviada")
    return (
      <div className="rounded-md border border-border p-3 text-sm flex items-center gap-2 text-[#25D366]">
        <Check className="h-4 w-4" /> {enviadoEm && r.status === "enviada" ? `Enviada em ${fmt(enviadoEm)}` : `Enviada para ${empresa}`}
      </div>
    );
  if (status === "descartada")
    return <div className="rounded-md border border-border p-3 text-sm text-muted-foreground opacity-70">{header}<p className="mt-1">Descartada</p></div>;
  if (status === "erro" && !erro)
    return (
      <div className="rounded-md border border-border p-3 space-y-2">
        {header}
        <p className="text-sm text-destructive">Não enviada</p>
        <Button size="sm" variant="outline" onClick={copiar}><Copy className="h-3.5 w-3.5 mr-1" />Copiar texto</Button>
      </div>
    );

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      {header}
      {r.motivo && <p className="text-xs text-muted-foreground">{r.motivo}</p>}
      <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} className="text-sm" disabled={sending} />
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={sending || !texto.trim()} onClick={() => setConfirm(true)} className="bg-[#25D366] hover:bg-[#1fb257] text-white">
          {sending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}Enviar pelo WhatsApp
        </Button>
        <Button size="sm" variant="outline" onClick={copiar}><Copy className="h-3.5 w-3.5 mr-1" />Copiar texto</Button>
        <Button size="sm" variant="ghost" disabled={sending} onClick={descartar}>Descartar</Button>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio</AlertDialogTitle>
            <AlertDialogDescription>Enviar esta mensagem para {empresa} pelo WhatsApp oficial da PQA?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={enviar}>Enviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
