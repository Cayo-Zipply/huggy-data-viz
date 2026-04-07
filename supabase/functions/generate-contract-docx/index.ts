import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// External Supabase where leads live
const EXT_URL = "https://riyfdcmmabvpcubusujw.supabase.co";
const EXT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpeWZkY21tYWJ2cGN1YnVzdWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NTMyMDMsImV4cCI6MjA5MDIyOTIwM30.pCRIa4UEC9WQiBP8EwzVrO73qS1FbsQ9fvKzlUPD1Gc";

// ── Helpers ──

function numberToWords(n: number): string {
  const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  if (n === 0) return "zero";
  if (n === 100) return "cem";

  const parts: string[] = [];
  if (n >= 1000) {
    const mil = Math.floor(n / 1000);
    if (mil === 1) parts.push("mil");
    else parts.push(numberToWords(mil) + " mil");
    n %= 1000;
    if (n > 0) parts.push("e");
  }
  if (n >= 100) {
    if (n === 100) { parts.push("cem"); return parts.join(" "); }
    parts.push(hundreds[Math.floor(n / 100)]);
    n %= 100;
    if (n > 0) parts.push("e");
  }
  if (n >= 20) {
    parts.push(tens[Math.floor(n / 10)]);
    n %= 10;
    if (n > 0) parts.push("e " + units[n]);
  } else if (n >= 10) {
    parts.push(teens[n - 10]);
  } else if (n > 0) {
    parts.push(units[n]);
  }
  return parts.join(" ");
}

function formatBRLExtended(value: number): string {
  const reais = Math.floor(value);
  const centavos = Math.round((value - reais) * 100);
  let text = `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${numberToWords(reais)} reais`;
  if (centavos > 0) text += ` e ${numberToWords(centavos)} centavos`;
  text += ")";
  return text;
}

