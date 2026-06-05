// Deploy no Supabase EXTERNO (riyfdcmmabvpcubusujw)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const IPBOX_BASE_URL = Deno.env.get('IPBOX_BASE_URL')!;
const IPBOX_TOKEN = Deno.env.get('IPBOX_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOTE_NOME = 'FUP';

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

function normalizeFone(raw: string): string {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);
  return d;
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const body = await req.json().catch(() => ({}));
  const criterio = body.criterio || {};
  const dryRun = !!body.dry_run;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let q = sb.from('leads')
    .select('id, nome, telefone, etapa_atual, pipe, status, tags, data_ultima_mudanca_etapa')
    .not('telefone', 'is', null);

  if (criterio.tipo === 'tag') {
    q = q.contains('tags', [criterio.valor || 'ligar']);
  } else if (criterio.tipo === 'etapa') {
    q = q.eq('etapa_atual', criterio.valor);
    if (criterio.pipe) q = q.eq('pipe', criterio.pipe);
  } else if (criterio.tipo === 'parado') {
    const cutoff = new Date(Date.now() - (Number(criterio.dias || 1) * 86400000)).toISOString();
    q = q.lt('data_ultima_mudanca_etapa', cutoff);
    if (criterio.valor) q = q.eq('etapa_atual', criterio.valor);
  } else {
    return json({ error: 'criterio.tipo inválido' }, 400);
  }

  q = q.not('status', 'in', '("ganho","perdido","Ganho","Perdido")');

  const { data: leadsRaw, error } = await q;
  if (error) return json({ error: error.message }, 500);

  // remove quem já está em FUP
  const leads = (leadsRaw || []).filter((l: any) => !(l.tags || []).includes('em-fup'));

  if (dryRun) return json({ ok: true, total: leads.length });

  const lotes = await ipbox('getLotesAtivos', {});
  const lote = (lotes.data?.data?.lotes || []).find(
    (l: any) => (l.descricao || '').trim().toUpperCase() === LOTE_NOME,
  );
  if (!lote) return json({ error: 'Lote FUP não encontrado no IPBOX' }, 500);

  let ok = 0, fail = 0;
  for (const l of leads) {
    const fone = normalizeFone(l.telefone);
    if (fone.length < 10) { fail++; continue; }
    const res = await ipbox('insertProspect', {
      lote: String(lote.id),
      nome: l.nome || 'Lead',
      fonecel: fone,
      codigo: l.id,
      rodar_lote: 'Y',
    });
    if (res.ok && res.data?.data?.id) {
      ok++;
      const novasTags = [...new Set([...(l.tags || []).filter((t: string) => t !== 'ligar'), 'em-fup'])];
      await sb.from('leads').update({ tags: novasTags }).eq('id', l.id);
    } else {
      fail++;
    }
  }

  return json({ ok: true, lote: lote.id, enfileirados: ok, falhas: fail, total: leads.length });
});
