
CREATE TABLE public.feedbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'melhoria',
  descricao TEXT NOT NULL,
  screenshot_url TEXT,
  pagina TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  resposta_admin TEXT,
  user_id UUID NOT NULL,
  user_name TEXT,
  user_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- Users can create their own feedbacks
CREATE POLICY "Users can create feedbacks"
ON public.feedbacks
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedbacks
CREATE POLICY "Users can view own feedbacks"
ON public.feedbacks
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Admins can update any feedback (change status, add response)
CREATE POLICY "Admins can update feedbacks"
ON public.feedbacks
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_feedbacks_updated_at
BEFORE UPDATE ON public.feedbacks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
