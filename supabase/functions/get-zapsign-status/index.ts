import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXT_URL = "https://riyfdcmmabvpcubusujw.supabase.co";
const EXT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpeWZkY21tYWJ2cGN1YnVzdWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NTMyMDMsImV4cCI6MjA5MDIyOTIwM30.pCRIa4UEC9WQiBP8EwzVrO73qS1FbsQ9fvKzlUPD1Gc";

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mapSignerStatus(s: any): string {
  if (s.signed_at) return "Assinado";
  if (s.status === "refused") return "Recusado";
  const opened = s.times_viewed && Number(s.times_viewed) > 0;
  if (opened || s.first_opened_at || s.last_view_at) return "Abriu o link (ainda não assinou)";
  return "Não abriu o link ainda";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead_id } = await req.json();
    if (!lead_id) return jsonResp({ ok: false, error: "lead_id é obrigatório" }, 400);

    const sb = createClient(EXT_URL, EXT_KEY);
    const { data: lead, error } = await sb.from("leads")
      .select("zapsign_doc_token, zapsign_signer_token, zapsign_signed_at, contract_url")
      .eq("id", lead_id).maybeSingle();

    if (error) return jsonResp({ ok: false, error: error.message }, 500);
    if (!lead || !lead.zapsign_doc_token) {
      return jsonResp({ ok: false, sem_contrato: true }, 404);
    }

    const apiKey = Deno.env.get("ZAPSIGN_API_KEY");
    if (!apiKey) return jsonResp({ ok: false, error: "ZAPSIGN_API_KEY não configurada" }, 500);

    const r = await fetch(`https://api.zapsign.com.br/api/v1/docs/${lead.zapsign_doc_token}/`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) {
      const txt = await r.text();
      return jsonResp({ ok: false, error: `ZapSign ${r.status}: ${txt.slice(0, 200)}` }, 502);
    }
    const doc = await r.json();

    const signatarios = (doc.signers || []).map((s: any) => ({
      nome: s.name || "",
      email: s.email || "",
      status: mapSignerStatus(s),
      times_viewed: s.times_viewed ?? 0,
      first_opened_at: s.first_opened_at || null,
      last_view_at: s.last_view_at || null,
      signed_at: s.signed_at || null,
    }));

    const eventos: { tipo: string; titulo: string; em: string; detalhe?: string }[] = [];
    const enviado_em = doc.created_at || null;
    if (enviado_em) {
      eventos.push({ tipo: "enviado", titulo: "Contrato enviado para assinatura", em: enviado_em });
    }
    for (const s of signatarios) {
      if (s.first_opened_at) {
        eventos.push({
          tipo: "aberto",
          titulo: `${s.nome} abriu o link`,
          em: s.first_opened_at,
          detalhe: `${s.times_viewed} visualização(ões)`,
        });
      }
      if (s.signed_at) {
        eventos.push({ tipo: "assinado", titulo: `${s.nome} assinou o contrato`, em: s.signed_at });
      }
    }
    if (doc.status === "refused") {
      eventos.push({ tipo: "recusado", titulo: "Contrato recusado", em: doc.last_update_at || enviado_em || new Date().toISOString() });
    }
    eventos.sort((a, b) => new Date(a.em).getTime() - new Date(b.em).getTime());

    return jsonResp({
      ok: true,
      doc_status: doc.status || "pending",
      assinado: !!signatarios.find((s) => s.signed_at) && doc.status === "signed",
      enviado_em,
      signatarios,
      eventos,
    });
  } catch (e) {
    return jsonResp({ ok: false, error: (e as Error).message }, 500);
  }
});
