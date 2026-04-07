ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_update_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "authenticated_read_all" ON public.user_profiles;
DROP POLICY IF EXISTS "users_update_own" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_update_all" ON public.user_profiles;
DROP POLICY IF EXISTS "service_insert" ON public.user_profiles;

CREATE POLICY "authenticated_read_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins_update_any_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP INDEX IF EXISTS public.user_profiles_user_id_unique_idx;
CREATE UNIQUE INDEX user_profiles_user_id_unique_idx
ON public.user_profiles (user_id)
WHERE user_id IS NOT NULL;

UPDATE public.user_profiles
SET email = lower(trim(email))
WHERE email IS NOT NULL
  AND email <> lower(trim(email));

UPDATE public.user_profiles up
SET user_id = au.id,
    email = lower(trim(au.email)),
    updated_at = now()
FROM auth.users au
WHERE lower(trim(up.email)) = lower(trim(au.email))
  AND (up.user_id IS NULL OR up.user_id = au.id);

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();