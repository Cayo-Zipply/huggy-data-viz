import { useState } from "react";
import { Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabaseExt } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface CallButtonProps {
  leadId: string;
  className?: string;
  size?: "sm" | "md";
}

export function CallButton({ leadId, className, size = "md" }: CallButtonProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const dims = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  const icon = size === "sm" ? 12 : 14;

  async function handleCall(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabaseExt.functions.invoke("ipbox-click-to-call", {
        body: { lead_id: leadId, lovable_user_id: user.id },
      });
      if (error || (data && data.error)) {
        toast.error(data?.error || error?.message || "Erro ao discar");
        return;
      }
      toast.success(`Discando ${data?.numero ?? ""}... atenda no softphone`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao discar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleCall}
      disabled={loading}
      title="Discar via IPBOX"
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors shrink-0",
        dims,
        className,
      )}
    >
      {loading ? <Loader2 size={icon} className="animate-spin" /> : <Phone size={icon} />}
    </button>
  );
}
