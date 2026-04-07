import { supabase } from "@/integrations/supabase/client";

// Re-export the single Supabase client
export { supabase };
export const supabaseExt = supabase;
