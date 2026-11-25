import { useEffect, useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabaseExt as supabase } from "@/lib/supabaseExternal";
import { ALMOCO_PADRAO, intervaloBloqueioValido, lerAlmocoPadrao, removerAlmocoPadrao, salvarAlmocoPadrao } from "@/lib/closerBloqueios";
import { HORAS } from "@/lib/horarios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export function AlmocoAtendimento({ closer }: { closer: string }) {
  const qc = useQueryClient();
  const id = useId();
  const [reservar, setReservar] = useState(false);
  const [inicio, setInicio] = useState<string>(ALMOCO_PADRAO.inicio);
  const [fim, setFim] = useState<string>(ALMOCO_PADRAO.fim);
  const [salvando, setSalvando] = useState(false);
  const almocoQ = useQuery({
    queryKey: ["closer_bloqueios", "almoco_padrao", closer],
    staleTime: 0,
    queryFn: () => lerAlmocoPadrao(supabase, closer),
  });

  useEffect(() => {
    if (almocoQ.data === undefined) return;
    setReservar(!!almocoQ.data);
    setInicio(almocoQ.data?.inicio ?? ALMOCO_PADRAO.inicio);
    setFim(almocoQ.data?.fim ?? ALMOCO_PADRAO.fim);
  }, [almocoQ.data]);

  const recarregar = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["closer_bloqueios", "almoco_padrao", closer] }),
      qc.invalidateQueries({ queryKey: ["closer_bloqueios_efetivos", closer] }),
      qc.invalidateQueries({ queryKey: ["closer_janelas"] }),
    ]);
  };

  const alterarReserva = async (ligado: boolean) => {
    if (ligado) {
      setReservar(true);
      setInicio(ALMOCO_PADRAO.inicio);
      setFim(ALMOCO_PADRAO.fim);
      return;
    }
    if (!almocoQ.data) { setReservar(false); return; }
    setSalvando(true);
    try {
      await removerAlmocoPadrao(supabase, closer);
      setReservar(false);
      toast.success("Reserva de almoço removida.");
      await recarregar();
    } catch {
      toast.error("Não foi possível remover a reserva de almoço.");
    } finally { setSalvando(false); }
  };

  const salvar = async () => {
    if (!reservar || !intervaloBloqueioValido(inicio, fim)) return;
    setSalvando(true);
    try {
      await salvarAlmocoPadrao(supabase, closer, inicio, fim);
      toast.success("Horário de almoço salvo.");
      await recarregar();
    } catch {
      toast.error("Não foi possível salvar o horário de almoço.");
    } finally { setSalvando(false); }
  };

  const bloqueado = almocoQ.isLoading || almocoQ.isError || salvando;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Almoço</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <label htmlFor={id} className="flex items-center gap-3 text-sm">
          <Switch id={id} checked={reservar} onCheckedChange={alterarReserva} disabled={bloqueado} />
          Reservar horário de almoço
        </label>
        <p className="text-xs text-muted-foreground">Nesse horário a IA não marca reunião para você.</p>
        {almocoQ.isLoading && <p role="status" className="text-xs text-muted-foreground">Carregando almoço…</p>}
        {almocoQ.isError && (
          <div role="alert" className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-destructive">Não foi possível carregar o horário de almoço.</p>
            <Button size="sm" variant="ghost" onClick={() => almocoQ.refetch()}>Tentar novamente</Button>
          </div>
        )}
        {reservar && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Início</span>
            <Select value={inicio} onValueChange={setInicio} disabled={bloqueado}>
              <SelectTrigger aria-label="Início do almoço" className="h-8 w-24 tabular-nums"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">{HORAS.map((hora) => <SelectItem key={hora} value={hora}>{hora}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">Fim</span>
            <Select value={fim} onValueChange={setFim} disabled={bloqueado}>
              <SelectTrigger aria-label="Fim do almoço" className="h-8 w-24 tabular-nums"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">{HORAS.map((hora) => <SelectItem key={hora} value={hora}>{hora}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" disabled={bloqueado || !intervaloBloqueioValido(inicio, fim)} onClick={salvar}>
              {salvando ? "Salvando…" : "Salvar almoço"}
            </Button>
            {!intervaloBloqueioValido(inicio, fim) && <p className="w-full text-xs text-destructive">Fim deve ser depois do início.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}