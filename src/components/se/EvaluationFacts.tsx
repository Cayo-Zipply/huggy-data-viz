import { useState } from 'react';
import { Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { objetoSE, valorDivergente, type SeloSE } from '@/lib/seEvaluation';

export const moedaSE = (v: number | null | undefined) => v == null ? 'sem dado' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const estado = (v: boolean | null | undefined) => v == null ? 'bg-muted text-muted-foreground border-border' : v ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30';

export function SelosReuniao({ selo }: { selo?: SeloSE }) {
  const assinatura = selo?.signed_at ? new Date(selo.signed_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : undefined;
  const chips = [
    { label: `Tabela${selo?.selo_tabela == null ? ': sem dado' : ''}`, valor: selo?.selo_tabela, dica: selo?.selo_tabela === false ? `Praticado ${moedaSE(selo.valor_relatorio)} / Tabela ${moedaSE(selo.preco_tabela)}` : undefined },
    { label: 'Assinou na call', valor: selo?.selo_assinou_na_call ? true : null, dica: assinatura },
    { label: `Pago${selo?.selo_pago == null ? ': em breve' : ''}`, valor: selo?.selo_pago },
  ];
  return <div className="flex flex-wrap gap-1 font-normal">{chips.map(c => {
    const chip = <Badge variant="outline" className={cn('text-[10px] whitespace-nowrap', estado(c.valor))}>{c.label}</Badge>;
    return c.dica ? <Tooltip key={c.label}><TooltipTrigger asChild><span tabIndex={0} onClick={e => e.stopPropagation()}>{chip}</span></TooltipTrigger><TooltipContent>{c.dica}</TooltipContent></Tooltip> : <span key={c.label}>{chip}</span>;
  })}</div>;
}

export function GuardrailChip({ label, evidencia }: { label: string; evidencia?: string }) {
  const [open, setOpen] = useState(false);
  const classe = 'h-auto px-1.5 py-0.5 text-[10px] font-normal whitespace-normal text-left border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20';
  if (!evidencia) return <Badge variant="outline" className={classe}>{label}</Badge>;
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="outline" className={classe} onClick={e => { e.stopPropagation(); setOpen(true); }} onMouseEnter={() => setOpen(true)}>{label}</Button></PopoverTrigger><PopoverContent onClick={e => e.stopPropagation()} onMouseLeave={() => setOpen(false)} className="max-w-[calc(100vw-2rem)] text-xs whitespace-pre-wrap">{evidencia}</PopoverContent></Popover>;
}

export function AjusteCriterio({ ajuste }: { ajuste: unknown }) {
  const a = objetoSE(ajuste);
  if (!Object.keys(a).length) return null;
  return <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" aria-label="Ajuste do critério"><Info className="h-3 w-3" /></Button></TooltipTrigger><TooltipContent>{String(a.motivo ?? '')} (modelo deu {String(a.modelo ?? '—')}, final {String(a.final ?? '—')})</TooltipContent></Tooltip>;
}

export function FatosCall({ fatos, selo }: { fatos: unknown; selo?: SeloSE }) {
  const f = objetoSE(fatos);
  if (!Object.keys(f).length) return null;
  const simNao = (v: unknown) => v === true ? 'sim' : v === false ? 'não' : 'sem dado';
  return <section className="space-y-2"><h4 className="text-sm font-semibold text-foreground">Fatos da call</h4><dl className="grid gap-2 text-xs sm:grid-cols-2 text-muted-foreground">{[
    ['Preço dito na call', f.preco_dito_na_call == null ? 'não foi dito' : moedaSE(Number(f.preco_dito_na_call))],
    ['Cliente pediu desconto', simNao(f.cliente_pediu_desconto)],
    ['Assinou durante a reunião (ZapSign)', simNao(f.assinou_na_call_farol)],
    ['Decisor confirmado', simNao(f.decisor_confirmado)],
  ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="text-foreground">{value}</dd></div>)}</dl>{valorDivergente(f.preco_dito_na_call, selo?.valor_relatorio) && <p className="text-xs text-muted-foreground">valor no Farol difere do dito na call</p>}</section>;
}
