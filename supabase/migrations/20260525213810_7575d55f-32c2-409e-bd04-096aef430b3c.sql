
-- 1) Tighten public-role policies on internal tables to authenticated users
-- lead_history
DROP POLICY IF EXISTS "Public access lead_history" ON public.lead_history;
CREATE POLICY "Authenticated read lead_history" ON public.lead_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert lead_history" ON public.lead_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins manage lead_history" ON public.lead_history FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- motivos_perda: authenticated read, admin write
DROP POLICY IF EXISTS "Public access motivos_perda" ON public.motivos_perda;
CREATE POLICY "Authenticated read motivos_perda" ON public.motivos_perda FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage motivos_perda" ON public.motivos_perda FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- pipeline_cards
DROP POLICY IF EXISTS "Allow public read" ON public.pipeline_cards;
DROP POLICY IF EXISTS "Allow public insert" ON public.pipeline_cards;
DROP POLICY IF EXISTS "Allow public update" ON public.pipeline_cards;
DROP POLICY IF EXISTS "Allow public delete" ON public.pipeline_cards;
CREATE POLICY "Authenticated read pipeline_cards" ON public.pipeline_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert pipeline_cards" ON public.pipeline_cards FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update pipeline_cards" ON public.pipeline_cards FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete pipeline_cards" ON public.pipeline_cards FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- pipeline_goals
DROP POLICY IF EXISTS "public_access_goals" ON public.pipeline_goals;
CREATE POLICY "Authenticated read pipeline_goals" ON public.pipeline_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage pipeline_goals" ON public.pipeline_goals FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- pipeline_sla_rules
DROP POLICY IF EXISTS "Public access sla_rules" ON public.pipeline_sla_rules;
CREATE POLICY "Authenticated read sla_rules" ON public.pipeline_sla_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage sla_rules" ON public.pipeline_sla_rules FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- pipeline_tasks
DROP POLICY IF EXISTS "public_access_tasks" ON public.pipeline_tasks;
CREATE POLICY "Authenticated read pipeline_tasks" ON public.pipeline_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert pipeline_tasks" ON public.pipeline_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update pipeline_tasks" ON public.pipeline_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete pipeline_tasks" ON public.pipeline_tasks FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 2) is_admin: remove JWT-email bypass
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE role = 'admin' AND user_id = _user_id
  )
$function$;

-- 3) Set search_path on functions missing it
CREATE OR REPLACE FUNCTION public.set_anotacao_edited()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $function$ BEGIN NEW.is_edited := true; NEW.updated_at := now(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.is_weekend_sp(ts timestamp with time zone)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public
AS $function$ SELECT EXTRACT(DOW FROM ts AT TIME ZONE 'America/Sao_Paulo') IN (0, 6) $function$;

CREATE OR REPLACE FUNCTION public.set_fim_de_semana()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $function$ BEGIN NEW.fim_de_semana := public.is_weekend_sp(NEW.created_at); RETURN NEW; END; $function$;

-- 4) Recreate view with security_invoker to fix SECURITY DEFINER VIEW finding
DROP VIEW IF EXISTS public.vw_conversao_fim_de_semana;
CREATE VIEW public.vw_conversao_fim_de_semana
WITH (security_invoker = on) AS
SELECT
  CASE WHEN fim_de_semana THEN 'Fim de semana' ELSE 'Dia útil' END AS periodo,
  count(*) AS total_leads,
  count(*) FILTER (WHERE lead_status = 'aberto') AS em_aberto,
  count(*) FILTER (WHERE lead_status = 'ganho') AS ganhos,
  count(*) FILTER (WHERE lead_status = 'perdido') AS perdidos,
  CASE WHEN count(*) FILTER (WHERE lead_status IN ('ganho','perdido')) > 0
    THEN round(count(*) FILTER (WHERE lead_status='ganho')::numeric / count(*) FILTER (WHERE lead_status IN ('ganho','perdido'))::numeric * 100, 2)
    ELSE 0 END AS taxa_conversao_pct,
  COALESCE(round(avg(deal_value) FILTER (WHERE lead_status='ganho'), 2), 0) AS ticket_medio_ganho,
  COALESCE(sum(deal_value) FILTER (WHERE lead_status='ganho'), 0) AS receita_total
FROM public.pipeline_cards
GROUP BY fim_de_semana;

-- 5) Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated (only triggers/internal use is_admin via RLS)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
-- is_admin stays callable by authenticated (needed in RLS via auth.uid()); RLS calls run as definer anyway. Revoke from anon.
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;

-- 6) Storage policies
-- lead-anexos: ownership-based delete
DROP POLICY IF EXISTS "Authenticated users can delete lead anexos" ON storage.objects;
CREATE POLICY "Owners or admins delete lead anexos" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'lead-anexos'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.lead_anexos la
      WHERE la.storage_path = storage.objects.name
        AND la.uploaded_by = auth.uid()
    )
  )
);

-- contracts: make private + scoped policies
UPDATE storage.buckets SET public = false WHERE id = 'contracts';
CREATE POLICY "Authenticated read contracts" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'contracts');
CREATE POLICY "Authenticated upload contracts" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contracts');
CREATE POLICY "Admins update contracts" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'contracts' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'contracts' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete contracts" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'contracts' AND public.is_admin(auth.uid()));
