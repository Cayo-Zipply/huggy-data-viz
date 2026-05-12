import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle, Loader2, Paperclip, Mail, FileText, RefreshCw, Sparkles,
  PencilLine, MoreVertical, RotateCcw,
} from "lucide-react";
import { supabase as supabaseCloud } from "@/lib/supabaseExternal";
import { sbExt } from "@/lib/supabaseExternal";
import type { EmailEnvio, EmailEnvioDestinatario, EmailTipo } from "@/hooks/useEmailEnvios";
import type { PipelineCard } from "./types";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: EmailTipo;
  leadId: string;
  card: PipelineCard | null;
  onUpdated: () => void;
}

const db = sbExt as any;

/* ── Skeleton templates ── */
function buildSkeleton(tipo: EmailTipo, card: PipelineCard | null): { assunto: string; corpo: string } {
  if (!card) return { assunto: "", corpo: "" };
  const empresaOuNome = card.empresa || card.nome || "—";
  const closer = card.owner || "—";
  const assistente = card.assistente_juridico || "—";

  if (tipo === "juridico") {
    return {
      assunto: `Novo cliente fechado — ${empresaOuNome} — Detalhes para ação jurídica`,
      corpo: `1. Situação fiscal identificada:
[preencher]

2. Prioridades e expectativas do cliente:
[preencher]

3. Soluções possíveis apresentadas em reunião:
[preencher]

4. Próximos passos:
[preencher]

Closer responsável: ${closer}`,
    };
  }

  const endereco = [card.endereco, card.cidade, card.estado, card.cep].filter(Boolean).join(", ") || "—";
  const dataVenda = card.data_venda ? new Date(card.data_venda).toLocaleDateString("pt-BR") : "—";
  const valor = card.valor_proposta ?? card.deal_value;
  const valorFmt = valor != null
    ? `R$ ${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : "—";
  const docNF = (card.tipo_documento || "").toLowerCase().includes("cnpj") ? "CNPJ" : "CPF sócio";

  return {
    assunto: `Fechamento de contrato — ${empresaOuNome}`,
    corpo: `Bom dia!
Segue fechamento de contrato para conhecimento e providências.

Closer responsável: ${closer}
Assistente Jurídico Responsável: ${assistente}

EMPRESA (baixada):
Nome da empresa: ${card.empresa || "—"}
CNPJ: ${card.cnpj || "—"}
Endereço: ${endereco}

SÓCIO:
Nome do sócio: ${card.representante_nome || "—"}
CPF: ${card.representante_cpf || "—"}
Telefone: ${card.telefone || "—"}
E-mail: ${card.email || "—"}

Data: ${dataVenda}
Valor: ${valorFmt}${card.qtd_salarios_minimos ? `, em relação à ${card.qtd_salarios_minimos} salário-mínimo` : ""}

Forma de pagamento:
* Mensalidade com ${card.porcentagem_exito || "—"}% de êxito (prescrição + transação tributária).
Primeiro pagamento: ${card.data_primeiro_pagamento || "—"}.
Pagamentos subsequentes: ${card.dia_demais_pagamentos ? `Dia ${card.dia_demais_pagamentos} dos meses subsequentes` : "No mesmo dia nos meses subsequentes"}.
Emissão da Nota Fiscal: ${docNF}

Observações:
Encaminho o contrato em anexo.

Atenciosamente,`,
  };
}

export function EmailReviewModal({ open, onOpenChange, tipo, leadId, card, onUpdated }: Props) {
  const [envio, setEnvio] = useState<EmailEnvio | null>(null);
  const [loadingEnvio, setLoadingEnvio] = useState(false);

  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [destinatarios, setDestinatarios] = useState<EmailEnvioDestinatario[]>([]);
  const [anexoNome, setAnexoNome] = useState<string | null>(null);
  const [anexoUrl, setAnexoUrl] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sending, setSending] = useState(false);
  const [generatingAuto, setGeneratingAuto] = useState(false);
  const [creatingManual, setCreatingManual] = useState(false);
  const [showSwapAnexo, setShowSwapAnexo] = useState(false);
  const [anexosLead, setAnexosLead] = useState<any[]>([]);

  const readOnly = envio?.status === "enviado";
  const titulo = tipo === "juridico" ? "E-mail Jurídico" : "E-mail Financeiro";

  // Always refetch envio when modal opens — bypasses any stale parent cache
  const fetchLatestEnvio = useCallback(async () => {
    if (!leadId) return null;
    setLoadingEnvio(true);
    const { data, error } = await db
      .from("email_envios")
      .select("*")
      .eq("lead_id", leadId)
      .eq("tipo", tipo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLoadingEnvio(false);
    if (error) {
      console.error("[EmailReviewModal] fetch envio:", error);
      return null;
    }
    return (data as EmailEnvio) || null;
  }, [leadId, tipo]);

  const hydrate = (e: EmailEnvio | null) => {
    setEnvio(e);
    if (!e) {
      setAssunto(""); setCorpo(""); setDestinatarios([]);
      setAnexoNome(null); setAnexoUrl(null);
      return;
    }
    setAssunto(e.assunto || "");
    setCorpo(e.corpo || "");
    setDestinatarios((e.destinatarios || []).map((d) => ({ ...d, selecionado: d.selecionado !== false })));
    setAnexoNome(e.anexo_nome);
    setAnexoUrl(e.anexo_url);
  };

  useEffect(() => {
    if (!open) return;
    setShowSwapAnexo(false);
    (async () => { hydrate(await fetchLatestEnvio()); })();
  }, [open, fetchLatestEnvio]);

  const loadAnexos = async () => {
    const { data } = await (supabaseCloud as any)
      .from("lead_anexos")
      .select("id, nome_arquivo, tipo, storage_path, url_publica")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    setAnexosLead(data || []);
  };

  const handleSwapAnexo = async () => { setShowSwapAnexo(true); await loadAnexos(); };

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
    setDestinatarios((prev) => prev.map((d, i) => (i === idx ? { ...d, selecionado: !d.selecionado } : d)));
  };

  const buildPatch = () => ({ assunto, corpo, destinatarios, anexo_nome: anexoNome, anexo_url: anexoUrl });

  const saveDraft = async () => {
    if (!envio) return;
    setSavingDraft(true);
    try {
      const { error } = await db.from("email_envios").update({ ...buildPatch(), status: "rascunho" }).eq("id", envio.id);
      if (error) throw error;
      toast.success("Rascunho salvo");
      onUpdated();
      hydrate(await fetchLatestEnvio());
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message || ""));
    } finally { setSavingDraft(false); }
  };

  /* ── Empty-state actions ── */
  const fetchDefaultDestinatarios = async (): Promise<EmailEnvioDestinatario[]> => {
    const { data } = await db
      .from("email_destinatarios")
      .select("nome, email, papel")
      .eq("tipo", tipo)
      .eq("ativo", true);
    return (data || []).map((d: any) => ({ nome: d.nome, email: d.email, papel: d.papel, selecionado: true }));
  };

  const fetchLatestAnexo = async (): Promise<{ url: string | null; nome: string | null }> => {
    const { data } = await (supabaseCloud as any)
      .from("lead_anexos")
      .select("nome_arquivo, storage_path, url_publica")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1);
    const a = data?.[0];
    if (!a) return { url: null, nome: null };
    let url = a.url_publica;
    if (!url && a.storage_path) {
      const { data: signed } = await (supabaseCloud as any).storage
        .from("lead-anexos").createSignedUrl(a.storage_path, 60 * 60 * 24);
      url = signed?.signedUrl || null;
    }
    return { url, nome: a.nome_arquivo };
  };

  const generateAuto = async () => {
    setGeneratingAuto(true);
    try {
      const { error } = await db.functions.invoke("gerar-rascunhos-ganho", {
        body: { lead_id: leadId, tipo, force: true },
      });
      if (error) throw error;
      toast.success("Rascunho gerado");
      const fresh = await fetchLatestEnvio();
      hydrate(fresh);
      onUpdated();
    } catch (e: any) {
      toast.error("Erro ao gerar: " + (e?.message || ""));
    } finally { setGeneratingAuto(false); }
  };

  const createManual = async (overwriteId?: string) => {
    setCreatingManual(true);
    try {
      const skel = buildSkeleton(tipo, card);
      const dests = await fetchDefaultDestinatarios();
      const anexo = await fetchLatestAnexo();
      const payload = {
        assunto: skel.assunto, corpo: skel.corpo,
        destinatarios: dests,
        anexo_nome: anexo.nome, anexo_url: anexo.url,
        status: "rascunho",
      };

      if (overwriteId) {
        const { error } = await db.from("email_envios").update(payload).eq("id", overwriteId);
        if (error) throw error;
      } else {
        const { error } = await db.from("email_envios").insert({ lead_id: leadId, tipo, ...payload });
        if (error) throw error;
      }
      toast.success(overwriteId ? "Rascunho resetado" : "Rascunho em branco criado");
      hydrate(await fetchLatestEnvio());
      onUpdated();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || ""));
    } finally { setCreatingManual(false); }
  };

  const regenerateAI = async () => {
    if (!confirm("Isso vai sobrescrever o rascunho atual com uma nova geração por IA — confirma?")) return;
    await generateAuto();
  };

  const resetToSkeleton = async () => {
    if (!envio) return;
    if (!confirm("Isso vai substituir o rascunho atual pelo template em branco — confirma?")) return;
    await createManual(envio.id);
  };

  const enviarGmail = async () => {
    if (!envio) return;
    const selecionados = destinatarios.filter((d) => d.selecionado !== false);
    if (selecionados.length === 0) { toast.error("Selecione ao menos um destinatário."); return; }
    if (!anexoNome || !anexoUrl) {
      toast.error("Anexo obrigatório. Anexe o contrato no card antes de enviar.");
      return;
    }
    setSending(true);
    try {
      await db.from("email_envios").update(buildPatch()).eq("id", envio.id);
      const { data: { session } } = await supabaseCloud.auth.getSession();
      const userEmail = session?.user?.email;
      const userMeta: any = session?.user?.user_metadata || {};
      const userName = userMeta.full_name || userMeta.name || null;
      const { error } = await db.functions.invoke("enviar-email-gmail", {
        body: { envio_id: envio.id, remetente_email: userEmail, remetente_nome: userName },
      });
      if (error) {
        const msg = error.message || "";
        if (msg.includes("401") || msg.includes("403")) {
          toast.error("Permissão Google insuficiente. Faça logout e login com Google novamente.");
        } else { toast.error("Erro ao enviar: " + msg); }
        return;
      }
      toast.success("E-mail enviado com sucesso!");
      onUpdated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || ""));
    } finally { setSending(false); }
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
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 ml-2">Enviado</span>
            )}
            {envio && !readOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="ml-auto h-7 w-7 p-0">
                    <MoreVertical size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={regenerateAI} disabled={generatingAuto}>
                    <Sparkles size={14} className="mr-2" /> Regenerar com IA
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={resetToSkeleton} disabled={creatingManual}>
                    <RotateCcw size={14} className="mr-2" /> Resetar para template em branco
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </DialogTitle>
        </DialogHeader>

        {loadingEnvio ? (
          <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin mr-2" /> Carregando…
          </div>
        ) : !envio ? (
          /* ── EMPTY STATE: oferece duas opções ── */
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              Nenhum rascunho criado ainda para este lead. Escolha como quer começar:
            </p>
            <button
              onClick={generateAuto}
              disabled={generatingAuto || creatingManual}
              className="w-full text-left p-4 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-2 font-medium text-primary">
                {generatingAuto ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Gerar automaticamente
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Usa a transcrição da reunião + dados do lead para gerar o e-mail. Recomendado se você acabou de fechar pelo funil normal.
              </p>
            </button>
            <button
              onClick={() => createManual()}
              disabled={generatingAuto || creatingManual}
              className="w-full text-left p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-2 font-medium">
                {creatingManual ? <Loader2 size={16} className="animate-spin" /> : <PencilLine size={16} />}
                Escrever manualmente
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Cria um rascunho em branco com template e destinatários padrão para você editar.
              </p>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {readOnly && envio.enviado_em && (
              <div className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-md p-3 border border-emerald-500/20">
                Enviado em {new Date(envio.enviado_em).toLocaleString("pt-BR")} para{" "}
                {(envio.destinatarios || []).filter((d) => d.selecionado !== false).map((d) => d.email).join(", ")}
              </div>
            )}

            {/* TO */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Para</Label>
              <div className="mt-1 space-y-1.5 rounded-md border border-border p-2 bg-muted/20">
                {tos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum destinatário TO configurado.</p>}
                {tos.map((d) => {
                  const idx = destinatarios.indexOf(d);
                  return (
                    <label key={idx} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={d.selecionado !== false} onCheckedChange={() => !readOnly && toggleDest(idx)} disabled={readOnly} />
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
                      <Checkbox checked={d.selecionado !== false} onCheckedChange={() => !readOnly && toggleDest(idx)} disabled={readOnly} />
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

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Assunto</Label>
              <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} disabled={readOnly} className="mt-1" />
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Corpo do e-mail</Label>
              <Textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} disabled={readOnly} rows={14} className="mt-1 font-mono text-xs" />
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
                      <a href={anexoUrl} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline shrink-0">Visualizar</a>
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
                    <Button variant="outline" size="sm" onClick={handleSwapAnexo}>Escolher anexo</Button>
                  )}
                </div>
              )}

              {showSwapAnexo && (
                <div className="mt-2 rounded-md border border-border p-2 bg-background space-y-1 max-h-48 overflow-y-auto">
                  {anexosLead.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2">Nenhum anexo no lead. Anexe o contrato pelo card primeiro.</p>
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
