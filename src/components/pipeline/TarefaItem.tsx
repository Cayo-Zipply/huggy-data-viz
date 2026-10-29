import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Check, Paperclip, Trash2, ImagePlus, RotateCw, CalendarPlus, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import type { PipelineTask } from "./types";

const sb = supabase as any;
const ACCEPT = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 10;

type Print = { id: string; storage_path: string; nome_arquivo: string; uploaded_by: string | null };

function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function addDays(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); }
function nextMonday() { const d = new Date(); const diff = ((8 - d.getDay()) % 7) || 7; d.setDate(d.getDate() + diff); return ymd(d); }
const fmtBR = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

function usePrints(taskId: string) {
  return useQuery({
    queryKey: ["tarefa-prints", taskId],
    staleTime: 60_000,
    queryFn: async (): Promise<Print[]> => {
      const { data, error } = await sb.from("lead_anexos").select("id, storage_path, nome_arquivo, uploaded_by")
        .eq("tarefa_id", taskId).order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function Thumb({ p, canDelete, onDelete, onOpen }: { p: Print; canDelete: boolean; onDelete: () => void; onOpen: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    sb.storage.from("lead-anexos").createSignedUrl(p.storage_path, 3600).then(({ data }: any) => { if (alive) setUrl(data?.signedUrl ?? null); });
    return () => { alive = false; };
  }, [p.storage_path]);
  return (
    <div className="relative group w-20 h-20 rounded-md overflow-hidden border border-border bg-muted/40">
      {url ? <img src={url} alt={p.nome_arquivo} className="w-full h-full object-cover cursor-zoom-in" onClick={() => onOpen(url)} /> : <div className="w-full h-full animate-pulse" />}
      {canDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Excluir print"
          className="absolute top-1 right-1 p-1 rounded bg-background/80 text-destructive opacity-0 group-hover:opacity-100">
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}

/** Área de prints: Ctrl+V, arrastar e soltar, ou escolher arquivo. */
export function PrintsArea({ task }: { task: PipelineTask }) {
  const { user, isAdmin, profile } = useAuth();
  const qc = useQueryClient();
  const { data: prints = [] } = usePrints(task.id);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["tarefa-prints", task.id] });
    qc.invalidateQueries({ queryKey: ["lead-anexos", task.card_id] });
  };

  const upload = useCallback(async (files: File[]) => {
    const valid = files.filter(f => {
      if (!ACCEPT.includes(f.type)) { toast.error(`${f.name || "Imagem"}: use PNG, JPG ou WEBP`); return false; }
      if (f.size > MAX_BYTES) { toast.error(`${f.name || "Imagem"}: máximo 5 MB`); return false; }
      return true;
    });
    if (!valid.length) return;
    if (prints.length + valid.length > MAX_FILES) { toast.error(`Máximo de ${MAX_FILES} prints por tarefa`); return; }
    setBusy(true);
    try {
      for (const f of valid) {
        const ext = f.type.split("/")[1].replace("jpeg", "jpg");
        const base = (f.name && f.name !== "image.png" ? f.name : `print.${ext}`).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${task.card_id}/tarefas/${task.id}/${Date.now()}-${base}`;
        const { error: upErr } = await sb.storage.from("lead-anexos").upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) throw upErr;
        const { error } = await sb.from("lead_anexos").insert({
          lead_id: task.card_id, tarefa_id: task.id, nome_arquivo: base, tipo: "print_tarefa",
          mime_type: f.type, tamanho_bytes: f.size, storage_path: path, source: "manual",
          uploaded_by: user?.id ?? null, uploaded_by_nome: profile?.nome || user?.email || null,
        });
        if (error) { await sb.storage.from("lead-anexos").remove([path]); throw error; }
      }
      toast.success(valid.length > 1 ? `${valid.length} prints anexados` : "Print anexado");
    } catch (e: any) {
      toast.error("Erro ao anexar print: " + (e?.message || e));
    } finally { setBusy(false); refresh(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prints.length, task.id, task.card_id, user?.id, profile?.nome]);

  const remove = async (p: Print) => {
    if (!confirm("Excluir este print?")) return;
    const { error } = await sb.from("lead_anexos").delete().eq("id", p.id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    await sb.storage.from("lead-anexos").remove([p.storage_path]);
    toast.success("Print excluído");
    refresh();
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.items).filter(i => i.type.startsWith("image/")).map(i => i.getAsFile()).filter(Boolean) as File[];
    if (files.length) { e.preventDefault(); upload(files); }
  };

  return (
    <div className="space-y-2">
      <div
        tabIndex={0}
        onPaste={onPaste}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(Array.from(e.dataTransfer.files)); }}
        className={cn("rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground flex items-center justify-between gap-2 focus:outline-none focus:ring-1 focus:ring-primary",
          drag ? "border-primary bg-primary/5" : "border-border")}
      >
        <span className="flex items-center gap-1.5"><ImagePlus size={13} />{busy ? "Enviando..." : "Anexar print — clique aqui e cole (Ctrl+V) ou arraste"}</span>
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="text-primary hover:underline whitespace-nowrap">Escolher imagem</button>
        <input ref={inputRef} type="file" accept={ACCEPT.join(",")} multiple className="hidden"
          onChange={(e) => { upload(Array.from(e.target.files || [])); e.target.value = ""; }} />
      </div>
      {prints.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {prints.map(p => (
            <Thumb key={p.id} p={p} canDelete={isAdmin || (!!user && p.uploaded_by === user.id)} onDelete={() => remove(p)} onOpen={setLightbox} />
          ))}
        </div>
      )}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl p-2">
          {lightbox && <img src={lightbox} alt="Print" className="w-full h-auto max-h-[80vh] object-contain rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DatePopover({ label, icon, onConfirm }: { label: string; icon: React.ReactNode; onConfirm: (d: string, t: string | null) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(addDays(1));
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const today = ymd(new Date());
  const shortcuts = [["Amanhã", addDays(1)], ["+2 dias", addDays(2)], ["Próxima segunda", nextMonday()], ["+1 semana", addDays(7)]];
  const confirm = async () => {
    if (!date || date < today) { toast.error("Escolha uma data a partir de hoje"); return; }
    setSaving(true);
    try { await onConfirm(date, time || null); setOpen(false); } finally { setSaving(false); }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">{icon}{label}</button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 p-3" align="end">
        <div className="flex flex-wrap gap-1">
          {shortcuts.map(([l, d]) => (
            <button key={l} onClick={() => setDate(d)} className={cn("text-[11px] px-2 py-1 rounded border", date === d ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{l}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="date" min={today} value={date} onChange={e => setDate(e.target.value)} className="flex-1 text-sm bg-muted/50 border border-border rounded-md px-2 py-1 text-foreground" />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} title="Hora (opcional)" className="w-24 text-sm bg-muted/50 border border-border rounded-md px-2 py-1 text-foreground" />
        </div>
        <Button size="sm" className="w-full" disabled={saving} onClick={confirm}>{saving ? "Salvando..." : "Confirmar"}</Button>
      </PopoverContent>
    </Popover>
  );
}

export function TarefaItem({ task, onToggle }: { task: PipelineTask; onToggle: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [obs, setObs] = useState(task.observacao ?? "");
  const [savedObs, setSavedObs] = useState(task.observacao ?? "");
  const [showMore, setShowMore] = useState(false);
  const [concluirOpen, setConcluirOpen] = useState(false);
  const [modalObs, setModalObs] = useState("");
  const { data: prints = [] } = usePrints(task.id);
  const done = task.status === "concluida";
  const reag = task.reagendamentos ?? 0;

  useEffect(() => { setObs(task.observacao ?? ""); setSavedObs(task.observacao ?? ""); }, [task.observacao]);

  const saveObs = async (value: string, silent = false) => {
    const v = value.trim() || null;
    if ((v ?? "") === (savedObs.trim() || "")) return true;
    const { error } = await sb.from("tarefas").update({ observacao: v }).eq("id", task.id);
    if (error) { toast.error("Erro ao salvar observação: " + error.message); return false; }
    setSavedObs(v ?? "");
    if (!silent) toast.success("Observação salva");
    return true;
  };

  const handleCheck = () => {
    if (done) { onToggle(task.id); return; }
    setModalObs(obs);
    setConcluirOpen(true);
  };

  const confirmConcluir = async () => {
    if (!(await saveObs(modalObs, true))) return;
    setObs(modalObs);
    onToggle(task.id);
    setConcluirOpen(false);
    toast.success("Tarefa concluída");
  };

  const reschedule = async (d: string, t: string | null) => {
    const { error } = await sb.from("tarefas").update({ data_tarefa: d, hora_tarefa: t }).eq("id", task.id);
    if (error) { toast.error("Erro ao reagendar: " + error.message); throw error; }
    toast.success(`Tarefa reagendada para ${fmtBR(d)}${t ? ` às ${t}` : ""}`);
  };

  const agendarDeNovo = async (d: string, t: string | null) => {
    const { error } = await sb.from("tarefas").insert({
      lead_id: task.card_id, titulo: task.title, pipeline: task.pipe_context, closer: task.responsible,
      data_tarefa: d, hora_tarefa: t, status: "pendente",
    });
    if (error) { toast.error("Erro ao agendar: " + error.message); throw error; }
    toast.success(`Nova tarefa criada para ${fmtBR(d)}`);
  };

  return (
    <div className="py-2 border-b border-border/30 last:border-0">
      <div className="flex items-start gap-3">
        <button onClick={handleCheck}
          className={cn("mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
            done ? "border-green-400 bg-green-400/20 text-green-400" : "border-muted-foreground text-transparent hover:border-primary")}>
          <Check size={10} />
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => setExpanded(v => !v)} className="w-full text-left flex items-center gap-1">
            <span className={cn("text-sm", done && "line-through text-muted-foreground")}>{task.title}</span>
            <ChevronDown size={12} className={cn("text-muted-foreground transition-transform", expanded && "rotate-180")} />
          </button>
          <div className="flex gap-2 mt-0.5 items-center flex-wrap">
            <span className="text-[10px] text-muted-foreground">{new Date(task.due_date + "T12:00:00").toLocaleDateString("pt-BR")}{task.due_time ? ` · ${task.due_time}` : ""}</span>
            {task.auto_generated && <span className="text-[10px] text-muted-foreground italic">auto</span>}
            {reag >= 1 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn("text-[10px] px-1.5 rounded border", reag >= 3 ? "border-orange-500/40 bg-orange-500/10 text-orange-500" : "border-border text-muted-foreground")}>reagendada {reag}x</span>
                </TooltipTrigger>
                <TooltipContent>{task.data_original ? `Data original: ${fmtBR(task.data_original)}` : "Reagendada"}</TooltipContent>
              </Tooltip>
            )}
            {prints.length > 0 && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Paperclip size={10} />{prints.length}</span>}
          </div>
          {!expanded && savedObs && (
            <div className="mt-1">
              <p className={cn("text-xs text-muted-foreground whitespace-pre-wrap", !showMore && "line-clamp-2")}>{savedObs}</p>
              {savedObs.length > 120 || savedObs.split("\n").length > 2 ? (
                <button onClick={() => setShowMore(v => !v)} className="text-[10px] text-primary hover:underline">{showMore ? "ver menos" : "ver mais"}</button>
              ) : null}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          {done
            ? <DatePopover label="Agendar de novo" icon={<CalendarPlus size={12} />} onConfirm={agendarDeNovo} />
            : <DatePopover label="Reagendar" icon={<RotateCw size={12} />} onConfirm={reschedule} />}
        </div>
      </div>

      {expanded && (
        <div className="ml-8 mt-2 space-y-2">
          <textarea value={obs} onChange={e => setObs(e.target.value)} onBlur={() => saveObs(obs)} rows={2}
            placeholder="Ex.: liguei, cliente pediu proposta revisada até sexta"
            aria-label="Observação — o que foi feito?"
            className="w-full text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-foreground resize-y min-h-[56px] focus:outline-none focus:ring-1 focus:ring-primary" />
          <p className="text-[10px] text-muted-foreground -mt-1">Observação — o que foi feito? (salva ao sair do campo)</p>
          <PrintsArea task={task} />
        </div>
      )}

      <Dialog open={concluirOpen} onOpenChange={setConcluirOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Concluir tarefa</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">{task.title}</p>
          <label className="text-xs text-muted-foreground">Observação — o que foi feito?</label>
          <textarea value={modalObs} onChange={e => setModalObs(e.target.value)} rows={3} autoFocus
            placeholder="Ex.: liguei, cliente pediu proposta revisada até sexta"
            className="w-full text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-primary" />
          <PrintsArea task={task} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConcluirOpen(false)}>Cancelar</Button>
            <Button onClick={confirmConcluir}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
