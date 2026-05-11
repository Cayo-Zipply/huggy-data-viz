import { createClient } from "@supabase/supabase-js";

const EXTERNAL_URL = "https://riyfdcmmabvpcubusujw.supabase.co";
const EXTERNAL_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpeWZkY21tYWJ2cGN1YnVzdWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NTMyMDMsImV4cCI6MjA5MDIyOTIwM30.pCRIa4UEC9WQiBP8EwzVrO73qS1FbsQ9fvKzlUPD1Gc";

// Single canonical Supabase client for the entire app — pointing to the
// "cayo" project (riyfdcmmabvpcubusujw) where ALL data, auth providers,
// edge functions and secrets live.
//
// The auto-generated file at src/integrations/supabase/client.ts is
// remapped via a Vite alias to this module, so importing from
// "@/integrations/supabase/client" resolves here too. This guarantees a
// SINGLE GoTrueClient instance and avoids the ghost xcjpoycwezdagbjrkhmq
// project (template default) from being instantiated in the bundle.
export const supabase = createClient(EXTERNAL_URL, EXTERNAL_ANON_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Backwards-compatible aliases used across the codebase.
export const supabaseExt = supabase;
export const sbExt = supabase;
export default supabase;
