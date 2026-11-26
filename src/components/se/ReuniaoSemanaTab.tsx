import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Trophy, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabaseExternal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { dateSE, nextDay, safeLink } from '@/lib/seTraining';
import { SE_STALE_TIME } from '@/lib/screenCache';

type Winner = {
  semana_inicio: string; semana_fim: string; readai_meeting_id: string | null;
  closer: string | null; closer_avatar_url: string | null; empresa: string | null;
  quando_local: string | null; nota: number | null; media_semana: number | null;
  reunioes_na_semana: number | null; resumo: string | null;
  comparativo: { codigo: string; titulo: string; nota: number | null; media_semana: number | null; delta: number | null }[] | null;
  pontos_fortes: string[] | null; ressalvas: string[] | null; readai_url: string | null;
};
export function ReuniaoSemanaTab() {
  const { isAdmin } = useAuth(); const qc = useQueryClient(); const { toast } = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [swap, setSwap] = useState<Winner | null>(null); const [meeting, setMeeting] = useState('');
  const [summary, setSummary] = useState(''); const [saving, setSaving] = useState(false);
  const { data: weeks = [], isLoading, isError, refetch } = useQuery({
    queryKey:['se-reuniao-semana'], staleTime: SE_STALE_TIME,
    queryFn: async () => { const { data, error } = await supabase.from('vw_se_reuniao_semana').select('*').order('semana_inicio', { ascending:false }); if (error) throw error; return (data ?? []) as Winner[]; },
  });
  const { data: options = [], isLoading: loadingOptions, isError: optionsError } = useQuery({
    queryKey:['se-reuniao-semana-opcoes', swap?.semana_inicio, swap?.semana_fim], enabled: isAdmin && !!swap,
    queryFn: async () => {
      if (!swap || !isAdmin) return [];
      const { data, error } = await supabase.from('vw_se_reunioes').select('reuniao_id,empresa,closer,quando_local,nota')
        .gte('quando_local', swap.semana_inicio.slice(0,10)).lt('quando_local', nextDay(swap.semana_fim)).order('quando_local', { ascending:false });
      if (error) throw error;
      return (data ?? []) as { reuniao_id:string; empresa:string; closer:string; quando_local:string; nota:number }[];
    },
  });
  const change = async () => {
    if (!isAdmin || !swap || !meeting) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('fn_se_eleger_reuniao_semana', { p_ref:swap.semana_inicio, p_forcar:meeting, p_resumo:summary.trim() || null });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey:['se-reuniao-semana'] });
      setSwap(null); toast({ title:'Reunião da semana atualizada' });
    } catch (e) { toast({ title:'Não foi possível trocar a reunião', description:e instanceof Error ? e.message : 'Tente novamente.', variant:'destructive' }); }
    finally { setSaving(false); }
  };
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando reunião da semana…</p>;
  if (isError) return <div role="alert" className="space-y-2"><p className="text-sm text-destructive">Não foi possível carregar a reunião da semana.</p><Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button></div>;
  const current = weeks.find(w => w.semana_inicio === selected) ?? weeks[0];
  const link = safeLink(current?.readai_url);
  return <div className="space-y-8">
    {!current ? <p className="text-sm text-muted-foreground">Sem reunião da semana.</p> : <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-base font-semibold flex items-center gap-2"><Trophy className="h-4 w-4 text-primary shrink-0" />Reunião da semana — {dateSE(current.semana_inicio)} a {dateSE(current.semana_fim)}</h2>
        {isAdmin && <Button size="sm" variant="outline" onClick={() => { setSwap(current); setMeeting(''); setSummary(''); }}><RefreshCw className="h-3.5 w-3.5 mr-2" />Trocar reunião</Button>}
      </header>
      {!current.readai_meeting_id ? <p className="text-sm text-muted-foreground">{current.resumo || 'Sem reunião da semana.'}</p> : <>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-3 min-w-0"><Avatar><AvatarImage src={safeLink(current.closer_avatar_url) ?? undefined} alt={current.closer ?? ''} /><AvatarFallback>{current.closer?.slice(0,2).toUpperCase() ?? '?'}</AvatarFallback></Avatar><div className="min-w-0"><p className="font-semibold break-words">{current.closer ?? '—'}</p><p className="text-sm text-muted-foreground break-words">{current.empresa ?? '—'} · {dateSE(current.quando_local, true)}</p></div></div>
          <div className="flex items-baseline gap-3"><span className="text-4xl font-semibold tabular-nums text-primary">{current.nota ?? '—'}</span><span className="text-xs text-muted-foreground">média da semana {current.media_semana ?? '—'}<br />{current.reunioes_na_semana ?? 0} reuniões</span></div>
        </div>
        <section className="space-y-2"><h3 className="text-sm font-semibold">Por que ganhou</h3><p className="text-sm text-muted-foreground whitespace-pre-wrap">{current.resumo || '—'}</p></section>
        {!!current.comparativo?.length && <section className="space-y-4"><div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><i className="h-2 w-3 bg-primary" />Reunião vencedora</span><span className="flex items-center gap-2"><i className="h-2 w-3 bg-muted-foreground/50" />Média da semana</span></div>{current.comparativo.filter(c => !c.codigo.startsWith('_')).map(c => <div key={c.codigo} className="space-y-1"><p className="text-xs font-medium">{c.titulo}</p>{[{label:'Reunião vencedora',v:c.nota,color:'bg-primary'},{label:'Média da semana',v:c.media_semana,color:'bg-muted-foreground/50'}].map(b => <div key={b.label} className="flex gap-3 items-center" aria-label={`${c.titulo}: ${b.label} ${b.v ?? 'sem dado'}`}><div className="h-2 flex-1 bg-muted rounded overflow-hidden"><div className={`h-full ${b.color}`} style={{width:`${Math.max(0,Math.min(100,(b.v ?? 0)*10))}%`}} /></div><span className="w-9 text-right text-xs tabular-nums">{b.v ?? '—'}</span></div>)}</div>)}</section>}
        {!!current.pontos_fortes?.length && <section className="space-y-2"><h3 className="text-sm font-semibold">Pontos fortes</h3><ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">{current.pontos_fortes.map((t,i) => <li key={i}>{t}</li>)}</ul></section>}
        {!!current.ressalvas?.length && <section className="border-l-2 border-warning bg-warning/10 p-4 space-y-2"><h3 className="font-semibold text-sm text-warning">O que não copiar desta call</h3><ul className="list-disc pl-5 text-sm space-y-1">{current.ressalvas.map((t,i) => <li key={i}>{t}</li>)}</ul></section>}
        {link && <Button asChild><a href={link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Assistir a reunião</a></Button>}
      </>}
    </section>}
    {weeks.length > 1 && <section className="space-y-3 border-t border-border pt-5"><h3 className="font-semibold text-sm">Semanas anteriores</h3><div className="divide-y divide-border">{weeks.slice(1).map(w => <Button key={w.semana_inicio} variant="ghost" className="h-auto w-full justify-start text-left py-3 whitespace-normal gap-3" onClick={() => setSelected(w.semana_inicio)}><span className="text-xs text-muted-foreground shrink-0">{dateSE(w.semana_inicio)}<br />{dateSE(w.semana_fim)}</span><span className="flex-1 min-w-0 break-words">{w.closer ?? 'Sem reunião'}<span className="block text-xs text-muted-foreground">{w.empresa}</span></span><span className="tabular-nums">{w.nota ?? '—'}</span></Button>)}</div>{selected && <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Voltar à semana atual</Button>}</section>}
    <Dialog open={!!swap} onOpenChange={v => { if (!v && !saving) setSwap(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Trocar reunião da semana</DialogTitle></DialogHeader><div className="space-y-4"><p className="text-xs text-muted-foreground">{dateSE(swap?.semana_inicio)} a {dateSE(swap?.semana_fim)}</p><Label>Reunião<Select value={meeting} onValueChange={setMeeting}><SelectTrigger className="mt-2"><SelectValue placeholder={loadingOptions ? 'Carregando…' : 'Selecione a reunião'} /></SelectTrigger><SelectContent>{options.map(o => <SelectItem key={o.reuniao_id} value={o.reuniao_id}>{o.empresa} · {o.closer} · {dateSE(o.quando_local,true)} · Nota {o.nota ?? '—'}</SelectItem>)}</SelectContent></Select></Label>{optionsError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar as opções.</p>}{!loadingOptions && !optionsError && !options.length && <p className="text-sm text-muted-foreground">Nenhuma reunião encontrada nesta semana.</p>}<div><Label htmlFor="week-summary">Resumo (opcional)</Label><Textarea id="week-summary" value={summary} onChange={e => setSummary(e.target.value)} className="mt-2" /></div><Button disabled={!meeting || saving} onClick={() => void change()}>{saving ? 'Salvando…' : 'Confirmar troca'}</Button></div></DialogContent></Dialog>
  </div>;
}
