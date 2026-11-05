import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseExternal";
import { createVersionCheck, VERSION_INTERVAL_MS } from "@/lib/appVersion";

export function useAppVersion(userId?: string) {
  const versaoCarregada = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!userId) return;
    versaoCarregada.current = undefined;
    const toastId = "farol-new-version";
    const checker = createVersionCheck({
      loadedVersion: versaoCarregada,
      readVersion: async () => {
        const { data, error } = await supabase.from("app_config")
          .select("valor").eq("chave", "farol_version").single();
        if (error) throw error;
        return typeof data?.valor === "string" ? data.valor : undefined;
      },
      hidden: () => document.visibilityState === "hidden",
      reload: () => window.location.reload(),
      notify: () => {
        toast("Nova versão do Farol disponível", {
          id: toastId,
          duration: Infinity,
          dismissible: false,
          action: { label: "Atualizar agora", onClick: () => window.location.reload() },
        });
      },
    });
    void checker.check();
    const interval = window.setInterval(() => void checker.check(), VERSION_INTERVAL_MS);
    return () => {
      checker.dispose();
      window.clearInterval(interval);
      toast.dismiss(toastId);
      versaoCarregada.current = undefined;
    };
  }, [userId]);
}