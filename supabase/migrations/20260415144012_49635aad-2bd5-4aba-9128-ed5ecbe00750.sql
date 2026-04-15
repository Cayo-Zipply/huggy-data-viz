
CREATE TABLE public.lead_anotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  texto text NOT NULL,
  autor_nome text,
  autor_user_id uuid,
  source text DEFAULT 'manual',
  is_edited boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_anotacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read anotacoes"
  ON public.lead_anotacoes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create anotacoes"
  ON public.lead_anotacoes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authors and admins can update anotacoes"
  ON public.lead_anotacoes FOR UPDATE
  TO authenticated
  USING (auth.uid() = autor_user_id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = autor_user_id OR public.is_admin(auth.uid()));

-- Auto-set is_edited on update and update timestamp
CREATE OR REPLACE FUNCTION public.set_anotacao_edited()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.is_edited := true;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_anotacao_edited
  BEFORE UPDATE ON public.lead_anotacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_anotacao_edited();

-- Index for fast lookup by lead
CREATE INDEX idx_lead_anotacoes_lead_id ON public.lead_anotacoes(lead_id);
