import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Novidade = {
  id: string;
  titulo: string;
  itens: string[];
  publicado_em: string;
};

const STORAGE_KEY = "ultima_novidade_vista";

export function useUltimaNovidade() {
  const [novidade, setNovidade] = useState<Novidade | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("app_updates")
        .select("id, titulo, itens, publicado_em")
        .eq("ativo", true)
        .order("publicado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return;

      const jaVista = localStorage.getItem(STORAGE_KEY);
      if (jaVista !== data.id) {
        setNovidade(data as Novidade);
      }
    })();
  }, []);

  function marcarComoVista() {
    if (novidade) localStorage.setItem(STORAGE_KEY, novidade.id);
    setNovidade(null);
  }

  return { novidade, marcarComoVista };
}
