import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw } from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeaturedMeetingVideo } from './FeaturedMeetingVideo';
import { featuredChips, featuredDontCopy, featuredExceptionAlerts, featuredMeetingKey, featuredMonth, featuredSwapParams, type FeaturedPeriod } from '@/lib/seFeaturedMeeting';

type Winner = {
  periodo: FeaturedPeriod;
  semana_inicio: string; semana_fim: string; readai_meeting_id: string | null;
  closer: string | null; closer_avatar_url: string | null; empresa: string | null;
  quando_local: string | null; nota: number | null; media_semana: number | null;
  reunioes_na_semana: number | null; resumo: string | null;
  comparativo: { codigo: string; titulo: string; nota: number | null; media_semana: number | null; delta: number | null }[] | null;
  pontos_fortes: string[] | null; ressalvas: string[] | null; readai_url: string | null;
  criterio_escolha?: 'completo' | 'excecao' | 'manual' | null; alertas_escolha?: string[] | null; pontos_melhoria?: string[] | null;
  valor_relatorio?: number | null; preco_tabela?: number | null; selo_tabela?: boolean | null; selo_assinou_na_call?: boolean | null;
};
const chipTone = { ok: 'border-success/40 bg-success/10 text-success', bad: 'border-destructive/40 bg-destructive/10 text-destructive', off: 'border-border text-muted-foreground' };
const periodLabel = (w: Winner, periodo: FeaturedPeriod) => periodo === 'mes' ? featuredMonth(w.semana_inicio) : `${dateSE(w.semana_inicio)} a ${dateSE(w.semana_fim)}`;
const CloserAvatar = ({ w, className = '' }: { w: Winner; className?: string }) => <Avatar className={className}><AvatarImage src={safeLink(w.closer_avatar_url) ?? undefined} alt={w.closer ?? ''} /><AvatarFallback className="text-foreground">{w.closer?.slice(0,2).toUpperCase() ?? '?'}</AvatarFallback></Avatar>;
const List = ({ items }: { items: string[] }) => <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">{items.map((t,i) => <li key={i} className="break-words">{t}</li>)}</ul>;
export function ReuniaoSemanaTab() {
  const { isAdmin } = useAuth(); const qc = useQueryClient(); const { toast } = useToast();
  const [periodo, setPeriodo] = useState<FeaturedPeriod>('mes');
  const [selected, setSelected] = useState<string | null>(null);
  const [swap, setSwap] = useState<Winner | null>(null); const [meeting, setMeeting] = useState('');
  const [summary, setSummary] = useState(''); const [saving, setSaving] = useState(false);
  const { data: weeks = [], isLoading, isError, refetch } = useQuery({
    queryKey:featuredMeetingKey(periodo), staleTime: SE_STALE_TIME,
    queryFn: async () => { const { data, error } = await supabase.from('vw_se_reuniao_semana').select('*').eq('periodo', periodo).order('semana_inicio', { ascending:false }); if (error) throw error; return (data ?? []) as Winner[]; },
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
      const { error } = await supabase.rpc('fn_se_eleger_reuniao_semana', featuredSwapParams(swap.semana_inicio, meeting, summary, periodo));
      if (error) throw error;
      await qc.invalidateQueries({ queryKey:['se-reuniao-semana'] });
      setSwap(null); toast({ title:'Reunião em destaque atualizada' });
    } catch (e) { toast({ title:'Não foi possível trocar a reunião', description:e instanceof Error ? e.message : 'Tente novamente.', variant:'destructive' }); }
    finally { setSaving(false); }
  };
  const current = weeks.find(w => w.semana_inicio === selected) ?? weeks[0];
  const alerts = current ? featuredExceptionAlerts(current.criterio_escolha, current.alertas_escolha) : null;
  const dontCopy = current ? featuredDontCopy(current.ressalvas, current.pontos_melhoria) : [];
  const bars = current?.comparativo?.filter(c => !c.codigo.startsWith('_')) ?? [];
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Tabs value={periodo} onValueChange={value => { if (value === 'mes' || value === 'semana') { setPeriodo(value); setSelected(null); } }}><TabsList aria-label="Período da reunião em destaque"><TabsTrigger value="mes">Do mês</TabsTrigger><TabsTrigger value="semana">Da semana</TabsTrigger></TabsList></Tabs>
      {isAdmin && current && <Button size="sm" variant="outline" onClick={() => { setSwap(current); setMeeting(''); setSummary(''); }}><RefreshCw className="h-3.5 w-3.5 mr-2" />Trocar reunião</Button>}
    </div>
    {isLoading ? <p className="text-sm text-muted-foreground">Carregando reunião em destaque…</p> : isError ? <div role="alert" className="space-y-2"><p className="text-sm text-destructive">Não foi possível carregar a reunião em destaque.</p><Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button></div> : !current ? <p className="text-sm text-muted-foreground">Sem reunião em destaque neste período.</p>
    : !current.readai_meeting_id ? <p className="mx-auto flex min-h-[40vh] max-w-3xl items-center justify-center whitespace-pre-wrap text-center text-2xl font-medium">{current.resumo || 'Sem reunião em destaque neste período.'}</p>
    : <>
      {alerts && <div role="note" className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 space-y-1"><p className="font-medium">Escolhida por ter a maior nota entre as reuniões que fecharam. Não cumpre todos os requisitos:</p>{!!alerts.length && <ul className="list-disc pl-5">{alerts.map((a,i) => <li key={i} className="break-words">{a}</li>)}</ul>}</div>
      </div>}
      <section className="grid gap-6 md:min-h-[70vh] md:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
        <div className="aspect-video md:aspect-auto">
          <FeaturedMeetingVideo key={`${periodo}:${current.semana_inicio}:${current.readai_meeting_id}`} meetingId={current.readai_meeting_id} readaiUrl={current.readai_url} title={current.empresa ?? '—'} cover={<CloserAvatar w={current} className="h-16 w-16" />} />
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-5">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">{periodo === 'mes' ? 'Reunião do mês' : 'Reunião da semana'} — {periodLabel(current, periodo)}</p>
          <h2 className="break-words text-3xl font-semibold leading-tight">{current.empresa ?? '—'}</h2>
          <div className="flex items-center gap-3 min-w-0"><CloserAvatar w={current} /><div className="min-w-0"><p className="font-medium break-words">{current.closer ?? '—'}</p><p className="text-sm text-muted-foreground">{dateSE(current.quando_local, true)}</p></div></div>
          <div><p className="text-7xl font-semibold leading-none tabular-nums text-primary lg:text-8xl">{current.nota ?? '—'}</p><p className="mt-2 text-sm text-muted-foreground">média do período {current.media_semana ?? '—'} · {current.reunioes_na_semana ?? 0} reuniões</p></div>
          <div className="flex flex-wrap gap-2">{featuredChips(current).map(c => <span key={c.label} className={`rounded-full border px-3 py-1 text-xs font-medium ${chipTone[c.tone]}`}>{c.label}</span>)}</div>
        </div>
      </section>
      <section className="grid gap-8 border-t border-border pt-6 md:grid-cols-3">
        <div className="min-w-0 space-y-4"><h3 className="text-base font-semibold">Por que ela se destacou</h3>
          {current.resumo && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{current.resumo}</p>}
          {!!bars.length && <div className="space-y-3"><div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><i className="h-2 w-3 bg-primary" />Reunião</span><span className="flex items-center gap-2"><i className="h-2 w-3 bg-muted-foreground/50" />Média do período</span></div>
            {bars.map(c => <div key={c.codigo} className="space-y-1"><p className="text-xs font-medium">{c.titulo}</p>{[{label:'Reunião',v:c.nota,color:'bg-primary'},{label:'Média do período',v:c.media_semana,color:'bg-muted-foreground/50'}].map(b => <div key={b.label} className="flex gap-3 items-center" aria-label={`${c.titulo}: ${b.label} ${b.v ?? 'sem dado'}`}><div className="h-2 flex-1 bg-muted rounded overflow-hidden"><div className={`h-full ${b.color}`} style={{width:`${Math.max(0,Math.min(100,(b.v ?? 0)*10))}%`}} /></div><span className="w-9 text-right text-xs tabular-nums">{b.v ?? '—'}</span></div>)}</div>)}</div>}
        </div>
        <div className="min-w-0 space-y-4"><h3 className="text-base font-semibold text-success">Faça igual</h3>{current.pontos_fortes?.length ? <List items={current.pontos_fortes} /> : <p className="text-sm text-muted-foreground">—</p>}</div>
        <div className="min-w-0 space-y-4"><h3 className="text-base font-semibold text-destructive">Não copie</h3>{dontCopy.length ? <List items={dontCopy} /> : <p className="text-sm text-muted-foreground">Nenhum ponto de atenção</p>}</div>
      </section>
    </>}
    {weeks.length > 1 && <section className="space-y-3 border-t border-border pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-semibold">Anteriores</h3>{selected && current !== weeks[0] && <Button variant="outline" size="sm" onClick={() => setSelected(null)}>{periodo === 'mes' ? 'Voltar ao mês atual' : 'Voltar à semana atual'}</Button>}</div>
      <div className="flex gap-3 overflow-x-auto pb-2">{weeks.slice(1).map(w => <button key={w.semana_inicio} type="button" aria-pressed={w === current} onClick={() => { setSelected(w.semana_inicio); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`w-52 shrink-0 rounded-lg border p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${w === current ? 'border-primary' : 'border-border'}`}>
        <span className="flex items-start justify-between gap-2"><span className="line-clamp-2 min-w-0 break-words text-sm font-medium">{w.empresa ?? 'Sem reunião'}</span><span className="text-lg font-semibold tabular-nums text-primary">{w.nota ?? '—'}</span></span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{w.closer ?? '—'}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{periodLabel(w, periodo)}</span>
      </button>)}</div>
    </section>}
    <Dialog open={!!swap} onOpenChange={v => { if (!v && !saving) setSwap(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Trocar reunião em destaque</DialogTitle></DialogHeader><div className="space-y-4"><p className="text-xs text-muted-foreground">{dateSE(swap?.semana_inicio)} a {dateSE(swap?.semana_fim)}</p><Label>Reunião<Select value={meeting} onValueChange={setMeeting}><SelectTrigger className="mt-2"><SelectValue placeholder={loadingOptions ? 'Carregando…' : 'Selecione a reunião'} /></SelectTrigger><SelectContent>{options.map(o => <SelectItem key={o.reuniao_id} value={o.reuniao_id}>{o.empresa} · {o.closer} · {dateSE(o.quando_local,true)} · Nota {o.nota ?? '—'}</SelectItem>)}</SelectContent></Select></Label>{optionsError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar as opções.</p>}{!loadingOptions && !optionsError && !options.length && <p className="text-sm text-muted-foreground">Nenhuma reunião encontrada neste período.</p>}<div><Label htmlFor="week-summary">Resumo (opcional)</Label><Textarea id="week-summary" value={summary} onChange={e => setSummary(e.target.value)} className="mt-2" /></div><Button disabled={!meeting || saving} onClick={() => void change()}>{saving ? 'Salvando…' : 'Confirmar troca'}</Button></div></DialogContent></Dialog>
  </div>;
}
