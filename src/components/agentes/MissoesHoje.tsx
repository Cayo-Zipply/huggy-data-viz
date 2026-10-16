import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabaseExternal";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./AgentAvatar";
import { hojeEmSaoPaulo, useAgentes, useBriefingsHoje, type Agente, type Briefing } from "./AgentesContext";

const PRIO = [
  { key: "alta", label: "Alta", cls: "border-destructive/60 bg-destructive/10", dot: "bg-destructive" },
  { key: "media", label: "Média", cls: "border-amber-500/60 bg-amber-500/10", dot: "bg-amber-500" },
  { key: "baixa", label: "Baixa", cls: "border-border bg-muted/40", dot: "bg-muted-foreground" },
] as const;

export function useBriefingPanel() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState<{ agente: Agente; briefing: Briefing } | null>(null);
  const abrir = (agente: Agente, briefing: Briefing) => {
    setAberto({ agente, briefing });
    if (!briefing.lido_em) {
      void (supabase as any).from("agente_briefings").update({ lido_em: new Date().toISOString() }).eq("id", briefing.id)
        .then(() => qc.invalidateQueries({ queryKey: ["agente-briefings", hojeEmSaoPaulo()] }));
    }
  };
  return { aberto, abrir, fechar: () => setAberto(null) };
}

export function BriefingSheet({ agente, briefing, onClose }: { agente: Agente; briefing: Briefing; onClose: () => void }) {
  const navigate = useNavigate();
  const itens = briefing.itens ?? [];
  const abrirLead = (id: string) => {
    onClose();
    navigate("/pipeline");
    setTimeout(() => window.dispatchEvent(new CustomEvent("open-lead-card", { detail: { leadId: id } })), 150);
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <AgentAvatar agente={agente} className="h-10 w-10 rounded-full" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Missão de hoje · {agente.nome}</p>
            <SheetTitle className="font-hud uppercase tracking-wide">{briefing.titulo}</SheetTitle>
          </div>
        </div>
        {briefing.resumo && <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-5">{briefing.resumo}</p>}
        {PRIO.map((p) => {
          const lista = itens.filter((i) => i.prioridade === p.key);
          if (!lista.length) return null;
          return (
            <div key={p.key} className="mb-5">
              <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-2">
                <span className={cn("h-2 w-2 rounded-full", p.dot)} />Prioridade {p.label}
              </p>
              <div className="space-y-2">
                {lista.map((it, i) => (
                  <div
                    key={i}
                    role={it.lead_id ? "button" : undefined}
                    onClick={it.lead_id ? () => abrirLead(it.lead_id!) : undefined}
                    className={cn("rounded-md border-l-2 border px-3 py-2", p.cls, it.lead_id && "cursor-pointer hover:brightness-110")}
                  >
                    <p className="text-sm">{it.texto}</p>
                    {it.tratativa && (
                      <div className="mt-2">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Tratativa sugerida</p>
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap">{it.tratativa}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </SheetContent>
    </Sheet>
  );
}

/** Card do Echo na área de Marketing (só aparece se o agente vier da consulta — RLS admin). */
export function SinalCampanhasHoje() {
  const { data: agentes = [] } = useAgentes();
  const { data: briefings = [] } = useBriefingsHoje();
  const echo = agentes.find((a) => a.id === "marketing");
  if (!echo) return null;
  const b = briefings.find((x) => x.agente_id === "marketing");
  const itens = b?.itens ?? [];
  return (
    <div className="mb-4 rounded-lg border border-border bg-card/50 p-4" style={{ borderLeft: "3px solid #F59E0B" }}>
      <div className="flex items-center gap-3 mb-2">
        <AgentAvatar agente={echo} className="h-8 w-8 rounded-full" imgClassName="object-[center_25%]" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Echo · Sinal das campanhas hoje</p>
          <p className="text-sm font-semibold">{b ? b.titulo : "Sem briefing hoje"}</p>
        </div>
      </div>
      {b?.resumo && <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-3">{b.resumo}</p>}
      {!!itens.length && (
        <div className="space-y-2">
          {PRIO.flatMap((p) => itens.filter((i) => i.prioridade === p.key).map((it, i) => (
            <div key={`${p.key}-${i}`} className={cn("rounded-md border-l-2 border px-3 py-2", p.cls)}>
              <p className="flex items-start gap-2 text-sm"><span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", p.dot)} />{it.texto}</p>
              {it.tratativa && <p className="mt-1 pl-4 text-xs text-foreground/80 whitespace-pre-wrap">{it.tratativa}</p>}
            </div>
          )))}
        </div>
      )}
    </div>
  );
}

export function MissoesHoje() {
  const { data: agentes = [] } = useAgentes();
  const { data: briefings = [] } = useBriefingsHoje();
  const { aberto, abrir, fechar } = useBriefingPanel();
  if (!agentes.length) return null;
  return (
    <div className="mx-4 md:mx-6 mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2">
      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mr-1">Missões de hoje</span>
      {agentes.map((a) => {
        const b = briefings.find((x) => x.agente_id === a.id);
        return (
          <button
            key={a.id}
            disabled={!b}
            onClick={() => b && abrir(a, b)}
            className="relative flex items-center gap-2 rounded-full border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60 disabled:cursor-default"
          >
            <AgentAvatar agente={a} className="h-6 w-6 rounded-full" />
            <span className="truncate max-w-[220px]">{b ? b.titulo : `${a.nome}: Sem missão hoje`}</span>
            {b && !b.lido_em && <span className="h-2 w-2 rounded-full bg-destructive" />}
          </button>
        );
      })}
      {aberto && <BriefingSheet agente={aberto.agente} briefing={aberto.briefing} onClose={fechar} />}
    </div>
  );
}
