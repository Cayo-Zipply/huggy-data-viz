import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Check, FilePlus, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseExternal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { dateSE, draftTrainingContent, safeLink, trainingErrorMessage, trainingTargetTitle, trainingTargets, type TrainingContent } from '@/lib/seTraining';
import { useTrainingRubric } from '@/hooks/useTrainingRubric';

const blank = { titulo:'', descricao:'', tipo:'video' as TrainingContent['tipo'], url:'', storage_path:'', codigo_alvo:'', duracao_min:'', ordem:'0' };
const statusName: Record<string,string> = { rascunho:'Rascunho', aprovado:'Aprovado', arquivado:'Arquivado' };
type Coverage = { titulo:string; aprovados:number; aguardando_aprovacao:number; closers_com_gap:unknown };
type Progress = { conteudo_id:string; user_id:string; iniciado_em:string|null; concluido_em:string|null };
export function TrainingAdmin() {
  const { isAdmin, user } = useAuth(); const qc = useQueryClient(); const { toast } = useToast();
  const [status, setStatus] = useState('todos'); const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null); const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null); const [source, setSource] = useState<'url'|'arquivo'>('url');
  const [busy, setBusy] = useState(false); const [removing, setRemoving] = useState<TrainingContent | null>(null);
  const { data: contents = [], isLoading, isError } = useQuery({ queryKey:['se-training-library'], enabled:isAdmin,
    queryFn: async () => { const { data,error } = await supabase.from('se_treinamento_conteudos').select('*').order('ordem'); if(error) throw error; return (data ?? []) as TrainingContent[]; } });
  const { data: rubric = [], isError: rubricError } = useTrainingRubric();
  const { data: coverage = [], isError: coverageError } = useQuery({ queryKey:['se-training-coverage'], enabled:isAdmin,
    queryFn: async () => { const {data,error} = await supabase.from('vw_se_treinamento_cobertura').select('*'); if(error) throw error; return (data ?? []) as Coverage[]; } });
  const { data: progress = [], isError: progressError } = useQuery({ queryKey:['se-training-progress'], enabled:isAdmin,
    queryFn: async () => { const {data,error} = await supabase.from('se_treinamento_progresso').select('conteudo_id,user_id,iniciado_em,concluido_em').order('iniciado_em',{ascending:false}); if(error) throw error; return (data ?? []) as Progress[]; } });
  const { data: profiles = [], isError: profilesError } = useQuery({ queryKey:['user_profiles'], enabled:isAdmin, staleTime:30*60_000,
    queryFn: async () => { const {data,error} = await supabase.from('user_profiles').select('*'); if(error) throw error; return (data ?? []) as {user_id:string|null;nome:string}[]; } });
  const refresh = async () => { await Promise.all(['se-training-library','se-training-suggestions','se-training-coverage','se-training-progress'].map(k => qc.invalidateQueries({queryKey:[k]}))); };
  const fail = (e:unknown) => toast({ title:'Não foi possível salvar', description:trainingErrorMessage(e), variant:'destructive' });
  const edit = (c?:TrainingContent) => { setEditing(c?.id ?? null); setFile(null); setSource(c?.storage_path ? 'arquivo' : 'url'); setForm(c ? {titulo:c.titulo,descricao:c.descricao ?? '',tipo:c.tipo,url:c.url ?? '',storage_path:c.storage_path ?? '',codigo_alvo:c.codigo_alvo,duracao_min:c.duracao_min == null ? '' : String(c.duracao_min),ordem:String(c.ordem ?? 0)} : blank); setOpen(true); };
  const save = async (e:React.FormEvent) => {
    e.preventDefault(); if(!isAdmin || !user || busy) return;
    if (!form.titulo.trim() || !form.codigo_alvo || (source==='url' ? !safeLink(form.url) : !file && !form.storage_path)) { fail(new Error('Preencha título, ponto da régua e um link ou arquivo válido.')); return; }
    setBusy(true); let uploaded:string|null = null;
    try {
      let path = source==='arquivo' ? form.storage_path || null : null;
      if(source==='arquivo' && file) {
        const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g,'').toLowerCase() || 'bin';
        path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const {error} = await supabase.storage.from('treinamento').upload(path,file,{upsert:false,contentType:file.type || undefined}); if(error) throw error; uploaded=path;
      }
      const values = { titulo:form.titulo.trim(), descricao:form.descricao.trim() || null, tipo:form.tipo, url:source==='url' ? safeLink(form.url) : null, storage_path:path, codigo_alvo:form.codigo_alvo, duracao_min:form.duracao_min === '' ? null : Number(form.duracao_min), ordem:Number(form.ordem || 0) };
      const query = editing ? supabase.from('se_treinamento_conteudos').update(values).eq('id',editing) : supabase.from('se_treinamento_conteudos').insert(draftTrainingContent(values));
      const {data,error} = await query.select('id'); if(error) throw error; if(!data?.length) throw new Error('A alteração não foi confirmada.');
      setOpen(false); await refresh(); toast({title:editing ? 'Conteúdo atualizado' : 'Conteúdo criado como rascunho'});
    } catch(e) { if(uploaded) await supabase.storage.from('treinamento').remove([uploaded]); fail(e); }
    finally {setBusy(false);}
  };
  const changeStatus = async (c:TrainingContent, next:TrainingContent['status']) => { if(!isAdmin || busy) return; setBusy(true); try { const {data,error}=await supabase.from('se_treinamento_conteudos').update({status:next}).eq('id',c.id).select('id'); if(error) throw error; if(!data?.length) throw new Error('A alteração não foi confirmada.'); await refresh(); toast({title:`Conteúdo: ${statusName[next]}`}); }catch(e){fail(e);}finally{setBusy(false);} };
  const remove = async () => { if(!isAdmin || !removing || busy) return; setBusy(true); try{ const {data,error}=await supabase.from('se_treinamento_conteudos').delete().eq('id',removing.id).select('id'); if(error) throw error; if(!data?.length) throw new Error('A exclusão não foi confirmada.'); setRemoving(null); await refresh(); toast({title:'Conteúdo excluído'}); }catch(e){fail(e);}finally{setBusy(false);} };
  if(!isAdmin) return null;
  const filtered = contents.filter(c => status==='todos' || c.status===status);
  return <div className="space-y-8 border-t border-border pt-6">
    <section className="space-y-4"><header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Biblioteca</h2><Button size="sm" onClick={()=>edit()}><FilePlus className="h-4 w-4 mr-2" />Novo conteúdo</Button></header>
      <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os status</SelectItem>{Object.entries(statusName).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando biblioteca…</p>}{isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar a biblioteca.</p>}
      {!isLoading && !isError && !filtered.length && <p className="text-sm text-muted-foreground">Nenhum conteúdo encontrado.</p>}
      <div className="divide-y divide-border">{filtered.map(c=><div key={c.id} className="flex flex-wrap justify-between gap-3 py-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium break-words">{c.titulo}</h3><Badge variant="outline" className={c.status==='aprovado' ? 'text-success border-success/30' : 'text-muted-foreground'}>{statusName[c.status] ?? c.status}</Badge></div><p className="text-xs text-muted-foreground mt-1">{c.tipo} · {trainingTargetTitle(rubric, c.codigo_alvo)}</p></div><div className="flex flex-wrap gap-1"><Button variant="ghost" size="icon" title="Editar conteúdo" aria-label={`Editar ${c.titulo}`} onClick={()=>edit(c)}><Pencil className="h-4 w-4" /></Button>{c.status!=='aprovado' && <Button size="sm" variant="outline" disabled={busy} onClick={()=>void changeStatus(c,'aprovado')}><Check className="h-3 w-3 mr-1" />Aprovar</Button>}{c.status!=='arquivado' && <Button size="sm" variant="outline" disabled={busy} onClick={()=>void changeStatus(c,'arquivado')}><Archive className="h-3 w-3 mr-1" />Arquivar</Button>}{c.status!=='rascunho' && <Button size="sm" variant="outline" disabled={busy} onClick={()=>void changeStatus(c,'rascunho')}><RotateCcw className="h-3 w-3 mr-1" />Voltar para rascunho</Button>}<Button variant="ghost" size="icon" className="text-destructive" title="Excluir conteúdo" aria-label={`Excluir ${c.titulo}`} disabled={busy} onClick={()=>setRemoving(c)}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>
    </section>
    <section className="space-y-3"><h2 className="text-base font-semibold">O que falta gravar</h2>{coverageError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar a cobertura.</p> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-muted-foreground"><tr>{['Ponto da régua','Aprovados','Aguardando aprovação','Closers com gap'].map(t=><th key={t} className="text-left p-2 whitespace-nowrap">{t}</th>)}</tr></thead><tbody>{coverage.map((c,i)=>{ const hasGap=Array.isArray(c.closers_com_gap) ? c.closers_com_gap.length>0 : typeof c.closers_com_gap==='number' ? c.closers_com_gap>0 : !!c.closers_com_gap; return <tr key={i} className={`border-t border-border ${hasGap && Number(c.aprovados)===0 ? 'bg-warning/10 text-warning' : ''}`}><td className="p-2">{c.titulo}</td><td className="p-2">{c.aprovados}</td><td className="p-2">{c.aguardando_aprovacao}</td><td className="p-2">{Array.isArray(c.closers_com_gap) ? c.closers_com_gap.join(', ') : String(c.closers_com_gap ?? '—')}</td></tr>;})}</tbody></table>{!coverage.length && <p className="p-2 text-sm text-muted-foreground">Nenhum ponto pendente.</p>}</div>}</section>
    <section className="space-y-3"><h2 className="text-base font-semibold">Quem assistiu</h2>{progressError || profilesError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar o acompanhamento.</p> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-muted-foreground"><tr>{['Nome','Conteúdo','Iniciado em','Concluído em'].map(t=><th key={t} className="p-2 text-left whitespace-nowrap">{t}</th>)}</tr></thead><tbody>{progress.map(p=><tr key={`${p.user_id}-${p.conteudo_id}`} className="border-t border-border"><td className="p-2">{profiles.find(u=>u.user_id===p.user_id)?.nome ?? 'Usuário indisponível'}</td><td className="p-2">{contents.find(c=>c.id===p.conteudo_id)?.titulo ?? 'Conteúdo indisponível'}</td><td className="p-2 whitespace-nowrap">{dateSE(p.iniciado_em,true)}</td><td className="p-2 whitespace-nowrap">{dateSE(p.concluido_em,true)}</td></tr>)}</tbody></table>{!progress.length && <p className="p-2 text-sm text-muted-foreground">Nenhuma visualização registrada.</p>}</div>}</section>
    <Dialog open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? 'Editar conteúdo' : 'Novo conteúdo'}</DialogTitle></DialogHeader><form onSubmit={e=>void save(e)} className="space-y-4">
      <div><Label htmlFor="training-title">Título</Label><Input id="training-title" required value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})} /></div><div><Label htmlFor="training-description">Descrição</Label><Textarea id="training-description" value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} /></div>
      <div><Label>Tipo</Label><Select value={form.tipo} onValueChange={(tipo:TrainingContent['tipo'])=>{setForm({...form,tipo});if(tipo==='link')setSource('url');}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="video">Vídeo</SelectItem><SelectItem value="arquivo">Arquivo</SelectItem><SelectItem value="link">Link</SelectItem></SelectContent></Select></div>
      {form.tipo!=='link' && <div><Label>Origem</Label><Select value={source} onValueChange={(s:'url'|'arquivo')=>setSource(s)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="url">Link</SelectItem><SelectItem value="arquivo">Arquivo privado</SelectItem></SelectContent></Select></div>}
      {source==='url' ? <div><Label htmlFor="training-url">URL</Label><Input id="training-url" type="url" required value={form.url} onChange={e=>setForm({...form,url:e.target.value})} /></div> : <div><Label htmlFor="training-file">Arquivo</Label><Input id="training-file" type="file" accept={form.tipo==='video' ? 'video/*' : undefined} onChange={e=>setFile(e.target.files?.[0] ?? null)} />{form.storage_path && !file && <p className="mt-1 text-xs text-muted-foreground">Arquivo atual mantido</p>}</div>}
      <div><Label>Ponto da régua</Label><Select value={form.codigo_alvo} onValueChange={codigo_alvo=>setForm({...form,codigo_alvo})}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{(['criterio','guardrail'] as const).map(tipo=><SelectGroup key={tipo}><SelectLabel>{tipo==='criterio' ? 'Critérios' : 'Guardrails'}</SelectLabel>{trainingTargets(rubric, tipo).map(r=><SelectItem key={r.codigo} value={r.codigo ?? ''}>{r.titulo ?? r.codigo}</SelectItem>)}</SelectGroup>)}</SelectContent></Select>{rubricError && <p role="alert" className="text-xs text-destructive">Não foi possível carregar a régua.</p>}</div>
      <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="training-duration">Duração (min)</Label><Input id="training-duration" type="number" min="0" step="1" value={form.duracao_min} onChange={e=>setForm({...form,duracao_min:e.target.value})} /></div><div><Label htmlFor="training-order">Ordem</Label><Input id="training-order" type="number" min="0" step="1" value={form.ordem} onChange={e=>setForm({...form,ordem:e.target.value})} /></div></div>
      <Button type="submit" disabled={busy}>{busy ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar rascunho'}</Button>
    </form></DialogContent></Dialog>
    <AlertDialog open={!!removing} onOpenChange={v=>{if(!v && !busy)setRemoving(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir conteúdo?</AlertDialogTitle><AlertDialogDescription>Excluir “{removing?.titulo}” da biblioteca?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e=>{e.preventDefault();void remove();}}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
