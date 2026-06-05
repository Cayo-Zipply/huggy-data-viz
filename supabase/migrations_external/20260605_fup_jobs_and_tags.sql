-- RODAR NO SUPABASE EXTERNO (riyfdcmmabvpcubusujw)
-- Fase 1: tag manual + jobs de FUP

alter table public.leads add column if not exists tags text[] default '{}';
create index if not exists idx_leads_tags on public.leads using gin (tags);

create table if not exists public.fup_jobs (
  id               uuid primary key default gen_random_uuid(),
  criado_por       uuid,
  criterio         jsonb not null,
  rotulo           text,
  agendado_para    timestamptz,
  status           text not null default 'pendente',
  total_enfileirado int,
  erro_msg         text,
  executado_em     timestamptz,
  criado_em        timestamptz default now()
);
create index if not exists idx_fup_jobs_pendentes on public.fup_jobs (status, agendado_para);

alter table public.fup_jobs enable row level security;
drop policy if exists fup_jobs_staff_all on public.fup_jobs;
create policy fup_jobs_staff_all on public.fup_jobs
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.fup_jobs to authenticated;
grant all on public.fup_jobs to service_role;

-- Cron do scheduler (substitua <SERVICE_ROLE_KEY>)
-- select cron.schedule('fup-scheduler', '*/5 * * * *', $$
--   select net.http_post(
--     url := 'https://riyfdcmmabvpcubusujw.supabase.co/functions/v1/fup-scheduler',
--     headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <SERVICE_ROLE_KEY>')
--   );
-- $$);