function formatDateExtended(dateStr: string): string {
  const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function salarioMinLabel(qtd: string): string {
  const n = parseFloat(qtd.replace(",", "."));
  if (n === 1) return "01 (um) salário mínimo";
  if (n === 0.5) return "meio salário mínimo";
  if (Number.isInteger(n)) return `${String(n).padStart(2, "0")} (${numberToWords(n)}) salários mínimos`;
  return `${qtd} salários mínimos`;
}

// ── Document XML generation ──

function generateDocxXml(lead: any): string {
  const tipo = lead.tipo_contrato || "tributario_cnpj";
  const isCPF = tipo === "tributario_cpf";
  const isEmpresarial = tipo === "empresarial_completo";

  const empresa = lead.empresa || "_______________";
  const cnpj = lead.cnpj || "_______________";
  const repr = lead.representante_nome || "_______________";
  const cpf = lead.representante_cpf || "_______________";
  const email = lead.email || "_______________";
  const endereco = lead.endereco || "_______________";
  const cidade = lead.cidade || "_______________";
  const estado = lead.estado || "_______________";
  const cep = lead.cep || "_______________";

  const valorMensalidade = lead.valor_mensalidade ? formatBRLExtended(Number(lead.valor_mensalidade)) : "_______________";
  const salarios = lead.qtd_salarios_minimos ? salarioMinLabel(lead.qtd_salarios_minimos) : "_______________";
  const exito = lead.porcentagem_exito || "___";
  const dataPagamento = lead.data_primeiro_pagamento ? formatDateExtended(lead.data_primeiro_pagamento) : "_______________";
  const diaDemais = lead.dia_demais_pagamentos || "___";
  const prazoRelatorios = lead.prazo_entrega_relatorios || "___";
  const prazoContrato = lead.prazo_contrato || "indeterminado";

  const enderecoCompleto = `${endereco}, CEP nº ${cep}, ${cidade}/${estado}`;

  let tipoLabel = "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORIA TRIBUTÁRIA";
  if (isEmpresarial) tipoLabel = "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORIA TRIBUTÁRIA E EMPRESARIAL";

  const contratante = isCPF
    ? `${repr}, inscrito(a) no CPF sob o nº ${cpf}, residente e domiciliado(a) em ${enderecoCompleto}, e-mail: ${email}`
    : `${empresa}, inscrita no CNPJ sob o nº ${cnpj}, com sede em ${enderecoCompleto}, neste ato representada por ${repr}, inscrito(a) no CPF sob o nº ${cpf}, e-mail: ${email}`;

  const paragraphs = [
    { text: tipoLabel, bold: true, center: true, size: 28 },
    { text: "", size: 24 },
    { text: "CONTRATANTE:", bold: true, size: 24 },
    { text: contratante, size: 24 },
    { text: "", size: 24 },
    { text: "CONTRATADA:", bold: true, size: 24 },
    { text: "PENA & QUADROS ASSESSORIA TRIBUTÁRIA LTDA, inscrita no CNPJ sob o nº XX.XXX.XXX/XXXX-XX, com sede na cidade de Goiânia/GO.", size: 24 },
    { text: "", size: 24 },
    { text: "CLÁUSULA PRIMEIRA – DO OBJETO", bold: true, size: 24 },
    { text: `O presente contrato tem por objeto a prestação de serviços de assessoria ${isEmpresarial ? "tributária e empresarial" : "tributária"}, compreendendo análise, revisão e recuperação de créditos tributários, bem como consultoria fiscal e planejamento tributário.`, size: 24 },
    { text: "", size: 24 },
    { text: "CLÁUSULA SEGUNDA – DOS HONORÁRIOS", bold: true, size: 24 },
    { text: `2.1. A título de honorários mensais, a CONTRATANTE pagará à CONTRATADA o valor de ${valorMensalidade}, correspondente a ${salarios}.`, size: 24 },
    { text: `2.2. A título de honorários de êxito, a CONTRATANTE pagará à CONTRATADA o percentual de ${exito}% (${numberToWords(parseInt(exito) || 0)} por cento) sobre todo e qualquer crédito tributário recuperado, compensado ou restituído.`, size: 24 },
    { text: "", size: 24 },
    { text: "CLÁUSULA TERCEIRA – DO PAGAMENTO", bold: true, size: 24 },
    { text: `3.1. O primeiro pagamento deverá ser efetuado em ${dataPagamento}.`, size: 24 },
    { text: `3.2. Os demais pagamentos serão efetuados todo dia ${diaDemais} de cada mês subsequente.`, size: 24 },
    { text: "", size: 24 },
    { text: "CLÁUSULA QUARTA – DOS PRAZOS", bold: true, size: 24 },
    { text: `4.1. A CONTRATADA se compromete a entregar os relatórios e pareceres no prazo de ${prazoRelatorios} (${numberToWords(parseInt(prazoRelatorios) || 0)}) dias úteis, contados a partir do recebimento de toda documentação necessária.`, size: 24 },
    { text: `4.2. O presente contrato terá prazo de vigência de ${prazoContrato}.`, size: 24 },
    { text: "", size: 24 },
    { text: "CLÁUSULA QUINTA – DAS OBRIGAÇÕES DA CONTRATANTE", bold: true, size: 24 },
    { text: "5.1. Fornecer tempestivamente toda documentação fiscal, contábil e tributária necessária para a execução dos serviços.", size: 24 },
    { text: "5.2. Efetuar os pagamentos nas datas avençadas.", size: 24 },
    { text: "", size: 24 },
    { text: "CLÁUSULA SEXTA – DAS OBRIGAÇÕES DA CONTRATADA", bold: true, size: 24 },
    { text: "6.1. Executar os serviços com diligência, zelo e dentro dos prazos estabelecidos.", size: 24 },
    { text: "6.2. Manter sigilo sobre todas as informações obtidas em razão da prestação dos serviços.", size: 24 },
    { text: "", size: 24 },
    { text: "CLÁUSULA SÉTIMA – DA RESCISÃO", bold: true, size: 24 },
    { text: "7.1. O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio de 30 (trinta) dias, sem prejuízo das obrigações já assumidas.", size: 24 },
    { text: "", size: 24 },
    { text: "CLÁUSULA OITAVA – DO FORO", bold: true, size: 24 },
    { text: "8.1. Fica eleito o foro da Comarca de Goiânia/GO para dirimir quaisquer dúvidas oriundas do presente contrato.", size: 24 },
    { text: "", size: 24 },
    { text: `E por estarem justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor.`, size: 24 },
    { text: "", size: 24 },
    { text: `Goiânia/GO, ${formatDateExtended(new Date().toISOString().split("T")[0])}.`, size: 24 },
    { text: "", size: 24 },
    { text: "", size: 24 },
    { text: "___________________________________________", center: true, size: 24 },
    { text: "CONTRATANTE", center: true, bold: true, size: 24 },
    { text: "", size: 24 },
    { text: "", size: 24 },
    { text: "___________________________________________", center: true, size: 24 },
    { text: "PENA & QUADROS ASSESSORIA TRIBUTÁRIA LTDA", center: true, bold: true, size: 24 },
    { text: "CONTRATADA", center: true, bold: true, size: 24 },
  ];

  const bodyXml = paragraphs.map(p => {
    const align = p.center ? '<w:jc w:val="center"/>' : '';
    const bold = p.bold ? '<w:b/>' : '';
    const sz = p.size ? `<w:sz w:val="${p.size}"/><w:szCs w:val="${p.size}"/>` : '';
    const escaped = p.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<w:p><w:pPr>${align}<w:rPr>${bold}${sz}<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr></w:pPr><w:r><w:rPr>${bold}${sz}<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" mc:Ignorable="w14 wp14">
<w:body>
${bodyXml}
<w:sectPr>
<w:pgSz w:w="12240" w:h="15840"/>
<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
</w:sectPr>
</w:body>
</w:document>`;
}

// ── ZIP builder ──

async function buildDocxBytes(documentXml: string): Promise<Uint8Array> {
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

  const { zipSync } = await import("https://esm.sh/fflate@0.8.2");
  const encoder = new TextEncoder();
  return zipSync({
    "[Content_Types].xml": encoder.encode(contentTypesXml),
    "_rels/.rels": encoder.encode(relsXml),
    "word/_rels/document.xml.rels": encoder.encode(wordRelsXml),
    "word/document.xml": encoder.encode(documentXml),
  });
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
  // Convert to base64
  const b64 = btoa(String.fromCharCode(...docxBytes));

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

    // Generate document
    const docXml = generateDocxXml(lead);
    const docxBytes = await buildDocxBytes(docXml);

    // Store in Lovable Cloud storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sbInternal = createClient(supabaseUrl, serviceKey);

    const fileName = `contratos/${lead_id}_${Date.now()}.docx`;
    const { error: uploadError } = await sbInternal.storage
      .from("contracts")
      .upload(fileName, docxBytes, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    let fileUrl: string;
    if (uploadError) {
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
    return new Response(JSON.stringify({ success: false, message: e.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
