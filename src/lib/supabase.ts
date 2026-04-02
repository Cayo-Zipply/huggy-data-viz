import { supabase } from "@/integrations/supabase/client";

// Reusar o mesmo cliente para evitar "Multiple GoTrueClient instances"
export const supabaseExt = supabase;
