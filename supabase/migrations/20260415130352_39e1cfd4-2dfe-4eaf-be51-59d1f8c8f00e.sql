
-- 1. Add column
ALTER TABLE public.pipeline_cards
  ADD COLUMN fim_de_semana boolean NOT NULL DEFAULT false;

-- 2. Weekend detection function (São Paulo timezone)
CREATE OR REPLACE FUNCTION public.is_weekend_sp(ts timestamptz)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT EXTRACT(DOW FROM ts AT TIME ZONE 'America/Sao_Paulo') IN (0, 6)
$$;

-- 3. Trigger function
CREATE OR REPLACE FUNCTION public.set_fim_de_semana()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.fim_de_semana := public.is_weekend_sp(NEW.created_at);
  RETURN NEW;
END;
$$;

-- 4. Trigger
CREATE TRIGGER trigger_set_fim_de_semana
  BEFORE INSERT OR UPDATE OF created_at ON public.pipeline_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.set_fim_de_semana();

-- 5. Backfill existing rows
UPDATE public.pipeline_cards
SET fim_de_semana = public.is_weekend_sp(created_at);

-- 6. Conversion view
CREATE OR REPLACE VIEW public.vw_conversao_fim_de_semana AS
SELECT
  CASE WHEN fim_de_semana THEN 'Fim de semana' ELSE 'Dia útil' END AS periodo,
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE lead_status = 'aberto') AS em_aberto,
  COUNT(*) FILTER (WHERE lead_status = 'ganho') AS ganhos,
  COUNT(*) FILTER (WHERE lead_status = 'perdido') AS perdidos,
  CASE
    WHEN COUNT(*) FILTER (WHERE lead_status IN ('ganho','perdido')) > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE lead_status = 'ganho')::numeric /
      COUNT(*) FILTER (WHERE lead_status IN ('ganho','perdido'))::numeric * 100, 2
    )
    ELSE 0
  END AS taxa_conversao_pct,
  COALESCE(
    ROUND(AVG(deal_value) FILTER (WHERE lead_status = 'ganho'), 2), 0
  ) AS ticket_medio_ganho,
  COALESCE(
    SUM(deal_value) FILTER (WHERE lead_status = 'ganho'), 0
  ) AS receita_total
FROM public.pipeline_cards
GROUP BY fim_de_semana;
