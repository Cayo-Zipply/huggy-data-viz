import brasao from "@/assets/farol-brasao.png.asset.json";
import { useState } from "react";
import {
  BarChart3, TrendingUp, Target, XOctagon, Mic, Radar, FileSignature, CalendarX, CalendarDays, FileSearch, Search, Zap,
} from "lucide-react";
import { AgentAvatar } from "@/components/agentes/AgentAvatar";
import { agentColor, ferramentaLabel, HABILIDADES, useAgentChat, useAgentes, useBriefingsHoje } from "@/components/agentes/AgentesContext";

const TITULO: Record<string, string> = { marketing: "Inteligência de sinais · Marketing" };
const DESCRICAO: Record<string, string> = {
  marketing: "Vigia o sinal das campanhas: saúde da CAPI, eventos de conversão, fadiga de criativo e o ritmo do mês. Avisa antes de o faturamento sentir.",
};
import { BriefingSheet, useBriefingPanel } from "@/components/agentes/MissoesHoje";

const ICONS: Record<string, any> = {
  metricas_periodo: BarChart3, metricas_mensal: TrendingUp, meta_vs_realizado: Target, motivos_perda: XOctagon,
  qualidade_closers: Mic, negocios_parados: Radar, links_sem_assinatura: FileSignature, no_shows_pendentes: CalendarX,
  agenda: CalendarDays, contexto_lead: FileSearch, buscar_lead: Search,
};

const CHAMFER = "polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px))";

export default function Esquadrao() {
  const { data: agentes = [], isLoading } = useAgentes();
  const { data: briefings = [] } = useBriefingsHoje();
  const { openChat } = useAgentChat();
  const { aberto, abrir, fechar } = useBriefingPanel();

  return (
    <div className="hud-bg min-h-screen px-4 py-8 md:px-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-5">
          <img src={brasao.url} alt="Brasão O Farol" className="w-24 h-24 object-contain shrink-0" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Black Ops · Seleção de agente</p>
            <h1 className="font-hud text-4xl md:text-5xl uppercase tracking-wider text-foreground mt-1">Esquadrão</h1>
            <p className="text-sm text-muted-foreground mt-1">Unidade O Farol · Pena Quadros</p>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-border via-border/40 to-transparent my-6" />

        {isLoading && <p className="text-sm text-muted-foreground">Carregando agentes…</p>}
        {!isLoading && agentes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum agente ativo.</p>}

        <div className={`grid gap-6 grid-cols-1 md:grid-cols-2 ${agentes.length >= 3 ? "xl:grid-cols-3" : ""}`}>
          {agentes.map((a) => (
            <AgentCard key={a.id} a={a} b={briefings.find((x) => x.agente_id === a.id)} compacto={agentes.length >= 3} onAbrir={abrir} onChat={openChat} />
          ))}
        </div>
      </div>
      {aberto && <BriefingSheet agente={aberto.agente} briefing={aberto.briefing} onClose={fechar} />}
    </div>
  );
}

function AgentCard({ a, b, compacto, onAbrir, onChat }: { a: any; b: any; compacto: boolean; onAbrir: (a: any, b: any) => void; onChat: (id: string) => void }) {
  const cor = agentColor(a);
  const [todas, setTodas] = useState(false);
  const [missaoAberta, setMissaoAberta] = useState(false);
  const habs: { label: string; Icon: any }[] = HABILIDADES[a.id]
    ? HABILIDADES[a.id].map((h) => ({ label: h, Icon: Zap }))
    : (a.ferramentas ?? []).map((f: string) => ({ label: ferramentaLabel(f), Icon: ICONS[f] ?? Zap }));
  const visiveis = compacto && !todas ? habs.slice(0, 6) : habs;
  const resto = habs.length - visiveis.length;
  const missao = b ? (b.resumo || b.titulo) : "Sem missão hoje";
  const abrir = onAbrir;
  const openChat = onChat;
            return (
              <div
                className="group relative p-px transition-shadow duration-300"
                style={{ clipPath: CHAMFER, background: `linear-gradient(160deg, ${cor}88, hsl(var(--border)) 40%, hsl(var(--border)))` }}
              >
                <div className="relative bg-[hsl(240_6%_4%)] h-full flex flex-col" style={{ clipPath: CHAMFER }}>
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ boxShadow: `inset 0 0 0 1px ${cor}, inset 0 0 40px ${cor}33` }} />
                  <div className={compacto ? "relative h-[260px] w-full overflow-hidden" : "relative aspect-[3/4] max-h-[460px] w-full overflow-hidden"}>
                    <AgentAvatar agente={a} className="h-full w-full" imgClassName={`transition-transform duration-500 group-hover:scale-105 ${compacto ? "object-cover object-[center_20%]" : "object-[center_25%]"}`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[hsl(240_6%_4%)] via-[hsl(240_6%_4%/0.4)] to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <h2 className={`font-hud ${compacto ? "text-[56px]" : "text-6xl md:text-7xl"} font-bold uppercase leading-none text-foreground drop-shadow-lg`}>{a.nome}</h2>
                      {(TITULO[a.id] ?? a.titulo) && <p className="mt-2 text-xs uppercase tracking-[0.35em]" style={{ color: cor }}>{TITULO[a.id] ?? a.titulo}</p>}
                    </div>
                  </div>

                  <div className="p-5 pt-3 flex-1 flex flex-col gap-4">
                    {DESCRICAO[a.id] && <p className="text-sm text-foreground/85">{DESCRICAO[a.id]}</p>}
                    {a.saudacao && <p className="text-sm italic text-muted-foreground">“{a.saudacao}”</p>}

                    {habs.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Habilidades</p>
                        <ul className={`grid grid-cols-1 ${compacto || HABILIDADES[a.id] ? "" : "sm:grid-cols-2"} gap-x-4 gap-y-1.5`}>
                          {visiveis.map(({ label, Icon }) => (
                            <li key={label} className="flex items-start gap-2 text-xs text-foreground/85">
                              <Icon className="h-3.5 w-3.5 shrink-0 mt-px" style={{ color: cor }} strokeWidth={1.5} />{label}
                            </li>
                          ))}
                        </ul>
                        {resto > 0 && <button onClick={() => setTodas(true)} className="mt-1.5 text-xs" style={{ color: cor }}>+{resto}</button>}
                      </div>
                    )}

                    <button
                      onClick={() => b && abrir(a, b)}
                      disabled={!b}
                      className="text-left border-l-2 pl-3 py-1 disabled:cursor-default"
                      style={{ borderColor: cor }}
                    >
                      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                        Missão de hoje {b && !b.lido_em && <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}
                      </p>
                      <p className={`text-sm text-foreground/90 mt-0.5 ${compacto ? (missaoAberta ? "" : "line-clamp-3") : "line-clamp-2"}`}>{missao}</p>
                    </button>
                    {compacto && b && missao.length > 120 && (
                      <button onClick={() => setMissaoAberta((v) => !v)} className="-mt-3 text-left text-xs pl-3" style={{ color: cor }}>{missaoAberta ? "ver menos" : "ver mais"}</button>
                    )}

                    <button
                      onClick={() => openChat(a.id)}
                      className="mt-auto font-hud uppercase tracking-[0.2em] text-sm py-3 text-foreground transition-[filter] hover:brightness-110"
                      style={{ backgroundColor: cor, clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                    >
                      Falar com {a.nome}
                    </button>
                  </div>
                </div>
              </div>
            );
}
