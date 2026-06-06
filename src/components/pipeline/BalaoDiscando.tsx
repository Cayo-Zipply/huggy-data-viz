import { useEffect, useRef, useState } from "react";
import { Phone, Flame, Pause, Play, Square, PhoneOff } from "lucide-react";
import { useDiscadorAtivo } from "@/hooks/useDiscadorAtivo";
import { useBurnRunId, burnState } from "@/lib/burnState";
import { supabase } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Progresso {
  existe: boolean;
  status: string; // rodando | pausado | encerrado | finalizado
  finalizado: boolean;
  pausado: boolean;
  popup_visto: boolean;
  total: number;
  discados: number;
  restantes: number;
  atendidos: number;
  caixa_postal: number;
  sem_resposta: number;
  outros: number;
}

export default function BalaoDiscando() {
  const { user } = useAuth();
  const runId = useBurnRunId();
  const { call } = useDiscadorAtivo(user?.email, true);
  const [prog, setProg] = useState<Progresso | null>(null);
  const [finalModal, setFinalModal] = useState<Progresso | null>(null);
  const [acting, setActing] = useState(false);
  const [hangingUp, setHangingUp] = useState(false);
  const markedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!runId) { setProg(null); return; }
    let cancelled = false;
    const tick = async () => {
      try {
        const { data } = await supabase.functions.invoke("fup-progresso", { body: { run_id: runId } });
        if (cancelled) return;
        const p = data as Progresso;
        if (!p?.existe) return;
        setProg(p);
        if (p.status === "encerrado") {
          burnState.set(null);
          return;
        }
        if (p.finalizado && !p.popup_visto && markedRef.current !== runId) {
          markedRef.current = runId;
          setFinalModal(p);
          await (supabase as any).from("fup_runs").update({ popup_visto: true }).eq("id", runId);
          burnState.set(null);
        }
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [runId]);

  async function updateStatus(novo: "rodando" | "pausado" | "encerrado") {
    if (!runId || !prog) return;
    setActing(true);
    try {
      await (supabase as any).from("fup_runs").update({ status: novo }).eq("id", runId);
      if (novo === "encerrado") {
        burnState.set(null);
        toast.info("Burn encerrado. Você pode continuar depois.");
      } else {
        setProg({ ...prog, status: novo, pausado: novo === "pausado" });
      }
    } finally {
      setActing(false);
    }
  }

  async function desligar() {
    if (!user?.email) return;
    setHangingUp(true);
    try {
      await supabase.functions.invoke("ipbox-end-call", { body: { email: user.email } });
      toast.success("Ligação encerrada");
    } catch (e: any) {
      toast.error("Erro ao desligar: " + (e?.message || e));
    } finally {
      setHangingUp(false);
    }
  }

  const showCall = call?.ativo;
  const showBurn = !!runId && !!prog && prog.status !== "encerrado";

  return (
    <>
      {(showCall || showBurn) && (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end">
          {showCall && (
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 shadow-lg backdrop-blur">
              <Phone className="w-4 h-4 text-foreground animate-pulse" />
              <span className="text-sm text-foreground">
                📞 Em ligação com <strong>{call?.nome || "—"}</strong>
                {call?.telefone && <span className="text-muted-foreground ml-1">· {call.telefone}</span>}
              </span>
              <Button size="sm" variant="destructive" className="h-7 px-2 ml-1" onClick={desligar} disabled={hangingUp}>
                <PhoneOff className="w-3 h-3 mr-1" /> Desligar
              </Button>
            </div>
          )}
          {showBurn && prog && (
            <div className="min-w-[300px] rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2 shadow-lg backdrop-blur">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="flex-1">🔥 Discados <strong>{prog.discados}/{prog.total}</strong> · {prog.atendidos} atendidos</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2"
                  onClick={() => updateStatus(prog.pausado ? "rodando" : "pausado")}
                  disabled={acting}
                  title={prog.pausado ? "Continuar" : "Pausar"}
                >
                  {prog.pausado ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-destructive"
                  onClick={() => updateStatus("encerrado")}
                  disabled={acting}
                  title="Encerrar"
                >
                  <Square className="w-3 h-3" />
                </Button>
              </div>
              <Progress value={prog.total ? (prog.discados / prog.total) * 100 : 0} className="h-1.5 mt-1.5" />
              <div className="text-[11px] text-muted-foreground mt-1 flex justify-between">
                <span>{prog.caixa_postal} caixa postal · {prog.sem_resposta} sem resposta</span>
                <span className="uppercase">{prog.pausado ? "pausado" : prog.status}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!finalModal} onOpenChange={(v) => !v && setFinalModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" /> Burn finalizado
            </DialogTitle>
          </DialogHeader>
          {finalModal && (
            <div className="text-sm text-foreground space-y-2">
              <p>Discamos para <strong>{finalModal.discados}</strong> de <strong>{finalModal.total}</strong> leads.</p>
              <ul className="text-muted-foreground text-sm list-disc pl-5">
                <li>{finalModal.atendidos} atendidos</li>
                <li>{finalModal.caixa_postal} caixa postal</li>
                <li>{finalModal.sem_resposta} sem resposta</li>
                {finalModal.outros > 0 && <li>{finalModal.outros} outros</li>}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setFinalModal(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
