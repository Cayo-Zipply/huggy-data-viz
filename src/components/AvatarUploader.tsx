import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabaseExt as supabase } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { refreshAvatars } from "@/hooks/useAvatars";
import { cn } from "@/lib/utils";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  className?: string;
  initials: string;
  currentUrl?: string | null;
}

/** Avatar do usuário logado com upload self-serve no bucket `avatars`. */
export function AvatarUploader({ className, initials, currentUrl }: Props) {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(currentUrl ?? null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file || !user) return;

    if (!ALLOWED.includes(file.type)) {
      toast({
        title: "Formato não suportado",
        description: "Envie uma imagem JPEG, PNG, WEBP ou GIF.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({
        title: "Imagem muito grande",
        description: "O tamanho máximo é 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Preview imediato
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    setUploading(true);

    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      const { error: dbErr } = await (supabase as any)
        .from("user_profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);
      if (dbErr) throw dbErr;

      // Cache-busting: o caminho é fixo e sobrescreve o arquivo anterior.
      setUrl(`${publicUrl}?t=${Date.now()}`);
      refreshAvatars();
      void refreshProfile();
      toast({ title: "Foto atualizada!" });
    } catch (err: any) {
      setUrl(currentUrl ?? null);
      toast({
        title: "Não foi possível atualizar a foto",
        description: err?.message ?? "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      URL.revokeObjectURL(preview);
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="Trocar foto"
        className={cn("relative group rounded-full", className)}
        disabled={uploading}
      >
        <Avatar className="h-8 w-8">
          {url ? <AvatarImage src={url} alt="" /> : null}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <Camera className="h-3.5 w-3.5 text-primary" />
          )}
        </span>
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </>
  );
}
