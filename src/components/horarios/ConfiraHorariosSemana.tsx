import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { addDias, diaSemana, hojeSP, rotuloData, segundaDaSemana } from "@/lib/horarios";
import { useJanelas } from "./HorariosAtendimento";
import { HorariosDialog } from "./HorariosDialog";

/** Toda segunda, no primeiro acesso do closer, mostra resumo dos próximos 7 dias. */
export function ConfiraHorariosSemana() {
  const { profile } = useAuth();
  const souCloser = (profile?.funcoes ?? []).includes("closer");
  const hoje = hojeSP();
  const chave = `farol_horarios_visto_${profile?.nome ?? ""}`;
  const semana = segundaDaSemana(hoje);
  const [open, setOpen] = useState(false);
  const [ajustar, setAjustar] = useState(false);

  useEffect(() => {
    if (!souCloser || !profile?.nome || diaSemana(hoje) !== 1) return;
    if (localStorage.getItem(chave) !== semana) setOpen(true);
  }, [souCloser, profile?.nome, hoje, chave, semana]);

  const { data: janelas = [], isLoading } = useJanelas(open ? profile?.nome : undefined, 7);
  const marcar = () => localStorage.setItem(chave, semana);

  if (!souCloser) return null;
  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) marcar(); setOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confira seus horários desta semana</DialogTitle></DialogHeader>
          <div className="space-y-1">
            {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
              Array.from({ length: 7 }, (_, i) => addDias(hoje, i)).map((d) => {
                const j = janelas.find((x) => x.data === d);
                return (
                  <div key={d} className="flex justify-between text-sm border-b border-border last:border-0 py-1">
                    <span className="font-medium tabular-nums">{rotuloData(d)}</span>
                    <span className={j ? "tabular-nums" : "text-muted-foreground"}>{j ? `${j.inicio} – ${j.fim}` : "Não atende"}</span>
                  </div>
                );
              })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { marcar(); setOpen(false); setAjustar(true); }}>Ajustar</Button>
            <Button onClick={() => { marcar(); setOpen(false); }}>Está certo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <HorariosDialog open={ajustar} onOpenChange={setAjustar} />
    </>
  );
}
