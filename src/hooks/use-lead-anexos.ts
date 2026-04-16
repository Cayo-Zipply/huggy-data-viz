import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LeadAnexo = {
  id: string;
  lead_id: string;
  nome_arquivo: string;
  tipo: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  conteudo_texto: string | null;
  storage_path: string | null;
  url_publica: string | null;
  source: string;
  uploaded_by: string | null;
  uploaded_by_nome: string | null;
  created_at: string;
  updated_at: string;
};

export function useLeadAnexos(leadId: string | null | undefined) {
  return useQuery({
    queryKey: ["lead-anexos", leadId],
    enabled: !!leadId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async (): Promise<LeadAnexo[]> => {
      const { data, error } = await supabase
        .from("lead_anexos")
        .select("*")
        .eq("lead_id", leadId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadAnexo[];
    },
  });
}

export function useUploadAnexo(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${leadId}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("lead-anexos")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      const tipo = file.type.startsWith("image/")
        ? "imagem"
        : file.type === "application/pdf"
        ? "documento"
        : file.name.toLowerCase().endsWith(".txt")
        ? "transcricao"
        : "documento";

      const { data, error } = await supabase
        .from("lead_anexos")
        .insert({
          lead_id: leadId,
          nome_arquivo: file.name,
          tipo,
          mime_type: file.type || null,
          tamanho_bytes: file.size,
          storage_path: path,
          source: "manual",
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-anexos", leadId] });
      toast.success("Anexo enviado com sucesso.");
    },
    onError: (err: any) => {
      console.error("[useUploadAnexo] erro:", err);
      toast.error("Erro ao enviar anexo: " + (err?.message ?? "Tente novamente."));
    },
  });
}

export function useDeleteAnexo(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (anexo: LeadAnexo) => {
      if (anexo.storage_path) {
        await supabase.storage.from("lead-anexos").remove([anexo.storage_path]);
      }
      const { error } = await supabase.from("lead_anexos").delete().eq("id", anexo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-anexos", leadId] });
      toast.success("Anexo removido.");
    },
    onError: (err: any) => {
      toast.error("Erro ao remover: " + (err?.message ?? "Tente novamente."));
    },
  });
}

export async function downloadAnexo(anexo: LeadAnexo) {
  if (anexo.conteudo_texto && !anexo.storage_path) {
    const blob = new Blob([anexo.conteudo_texto], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = anexo.nome_arquivo;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  if (anexo.storage_path) {
    const { data, error } = await supabase.storage
      .from("lead-anexos")
      .createSignedUrl(anexo.storage_path, 60);
    if (error) throw error;
    window.open(data.signedUrl, "_blank");
  }
}
