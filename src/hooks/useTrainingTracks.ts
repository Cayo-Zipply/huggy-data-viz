import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseExternal';
import type { TrainingTrack } from '@/lib/seTraining';

export function useTrainingTracks(enabled = true) {
  return useQuery({
    queryKey: ['se-training-tracks'], enabled, staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('se_treinamento_trilhas').select('*').eq('ativo', true).order('ordem');
      if (error) throw error;
      return (data ?? []) as TrainingTrack[];
    },
  });
}
