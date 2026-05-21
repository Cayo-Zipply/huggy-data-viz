CREATE POLICY "users_link_own_profile_by_email"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  user_id IS NULL
  AND lower(trim(email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', '')))
)
WITH CHECK (
  user_id = auth.uid()
  AND lower(trim(email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', '')))
);