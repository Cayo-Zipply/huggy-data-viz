CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE role = 'admin'
      AND (
        user_id = _user_id
        OR lower(trim(email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', '')))
      )
  )
$function$;