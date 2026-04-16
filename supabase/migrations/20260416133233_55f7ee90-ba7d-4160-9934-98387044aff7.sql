
-- Create lead_anexos table
CREATE TABLE public.lead_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  nome_arquivo text NOT NULL,
  tipo text NOT NULL DEFAULT 'documento',
  mime_type text,
  tamanho_bytes bigint,
  conteudo_texto text,
  storage_path text,
  url_publica text,
  source text NOT NULL DEFAULT 'manual',
  uploaded_by uuid,
  uploaded_by_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_anexos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read anexos"
  ON public.lead_anexos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create anexos"
  ON public.lead_anexos FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Uploaders and admins can update anexos"
  ON public.lead_anexos FOR UPDATE TO authenticated
  USING (auth.uid() = uploaded_by OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = uploaded_by OR public.is_admin(auth.uid()));

CREATE POLICY "Uploaders and admins can delete anexos"
  ON public.lead_anexos FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by OR public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_lead_anexos_updated_at
  BEFORE UPDATE ON public.lead_anexos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-anexos', 'lead-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload lead anexos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lead-anexos');

CREATE POLICY "Authenticated users can read lead anexos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lead-anexos');

CREATE POLICY "Authenticated users can delete lead anexos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lead-anexos');
