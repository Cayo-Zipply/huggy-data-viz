ALTER TABLE public.user_profiles ALTER COLUMN role DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email text;
  derived_name text;
BEGIN
  normalized_email := lower(trim(coalesce(NEW.email, '')));
  derived_name := COALESCE(
    NULLIF(trim(coalesce(NEW.raw_user_meta_data->>'full_name', '')), ''),
    split_part(normalized_email, '@', 1)
  );

  UPDATE public.user_profiles
  SET user_id = NEW.id,
      email = normalized_email,
      nome = COALESCE(NULLIF(trim(coalesce(nome, '')), ''), derived_name),
      updated_at = now()
  WHERE lower(trim(email)) = normalized_email
    AND (user_id IS NULL OR user_id = NEW.id);

  IF NOT FOUND THEN
    INSERT INTO public.user_profiles (user_id, email, nome, role)
    VALUES (NEW.id, normalized_email, derived_name, NULL)
    ON CONFLICT (email) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        email = EXCLUDED.email,
        nome = COALESCE(NULLIF(trim(coalesce(public.user_profiles.nome, '')), ''), EXCLUDED.nome),
        updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;