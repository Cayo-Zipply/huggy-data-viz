import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabaseExt as supabase } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DIAS, HORAS, addDias, diaSemana, hhmm, hojeSP, intervaloValido, rotuloData, ultimaReuniao } from "@/lib/horarios";

const TOAST_OK = "Horários salvos. A IA já passa a oferecer só esses horários.";

type DiaPadrao = { atende: boolean; inicio: string; fim: string };
export type Janela = { data: string; inicio: string | null; fim: string | null };
type Excecao = { data: string; folga: boolean; inicio: string | null; fim: string | null };

export function useClosersAgenda() {
  return useQuery({
    queryKey: ["user_profiles", "closers_agenda"],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles").select("nome")
        .contains("funcoes", ["closer"]).eq("visivel_dropdown_closer", true).order("nome");
      if (error) throw error;
      return (data ?? []).map((r: any) => r.nome as string);
    },
  });
}

export function useJanelas(closer: string | undefined, dias: number) {
  return useQuery({
    queryKey: ["closer_janelas", closer, dias],
    enabled: !!closer,
    staleTime: 0,
    queryFn: async (): Promise<Janela[]> => {
      const { data, error } = await supabase.rpc("closer_janelas" as any, { p_de: hojeSP(), p_dias: dias });
      if (error) throw error;
      return ((data as any[]) ?? []).filter((r) => r.closer === closer)
        .map((r) => ({ data: String(r.data).slice(0, 10), inicio: hhmm(r.inicio), fim: hhmm(r.fim) }));
    },
  });
}

function HoraSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-24 h-8 tabular-nums"><SelectValue placeholder="--:--" /></SelectTrigger>
      <SelectContent className="max-h-64">{HORAS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
    </Select>
  );
}

const Dica = ({ fim }: { fim: string }) =>
  fim ? <p className="text-[11px] text-muted-foreground">Reunião dura 1h: com fim {fim}, a última começa às {ultimaReuniao(fim)}.</p> : null;

