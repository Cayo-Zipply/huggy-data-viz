CREATE POLICY "admins_insert_any_profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));