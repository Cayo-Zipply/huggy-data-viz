import type { ReactNode } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAvatars } from "@/hooks/useAvatars";
import { cn } from "@/lib/utils";

interface PersonAvatarProps {
  name?: string | null;
  className?: string;
  /** Conteúdo mostrado quando não há foto (ou ela falha ao carregar). */
  fallback?: ReactNode;
}

function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Avatar circular do vendedor. Busca `user_profiles.avatar_url` pelo nome
 * exibido; se não houver foto (ou ela falhar), mostra o fallback informado.
 */
export function PersonAvatar({ name, className, fallback }: PersonAvatarProps) {
  const { getAvatar } = useAvatars();
  const url = getAvatar(name);

  return (
    <Avatar className={cn("h-10 w-10 shrink-0", className)}>
      {url ? <AvatarImage src={url} alt={name ?? ""} /> : null}
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
        {fallback ?? initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
