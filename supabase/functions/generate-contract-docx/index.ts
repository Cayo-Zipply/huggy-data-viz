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

function buildReplacements(lead: any): Record<string, string> {
  const tipo = lead.tipo_contrato || "tributario_cnpj";
  const isCPF = tipo === "tributario_cpf";

  const endereco = lead.endereco || "_______________";
  const cidade = lead.cidade || "_______________";
  const estado = lead.estado || "_______________";
  const cep = lead.cep || "_______________";
  const enderecoCompleto = `${endereco}, CEP nº ${cep}, ${cidade}/${estado}`;

  const valorMensalidade = lead.valor_mensalidade ? formatBRL(Number(lead.valor_mensalidade)) : "_______________";
  const porcentagemExito = lead.porcentagem_exito ? `${lead.porcentagem_exito}%` : "____%";
  const dataPrimeiroPagamento = lead.data_primeiro_pagamento ? formatDateExtended(lead.data_primeiro_pagamento) : "_______________";
  const diaDemais = lead.dia_demais_pagamentos || "___";
  const prazoRelatorios = lead.prazo_entrega_relatorios || "___";
  const hoje = formatDateExtended(new Date().toISOString().split("T")[0]);

  const replacements: Record<string, string> = {
    "[NOME COMPLETO REPRESENTANTE]": lead.representante_nome || "_______________",
    "[CPF]": lead.representante_cpf || "_______________",
    "[ENDEREÇO COMPLETO]": enderecoCompleto,
    "[VALOR DA MENSALIDADE]": valorMensalidade,
    "[QUANTIDADE DE SALÁRIO-MÍNIMOS]": lead.qtd_salarios_minimos || "___",
    "[QUANTIDADE DE SALÁRIO-MÍNIMO]": lead.qtd_salarios_minimos || "___",
    "[PORCENTAGEM DE ÊXITO]": porcentagemExito,
    "[PORCENTAGEM DE ÉXITO]": porcentagemExito,
    "[DE ÉXITO]": porcentagemExito,
    "[DATA DO PRIMEIRO PAGAMENTO]": dataPrimeiroPagamento,
    "[DIA DOS DEMAIS PAGAMENTOS]": diaDemais,
    "[PRAZO DE ENTREGA DOS RELATÓRIOS]": prazoRelatorios,
    "[DIA de MÊS de 202X]": hoje,
    "[DIA de MÉS de 202X]": hoje,
  };

  if (!isCPF) {
    replacements["[NOME DA EMPRESA]"] = lead.empresa || "_______________";
    replacements["[CNPJ]"] = lead.cnpj || "_______________";
  }

  return replacements;
}

function replaceInXml(xml: string, replacements: Record<string, string>): string {
  let result = xml;

  // DOCX XML splits text across multiple <w:t> tags.
  // We need to handle placeholders that may be split across runs.
  // First, try direct replacement for non-split placeholders.
  for (const [placeholder, value] of Object.entries(replacements)) {
    const escapedValue = escapeXml(value);
    // Replace in plain text
    result = result.split(placeholder).join(escapedValue);
    // Replace XML-escaped version
    const escapedPlaceholder = escapeXml(placeholder);
    if (escapedPlaceholder !== placeholder) {
      result = result.split(escapedPlaceholder).join(escapedValue);
    }
  }

  // Handle split placeholders: Word often splits "[PLACEHOLDER]" across runs like:
  // <w:t>[</w:t></w:r><w:r><w:t>PLACEHOLDER</w:t></w:r><w:r><w:t>]</w:t>
  // Strategy: concatenate all text in a paragraph, do replacements, then rebuild.
  // We use a regex approach to find paragraphs and merge text content.

  // Collect text from runs within each paragraph, replace, and redistribute
  result = result.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (paragraph) => {
    // Extract all text content
    let fullText = "";
    const textParts: { match: string; text: string }[] = [];

    // Find all <w:t> elements
    const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let m;
    while ((m = tRegex.exec(paragraph)) !== null) {
      textParts.push({ match: m[0], text: m[1] });
      fullText += m[1];
    }

    if (textParts.length === 0) return paragraph;

    // Check if any placeholder exists in the concatenated text
    let needsReplacement = false;
    for (const [placeholder] of Object.entries(replacements)) {
      const ep = escapeXml(placeholder);
      if (fullText.includes(placeholder) || fullText.includes(ep)) {
        needsReplacement = true;
        break;
      }
    }

    if (!needsReplacement) return paragraph;

    // Do replacements on the full concatenated text
    let replacedText = fullText;
    for (const [placeholder, value] of Object.entries(replacements)) {
      const escapedValue = escapeXml(value);
      replacedText = replacedText.split(placeholder).join(escapedValue);
      const ep = escapeXml(placeholder);
      if (ep !== placeholder) {
        replacedText = replacedText.split(ep).join(escapedValue);
      }
    }

    if (replacedText === fullText) return paragraph;

    // Put all replaced text into the first <w:t> and clear the rest
    let firstReplaced = false;
    let result = paragraph;
    for (const part of textParts) {
      if (!firstReplaced) {
        const newT = `<w:t xml:space="preserve">${replacedText}</w:t>`;
        result = result.replace(part.match, newT);
        firstReplaced = true;
      } else {
        const emptyT = `<w:t xml:space="preserve"></w:t>`;
        result = result.replace(part.match, emptyT);
      }
    }
    return result;
  });

  return result;
}

