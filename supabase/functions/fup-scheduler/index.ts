// Deploy no Supabase EXTERNO. Acionado via pg_cron a cada 5 min.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async () => {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: jobs } = await sb.from('fup_jobs')
    .select('*').eq('status', 'pendente')
    .lte('agendado_para', new Date().toISOString());

  for (const job of jobs || []) {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/iniciar-fup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ criterio: job.criterio }),
    });
    const r = await resp.json().catch(() => ({ error: 'resposta inválida' }));
    await sb.from('fup_jobs').update({
      status: r.error ? 'erro' : 'executado',
      executado_em: new Date().toISOString(),
      total_enfileirado: r.enfileirados ?? 0,
      erro_msg: r.error ?? null,
    }).eq('id', job.id);
  }

  return new Response(JSON.stringify({ processados: jobs?.length || 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
