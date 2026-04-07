
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'closer' CHECK (role IN ('admin', 'sdr', 'closer')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_profiles" ON public.user_profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "users_update_own_profile" ON public.user_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

INSERT INTO public.user_profiles (email, nome, role) VALUES
  ('cayo.bitencourt@penaquadros.com', 'Cayo Bitencourt', 'admin'),
  ('stephanie@penaquadros.com', 'Stephanie', 'sdr'),
  ('joao.almeida@penaquadros.com', 'João Almeida', 'closer')
ON CONFLICT (email) DO NOTHING;
