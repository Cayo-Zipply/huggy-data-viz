import { createClient } from "@supabase/supabase-js";

// Cliente do Lovable Cloud (separado do CRM externo).
// Usado para tabelas que vivem aqui, como `motivos_perda`.
const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabaseCloud = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
