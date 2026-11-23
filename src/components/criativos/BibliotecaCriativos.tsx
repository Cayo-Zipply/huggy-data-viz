import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ANGULOS, STATUS_CRIATIVO, VIDEO_MAX_BYTES, caminhoVideo } from "@/lib/metaCampanhas";
import { FunilPorCriativo } from "./FunilPorCriativo";

type CriativoLib = {
  id: string; nome: string; angulo: string | null; descricao: string | null; transcricao: string | null;
  storage_path: string | null; thumb_url: string | null; meta_video_id: string | null; status: string; created_at: string;
};

const LIB_KEY = ["criativos-biblioteca"];
const urlPublica = (path: string | null) => (path ? supabase.storage.from("criativos").getPublicUrl(path).data.publicUrl : null);
const angLabel = (a: string | null) => ANGULOS.find((x) => x.v === a)?.l ?? a ?? "—";
const dataBR = (s: string) => new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

async function invokeMeta(body: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("meta-manager", { body });
  if (error) {
    let msg = error.message;
    try { const ctx = await (error as any).context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* ignore */ }
    throw new Error(msg || "Falha ao falar com o Meta.");
  }
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export function BibliotecaCriativos() {
  const [novo, setNovo] = useState(false);
  const q = useQuery({
    queryKey: LIB_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("criativos_biblioteca" as any)
        .select("id, nome, angulo, descricao, transcricao, storage_path, thumb_url, meta_video_id, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CriativoLib[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{(q.data ?? []).length} criativos na biblioteca</p>
        <Button size="sm" onClick={() => setNovo(true)}><Plus className="h-4 w-4 mr-1.5" /> Adicionar criativo</Button>
      </div>

      {q.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[420px]" />)}</div>
      ) : q.isError ? (
        <div className="text-center py-10 space-y-2"><p className="text-sm text-muted-foreground">Não foi possível carregar a biblioteca.</p><Button size="sm" variant="outline" onClick={() => q.refetch()}>Tentar de novo</Button></div>
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-center py-10 text-sm text-muted-foreground">Nenhum criativo cadastrado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {q.data!.map((c) => <CardCriativo key={c.id} c={c} />)}
        </div>
      )}

      <FunilPorCriativo />
      <NovoCriativoDialog open={novo} onClose={() => setNovo(false)} />
    </div>
  );
}

function CardCriativo({ c }: { c: CriativoLib }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const url = urlPublica(c.storage_path);

  // Depois de enviado ao Meta: consulta a cada 10 s até ficar pronto e grava a miniatura.
  const aguardando = isAdmin && !!c.meta_video_id && !c.thumb_url;
  const statusQ = useQuery({
    queryKey: ["meta-video-status", c.meta_video_id],
    queryFn: async () => (await invokeMeta({ action: "video_status", meta_video_id: c.meta_video_id })) as { status?: string; thumb?: string },
    enabled: aguardando,
    refetchInterval: (query) => ((query.state.data as any)?.status === "ready" ? false : 10_000),
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: 0,
  });
  useEffect(() => {
    const d = statusQ.data;
    if (!aguardando || d?.status !== "ready") return;
    (async () => {
      if (d.thumb) {
        const { error } = await supabase.from("criativos_biblioteca" as any).update({ thumb_url: d.thumb }).eq("id", c.id);
        if (error) { toast.error("Vídeo pronto, mas não deu para salvar a miniatura."); return; }
      }
      toast.success(`"${c.nome}" está pronto no Meta.`);
      qc.invalidateQueries({ queryKey: LIB_KEY });
    })();
  }, [statusQ.data, aguardando, c.id, c.nome, qc]);

  const enviarMeta = async () => {
    setEnviando(true);
    try {
      await invokeMeta({ action: "upload_video", criativo_id: c.id });
      toast.success("Vídeo enviado ao Meta. Processando…");
      await qc.invalidateQueries({ queryKey: LIB_KEY });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível enviar ao Meta.");
    } finally { setEnviando(false); }
  };

  const processando = aguardando && statusQ.data?.status !== "ready";
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
      <div className="aspect-[4/5] bg-muted">
        {url ? (
          <video src={url} poster={c.thumb_url ?? undefined} controls preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">Sem vídeo</div>
        )}
      </div>
      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <p className="text-sm font-medium text-foreground line-clamp-2">{c.nome}</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{angLabel(c.angulo)}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px]", c.status === "aposentado" ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground")}>
            {STATUS_CRIATIVO[c.status] ?? c.status}
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground">{dataBR(c.created_at)}</span>
        </div>
        {c.descricao && <p className="text-xs text-muted-foreground line-clamp-3">{c.descricao}</p>}
        {c.meta_video_id && <p className="text-[11px] text-muted-foreground tabular-nums">Vídeo no Meta: {c.meta_video_id}</p>}
        {processando && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Processando no Meta…</p>
        )}
        <div className="mt-auto pt-1">
          {isAdmin && c.status === "arquivo" && !c.meta_video_id && (
            <Button size="sm" variant="outline" className="w-full" onClick={enviarMeta} disabled={enviando || !c.storage_path}>
              {enviando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
              {enviando ? "Enviando…" : "Enviar ao Meta"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function NovoCriativoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [angulo, setAngulo] = useState<string>("dor");
  const [descricao, setDescricao] = useState("");
  const [transcricao, setTranscricao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) { setNome(""); setAngulo("dor"); setDescricao(""); setTranscricao(""); setArquivo(null); }
  }, [open]);

  const erroArquivo = useMemo(() => {
    if (!arquivo) return null;
    const ehMp4 = arquivo.type === "video/mp4" || arquivo.name.toLowerCase().endsWith(".mp4");
    if (!ehMp4) return "Envie um vídeo .mp4.";
    if (arquivo.size > VIDEO_MAX_BYTES) return "O vídeo passa de 500 MB.";
    return null;
  }, [arquivo]);

  const salvar = async () => {
    if (!nome.trim() || !arquivo || erroArquivo) return;
    setSalvando(true);
    try {
      const path = caminhoVideo(nome);
      const up = await supabase.storage.from("criativos").upload(path, arquivo, { contentType: "video/mp4", upsert: false });
      if (up.error) throw new Error(up.error.message);
      const { error } = await supabase.from("criativos_biblioteca" as any).insert({
        nome: nome.trim(), angulo, descricao: descricao.trim() || null, transcricao: transcricao.trim() || null,
        storage_path: path, status: "arquivo", criado_por: profile?.email ?? null,
      });
      if (error) throw new Error(error.message);
      toast.success("Criativo adicionado.");
      await qc.invalidateQueries({ queryKey: LIB_KEY });
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar o criativo.");
    } finally { setSalvando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar criativo</DialogTitle>
          <DialogDescription>Vídeo .mp4 de até 500 MB.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="cr-nome">Nome</Label><Input id="cr-nome" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Ângulo</Label>
            <Select value={angulo} onValueChange={setAngulo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ANGULOS.map((a) => <SelectItem key={a.v} value={a.v}>{a.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="cr-desc">Descrição</Label><Textarea id="cr-desc" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="cr-trans">Transcrição (opcional)</Label><Textarea id="cr-trans" rows={3} value={transcricao} onChange={(e) => setTranscricao(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="cr-video">Vídeo</Label>
            <Input id="cr-video" type="file" accept="video/mp4,.mp4" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            {arquivo && !erroArquivo && <p className="text-[11px] text-muted-foreground">{(arquivo.size / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB</p>}
            {erroArquivo && <p className="text-xs text-destructive">{erroArquivo}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || !nome.trim() || !arquivo || !!erroArquivo}>
            {salvando ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Enviando vídeo…</> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
