import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabaseExternal";
import { STAGE_CONFIG, STAGE_ORDER, type Stage } from "./types";
import { toast } from "sonner";
import { Flame, Loader2, Trash2, Repeat } from "lucide-react";
import { burnState } from "@/lib/burnState";
import { useAuth } from "@/contexts/AuthContext";

type Tipo = "tag" | "etapa" | "parado" | "todos";
type Quando = "agora" | "agendar";
type PipeSel = "sdr" | "closer" | "tudo";

interface FupJob {
  id: string;
  rotulo: string | null;
  agendado_para: string | null;
  status: string;
  criterio: any;
  total_enfileirado: number | null;
  erro_msg: string | null;
}

interface FupRun {
  id: string;
  rotulo: string | null;
  total: number | null;
  discados: number | null;
  fed_count?: number | null;
  status: string | null;
  criado_em: string | null;
}

export default function BurnFupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<Tipo>("tag");
  const [etapa, setEtapa] = useState<Stage>("conectado");
  const [dias, setDias] = useState<number>(2);
  const [etapaParado, setEtapaParado] = useState<string>("");
  const [pipeTodos, setPipeTodos] = useState<PipeSel>("sdr");
  const [quando, setQuando] = useState<Quando>("agora");
  const [agendado, setAgendado] = useState<string>(() => {
    const d = new Date(Date.now() + 86400000);
    d.setHours(9, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [preview, setPreview] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [jobs, setJobs] = useState<FupJob[]>([]);
  const [runs, setRuns] = useState<FupRun[]>([]);
  const [repetindo, setRepetindo] = useState<string | null>(null);
  const [continuavel, setContinuavel] = useState<FupRun | null>(null);
  const [continuando, setContinuando] = useState(false);

  const criterio = (() => {
    if (tipo === "tag") return { tipo: "tag", valor: "ligar" };
    if (tipo === "etapa") return { tipo: "etapa", valor: STAGE_CONFIG[etapa].label };
    if (tipo === "todos") {
      const c: any = { tipo: "todos" };
      if (pipeTodos !== "tudo") c.pipe = pipeTodos;
      return c;
    }
    const c: any = { tipo: "parado", dias };
    if (etapaParado) c.valor = STAGE_CONFIG[etapaParado as Stage].label;
    return c;
  })();

  const rotulo = (() => {
    if (tipo === "tag") return "Leads com tag ligar";
    if (tipo === "etapa") return `Todos em ${STAGE_CONFIG[etapa].label}`;
    if (tipo === "todos") return `Todos do pipe ${pipeTodos.toUpperCase()}`;
    return `Parados há ${dias}d${etapaParado ? ` em ${STAGE_CONFIG[etapaParado as Stage].label}` : ""}`;
  })();

  async function loadJobs() {
    const { data } = await (supabase as any)
      .from("fup_jobs")
      .select("*")
      .in("status", ["pendente"])
      .order("agendado_para", { ascending: true });
    setJobs((data as FupJob[]) || []);
  }

  async function loadRuns() {
    const { data } = await (supabase as any)
      .from("fup_runs")
      .select("id, rotulo, total, discados, fed_count, status, criado_em")
      .order("criado_em", { ascending: false })
      .limit(10);
    setRuns((data as FupRun[]) || []);
  }

  async function loadContinuavel() {
    const { data } = await (supabase as any)
      .from("fup_runs")
      .select("id, rotulo, total, discados, fed_count, status, criado_em")
      .in("status", ["pausado", "encerrado"])
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    const r = data as FupRun | null;
    if (r && (r.fed_count ?? 0) < (r.total ?? 0)) setContinuavel(r);
    else setContinuavel(null);
  }

  async function continuar() {
    if (!continuavel) return;
    setContinuando(true);
    try {
      await (supabase as any).from("fup_runs").update({ status: "rodando" }).eq("id", continuavel.id);
      burnState.set(continuavel.id);
      toast.success("🔥 Burn retomado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao continuar: " + (e?.message || e));
    } finally {
      setContinuando(false);
    }
  }

  useEffect(() => {
    if (open) {
      loadJobs();
      loadRuns();
      loadContinuavel();
      setPreview(null);
    }
  }, [open]);

  useEffect(() => { setPreview(null); }, [tipo, etapa, dias, etapaParado, pipeTodos]);

  async function fazerPreview() {
    setPreviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke("iniciar-fup", {
        body: { criterio, dry_run: true },
      });
      if (error) throw error;
      setPreview((data as any)?.total ?? 0);
    } catch (e: any) {
      toast.error("Erro no preview: " + (e?.message || e));
    } finally {
      setPreviewing(false);
    }
  }

  async function confirmar() {
    setConfirmando(true);
    try {
      if (quando === "agora") {
        const { data: resp, error } = await supabase.functions.invoke("iniciar-fup", {
          body: { criterio, criado_por: user?.id ?? null },
        });
        if (error) throw error;
        const r = resp as any;
        if (r?.error) throw new Error(r.error);
        if (r?.run_id) burnState.set(r.run_id);
        toast.success(`🔥 Burn iniciado · ${r?.total ?? 0} leads na fila`);
        onOpenChange(false);
      } else {
        const when = new Date(agendado).toISOString();
        const { error } = await (supabase as any).from("fup_jobs").insert({
          criterio,
          rotulo,
          agendado_para: when,
          status: "pendente",
        });
        if (error) throw error;
        toast.success(`Agendado para ${new Date(agendado).toLocaleString("pt-BR")}`);
        await loadJobs();
      }
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    } finally {
      setConfirmando(false);
    }
  }

  async function repetirRun(runId: string) {
    setRepetindo(runId);
    try {
      const { data: resp, error } = await supabase.functions.invoke("iniciar-fup", {
        body: { criterio: { tipo: "repetir", run_id: runId }, criado_por: user?.id ?? null },
      });
      if (error) throw error;
      const r = resp as any;
      if (r?.error) throw new Error(r.error);
      if (r?.run_id) burnState.set(r.run_id);
      toast.success(`🔥 Repetindo · ${r?.total ?? 0} leads`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao repetir: " + (e?.message || e));
    } finally {
      setRepetindo(null);
    }
  }

  async function cancelar(id: string) {
    await (supabase as any).from("fup_jobs").update({ status: "cancelado" }).eq("id", id);
    await loadJobs();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" /> Burn — Disparar FUP no IPBOX
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {continuavel && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-orange-500/40 bg-orange-500/10">
              <Flame className="w-4 h-4 text-orange-500" />
              <div className="flex-1 min-w-0 text-sm">
                <div className="truncate font-medium">{continuavel.rotulo || "Lista anterior"}</div>
                <div className="text-xs text-muted-foreground">
                  {continuavel.discados ?? 0}/{continuavel.total ?? 0} · {continuavel.status}
                </div>
              </div>
              <Button size="sm" onClick={continuar} disabled={continuando} className="bg-orange-500 hover:bg-orange-600 text-white">
                {continuando ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Play className="w-3 h-3 mr-1" /> Continuar</>}
              </Button>
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold text-muted-foreground">CRITÉRIO</Label>
            <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as Tipo)} className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="tag" id="t-tag" />
                <Label htmlFor="t-tag" className="text-sm">Tag <code className="text-xs">ligar</code> (marcados manualmente)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="etapa" id="t-etapa" />
                <Label htmlFor="t-etapa" className="text-sm">Etapa inteira</Label>
                {tipo === "etapa" && (
                  <Select value={etapa} onValueChange={(v) => setEtapa(v as Stage)}>
                    <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGE_ORDER.map((s) => (
                        <SelectItem key={s} value={s}>{STAGE_CONFIG[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <RadioGroupItem value="parado" id="t-parado" />
                <Label htmlFor="t-parado" className="text-sm">Parados há</Label>
                {tipo === "parado" && (
                  <>
                    <Input type="number" min={1} value={dias} onChange={(e) => setDias(Number(e.target.value))} className="h-8 w-16" />
                    <span className="text-sm">dias</span>
                    <Select value={etapaParado || "any"} onValueChange={(v) => setEtapaParado(v === "any" ? "" : v)}>
                      <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Qualquer etapa</SelectItem>
                        {STAGE_ORDER.map((s) => (
                          <SelectItem key={s} value={s}>{STAGE_CONFIG[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="todos" id="t-todos" />
                <Label htmlFor="t-todos" className="text-sm">Todos do pipe</Label>
                {tipo === "todos" && (
                  <Select value={pipeTodos} onValueChange={(v) => setPipeTodos(v as PipeSel)}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sdr">SDR</SelectItem>
                      <SelectItem value="closer">Closer</SelectItem>
                      <SelectItem value="tudo">Tudo</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label className="text-xs font-semibold text-muted-foreground">QUANDO</Label>
            <RadioGroup value={quando} onValueChange={(v) => setQuando(v as Quando)} className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="agora" id="q-agora" />
                <Label htmlFor="q-agora" className="text-sm">Agora 🔥</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="agendar" id="q-agendar" />
                <Label htmlFor="q-agendar" className="text-sm">Agendar</Label>
                {quando === "agendar" && (
                  <Input type="datetime-local" value={agendado} onChange={(e) => setAgendado(e.target.value)} className="h-8 w-56" />
                )}
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border">
            <Button size="sm" variant="outline" onClick={fazerPreview} disabled={previewing}>
              {previewing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Preview"}
            </Button>
            <span className="text-sm text-foreground">
              {preview === null ? "Clique em Preview para ver quantos leads serão chamados" : `${preview} leads serão chamados`}
            </span>
          </div>

          <Button
            onClick={confirmar}
            disabled={confirmando || preview === 0}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            {confirmando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Flame className="w-4 h-4 mr-2" />}
            {quando === "agora" ? "Burn agora" : "Agendar"}
          </Button>

          {jobs.length > 0 && (
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">AGENDAMENTOS PENDENTES</Label>
              <div className="mt-2 space-y-1.5">
                {jobs.map((j) => (
                  <div key={j.id} className="flex items-center gap-2 p-2 rounded-md border border-border bg-card text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{j.rotulo || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {j.agendado_para ? new Date(j.agendado_para).toLocaleString("pt-BR") : "—"}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => cancelar(j.id)} className="h-7 px-2 text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {runs.length > 0 && (
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">BURNS ANTERIORES</Label>
              <div className="mt-2 space-y-1.5">
                {runs.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 p-2 rounded-md border border-border bg-card text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{r.rotulo || "Burn"}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.criado_em ? new Date(r.criado_em).toLocaleString("pt-BR") : "—"} · {r.discados ?? 0}/{r.total ?? 0} · {r.status}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => repetirRun(r.id)}
                      disabled={repetindo === r.id}
                      className="h-7 px-2"
                      title="Repetir esta lista"
                    >
                      {repetindo === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Repeat className="w-3 h-3" />}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
