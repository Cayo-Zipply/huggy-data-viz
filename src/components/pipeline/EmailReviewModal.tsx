import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2, Paperclip, Mail, FileText, RefreshCw } from "lucide-react";
import { supabase as supabaseCloud } from "@/integrations/supabase/client";
import { sbExt } from "@/lib/supabaseExternal";
import type { EmailEnvio, EmailEnvioDestinatario, EmailTipo } from "@/hooks/useEmailEnvios";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envio: EmailEnvio | null;
  tipo: EmailTipo;
  leadId: string;
  onUpdated: () => void;
}

const db = sbExt as any;

export function EmailReviewModal({ open, onOpenChange, envio, tipo, leadId, onUpdated }: Props) {
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [destinatarios, setDestinatarios] = useState<EmailEnvioDestinatario[]>([]);
  const [anexoNome, setAnexoNome] = useState<string | null>(null);
  const [anexoUrl, setAnexoUrl] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSwapAnexo, setShowSwapAnexo] = useState(false);
  const [anexosLead, setAnexosLead] = useState<any[]>([]);

  const readOnly = envio?.status === "enviado";
  const titulo = tipo === "juridico" ? "E-mail Jurídico" : "E-mail Financeiro";

  useEffect(() => {
    if (!open || !envio) return;
    setAssunto(envio.assunto || "");
    setCorpo(envio.corpo || "");
    setDestinatarios(
      (envio.destinatarios || []).map((d) => ({
        ...d,
        selecionado: d.selecionado !== false,
      })),
    );
    setAnexoNome(envio.anexo_nome);
    setAnexoUrl(envio.anexo_url);
    setShowSwapAnexo(false);
  }, [open, envio]);

  const loadAnexos = async () => {
    const { data } = await (supabaseCloud as any)
      .from("lead_anexos")
      .select("id, nome_arquivo, tipo, storage_path, url_publica")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    setAnexosLead(data || []);
  };

  const handleSwapAnexo = async () => {
    setShowSwapAnexo(true);
    await loadAnexos();
  };

  const pickAnexo = async (anexo: any) => {
    let url = anexo.url_publica;
    if (!url && anexo.storage_path) {
      const { data } = await (supabaseCloud as any).storage
        .from("lead-anexos")
        .createSignedUrl(anexo.storage_path, 60 * 60 * 24);
      url = data?.signedUrl || null;
    }
    setAnexoNome(anexo.nome_arquivo);
    setAnexoUrl(url);
    setShowSwapAnexo(false);
  };

  const toggleDest = (idx: number) => {
    setDestinatarios((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, selecionado: !d.selecionado } : d)),
    );
  };

  const buildPatch = () => ({
    assunto,
    corpo,
    destinatarios,
    anexo_nome: anexoNome,
    anexo_url: anexoUrl,
  });

  const saveDraft = async () => {
    if (!envio) return;
    setSavingDraft(true);
    try {
      const { error } = await db
        .from("email_envios")
        .update({ ...buildPatch(), status: "rascunho" })
        .eq("id", envio.id);
      if (error) throw error;
      toast.success("Rascunho salvo");
      onUpdated();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message || ""));
    } finally {
      setSavingDraft(false);
    }
  };

  const enviarGmail = async () => {
    if (!envio) return;

    const selecionados = destinatarios.filter((d) => d.selecionado !== false);
    if (selecionados.length === 0) {
      toast.error("Selecione ao menos um destinatário.");
      return;
    }
    if (!anexoNome || !anexoUrl) {
      toast.error("Anexo obrigatório. Anexe o contrato no card antes de enviar.");
      return;
    }

    setSending(true);
    try {
      // 1. salva rascunho atualizado
      await db.from("email_envios").update(buildPatch()).eq("id", envio.id);

      // 2. pega provider_token do Google
      const { data: { session } } = await supabaseCloud.auth.getSession();
      const providerToken = (session as any)?.provider_token;
      const userEmail = session?.user?.email;
      const userMeta: any = session?.user?.user_metadata || {};
      const userName = userMeta.full_name || userMeta.name || null;

      if (!providerToken) {
        toast.error("Sessão Google expirada. Faça logout e login com Google novamente para autorizar o envio pelo Gmail.");
        setSending(false);
        return;
      }

      // 3. invoca edge function (usa o supabase EXTERNO, onde a função está deployada)
      const { data, error } = await db.functions.invoke("enviar-email-gmail", {
        body: {
          envio_id: envio.id,
          provider_token: providerToken,
          remetente_email: userEmail,
          remetente_nome: userName,
        },
      });
      if (error) {
        const msg = error.message || "";
        if (msg.includes("401") || msg.includes("403")) {
          toast.error("Permissão Google insuficiente. Faça logout e login com Google novamente.");
        } else {
          toast.error("Erro ao enviar: " + msg);
        }
        return;
      }
      toast.success("E-mail enviado com sucesso!");
      onUpdated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || ""));
    } finally {
      setSending(false);
    }
  };

  const tos = destinatarios.filter((d) => d.papel === "to");
  const ccs = destinatarios.filter((d) => d.papel === "cc");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail size={18} /> {titulo}
            {readOnly && (
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 ml-2">
                Enviado
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {!envio ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum rascunho disponível. Aguarde a geração automática após marcar o lead como ganho.
          </div>
        ) : (
          <div className="space-y-4">
            {readOnly && envio.enviado_em && (
              <div className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-md p-3 border border-emerald-500/20">
                Enviado em {new Date(envio.enviado_em).toLocaleString("pt-BR")} para{" "}
                {(envio.destinatarios || [])
                  .filter((d) => d.selecionado !== false)
                  .map((d) => d.email)
                  .join(", ")}
              </div>
            )}

            {/* Destinatários TO */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Para</Label>
              <div className="mt-1 space-y-1.5 rounded-md border border-border p-2 bg-muted/20">
                {tos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum destinatário TO configurado.</p>}
                {tos.map((d) => {
                  const idx = destinatarios.indexOf(d);
                  return (
                    <label key={idx} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={d.selecionado !== false}
                        onCheckedChange={() => !readOnly && toggleDest(idx)}
                        disabled={readOnly}
                      />
                      <span className="font-mono text-xs">{d.email}</span>
                      {d.nome && <span className="text-muted-foreground text-xs">— {d.nome}</span>}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* CC */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cópia (CC)</Label>
              <div className="mt-1 space-y-1.5 rounded-md border border-border p-2 bg-muted/20">
                {ccs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum destinatário em cópia.</p>}
                {ccs.map((d) => {
                  const idx = destinatarios.indexOf(d);
                  return (
                    <label key={idx} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={d.selecionado !== false}
                        onCheckedChange={() => !readOnly && toggleDest(idx)}
                        disabled={readOnly}
                      />
                      <span className="font-mono text-xs">{d.email}</span>
                      {d.nome && <span className="text-muted-foreground text-xs">— {d.nome}</span>}
                    </label>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Para gerenciar destinatários, vá em <strong>Configurações → Destinatários de E-mail</strong>.
              </p>
            </div>

            {/* Assunto */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Assunto</Label>
              <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} disabled={readOnly} className="mt-1" />
            </div>

            {/* Corpo */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Corpo do e-mail</Label>
              <Textarea
                value={corpo}
                onChange={(e) => setCorpo(e.target.value)}
                disabled={readOnly}
                rows={14}
                className="mt-1 font-mono text-xs"
              />
            </div>

            {/* Anexo */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Anexo</Label>
              {anexoNome ? (
                <div className="mt-1 flex items-center justify-between rounded-md border border-border p-2 bg-muted/20">
                  <div className="flex items-center gap-2 text-sm min-w-0">
                    <Paperclip size={14} className="shrink-0" />
                    <span className="truncate">{anexoNome}</span>
                    {anexoUrl && (
                      <a href={anexoUrl} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline shrink-0">
                        Visualizar
                      </a>
                    )}
                  </div>
                  {!readOnly && (
                    <Button variant="ghost" size="sm" onClick={handleSwapAnexo} className="shrink-0">
                      <RefreshCw size={12} className="mr-1" /> Trocar
                    </Button>
                  )}
                </div>
              ) : (
                <div className="mt-1 flex items-center justify-between rounded-md border border-destructive/40 p-2 bg-destructive/5 text-destructive">
                  <div className="flex items-center gap-2 text-xs">
                    <AlertTriangle size={14} />
                    Nenhum anexo encontrado — anexe o contrato no card antes de enviar.
                  </div>
                  {!readOnly && (
                    <Button variant="outline" size="sm" onClick={handleSwapAnexo}>
                      Escolher anexo
                    </Button>
                  )}
                </div>
              )}

              {showSwapAnexo && (
                <div className="mt-2 rounded-md border border-border p-2 bg-background space-y-1 max-h-48 overflow-y-auto">
                  {anexosLead.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2">
                      Nenhum anexo no lead. Anexe o contrato pelo card primeiro.
                    </p>
                  ) : (
                    anexosLead.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => pickAnexo(a)}
                        className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2"
                      >
                        <FileText size={12} />
                        <span className="truncate flex-1">{a.nome_arquivo}</span>
                        <span className="text-muted-foreground">{a.tipo}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                {readOnly ? "Fechar" : "Cancelar"}
              </Button>
              {!readOnly && (
                <>
                  <Button variant="secondary" onClick={saveDraft} disabled={savingDraft || sending}>
                    {savingDraft ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                    Salvar rascunho
                  </Button>
                  <Button onClick={enviarGmail} disabled={sending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {sending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Mail size={14} className="mr-1" />}
                    Enviar via Gmail
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
