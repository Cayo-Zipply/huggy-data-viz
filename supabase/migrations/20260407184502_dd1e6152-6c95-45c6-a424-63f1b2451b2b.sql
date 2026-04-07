DROP POLICY IF EXISTS "users_insert_own_profile" ON public.user_profiles;

CREATE POLICY "users_insert_own_profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);