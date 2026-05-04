ALTER TABLE public.pipeline_goals
  ADD COLUMN IF NOT EXISTS meta_vendas integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_ticket_medio numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_contratos integer DEFAULT 0;