export function HorariosAtendimento() {
  const { profile, isAdmin } = useAuth();
  const qc = useQueryClient();
  const souCloser = (profile?.funcoes ?? []).includes("closer");
  const { data: closers = [] } = useClosersAgenda();
  const [closer, setCloser] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (closer) return;
    if (souCloser && profile?.nome) setCloser(profile.nome);
    else if (isAdmin && closers.length) setCloser(closers[0]);
  }, [closer, souCloser, isAdmin, closers, profile?.nome]);

  // ---------- Semana padrão ----------
  const [semana, setSemana] = useState<DiaPadrao[]>(() => DIAS.map(() => ({ atende: false, inicio: "09:00", fim: "18:00" })));
  const [salvandoSemana, setSalvandoSemana] = useState(false);
  const padraoQ = useQuery({
    queryKey: ["closer_agenda_padrao", closer],
    enabled: !!closer,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("closer_agenda_padrao" as any).select("dia_semana, inicio, fim").eq("closer", closer!);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
  useEffect(() => {
    if (!padraoQ.data) return;
    setSemana(DIAS.map((_, i) => {
      const r = padraoQ.data!.find((x) => Number(x.dia_semana) === i);
      return r ? { atende: true, inicio: hhmm(r.inicio), fim: hhmm(r.fim) } : { atende: false, inicio: "09:00", fim: "18:00" };
    }));
  }, [padraoQ.data]);

  const setDia = (i: number, p: Partial<DiaPadrao>) => setSemana((s) => s.map((d, j) => (j === i ? { ...d, ...p } : d)));
  const semanaInvalida = semana.some((d) => d.atende && !intervaloValido(d.inicio, d.fim));

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["closer_janelas"] });
    qc.invalidateQueries({ queryKey: ["closer_agenda_dia", closer] });
    qc.invalidateQueries({ queryKey: ["closer_agenda_padrao", closer] });
  };

  const salvarSemana = async () => {
    if (!closer || semanaInvalida) return;
    setSalvandoSemana(true);
    try {
      const ligados = semana.map((d, i) => ({ ...d, i })).filter((d) => d.atende);
      const desligados = semana.map((d, i) => ({ ...d, i })).filter((d) => !d.atende).map((d) => d.i);
      if (ligados.length) {
        const { error } = await supabase.from("closer_agenda_padrao" as any).upsert(
          ligados.map((d) => ({ closer, dia_semana: d.i, inicio: d.inicio, fim: d.fim, updated_at: new Date().toISOString() })) as any,
          { onConflict: "closer,dia_semana" });
        if (error) throw error;
      }
      if (desligados.length) {
        const { error } = await supabase.from("closer_agenda_padrao" as any).delete().eq("closer", closer).in("dia_semana", desligados);
        if (error) throw error;
      }
      toast.success(TOAST_OK);
      recarregar();
    } catch (e: any) {
      toast.error("Não foi possível salvar: " + (e?.message ?? "erro"));
    } finally {
      setSalvandoSemana(false);
    }
  };

  // ---------- Próximos 14 dias ----------
  const hoje = hojeSP();
  const datas = useMemo(() => Array.from({ length: 14 }, (_, i) => addDias(hoje, i)), [hoje]);
  const janelasQ = useJanelas(closer, 14);
  const excQ = useQuery({
    queryKey: ["closer_agenda_dia", closer, hoje],
    enabled: !!closer,
    staleTime: 0,
    queryFn: async (): Promise<Excecao[]> => {
      const { data, error } = await supabase.from("closer_agenda_dia" as any).select("data, folga, inicio, fim")
        .eq("closer", closer!).gte("data", hoje).lte("data", addDias(hoje, 13));
      if (error) throw error;
      return ((data as any[]) ?? []).map((r) => ({ ...r, data: String(r.data).slice(0, 10) }));
    },
  });
  const [editando, setEditando] = useState<string | null>(null);
  const [edIni, setEdIni] = useState("09:00");
  const [edFim, setEdFim] = useState("18:00");
  const [ocupado, setOcupado] = useState<string | null>(null);

  const acaoDia = async (data: string, fn: () => PromiseLike<{ error: any }>) => {
    setOcupado(data);
    const { error } = await fn();
    setOcupado(null);
    if (error) { toast.error("Não foi possível salvar: " + error.message); return; }
    setEditando(null);
    toast.success(TOAST_OK);
    recarregar();
  };
  const upsertDia = (data: string, row: Record<string, unknown>) =>
    acaoDia(data, () => supabase.from("closer_agenda_dia" as any)
      .upsert({ closer, data, ...row, updated_at: new Date().toISOString() } as any, { onConflict: "closer,data" }));

  if (!souCloser && !isAdmin) return <p className="text-sm text-muted-foreground">Disponível apenas para closers.</p>;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Closer:</span>
          <Select value={closer} onValueChange={(v) => { setCloser(v); setEditando(null); }}>
            <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Escolha um closer" /></SelectTrigger>
            <SelectContent>
              {Array.from(new Set([...(souCloser && profile?.nome ? [profile.nome] : []), ...closers])).map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Semana padrão</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {semana.map((d, i) => {
            const inval = d.atende && !intervaloValido(d.inicio, d.fim);
            return (
              <div key={i} className="flex flex-wrap items-center gap-3 py-1 border-b border-border last:border-0">
                <span className="w-20 text-sm font-medium">{DIAS[i]}</span>
                <label className="flex items-center gap-2 text-xs text-muted-foreground w-24">
                  <Switch checked={d.atende} onCheckedChange={(v) => setDia(i, { atende: v })} /> Atende
                </label>
                <span className="text-xs text-muted-foreground">Início</span>
                <HoraSelect value={d.inicio} onChange={(v) => setDia(i, { inicio: v })} disabled={!d.atende} />
                <span className="text-xs text-muted-foreground">Fim</span>
                <HoraSelect value={d.fim} onChange={(v) => setDia(i, { fim: v })} disabled={!d.atende} />
                {inval && <span className="text-xs text-destructive">Fim deve ser depois do início</span>}
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground">O fim é até quando você atende. A reunião dura 1h: com fim 22:00, a última reunião começa às 21:00.</p>
          <Button size="sm" onClick={salvarSemana} disabled={!closer || semanaInvalida || salvandoSemana || padraoQ.isLoading}>
            {salvandoSemana ? "Salvando…" : "Salvar semana padrão"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Próximos 14 dias</CardTitle>
          <p className="text-xs text-muted-foreground">Exemplos: "Sábado das 9h às 13h", "Sexta até as 22h", "Folga na quinta".</p>
        </CardHeader>
        <CardContent className="space-y-1">
          {janelasQ.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : datas.map((data) => {
            const j = janelasQ.data?.find((x) => x.data === data);
            const exc = excQ.data?.find((x) => x.data === data);
            const busy = ocupado === data;
            return (
              <div key={data} className="py-1.5 border-b border-border last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-20 text-sm font-medium tabular-nums">{rotuloData(data)}</span>
                  <span className={j ? "text-sm tabular-nums" : "text-sm text-muted-foreground"}>
                    {j ? `${j.inicio} – ${j.fim}` : "Não atende"}
                  </span>
                  {exc && <Badge variant="secondary" className="text-[10px]">Exceção</Badge>}
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy}
                      onClick={() => { setEditando(data); setEdIni(j?.inicio || "09:00"); setEdFim(j?.fim || "18:00"); }}>Mudar horário</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy}
                      onClick={() => upsertDia(data, { folga: true, inicio: null, fim: null })}>Folga</Button>
                    {exc && <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy}
                      onClick={() => acaoDia(data, () => supabase.from("closer_agenda_dia" as any).delete().eq("closer", closer!).eq("data", data))}>Voltar ao padrão</Button>}
                  </div>
                </div>
                {editando === data && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-20">
                    <span className="text-xs text-muted-foreground">Início</span>
                    <HoraSelect value={edIni} onChange={setEdIni} />
                    <span className="text-xs text-muted-foreground">Fim</span>
                    <HoraSelect value={edFim} onChange={setEdFim} />
                    <Button size="sm" className="h-8" disabled={!intervaloValido(edIni, edFim) || busy}
                      onClick={() => upsertDia(data, { folga: false, inicio: edIni, fim: edFim })}>Salvar</Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditando(null)}>Cancelar</Button>
                    {!intervaloValido(edIni, edFim) && <span className="text-xs text-destructive">Fim deve ser depois do início</span>}
                    <div className="w-full"><Dica fim={edFim} /></div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
