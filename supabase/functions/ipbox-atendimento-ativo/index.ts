// Deploy no Supabase EXTERNO. Polling do contato ativo no ramal do SDR.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const IPBOX_BASE_URL = Deno.env.get('IPBOX_BASE_URL')!;
const IPBOX_TOKEN = Deno.env.get('IPBOX_TOKEN')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
};

async function ipbox(endpoint: string, params: Record<string, string>) {
  const r = await fetch(`${IPBOX_BASE_URL}/ipbox/api/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: IPBOX_TOKEN,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(params).toString(),
  });
  const t = await r.text();
  try { return { ok: r.ok, data: JSON.parse(t) }; } catch { return { ok: r.ok, data: { raw: t } }; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const { ramal, login } = await req.json().catch(() => ({}));

  const ativa = await ipbox('getLigacaoAtivaByRamal', { ramal: String(ramal || '') });
  const c = ativa.data?.data || {};
  let estado: unknown = null;
  if (login) {
    const e = await ipbox('getEstado', { user: String(login) });
    estado = e.data?.data ?? e.data;
  }

  const temContato = !!(c.codigo || c.numero);

  return new Response(JSON.stringify({
    ativo: temContato,
    lead_id: c.codigo || null,
    nome: c.nome || null,
    telefone: c.numero ? `${c.ddd || ''}${c.numero}` : null,
    uid: c.uid || null,
    estado_raw: estado,
  }), { headers: { 'Content-Type': 'application/json', ...cors } });
});
