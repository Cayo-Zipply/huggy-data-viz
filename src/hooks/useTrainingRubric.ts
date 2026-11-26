import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseExternal';
import { SE_STALE_TIME } from '@/lib/screenCache';
import type { RubricaSE } from '@/lib/seEvaluation';

export function useTrainingRubric() {
  return useQuery({
    queryKey: ['se-rubrica'], staleTime: SE_STALE_TIME,
    queryFn: async () => {
      const { data, error } = await supabase.from('se_rubrica').select('*').eq('ativo', true);
      if (error) throw error;
      return (data ?? []) as RubricaSE[];
    },
  });
}