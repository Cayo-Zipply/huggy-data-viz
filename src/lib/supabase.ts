import { supabase } from "@/lib/supabaseExternal";

// Re-export the single Supabase client
export { supabase };
export const supabaseExt = supabase;
