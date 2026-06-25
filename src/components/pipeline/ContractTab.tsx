import { useState, useEffect } from "react";
import { FileText, Download, Loader2, RefreshCw, FileSignature, ExternalLink, MessageCircle, Eye, Plus, Trash2, Copy, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { ZapsignHistory } from "./ZapsignHistory";

type CnpjAdicional = {
  empresa: string;
  cnpj: string;
  mesmo_endereco: boolean;
  endereco?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
};
type SocioAdicional = { nome: string; cpf: string };

const maskCNPJ = (v: string) => v.replace(/\D/g, "").slice(0, 14)
  .replace(/^(\d{2})(\d)/, "$1.$2")
  .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
  .replace(/\.(\d{3})(\d)/, ".$1/$2")
  .replace(/(\d{4})(\d)/, "$1-$2");
const maskCPF = (v: string) => v.replace(/\D/g, "").slice(0, 11)
  .replace(/(\d{3})(\d)/, "$1.$2")
  .replace(/(\d{3})(\d)/, "$1.$2")
  .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const maskCEP = (v: string) => v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputMoedaBRL } from "@/components/ui/input-moeda-brl";
import { toast } from "sonner";
import type { PipelineCard as CardType, ContractType, ContractStatus, Stage } from "./types";
import { formatBRL } from "./types";
import { supabase } from "@/lib/supabaseExternal";
import { notifySlackGanho } from "@/lib/notifySlackGanho";

const UF_OPTIONS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA",
  "PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"
];

const CONTRACT_TYPE_OPTIONS: { value: ContractType; label: string; desc: string }[] = [
  { value: "tributario_cnpj", label: "Tributário CNPJ", desc: "Para empresas (PJ) — assessoria tributária" },
  { value: "tributario_cpf", label: "Tributário CPF", desc: "Para pessoas físicas — assessoria tributária" },
  { value: "empresarial_completo", label: "Empresarial Completo", desc: "Para empresas (PJ) — tributário + empresarial" },
];

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  gerado: { label: "📄 Contrato gerado", color: "bg-blue-500/20 text-blue-400" },
  enviado: { label: "📝 Aguardando assinatura (ZapSign)", color: "bg-amber-500/20 text-amber-400" },
  enviado_whatsapp: { label: "📱 Enviado via WhatsApp", color: "bg-emerald-500/20 text-emerald-400" },
  assinado: { label: "✅ Contrato assinado", color: "bg-green-500/20 text-green-400" },
  recusado: { label: "❌ Contrato recusado", color: "bg-red-500/20 text-red-400" },
};

type ContractFunctionResult = {
  success?: boolean;
  message?: string;
  zapsign_sent?: boolean;
  file_url?: string;
  sign_url?: string;
  whatsapp_url?: string;
  share_url?: string;
};

const MISSING_FIELD_LABELS: Record<string, string> = {
  representante_cpf: "CPF do representante",
  representante_nome: "Nome do representante",
  valor_mensalidade: "Valor da mensalidade",
  porcentagem_exito: "Porcentagem de êxito",
  empresa: "Razão social / empresa",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  endereco: "Endereço",
  cidade: "Cidade",
  estado: "Estado (UF)",
  cep: "CEP",
  tipo_contrato: "Tipo de contrato",
};

async function parseEdgeFunctionError(error: any, fallback: string): Promise<string> {
  let parsed: any = null;
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.json === "function") {
      try { parsed = await ctx.clone().json(); } catch {
        try { const txt = await ctx.clone().text(); parsed = txt ? JSON.parse(txt) : null; } catch {}
      }
    } else if (typeof ctx?.body === "string") {
      try { parsed = JSON.parse(ctx.body); } catch {}
    } else if (ctx?.body && typeof ctx.body === "object") {
      parsed = ctx.body;
    }
  } catch { /* ignore */ }

  if (parsed?.error) {
    let msg = parsed.error as string;
    if (Array.isArray(parsed.missing) && parsed.missing.length) {
      const faltando = parsed.missing.map((f: string) => MISSING_FIELD_LABELS[f] ?? f).join(", ");
      msg = `${msg}: ${faltando}`;
    }
    return msg;
  }
  if (parsed?.message) return parsed.message;
  return error?.message || fallback;
}

async function invokeContractFunction(body: { lead_id: string; action: "zapsign" | "download" | "whatsapp" | "preview" }) {
  const { data, error } = await supabase.functions.invoke("generate-contract-docx", { body });
  if (error) {
    const msg = await parseEdgeFunctionError(error, "Erro ao gerar contrato");
    throw new Error(msg);
  }
  return data as ContractFunctionResult;
}

interface Props {
  card: CardType;
  onUpdate: (id: string, u: Partial<CardType>) => void;
}

