
-- Allow null role for pending users
ALTER TABLE public.user_profiles ALTER COLUMN role DROP DEFAULT;

-- Update the trigger to create profile without role (pending)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, nome, role)
  VALUES (
    NEW.id,
    LOWER(TRIM(COALESCE(NEW.email, ''))),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(COALESCE(NEW.email,''), '@', 1)),
    NULL
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Make sure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure RLS policies allow users to read and update their own profile
DROP POLICY IF EXISTS "users_read_own" ON public.user_profiles;
DROP POLICY IF EXISTS "users_update_own" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_read_all" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_update_all" ON public.user_profiles;
DROP POLICY IF EXISTS "authenticated_read_all" ON public.user_profiles;

CREATE POLICY "authenticated_read_all" ON public.user_profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "users_update_own" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin_update_all" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Allow the trigger (service role) to insert
DROP POLICY IF EXISTS "service_insert" ON public.user_profiles;
CREATE POLICY "service_insert" ON public.user_profiles
  FOR INSERT WITH CHECK (true);
