import { useState, useEffect } from "react";
import { FileText, Download, Loader2, RefreshCw, FileSignature, ExternalLink, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import type { PipelineCard as CardType, ContractType, ContractStatus } from "./types";
import { formatBRL } from "./types";
import { supabase } from "@/integrations/supabase/client";

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

interface Props {
  card: CardType;
  onUpdate: (id: string, u: Partial<CardType>) => void;
}

export function ContractTab({ card, onUpdate }: Props) {
  const isGenerated = card.contrato_status && card.contrato_status !== "pendente";

  const [tipo, setTipo] = useState<ContractType | "">(card.tipo_contrato || "");
  const [form, setForm] = useState({
    empresa: card.empresa || "",
    cnpj: card.cnpj || "",
    representante_nome: card.representante_nome || "",
    representante_cpf: card.representante_cpf || "",
    email: card.email || "",
    telefone: card.telefone || "",
    endereco: card.endereco || "",
    cidade: card.cidade || "",
    estado: card.estado || "",
    cep: card.cep || "",
    valor_mensalidade: card.valor_mensalidade?.toString() || "",
    qtd_salarios_minimos: card.qtd_salarios_minimos || "",
    porcentagem_exito: card.porcentagem_exito || "",
    valor_divida: card.valor_divida?.toString() || "",
    valor_proposta: card.valor_proposta?.toString() || "",
    data_primeiro_pagamento: card.data_primeiro_pagamento || "",
    dia_demais_pagamentos: card.dia_demais_pagamentos || "",
    prazo_entrega_relatorios: card.prazo_entrega_relatorios?.toString() || "",
    prazo_contrato: card.prazo_contrato || "",
  });
  const [actionLoading, setActionLoading] = useState<"zapsign" | "download" | "whatsapp" | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<{ action: string; data: any } | null>(null);

  useEffect(() => {
    setTipo(card.tipo_contrato || "");
    setForm({
      empresa: card.empresa || "",
      cnpj: card.cnpj || "",
      representante_nome: card.representante_nome || "",
      representante_cpf: card.representante_cpf || "",
      email: card.email || "",
      telefone: card.telefone || "",
      endereco: card.endereco || "",
      cidade: card.cidade || "",
      estado: card.estado || "",
      cep: card.cep || "",
      valor_mensalidade: card.valor_mensalidade?.toString() || "",
      qtd_salarios_minimos: card.qtd_salarios_minimos || "",
      porcentagem_exito: card.porcentagem_exito || "",
      valor_divida: card.valor_divida?.toString() || "",
      valor_proposta: card.valor_proposta?.toString() || "",
      data_primeiro_pagamento: card.data_primeiro_pagamento || "",
      dia_demais_pagamentos: card.dia_demais_pagamentos || "",
      prazo_entrega_relatorios: card.prazo_entrega_relatorios?.toString() || "",
      prazo_contrato: card.prazo_contrato || "",
    });
    setLastResult(null);
  }, [card.id]);

  const isCNPJType = tipo === "tributario_cnpj" || tipo === "empresarial_completo";

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!tipo) errs.push("Tipo de contrato");
    if (isCNPJType && !form.empresa.trim()) errs.push("Nome da Empresa");
    if (isCNPJType && !form.cnpj.trim()) errs.push("CNPJ");
    if (!form.representante_nome.trim()) errs.push("Nome do Representante");
    if (!form.representante_cpf.trim()) errs.push("CPF do Representante");
    if (!form.email.trim()) errs.push("Email");
    if (!form.valor_mensalidade.trim()) errs.push("Valor da Mensalidade");
    if (!form.qtd_salarios_minimos.trim()) errs.push("Qtd Salários Mínimos");
    if (!form.porcentagem_exito.trim()) errs.push("Porcentagem de Êxito");
    if (!form.data_primeiro_pagamento) errs.push("Data do Primeiro Pagamento");
    if (!form.dia_demais_pagamentos) errs.push("Dia dos Demais Pagamentos");
    if (!form.prazo_entrega_relatorios.trim()) errs.push("Prazo Entrega Relatórios");
    return errs;
  };

  const isFormValid = () => validate().length === 0;

  const saveFields = async () => {
    const updates: Partial<CardType> = {
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
      valor_mensalidade: form.valor_mensalidade ? parseFloat(form.valor_mensalidade.replace(",", ".")) : null,
      qtd_salarios_minimos: form.qtd_salarios_minimos || null,
      porcentagem_exito: form.porcentagem_exito || null,
      valor_divida: form.valor_divida ? parseFloat(form.valor_divida.replace(",", ".")) : null,
      valor_proposta: form.valor_proposta ? parseFloat(form.valor_proposta.replace(",", ".")) : null,
      data_primeiro_pagamento: form.data_primeiro_pagamento || null,
      dia_demais_pagamentos: form.dia_demais_pagamentos || null,
      prazo_entrega_relatorios: form.prazo_entrega_relatorios ? parseInt(form.prazo_entrega_relatorios) : null,
      prazo_contrato: form.prazo_contrato || null,
    };
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

      const { data, error } = await supabase.functions.invoke("generate-contract-docx", {
        body: { lead_id: card.id, action },
      });

      if (error || !data?.success) {
        toast.error(data?.message || error?.message || "Erro ao gerar contrato");
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
            stage: "link_enviado" as const,
          });
        } else {
          toast.warning(`⚠️ ${data.message}`);
          onUpdate(card.id, {
            contrato_status: "gerado" as ContractStatus,
            contrato_file_url: data.file_url,
            contrato_preparado_em: new Date().toISOString(),
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
          stage: "link_enviado" as const,
        });
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar contrato");
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
            {card.contract_url && (
              <a href={card.contract_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline mt-2 inline-block">
                Ver contrato assinado
              </a>
            )}
          </div>
        )}

        {card.contrato_status === "enviado" && card.contract_url && (
          <a href={card.contract_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors border border-amber-500/20 w-fit">
            <ExternalLink size={16} />Ver no ZapSign
          </a>
        )}

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

          {/* Financeiro */}
          <div>
            <p className="text-xs font-medium text-foreground uppercase tracking-wider mb-3">Dados Financeiros</p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Valor da Mensalidade (R$) *</label>
                <input value={form.valor_mensalidade} onChange={e => updateField("valor_mensalidade", e.target.value)} placeholder="0,00" className={inputClass("Valor da Mensalidade")} />
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
                <input value={form.valor_divida} onChange={e => updateField("valor_divida", e.target.value)} placeholder="0,00" className={inputClass("")} />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Valor da Proposta (R$)</label>
                <input value={form.valor_proposta} onChange={e => updateField("valor_proposta", e.target.value)} placeholder="0,00" className={inputClass("")} />
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
            <div className="flex gap-2">
              <button onClick={saveFields} className="text-sm px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border">
                Salvar Dados
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
    </div>
  );
}