export function ContractTab({ card, onUpdate }: Props) {
  const isGenerated = card.contrato_status && card.contrato_status !== "pendente";

  // Pré-preenche campos do contrato a partir dos dados do card.
  // Se o usuário editar e salvar, as edições são refletidas. Tudo continua editável.
  const buildInitialForm = () => ({
    empresa: card.empresa || "",
    cnpj: card.cnpj || "",
    // Sem representante cadastrado? usa o nome do lead como sugestão.
    representante_nome: card.representante_nome || card.nome || "",
    representante_cpf: card.representante_cpf || "",
    email: card.email || "",
    telefone: card.telefone || "",
    endereco: card.endereco || "",
    cidade: card.cidade || "",
    estado: card.estado || "",
    cep: card.cep || "",
    qtd_salarios_minimos: card.qtd_salarios_minimos || "",
    porcentagem_exito: card.porcentagem_exito || "",
    data_primeiro_pagamento: card.data_primeiro_pagamento || "",
    dia_demais_pagamentos: card.dia_demais_pagamentos || "",
    prazo_entrega_relatorios: card.prazo_entrega_relatorios?.toString() || "",
    prazo_contrato: card.prazo_contrato || "",
  });

  const [tipo, setTipo] = useState<ContractType | "">(card.tipo_contrato || "");
  const [form, setForm] = useState(buildInitialForm);
  const [responsavelJuridico, setResponsavelJuridico] = useState<string>(card.responsavel_juridico || "");
  const [valorMensalidade, setValorMensalidade] = useState<number | null>(card.valor_mensalidade ?? null);
  const [valorDivida, setValorDivida] = useState<number | null>(card.valor_divida ?? null);
  const [valorProposta, setValorProposta] = useState<number | null>(card.valor_proposta ?? null);
  const [actionLoading, setActionLoading] = useState<"zapsign" | "download" | "whatsapp" | "preview" | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<{ action: string; data: ContractFunctionResult } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingSignedUrl, setLoadingSignedUrl] = useState(false);
  const [cnpjsAdicionais, setCnpjsAdicionais] = useState<CnpjAdicional[]>(
    Array.isArray((card as any).cnpjs_adicionais) ? (card as any).cnpjs_adicionais : []
  );
  const [sociosAdicionais, setSociosAdicionais] = useState<SocioAdicional[]>(
    Array.isArray((card as any).socios_adicionais) ? (card as any).socios_adicionais : []
  );

  const handleOpenSignedContract = async () => {
    setLoadingSignedUrl(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-signed-contract-url", {
        body: { lead_id: card.id },
      });
      if (error || !data?.url) {
        const msg = error
          ? await parseEdgeFunctionError(error, "Não foi possível abrir o contrato. Tente novamente.")
          : "Não foi possível abrir o contrato. Tente novamente.";
        toast.error(msg);
        return;
      }
      window.open(data.url, "_blank");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível abrir o contrato. Tente novamente.");
    } finally {
      setLoadingSignedUrl(false);
    }
  };

  useEffect(() => {
    setTipo(card.tipo_contrato || "");
    setForm(buildInitialForm());
    setValorMensalidade(card.valor_mensalidade ?? null);
    setValorDivida(card.valor_divida ?? null);
    setValorProposta(card.valor_proposta ?? null);
    setCnpjsAdicionais(Array.isArray((card as any).cnpjs_adicionais) ? (card as any).cnpjs_adicionais : []);
    setSociosAdicionais(Array.isArray((card as any).socios_adicionais) ? (card as any).socios_adicionais : []);
    setLastResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  // Quando o card é atualizado (ex.: usuário preencheu CNPJ na aba Dados),
  // sincroniza qualquer campo que ainda esteja vazio no formulário,
  // sem sobrescrever edições já feitas pelo usuário.
  useEffect(() => {
    setForm(prev => ({
      empresa: prev.empresa || card.empresa || "",
      cnpj: prev.cnpj || card.cnpj || "",
      representante_nome: prev.representante_nome || card.representante_nome || card.nome || "",
      representante_cpf: prev.representante_cpf || card.representante_cpf || "",
      email: prev.email || card.email || "",
      telefone: prev.telefone || card.telefone || "",
      endereco: prev.endereco || card.endereco || "",
      cidade: prev.cidade || card.cidade || "",
      estado: prev.estado || card.estado || "",
      cep: prev.cep || card.cep || "",
      qtd_salarios_minimos: prev.qtd_salarios_minimos || card.qtd_salarios_minimos || "",
      porcentagem_exito: prev.porcentagem_exito || card.porcentagem_exito || "",
      data_primeiro_pagamento: prev.data_primeiro_pagamento || card.data_primeiro_pagamento || "",
      dia_demais_pagamentos: prev.dia_demais_pagamentos || card.dia_demais_pagamentos || "",
      prazo_entrega_relatorios: prev.prazo_entrega_relatorios || card.prazo_entrega_relatorios?.toString() || "",
      prazo_contrato: prev.prazo_contrato || card.prazo_contrato || "",
    }));
    setValorMensalidade(prev => prev ?? card.valor_mensalidade ?? null);
    setValorDivida(prev => prev ?? card.valor_divida ?? null);
    setValorProposta(prev => prev ?? card.valor_proposta ?? null);
  }, [card.empresa, card.cnpj, card.representante_nome, card.representante_cpf, card.email, card.telefone, card.endereco, card.cidade, card.estado, card.cep, card.qtd_salarios_minimos, card.porcentagem_exito, card.data_primeiro_pagamento, card.dia_demais_pagamentos, card.prazo_entrega_relatorios, card.prazo_contrato, card.valor_mensalidade, card.valor_divida, card.valor_proposta, card.nome]);


  const isCNPJType = tipo === "tributario_cnpj" || tipo === "empresarial_completo";

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!tipo) errs.push("Tipo de contrato");
    if (isCNPJType && !form.empresa.trim()) errs.push("Nome da Empresa");
    if (isCNPJType && !form.cnpj.trim()) errs.push("CNPJ");
    if (!form.representante_nome.trim()) errs.push("Nome do Representante");
    if (!form.representante_cpf.trim()) errs.push("CPF do Representante");
    if (!form.email.trim()) errs.push("Email");
    if (valorMensalidade === null || valorMensalidade === 0) errs.push("Valor da Mensalidade");
    if (!form.qtd_salarios_minimos.trim()) errs.push("Qtd Salários Mínimos");
    if (!form.porcentagem_exito.trim()) errs.push("Porcentagem de Êxito");
    if (!form.data_primeiro_pagamento) errs.push("Data do Primeiro Pagamento");
    if (!form.dia_demais_pagamentos) errs.push("Dia dos Demais Pagamentos");
    if (!form.prazo_entrega_relatorios.trim()) errs.push("Prazo Entrega Relatórios");
    if (isCNPJType) {
      cnpjsAdicionais.forEach((c, i) => {
        if (!c.empresa?.trim()) errs.push(`CNPJ adicional #${i + 1}: Empresa`);
        if (!c.cnpj?.trim()) errs.push(`CNPJ adicional #${i + 1}: CNPJ`);
        if (!c.mesmo_endereco && !c.endereco?.trim()) errs.push(`CNPJ adicional #${i + 1}: Endereço`);
      });
      sociosAdicionais.forEach((s, i) => {
        if (!s.nome?.trim()) errs.push(`Sócio adicional #${i + 1}: Nome`);
        if (!s.cpf?.trim()) errs.push(`Sócio adicional #${i + 1}: CPF`);
      });
    }
    return errs;
  };

  const isFormValid = () => validate().length === 0;

  const saveFields = async () => {
    const updates: Partial<CardType> & Record<string, any> = {
      tipo_contrato: tipo as ContractType || null,
      empresa: form.empresa || null,
      cnpj: form.cnpj || null,
      representante_nome: form.representante_nome || null,
      representante_cpf: form.representante_cpf || null,
      email: form.email || null,
      telefone: form.telefone || null,
      endereco: form.endereco || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      cep: form.cep || null,
      valor_mensalidade: valorMensalidade,
      qtd_salarios_minimos: form.qtd_salarios_minimos || null,
      porcentagem_exito: form.porcentagem_exito || null,
      valor_divida: valorDivida,
      valor_proposta: valorProposta,
      data_primeiro_pagamento: form.data_primeiro_pagamento || null,
      dia_demais_pagamentos: form.dia_demais_pagamentos || null,
      prazo_entrega_relatorios: form.prazo_entrega_relatorios ? parseInt(form.prazo_entrega_relatorios) : null,
      prazo_contrato: form.prazo_contrato || null,
      cnpjs_adicionais: isCNPJType ? cnpjsAdicionais.map(c => c.mesmo_endereco
        ? { empresa: c.empresa, cnpj: c.cnpj, mesmo_endereco: true }
        : { empresa: c.empresa, cnpj: c.cnpj, mesmo_endereco: false, endereco: c.endereco || "", cep: c.cep || "", cidade: c.cidade || "", estado: c.estado || "" }
      ) : [],
      socios_adicionais: isCNPJType ? sociosAdicionais.map(s => ({ nome: s.nome, cpf: s.cpf })) : [],
    } as any;
    await onUpdate(card.id, updates);
  };

  const handleAction = async (action: "zapsign" | "download" | "whatsapp") => {
    const errs = validate();
    if (errs.length) {
      setErrors(errs);
      toast.error(`Campos obrigatórios faltando: ${errs.join(", ")}`);
      return;
    }
    setErrors([]);
    setActionLoading(action);
    setLastResult(null);

    try {
      await saveFields();
      await new Promise(r => setTimeout(r, 500));

      const data = await invokeContractFunction({ lead_id: card.id, action });

      if (!data?.success) {
        toast.error(data?.message || "Erro ao gerar contrato");
        setActionLoading(null);
        return;
      }

      setLastResult({ action, data });

      if (action === "zapsign") {
        if (data.zapsign_sent) {
          toast.success("✅ Contrato gerado e enviado para assinatura!");
          onUpdate(card.id, {
            contrato_status: "enviado" as ContractStatus,
            contrato_file_url: data.file_url,
            contract_url: data.sign_url,
            contrato_preparado_em: new Date().toISOString(),
            stage: "link_enviado" as Stage,
          });
        } else {
          toast.warning(`⚠️ ${data.message}`);
          onUpdate(card.id, {
            contrato_status: "gerado" as ContractStatus,
            contrato_file_url: data.file_url,
            contrato_preparado_em: new Date().toISOString(),
            stage: "link_enviado" as Stage,
          });
        }
      } else if (action === "download") {
        toast.success("📥 Contrato gerado! Download iniciado.");
        // Trigger download
        if (data.file_url) {
          try {
            const res = await fetch(data.file_url);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `contrato_${card.nome || card.id}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
          } catch {
            window.open(data.file_url, "_blank");
          }
        }
        onUpdate(card.id, {
          contrato_status: "gerado" as ContractStatus,
          contrato_file_url: data.file_url,
          contrato_preparado_em: new Date().toISOString(),
          stage: "link_enviado" as Stage,
        });
      } else if (action === "whatsapp") {
        toast.success("📱 Contrato gerado! Abrindo WhatsApp Web...");
        if (data.whatsapp_url) {
          window.open(data.whatsapp_url, "_blank");
        }
        onUpdate(card.id, {
          contrato_status: "enviado_whatsapp" as ContractStatus,
          contrato_file_url: data.file_url,
          contrato_preparado_em: new Date().toISOString(),
          stage: "link_enviado" as Stage,
        });
      }
      // Aviso Slack #closer (idempotente; só envia se lead já estiver ganho)
      notifySlackGanho(card.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar contrato");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadFile = async (url: string, fileName: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleRegenerate = () => {
    onUpdate(card.id, { contrato_status: "pendente" as ContractStatus, contrato_file_url: null, contract_url: null });
    setLastResult(null);
  };

  const handlePreview = async () => {
    if (!tipo) {
      toast.error("Selecione o tipo de contrato primeiro");
      return;
    }
    setActionLoading("preview");
    try {
      await saveFields();
      await new Promise(r => setTimeout(r, 400));
      const data = await invokeContractFunction({ lead_id: card.id, action: "preview" });
      const url = data?.file_url || (data as any)?.preview_url || (data as any)?.url || data?.share_url;
      if (!url) {
        toast.error(data?.message || "Prévia não disponível");
        return;
      }
      window.open(url, "_blank");
      setPreviewUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar a prévia");
    } finally {
      setActionLoading(null);
    }
  };

  const updateField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const inputClass = (fieldName: string) =>
    `w-full text-sm bg-muted/50 border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${errors.includes(fieldName) ? "border-red-500" : "border-border"}`;

  // ── GENERATED / ENVIADO / ASSINADO VIEW ──
  if (isGenerated) {
    const statusInfo = STATUS_BADGES[card.contrato_status!] || { label: card.contrato_status, color: "bg-muted text-foreground" };
    const tipoLabel = CONTRACT_TYPE_OPTIONS.find(t => t.value === card.tipo_contrato)?.label || card.tipo_contrato;
    const isCPFType = card.tipo_contrato === "tributario_cpf";
    const empresaName = isCPFType ? (card.representante_nome || "Cliente") : (card.empresa || "Empresa");
    const docName = `CONTRATO DE ASSESSORIA JURÍDICA TRIBUTÁRIA E EMPRESARIAL - PQA & ${empresaName}`;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/20 text-primary font-medium">{tipoLabel}</span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
        </div>

        <p className="text-sm font-medium text-foreground">{docName}</p>

        {card.contrato_preparado_em && (
          <p className="text-xs text-muted-foreground">
            Gerado em: {new Date(card.contrato_preparado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            {card.contrato_preparado_por && ` por ${card.contrato_preparado_por}`}
          </p>
        )}

        {card.contrato_status === "assinado" && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
            <p className="text-green-400 font-medium">🎉 Contrato assinado{card.zapsign_signed_at ? ` em ${new Date(card.zapsign_signed_at).toLocaleDateString("pt-BR")}` : ""}</p>
            <button
              onClick={handleOpenSignedContract}
              disabled={loadingSignedUrl}
              className="text-sm text-primary hover:underline mt-2 inline-flex items-center gap-1 disabled:opacity-60"
            >
              {loadingSignedUrl && <Loader2 size={12} className="animate-spin" />}
              {loadingSignedUrl ? "Abrindo…" : "Ver contrato assinado"}
            </button>
          </div>
        )}

{(() => {
          const signerToken = (card as any).zapsign_signer_token as string | null | undefined;
          const isZapUrl = card.contract_url && card.contract_url.startsWith("https://app.zapsign.com.br/");
          const signLink = isZapUrl
            ? card.contract_url!
            : (signerToken ? `https://app.zapsign.com.br/verificar/${signerToken}` : null);
          if (!signLink) return null;

          const copySignLink = async () => {
            try { await navigator.clipboard.writeText(signLink); toast.success("Link copiado!"); }
            catch { toast.error("Não foi possível copiar"); }
          };

          const buildProposalMessage = () => {
            const primeiroNome = (card.nome || "").trim().split(/\s+/)[0] || card.nome || "";
            const vm = card.valor_mensalidade;
            const valorFmt = vm != null
              ? vm.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : "—";
            const qtdSm = (card.qtd_salarios_minimos || "").replace(".", ",");

            let diasTxt = "alguns";
            const dp = card.data_primeiro_pagamento;
            if (dp && /^\d{4}-\d{2}-\d{2}/.test(dp)) {
              const [y, m, d] = dp.slice(0, 10).split("-").map(Number);
              const target = new Date(Date.UTC(y, m - 1, d));
              const nowSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
              const todayUTC = new Date(Date.UTC(nowSP.getFullYear(), nowSP.getMonth(), nowSP.getDate()));
              const diff = Math.ceil((target.getTime() - todayUTC.getTime()) / 86400000);
              diasTxt = String(Math.max(0, diff));
            }

            return `${primeiroNome} ! Conforme alinhamos na reunião, estou te encaminhando nossa proposta comercial de assessoria jurídica tributária para análise.
Atuamos com exclusão de débitos fiscais e negociação tributária, sempre com foco em segurança jurídica e previsibilidade financeira para empresários e sócios.
Na proposta, você encontrará:
📌 Mensalidade: R$ ${valorFmt} (${qtdSm} salário-mínimo), com o primeiro pagamento apenas ${diasTxt} dias após a assinatura;
📌 Relatório fiscal e judicial completo, entregue em até 7 dias úteis após o envio dos acessos.
Nosso acompanhamento é contínuo, com análise mensal de oportunidades de negociação e exclusão de débitos.
${signLink}`;
          };

          const copyProposal = async () => {
            try { await navigator.clipboard.writeText(buildProposalMessage()); toast.success("Mensagem copiada!"); }
            catch { toast.error("Não foi possível copiar"); }
          };

          return (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-medium text-foreground uppercase tracking-wider">Link de assinatura (ZapSign)</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={signLink}
                  onFocus={e => e.currentTarget.select()}
                  className="flex-1 min-w-0 text-xs bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={copySignLink}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted text-foreground"
                >
                  <Copy size={12} /> Copiar
                </button>
                <a
                  href={signLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted text-foreground"
                >
                  <ExternalLink size={12} /> Abrir
                </a>
                <button
                  onClick={copyProposal}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary"
                >
                  <Copy size={12} /> Copiar mensagem com o Link
                </button>
              </div>
            </div>
          );
        })()}

        <ZapsignHistory
          leadId={card.id}
          signerTokenFallback={(card as any).zapsign_signer_token || null}
          isSigned={!!card.zapsign_signed_at}
        />



        {card.contrato_status === "enviado_whatsapp" && (
          <p className="text-xs text-muted-foreground bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
            📱 Contrato enviado via WhatsApp. O link de download expira em 7 dias.
          </p>
        )}

        {card.contrato_file_url && (
          <button onClick={() => handleDownloadFile(card.contrato_file_url!, `contrato_${card.nome || card.id}.docx`)} className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20 w-fit">
            <Download size={16} />Baixar Word
          </button>
        )}

        {card.contrato_status === "gerado" && (
          <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/50">
            📄 Contrato gerado e disponível para download.
          </p>
        )}

        <button onClick={handleRegenerate} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-4">
          <RefreshCw size={12} />Regerar Contrato
        </button>
      </div>
    );
  }

  // ── FORM VIEW ──
  return (
    <div className="space-y-5">
      {/* Type selector */}
      <div>
        <p className="text-xs font-medium text-foreground uppercase tracking-wider mb-2">Tipo de Contrato *</p>
        <div className="space-y-2">
          {CONTRACT_TYPE_OPTIONS.map(opt => (
            <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${tipo === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
              <input type="radio" name="tipo_contrato" value={opt.value} checked={tipo === opt.value} onChange={() => setTipo(opt.value)} className="mt-0.5 accent-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
        {errors.includes("Tipo de contrato") && <p className="text-xs text-red-500 mt-1">Selecione o tipo de contrato</p>}
      </div>

      {tipo && (
        <>
          {/* Contratante */}
          <div>
            <p className="text-xs font-medium text-foreground uppercase tracking-wider mb-3">Dados da Parte Contratante</p>
            <div className="space-y-3">
              {isCNPJType && (
                <>
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block">Nome da Empresa *</label>
                    <input value={form.empresa} onChange={e => updateField("empresa", e.target.value)} className={inputClass("Nome da Empresa")} />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block">CNPJ *</label>
                    <input value={form.cnpj} onChange={e => updateField("cnpj", e.target.value)} placeholder="XX.XXX.XXX/XXXX-XX" className={inputClass("CNPJ")} />
                  </div>
                </>
              )}
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Nome Completo do Representante *</label>
                <input value={form.representante_nome} onChange={e => updateField("representante_nome", e.target.value)} className={inputClass("Nome do Representante")} />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">CPF do Representante *</label>
                <input value={form.representante_cpf} onChange={e => updateField("representante_cpf", e.target.value)} placeholder="XXX.XXX.XXX-XX" className={inputClass("CPF do Representante")} />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Email *</label>
                <input type="email" value={form.email} onChange={e => updateField("email", e.target.value)} className={inputClass("Email")} />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Telefone</label>
                <input value={form.telefone} onChange={e => updateField("telefone", e.target.value)} className={inputClass("")} />
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div>
            <p className="text-xs font-medium text-foreground uppercase tracking-wider mb-3">Endereço</p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Endereço (rua, nº, bairro)</label>
                <input value={form.endereco} onChange={e => updateField("endereco", e.target.value)} className={inputClass("")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Cidade</label>
                  <input value={form.cidade} onChange={e => updateField("cidade", e.target.value)} className={inputClass("")} />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Estado</label>
                  <select value={form.estado} onChange={e => updateField("estado", e.target.value)} className={inputClass("")}>
                    <option value="">Selecione</option>
                    {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">CEP</label>
                <input value={form.cep} onChange={e => updateField("cep", e.target.value)} placeholder="XXXXX-XXX" className={inputClass("")} />
              </div>
            </div>
          </div>

          {isCNPJType && (
            <>
              {/* CNPJs adicionais */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-foreground uppercase tracking-wider">CNPJs adicionais</p>
                  <button
                    type="button"
                    onClick={() => setCnpjsAdicionais(prev => [...prev, { empresa: "", cnpj: "", mesmo_endereco: true }])}
                    className="text-xs flex items-center gap-1 px-2 py-1 rounded-md border border-border hover:bg-muted text-foreground"
                  >
                    <Plus size={12} /> Adicionar CNPJ
                  </button>
                </div>
                {cnpjsAdicionais.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">Nenhum CNPJ adicional. O contrato sairá com apenas o CNPJ principal.</p>
                )}
                <div className="space-y-3">
                  {cnpjsAdicionais.map((c, idx) => (
                    <div key={idx} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium text-muted-foreground">CNPJ #{idx + 2}</p>
                        <button
                          type="button"
                          onClick={() => setCnpjsAdicionais(prev => prev.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-red-500"
                          aria-label="Remover CNPJ"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground mb-1 block">Empresa *</label>
                        <input
                          value={c.empresa}
                          onChange={e => setCnpjsAdicionais(prev => prev.map((p, i) => i === idx ? { ...p, empresa: e.target.value } : p))}
                          className={inputClass("")}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground mb-1 block">CNPJ *</label>
                        <input
                          value={c.cnpj}
                          onChange={e => setCnpjsAdicionais(prev => prev.map((p, i) => i === idx ? { ...p, cnpj: maskCNPJ(e.target.value) } : p))}
                          placeholder="00.000.000/0000-00"
                          className={inputClass("")}
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={c.mesmo_endereco}
                          onChange={e => setCnpjsAdicionais(prev => prev.map((p, i) => i === idx ? { ...p, mesmo_endereco: e.target.checked } : p))}
                          className="accent-primary"
                        />
                        Usar o mesmo endereço do CNPJ principal
                      </label>
                      {!c.mesmo_endereco && (
                        <div className="space-y-2 pt-1">
                          <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block">Endereço (rua, nº, bairro) *</label>
                            <input
                              value={c.endereco || ""}
                              onChange={e => setCnpjsAdicionais(prev => prev.map((p, i) => i === idx ? { ...p, endereco: e.target.value } : p))}
                              className={inputClass("")}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] text-muted-foreground mb-1 block">Cidade</label>
                              <input
                                value={c.cidade || ""}
                                onChange={e => setCnpjsAdicionais(prev => prev.map((p, i) => i === idx ? { ...p, cidade: e.target.value } : p))}
                                className={inputClass("")}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-muted-foreground mb-1 block">Estado</label>
                              <select
                                value={c.estado || ""}
                                onChange={e => setCnpjsAdicionais(prev => prev.map((p, i) => i === idx ? { ...p, estado: e.target.value } : p))}
                                className={inputClass("")}
                              >
                                <option value="">Selecione</option>
                                {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block">CEP</label>
                            <input
                              value={c.cep || ""}
                              onChange={e => setCnpjsAdicionais(prev => prev.map((p, i) => i === idx ? { ...p, cep: maskCEP(e.target.value) } : p))}
                              placeholder="00000-000"
                              className={inputClass("")}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sócios adicionais */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-foreground uppercase tracking-wider">Sócios / representantes adicionais</p>
                  <button
                    type="button"
                    onClick={() => setSociosAdicionais(prev => [...prev, { nome: "", cpf: "" }])}
                    className="text-xs flex items-center gap-1 px-2 py-1 rounded-md border border-border hover:bg-muted text-foreground"
                  >
                    <Plus size={12} /> Adicionar sócio
                  </button>
                </div>
                {sociosAdicionais.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">Nenhum sócio adicional. Apenas o representante principal será incluído.</p>
                )}
                <div className="space-y-3">
                  {sociosAdicionais.map((s, idx) => (
                    <div key={idx} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium text-muted-foreground">Sócio #{idx + 2}</p>
                        <button
                          type="button"
                          onClick={() => setSociosAdicionais(prev => prev.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-red-500"
                          aria-label="Remover sócio"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground mb-1 block">Nome *</label>
                        <input
                          value={s.nome}
                          onChange={e => setSociosAdicionais(prev => prev.map((p, i) => i === idx ? { ...p, nome: e.target.value } : p))}
                          className={inputClass("")}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground mb-1 block">CPF *</label>
                        <input
                          value={s.cpf}
                          onChange={e => setSociosAdicionais(prev => prev.map((p, i) => i === idx ? { ...p, cpf: maskCPF(e.target.value) } : p))}
                          placeholder="000.000.000-00"
                          className={inputClass("")}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}



          {/* Financeiro */}
          <div>
            <p className="text-xs font-medium text-foreground uppercase tracking-wider mb-3">Dados Financeiros</p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Valor da Mensalidade (R$) *</label>
                <InputMoedaBRL value={valorMensalidade} onChange={setValorMensalidade} hasError={errors.includes("Valor da Mensalidade")} />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Quantidade de Salários Mínimos *</label>
                <input value={form.qtd_salarios_minimos} onChange={e => updateField("qtd_salarios_minimos", e.target.value)} placeholder="0 a 10" className={inputClass("Qtd Salários Mínimos")} />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Porcentagem de Êxito (%) *</label>
                <input value={form.porcentagem_exito} onChange={e => updateField("porcentagem_exito", e.target.value)} placeholder="Ex: 30" className={inputClass("Porcentagem de Êxito")} />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Valor da Dívida (R$)</label>
                <InputMoedaBRL value={valorDivida} onChange={setValorDivida} />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Valor da Proposta (R$)</label>
                <InputMoedaBRL value={valorProposta} onChange={setValorProposta} />
              </div>
            </div>
          </div>

          {/* Pagamento */}
          <div>
            <p className="text-xs font-medium text-foreground uppercase tracking-wider mb-3">Dados de Pagamento</p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Data do Primeiro Pagamento *</label>
                <input type="date" value={form.data_primeiro_pagamento} onChange={e => updateField("data_primeiro_pagamento", e.target.value)} className={inputClass("Data do Primeiro Pagamento")} />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Dia dos Demais Pagamentos *</label>
                <select value={form.dia_demais_pagamentos} onChange={e => updateField("dia_demais_pagamentos", e.target.value)} className={inputClass("Dia dos Demais Pagamentos")}>
                  <option value="">Selecione</option>
                  <option value="5">Dia 5</option>
                  <option value="10">Dia 10</option>
                  <option value="15">Dia 15</option>
                  <option value="25">Dia 25</option>
                </select>
              </div>
            </div>
          </div>

          {/* Operacional */}
          <div>
            <p className="text-xs font-medium text-foreground uppercase tracking-wider mb-3">Dados Operacionais</p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Prazo Entrega Relatórios (dias úteis) *</label>
                <input type="number" min={1} max={20} value={form.prazo_entrega_relatorios} onChange={e => updateField("prazo_entrega_relatorios", e.target.value)} className={inputClass("Prazo Entrega Relatórios")} />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Prazo do Contrato</label>
                <input value={form.prazo_contrato} onChange={e => updateField("prazo_contrato", e.target.value)} placeholder="Ex: 12 meses" className={inputClass("")} />
              </div>
            </div>
          </div>

          {/* Actions - 3 buttons */}
          <div className="pt-2 space-y-3">
            <div className="flex gap-2 flex-wrap">
              <button onClick={saveFields} className="text-sm px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border">
                Salvar Dados
              </button>
              <button
                onClick={handlePreview}
                disabled={!tipo || actionLoading !== null}
                className="text-sm px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20 flex items-center gap-2 disabled:opacity-40"
              >
                {actionLoading === "preview" ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                {actionLoading === "preview" ? "Gerando prévia..." : "Visualizar Prévia"}
              </button>
            </div>

            <p className="text-xs font-medium text-foreground uppercase tracking-wider">Como deseja prosseguir com o contrato?</p>

            {!isFormValid() && (
              <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/50">
                ⚠️ Preencha todos os campos obrigatórios para habilitar as opções abaixo.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* ZapSign */}
              <button
                onClick={() => handleAction("zapsign")}
                disabled={actionLoading !== null || !isFormValid()}
                className="flex flex-col items-center gap-1.5 px-4 py-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-40 border border-primary/20"
              >
                {actionLoading === "zapsign" ? <Loader2 size={20} className="animate-spin" /> : <FileSignature size={20} />}
                <span className="text-sm font-medium">{actionLoading === "zapsign" ? "Enviando..." : "Enviar para ZapSign"}</span>
                <span className="text-[10px] opacity-70">Assinatura eletrônica</span>
              </button>

              {/* Download */}
              <button
                onClick={() => handleAction("download")}
                disabled={actionLoading !== null || !isFormValid()}
                className="flex flex-col items-center gap-1.5 px-4 py-4 rounded-xl bg-muted text-foreground hover:bg-muted/80 transition-all disabled:opacity-40 border border-border"
              >
                {actionLoading === "download" ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                <span className="text-sm font-medium">{actionLoading === "download" ? "Gerando..." : "Criar e Baixar"}</span>
                <span className="text-[10px] text-muted-foreground">Download do .docx</span>
              </button>

              {/* WhatsApp */}
              <button
                onClick={() => handleAction("whatsapp")}
                disabled={actionLoading !== null || !isFormValid()}
                className="flex flex-col items-center gap-1.5 px-4 py-4 rounded-xl text-white hover:opacity-90 transition-all disabled:opacity-40 border border-emerald-600/30"
                style={{ backgroundColor: "#25D366" }}
              >
                {actionLoading === "whatsapp" ? <Loader2 size={20} className="animate-spin" /> : <MessageCircle size={20} />}
                <span className="text-sm font-medium">{actionLoading === "whatsapp" ? "Gerando..." : "Enviar via WhatsApp"}</span>
                <span className="text-[10px] opacity-80">Abre WhatsApp Web</span>
              </button>
            </div>

            {/* Post-action feedback */}
            {lastResult && (
              <div className="rounded-lg border p-3 space-y-1.5 bg-muted/20 border-border">
                {lastResult.action === "zapsign" && lastResult.data.zapsign_sent && (
                  <>
                    <p className="text-sm text-foreground">✅ Contrato enviado para assinatura via ZapSign</p>
                    {lastResult.data.sign_url && (
                      <a href={lastResult.data.sign_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                        <ExternalLink size={12} />Abrir link de assinatura
                      </a>
                    )}
                  </>
                )}
                {lastResult.action === "download" && (
                  <>
                    <p className="text-sm text-foreground">✅ Contrato gerado com sucesso</p>
                    <p className="text-xs text-muted-foreground">📥 O download foi iniciado automaticamente</p>
                    {lastResult.data.file_url && (
                      <button onClick={() => handleDownloadFile(lastResult.data.file_url, `contrato_${card.nome || card.id}.docx`)} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Download size={12} />Baixar novamente
                      </button>
                    )}
                  </>
                )}
                {lastResult.action === "whatsapp" && (
                  <>
                    <p className="text-sm text-foreground">✅ Contrato gerado com sucesso</p>
                    <p className="text-xs text-muted-foreground">📱 WhatsApp Web foi aberto em nova aba</p>
                    <div className="flex gap-3">
                      {lastResult.data.whatsapp_url && (
                        <a href={lastResult.data.whatsapp_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                          <MessageCircle size={12} />Abrir WhatsApp novamente
                        </a>
                      )}
                      {lastResult.data.file_url && (
                        <button onClick={() => handleDownloadFile(lastResult.data.file_url, `contrato_${card.nome || card.id}.docx`)} className="text-xs text-primary hover:underline flex items-center gap-1">
                          <Download size={12} />Baixar contrato
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {errors.length > 0 && (
            <p className="text-xs text-red-500">Campos obrigatórios faltando: {errors.join(", ")}</p>
          )}
        </>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <span>Prévia do Contrato</span>
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-normal text-primary hover:underline flex items-center gap-1 mr-8"
                >
                  <ExternalLink size={12} /> Abrir em nova aba
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`}
              className="w-full flex-1 rounded border border-border bg-white"
              title="Prévia do contrato"
            />
          )}
          <p className="text-[11px] text-muted-foreground">
            ⓘ Prévia renderizada via Office Online. Pode levar alguns segundos para carregar. Os campos não preenchidos aparecem como "_______________".
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
