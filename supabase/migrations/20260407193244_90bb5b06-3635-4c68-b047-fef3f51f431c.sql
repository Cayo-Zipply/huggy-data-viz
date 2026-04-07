
CREATE TABLE public.pipeline_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.pipeline_card_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.pipeline_cards(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.pipeline_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(card_id, label_id)
);

ALTER TABLE public.pipeline_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_card_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read labels" ON public.pipeline_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage labels" ON public.pipeline_labels FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Anyone can read card labels" ON public.pipeline_card_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can manage card labels" ON public.pipeline_card_labels FOR ALL TO authenticated USING (true) WITH CHECK (true);
