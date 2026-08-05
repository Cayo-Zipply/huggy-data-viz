-- RODAR NO SUPABASE EXTERNO (riyfdcmmabvpcubusujw)
-- Modo Pool — reativação de leads frios do pipe closer.
-- NUNCA altera leads.etapa_atual (evita re-disparo de CAPI). Só tags + colunas pool_*.

-- 1.1 Config singleton -------------------------------------------------------
create table if not exists public.pool_config (
  id uuid primary key default gen_random_uuid(),
  pool_ativo boolean not null default false,
  dias_inatividade int not null default 10,
  prazo_pool_dias  int not null default 10,
  etapas_elegiveis text[] not null default '{Reunião Agendada,No Show,Reunião Realizada,Link Enviado}',
  motivos_excluidos text[] not null default '{qualificação,não se qualifica,dívida baixa}',
  updated_at timestamptz default now(),
  updated_by text
);
insert into public.pool_config (pool_ativo)
  select false where not exists (select 1 from public.pool_config);

alter table public.pool_config enable row level security;
drop policy if exists pool_config_read on public.pool_config;
create policy pool_config_read on public.pool_config
  for select to authenticated using (true);
drop policy if exists pool_config_write on public.pool_config;
create policy pool_config_write on public.pool_config
  for update to authenticated using (true) with check (true);
grant select, update on public.pool_config to authenticated;
grant all on public.pool_config to service_role;

-- 1.2 Estado do pool no lead -------------------------------------------------
alter table public.leads add column if not exists pool_status text;
alter table public.leads add column if not exists pool_owner  text;
alter table public.leads add column if not exists pool_entrou_em timestamptz;
alter table public.leads add column if not exists pool_prazo_ate timestamptz;
create index if not exists idx_leads_pool_status on public.leads (pool_status);

-- 1.3 Log de rotação / auditoria --------------------------------------------
create table if not exists public.pool_rotacoes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id),
  closer_original  text,
  closer_atribuido text,
  atribuido_em timestamptz default now(),
  prazo_ate timestamptz,
  oferta_tier numeric,
  resultado text,
  resultado_em timestamptz,
  comissionavel boolean generated always as (closer_atribuido is distinct from closer_original) stored
);
create index if not exists idx_pool_rotacoes_lead on public.pool_rotacoes (lead_id);
create index if not exists idx_pool_rotacoes_closer on public.pool_rotacoes (closer_atribuido);

alter table public.pool_rotacoes enable row level security;
drop policy if exists pool_rotacoes_all on public.pool_rotacoes;
create policy pool_rotacoes_all on public.pool_rotacoes
  for all to authenticated using (true) with check (true);
grant select, insert, update on public.pool_rotacoes to authenticated;
grant all on public.pool_rotacoes to service_role;

-- 1.4 View de elegíveis ------------------------------------------------------
create or replace view public.v_pool_elegiveis as
select l.*
from public.leads l, public.pool_config c
where l.pipe = 'closer'
  and l.etapa_atual = any(c.etapas_elegiveis)
  and l.status in ('aberto','perdido')
  and l.etapa_atual <> 'Contrato Assinado'
  and l.data_ultima_mudanca_etapa < now() - make_interval(days => c.dias_inatividade)
  and not exists (
    select 1 from public.tarefas t
    where t.lead_id = l.id
      and lower(coalesce(t.status,'')) not in ('concluida','concluída','cancelada')
  )
  and lower(coalesce(l.motivo_perda,'')) <> all (select lower(m) from unnest(c.motivos_excluidos) m)
  and coalesce(l.pool_status,'') <> 'excluido';

grant select on public.v_pool_elegiveis to authenticated, service_role;

-- 2. RPC de distribuição -----------------------------------------------------
create or replace function public.distribuir_pool_lead(p_closer text)
returns setof public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.pool_config;
  v_lead public.leads;
  v_prazo timestamptz;
