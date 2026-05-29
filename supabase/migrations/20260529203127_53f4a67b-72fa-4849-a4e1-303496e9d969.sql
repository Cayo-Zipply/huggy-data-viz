create table if not exists public.app_updates (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  itens text[] not null default '{}',
  publicado_em timestamptz not null default now(),
  ativo boolean not null default true
);

grant select on public.app_updates to authenticated;
grant all on public.app_updates to service_role;

alter table public.app_updates enable row level security;

create policy "logados leem updates ativos"
  on public.app_updates for select
  to authenticated
  using (ativo = true);