async function generateFromTemplate(sbInternal: any, lead: any): Promise<Uint8Array> {
  const tipo = lead.tipo_contrato || "tributario_cnpj";
  const templatePath = TEMPLATE_MAP[tipo];
  if (!templatePath) {
    throw new Error(`Tipo de contrato desconhecido: ${tipo}`);
  }

  // Download template
  const templateBytes = await downloadTemplate(sbInternal, templatePath);

  // Unzip
  const { unzipSync, zipSync } = await import("https://esm.sh/fflate@0.8.2");
  const unzipped = unzipSync(templateBytes);

  // Build replacements
  const replacements = buildReplacements(lead);

  // Process XML files (document.xml, header*.xml, footer*.xml)
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const xmlFiles = Object.keys(unzipped).filter(
    (name) =>
      name.endsWith(".xml") &&
      (name.includes("word/document") ||
        name.includes("word/header") ||
        name.includes("word/footer"))
  );

  for (const xmlFile of xmlFiles) {
    let xmlContent = decoder.decode(unzipped[xmlFile]);
    // Remove yellow highlighting/shading from runs
    xmlContent = xmlContent.replace(/<w:highlight\s+w:val="yellow"\s*\/>/g, "");
    xmlContent = xmlContent.replace(/<w:shd[^>]*w:fill="FFFF00"[^>]*\/>/g, "");
    xmlContent = xmlContent.replace(/<w:shd[^>]*w:fill="FFD966"[^>]*\/>/g, "");
    xmlContent = xmlContent.replace(/<w:shd[^>]*w:fill="FFF2CC"[^>]*\/>/g, "");
    // Do placeholder replacements
    const replacedXml = replaceInXml(xmlContent, replacements);
    unzipped[xmlFile] = encoder.encode(replacedXml);
  }

  // Rezip
  return zipSync(unzipped);
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
  // Chunked base64 encoding to avoid stack overflow with large files
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
    base64_pdf: b64,
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
    const { lead_id } = await req.json();
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

    // Validate required fields
    const missing: string[] = [];
    if (!lead.tipo_contrato) missing.push("tipo_contrato");
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
      const b64 = btoa(String.fromCharCode(...docxBytes));
      fileUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${b64}`;
    } else {
      const { data: urlData } = sbInternal.storage.from("contracts").getPublicUrl(fileName);
      fileUrl = urlData.publicUrl;
    }

    // ── ZapSign auto-send ──
    const zapSignKey = Deno.env.get("ZAPSIGN_API_KEY");
    let zapSignResult: { doc_token: string; signer_token: string; sign_url: string } | null = null;
    let zapSignError: string | null = null;

    const isCPF = lead.tipo_contrato === "tributario_cpf";
    const empresaName = isCPF ? (lead.representante_nome || "Cliente") : (lead.empresa || "Empresa");
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

    // Update lead status in external DB
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
      file_name: fileName,
      file_url: fileUrl,
      sign_url: zapSignResult?.sign_url || null,
      doc_token: zapSignResult?.doc_token || null,
      docx_generated: true,
      zapsign_sent: !!zapSignResult,
      zapsign_error: zapSignError,
      message: zapSignResult
        ? "Contrato gerado e enviado para assinatura no ZapSign!"
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