begin
  select * into c from public.pool_config limit 1;
  if c is null or c.pool_ativo is not true then
    return;
  end if;
  if coalesce(trim(p_closer),'') = '' then
    return;
  end if;

  select l.* into v_lead
  from public.v_pool_elegiveis l
  where lower(coalesce(l.closer,'')) <> lower(p_closer)          -- nunca devolve ao dono original
    and not exists (
      select 1 from public.pool_rotacoes r
      where r.lead_id = l.id
        and lower(coalesce(r.closer_atribuido,'')) = lower(p_closer)
        and r.resultado in ('sem_sucesso','devolvido','expirado')
    )
    and not (coalesce(l.pool_status,'') = 'em_atendimento' and coalesce(l.pool_prazo_ate, now()) > now())
  order by l.data_ultima_mudanca_etapa asc nulls last
  limit 1
  for update of l skip locked;

  if v_lead.id is null then
    return;
  end if;

  v_prazo := now() + make_interval(days => c.prazo_pool_dias);

  update public.leads l
  set pool_status = 'em_atendimento',
      pool_owner = p_closer,
      pool_entrou_em = now(),
      pool_prazo_ate = v_prazo,
      tags = (select array_agg(distinct t) from unnest(coalesce(l.tags,'{}'::text[]) || 'POOL') t)
  where l.id = v_lead.id
  returning l.* into v_lead;

  insert into public.pool_rotacoes (lead_id, closer_original, closer_atribuido, prazo_ate)
  values (v_lead.id, v_lead.closer, p_closer, v_prazo);

  return next v_lead;
end;
$$;

grant execute on function public.distribuir_pool_lead(text) to authenticated, service_role;

-- 3. Job de devolução automática --------------------------------------------
create or replace function public.pool_reciclar_expirados()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exp int := 0;
  v_conv int := 0;
begin
  -- convertidos
  with alvo as (
    select id, pool_owner from public.leads
    where pool_status = 'em_atendimento' and status = 'ganho'
  ), upd as (
    update public.leads l set pool_status = 'convertido'
    where l.id in (select id from alvo) returning l.id
  )
  update public.pool_rotacoes r
  set resultado = 'convertido', resultado_em = now()
  where r.resultado is null and r.lead_id in (select id from upd);
  get diagnostics v_conv = row_count;

  -- expirados
  with alvo as (
    select id from public.leads
    where pool_status = 'em_atendimento'
      and pool_prazo_ate < now()
      and coalesce(status,'') <> 'ganho'
  ), upd as (
    update public.leads l
    set pool_status = 'elegivel',
        pool_owner = null,
        pool_prazo_ate = null,
        tags = (select coalesce(array_agg(t), '{}'::text[]) from unnest(coalesce(l.tags,'{}'::text[])) t where t <> 'POOL')
    where l.id in (select id from alvo) returning l.id
  )
  update public.pool_rotacoes r
  set resultado = 'expirado', resultado_em = now()
  where r.resultado is null and r.lead_id in (select id from upd);
  get diagnostics v_exp = row_count;

  return jsonb_build_object('expirados', v_exp, 'convertidos', v_conv);
end;
$$;

grant execute on function public.pool_reciclar_expirados() to authenticated, service_role;

-- 4. Fechar rotação a partir da UI (resultado do closer) ---------------------
create or replace function public.pool_registrar_resultado(
  p_lead_id uuid,
  p_closer text,
  p_resultado text,
  p_oferta_tier numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_resultado not in ('convertido','sem_sucesso','devolvido') then
    raise exception 'resultado inválido: %', p_resultado;
  end if;

  update public.pool_rotacoes r
  set resultado = p_resultado,
      resultado_em = now(),
      oferta_tier = coalesce(p_oferta_tier, r.oferta_tier)
  where r.lead_id = p_lead_id
    and lower(coalesce(r.closer_atribuido,'')) = lower(p_closer)
    and r.resultado is null;

  if p_resultado = 'convertido' then
    update public.leads set pool_status = 'convertido' where id = p_lead_id;
  else
    update public.leads l
    set pool_status = 'elegivel',
        pool_owner = null,
        pool_prazo_ate = null,
        tags = (select coalesce(array_agg(t), '{}'::text[]) from unnest(coalesce(l.tags,'{}'::text[])) t where t <> 'POOL')
    where l.id = p_lead_id;
  end if;
end;
$$;

grant execute on function public.pool_registrar_resultado(uuid, text, text, numeric) to authenticated, service_role;

-- 5. Cron diário (rodar manualmente uma vez)
-- select cron.schedule('pool-reciclar', '10 3 * * *', $$select public.pool_reciclar_expirados();$$);
