CREATE TABLE public.marketing_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,
  manual_mensagens INTEGER,
  manual_reunioes INTEGER,
  manual_vendas INTEGER,
  manual_faturamento NUMERIC,
  manual_impressoes INTEGER,
  manual_cliques INTEGER,
  manual_investimento NUMERIC,
  manual_ctr NUMERIC,
  manual_cpc NUMERIC,
  manual_cpm NUMERIC,
  updated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read overrides"
  ON public.marketing_overrides FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage overrides"
  ON public.marketing_overrides FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_marketing_overrides_updated_at
  BEFORE UPDATE ON public.marketing_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();