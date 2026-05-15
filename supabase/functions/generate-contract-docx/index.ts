import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// External Supabase where leads live
const EXT_URL = "https://riyfdcmmabvpcubusujw.supabase.co";
const EXT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpeWZkY21tYWJ2cGN1YnVzdWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NTMyMDMsImV4cCI6MjA5MDIyOTIwM30.pCRIa4UEC9WQiBP8EwzVrO73qS1FbsQ9fvKzlUPD1Gc";

// Template mapping
const TEMPLATE_MAP: Record<string, string> = {
  tributario_cnpj: "templates/tributario_cnpj.docx",
  tributario_cpf: "templates/tributario_cpf.docx",
  empresarial_completo: "templates/empresarial_completo.docx",
};

// ── Helpers ──

function formatBRL(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateExtended(dateStr: string): string {
  const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// ── Template-based document generation ──

async function downloadTemplate(sbInternal: any, templatePath: string): Promise<Uint8Array> {
  const { data, error } = await sbInternal.storage.from("contracts").download(templatePath);
  if (error || !data) {
    throw new Error(`Falha ao baixar template: ${templatePath} - ${error?.message || "arquivo não encontrado"}`);
  }
  return new Uint8Array(await data.arrayBuffer());
}

// ── Replacement rules tied to text patterns inside the actual templates ──
// The templates use generic filler like "(NOME DO CLIENTE)", "xxx.xxx.xxx-xx",
// "R$ xxxxx (valor por extenso)", "x% (valor por extenso)" etc., so we replace
// those patterns within paragraphs anchored by surrounding wording.

interface PatternRule {
  anchor: RegExp;
  replacements: Array<[RegExp, string]>;
}

function buildEnderecoCompleto(lead: any): string {
  const endereco = (lead.endereco || "").trim();
  const cidade = (lead.cidade || "").trim();
  const estado = (lead.estado || "").trim();
  const cep = (lead.cep || "").trim();
  if (!endereco && !cidade && !cep) return "Rua XXXXXX, nº XXXXX, Bairro, CEP nº XX.XXX-XXX, Cidade/UF";
  const parts: string[] = [];
  if (endereco) parts.push(endereco);
  if (cep) parts.push(`CEP nº ${cep}`);
  const loc = [cidade, estado].filter(Boolean).join("/");
  if (loc) parts.push(loc);
  return parts.join(", ");
}

function buildPatternRules(lead: any): PatternRule[] {
  const tipo = lead.tipo_contrato || "tributario_cnpj";
  // tributario_cnpj template uses CPF for the client (pessoa física)
  // tributario_cpf and empresarial_completo use CNPJ for the client (pessoa jurídica)
  const clientIsPF = tipo === "tributario_cnpj";

  const clientName = clientIsPF
    ? (lead.representante_nome || lead.nome || "NOME DO CLIENTE")
    : (lead.empresa || lead.nome || "NOME DO CLIENTE");
  const cpf = lead.representante_cpf || "xxx.xxx.xxx-xx";
  const cnpj = lead.cnpj || "xx.xxx.xxx/xxxx-xx";
  const enderecoFull = buildEnderecoCompleto(lead);

  const valorMensal = lead.valor_mensalidade
    ? formatBRL(Number(lead.valor_mensalidade))
    : "R$ xxxxx";
  const qtdSal = lead.qtd_salarios_minimos ? String(lead.qtd_salarios_minimos) : "xx";
  const exito = lead.porcentagem_exito ? `${lead.porcentagem_exito}%` : "x%";

  const socioNome = lead.representante_nome || "[NOME DO SÓCIO]";
  const socioCpf = lead.representante_cpf || "[número]";

  return [
    // Cliente — parágrafo de qualificação
    {
      anchor: /doravante denominado[^<]*CONTRATANTE/i,
      replacements: [
        [/\(NOME DO CLIENTE\)/g, clientName],
        [/(?<![A-Za-zÀ-ÿ])NOME DO CLIENTE(?![A-Za-zÀ-ÿ])/g, clientName],
        [/xxx\.xxx\.xxx-xx/g, cpf],
        [/xx\.xxx\.xxx\/xxxx-xx/g, cnpj],
        [/Rua XXXXXX, nº XXXXX, Bairro, CEP nº XX\.XXX-XXX, Cidade\/UF/g, enderecoFull],
      ],
    },
    // Honorários mensais
    {
      anchor: /pagar[ãa]o mensalmente [àa] CONTRATADA/i,
      replacements: [
        [/R\$ xxxxx \(valor por extenso\)/g, valorMensal],
        [/xx salários-mínimos/g, `${qtdSal} salários-mínimos`],
      ],
    },
    // Honorários de êxito (vários parágrafos)
    {
      anchor: /honorários de êxito|rescis[ãa]o contratual/i,
      replacements: [
        [/x% \(valor por extenso\)/g, exito],
      ],
    },
    // Sócio coobrigado
    {
      anchor: /denominado sócio coobrigado/i,
      replacements: [
        [/\[NOME DO SÓCIO\]/g, socioNome],
        [/\[número\]/g, socioCpf],
      ],
    },
  ];
}

function applyPatternRules(xml: string, rules: PatternRule[]): string {
  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (paragraph) => {
    const textParts: { match: string; text: string }[] = [];
    const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let m;
    let fullText = "";
    while ((m = tRegex.exec(paragraph)) !== null) {
      textParts.push({ match: m[0], text: m[1] });
      fullText += m[1];
    }
    if (textParts.length === 0) return paragraph;

    // Decode XML entities for matching/replacement, re-escape on write
    const decoded = fullText
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    let working = decoded;
    let changed = false;
    for (const rule of rules) {
      if (!rule.anchor.test(decoded)) continue;
      for (const [pattern, value] of rule.replacements) {
        const next = working.replace(pattern, value);
        if (next !== working) {
          working = next;
          changed = true;
        }
      }
    }

    if (!changed) return paragraph;

    const newText = escapeXml(working);
    let firstReplaced = false;
    let result = paragraph;
    for (const part of textParts) {
      if (!firstReplaced) {
        result = result.replace(part.match, `<w:t xml:space="preserve">${newText}</w:t>`);
        firstReplaced = true;
      } else {
        result = result.replace(part.match, `<w:t xml:space="preserve"></w:t>`);
      }
    }
    return result;
  });
}

async function generateFromTemplate(sbInternal: any, lead: any): Promise<Uint8Array> {
  const tipo = lead.tipo_contrato || "tributario_cnpj";
  const templatePath = TEMPLATE_MAP[tipo];
  if (!templatePath) {
    throw new Error(`Tipo de contrato desconhecido: ${tipo}`);
  }

  const templateBytes = await downloadTemplate(sbInternal, templatePath);

  const fflate = await import("https://esm.sh/fflate@0.8.2");
  const unzipped = fflate.unzipSync(templateBytes);

  const rules = buildPatternRules(lead);

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const xmlFiles = Object.keys(unzipped).filter(
    (name) =>
      name.endsWith(".xml") &&
      (name.includes("word/document") ||
        name.includes("word/header") ||
        name.includes("word/footer"))
  );

  const zipInput: Record<string, any> = {};

  for (const [name, data] of Object.entries(unzipped)) {
    if (xmlFiles.includes(name)) {
      let xmlContent = decoder.decode(data as Uint8Array);
      xmlContent = xmlContent.replace(/<w:highlight\s+w:val="yellow"\s*\/>/g, "");
      xmlContent = xmlContent.replace(/<w:shd[^>]*w:fill="FFFF00"[^>]*\/>/g, "");
      xmlContent = xmlContent.replace(/<w:shd[^>]*w:fill="FFD966"[^>]*\/>/g, "");
      xmlContent = xmlContent.replace(/<w:shd[^>]*w:fill="FFF2CC"[^>]*\/>/g, "");
      const replacedXml = applyPatternRules(xmlContent, rules);
      zipInput[name] = [encoder.encode(replacedXml), { level: 6 }];
    } else if (name.endsWith(".xml") || name.endsWith(".rels")) {
      zipInput[name] = [data as Uint8Array, { level: 6 }];
    } else {
      zipInput[name] = [data as Uint8Array, { level: 0 }];
    }
  }

  return fflate.zipSync(zipInput);
}

// ── ZapSign integration ──

async function sendToZapSign(
  apiKey: string,
  docxBytes: Uint8Array,
  docName: string,
  signerName: string,
  signerEmail: string,
  signerPhone: string | null,
): Promise<{ doc_token: string; signer_token: string; sign_url: string }> {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < docxBytes.length; i += chunkSize) {
    const chunk = docxBytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const b64 = btoa(binary);

  const body: any = {
    name: docName,
    lang: "pt-br",
    signers: [
      {
        name: signerName,
        email: signerEmail,
        send_automatic_email: true,
        send_automatic_whatsapp: !!signerPhone,
        ...(signerPhone ? { phone_country: "55", phone_number: signerPhone.replace(/\D/g, "") } : {}),
      },
    ],
    base64_docx: b64,
  };

  const res = await fetch("https://api.zapsign.com.br/api/v1/docs/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ZapSign API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const signer = data.signers?.[0] || {};
  return {
    doc_token: data.token || "",
    signer_token: signer.token || "",
    sign_url: signer.sign_url || data.sign_url || "",
  };
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id, action = "zapsign" } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ success: false, message: "lead_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read lead from external Supabase
    const sbExt = createClient(EXT_URL, EXT_KEY);
    const { data: lead, error } = await sbExt.from("leads").select("*").eq("id", lead_id).single();
    if (error || !lead) {
      return new Response(JSON.stringify({ success: false, message: "Lead não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate required fields (skipped for preview action)
    const missing: string[] = [];
    if (action !== "preview" && !lead.tipo_contrato) missing.push("tipo_contrato");
    if (action !== "preview") {
      if (!lead.representante_nome) missing.push("representante_nome");
      if (!lead.representante_cpf) missing.push("representante_cpf");
      if (!lead.email) missing.push("email");
      if (!lead.valor_mensalidade) missing.push("valor_mensalidade");
      if (!lead.qtd_salarios_minimos) missing.push("qtd_salarios_minimos");
      if (!lead.porcentagem_exito) missing.push("porcentagem_exito");
      if (!lead.data_primeiro_pagamento) missing.push("data_primeiro_pagamento");
      if (!lead.dia_demais_pagamentos) missing.push("dia_demais_pagamentos");
      if (!lead.prazo_entrega_relatorios) missing.push("prazo_entrega_relatorios");

      const isCNPJ = lead.tipo_contrato === "tributario_cnpj" || lead.tipo_contrato === "empresarial_completo";
      if (isCNPJ) {
        if (!lead.empresa) missing.push("empresa");
        if (!lead.cnpj) missing.push("cnpj");
      }
    } else {
      // Preview needs at least the contract type
      if (!lead.tipo_contrato) {
        return new Response(JSON.stringify({ success: false, message: "Selecione o tipo de contrato para visualizar a prévia" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (missing.length > 0) {
      return new Response(JSON.stringify({ success: false, message: `Campos obrigatórios faltando: ${missing.join(", ")}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Internal Supabase client (for storage)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sbInternal = createClient(supabaseUrl, serviceKey);

    // Generate document from template
    const docxBytes = await generateFromTemplate(sbInternal, lead);

    // Store generated contract in storage
    const fileName = `contratos/${lead_id}_${Date.now()}.docx`;
    const { error: uploadError } = await sbInternal.storage
      .from("contracts")
      .upload(fileName, docxBytes, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    let fileUrl: string;
    if (uploadError) {
      console.error("Upload error:", uploadError.message);
      let bin = "";
      for (let i = 0; i < docxBytes.length; i += 8192) {
        bin += String.fromCharCode(...docxBytes.subarray(i, i + 8192));
      }
      const b64 = btoa(bin);
      fileUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${b64}`;
    } else {
      const { data: urlData } = sbInternal.storage.from("contracts").getPublicUrl(fileName);
      fileUrl = urlData.publicUrl;
    }

    const isCPF = lead.tipo_contrato === "tributario_cpf";
    const empresaName = isCPF ? (lead.representante_nome || "Cliente") : (lead.empresa || "Empresa");
    const contractName = `CONTRATO PQA & ${empresaName}`;

    // ── ACTION: PREVIEW ──
    if (action === "preview") {
      const { data: signedUrl } = await sbInternal.storage
        .from("contracts")
        .createSignedUrl(fileName, 60 * 60); // 1 hour
      return new Response(JSON.stringify({
        success: true,
        action: "preview",
        file_url: fileUrl,
        file_name: fileName,
        share_url: signedUrl?.signedUrl || fileUrl,
        message: "Prévia gerada",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: DOWNLOAD ──
    if (action === "download") {
      await sbExt.from("leads").update({
        contrato_status: "gerado",
        contrato_file_url: fileUrl,
        contrato_preparado_em: new Date().toISOString(),
      }).eq("id", lead_id);

      return new Response(JSON.stringify({
        success: true,
        action: "download",
        file_url: fileUrl,
        file_name: fileName,
        message: `Contrato "${contractName}" gerado com sucesso! Pronto para download.`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: WHATSAPP ──
    if (action === "whatsapp") {
      const { data: signedUrl } = await sbInternal.storage
        .from("contracts")
        .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days
      const shareUrl = signedUrl?.signedUrl || fileUrl;

      await sbExt.from("leads").update({
        contrato_status: "enviado_whatsapp",
        contrato_file_url: fileUrl,
        contrato_preparado_em: new Date().toISOString(),
      }).eq("id", lead_id);

      const phone = (lead.telefone || "").replace(/\D/g, "");
      const whatsappPhone = phone.startsWith("55") ? phone : `55${phone}`;
      const whatsappMessage = encodeURIComponent(
        `Olá ${lead.representante_nome || lead.nome || ""}! Segue o contrato de assessoria jurídica da Pena Quadros Advogados para sua análise e assinatura:\n\n${shareUrl}\n\nQualquer dúvida, estamos à disposição!`
      );
      const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${whatsappMessage}`;

      return new Response(JSON.stringify({
        success: true,
        action: "whatsapp",
        file_url: fileUrl,
        file_name: fileName,
        share_url: shareUrl,
        whatsapp_url: whatsappUrl,
        whatsapp_phone: whatsappPhone,
        message: `Contrato "${contractName}" gerado! Abrindo WhatsApp Web para envio.`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: ZAPSIGN (default) ──
    const zapSignKey = Deno.env.get("ZAPSIGN_API_KEY");
    let zapSignResult: { doc_token: string; signer_token: string; sign_url: string } | null = null;
    let zapSignError: string | null = null;

    const docName = `CONTRATO DE ASSESSORIA JURÍDICA TRIBUTÁRIA E EMPRESARIAL - PQA & ${empresaName}`;

    if (zapSignKey) {
      try {
        zapSignResult = await sendToZapSign(
          zapSignKey,
          docxBytes,
          docName,
          lead.representante_nome || empresaName,
          lead.email,
          lead.telefone || null,
        );
      } catch (e: any) {
        console.error("ZapSign error:", e.message);
        zapSignError = e.message;
      }
    } else {
      zapSignError = "ZAPSIGN_API_KEY não configurada";
    }

    const updatePayload: any = {
      contrato_file_url: fileUrl,
      contrato_preparado_em: new Date().toISOString(),
    };

    if (zapSignResult) {
      updatePayload.contrato_status = "enviado";
      updatePayload.zapsign_doc_token = zapSignResult.doc_token;
      updatePayload.zapsign_signer_token = zapSignResult.signer_token;
      updatePayload.contract_url = zapSignResult.sign_url;
    } else {
      updatePayload.contrato_status = "gerado";
    }

    await sbExt.from("leads").update(updatePayload).eq("id", lead_id);

    return new Response(JSON.stringify({
      success: true,
      action: "zapsign",
      file_name: fileName,
      file_url: fileUrl,
      sign_url: zapSignResult?.sign_url || null,
      doc_token: zapSignResult?.doc_token || null,
      docx_generated: true,
      zapsign_sent: !!zapSignResult,
      zapsign_error: zapSignError,
      message: zapSignResult
        ? `Contrato "${contractName}" gerado e enviado para assinatura no ZapSign!`
        : zapSignError
          ? `Contrato gerado, mas erro no ZapSign: ${zapSignError}. Baixe o Word e suba manualmente.`
          : "Contrato gerado com sucesso",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Error:", e.message, e.stack);
    return new Response(JSON.stringify({ success: false, message: e.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
