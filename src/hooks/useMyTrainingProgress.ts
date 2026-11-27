import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseExternal';
import { useAuth } from '@/contexts/AuthContext';
import { progressIndex, type MyProgress } from '@/lib/seProgress';

export const MY_TRAINING_PROGRESS_KEY = 'se-meu-progresso';
/** Progresso do usuário logado em vídeos, arquivos e artigos; a view já filtra pelo usuário. */
export function useMyTrainingProgress() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: [MY_TRAINING_PROGRESS_KEY, user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('vw_se_meu_progresso').select('origem,item_id,percentual,concluido,concluido_em,status');
      if (error) throw error;
      return (data ?? []) as MyProgress[];
    },
  });
  return useMemo(() => progressIndex(data ?? []), [data]);
}
