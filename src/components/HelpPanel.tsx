import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { STAGE_CONFIG, STAGE_ORDER, SDR_STAGES, CLOSER_STAGES, CLOSERS, DEFAULT_DEAL_VALUE, STALE_DAYS, AUTO_TASKS, HANDOFF_ITEMS, LOSS_CATEGORIES, formatBRL } from "@/components/pipeline/types";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowRight, CheckCircle, Clock, FileText, GripVertical, Target, Upload, Users } from "lucide-react";

export function HelpPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Central de Ajuda</h2>
        <p className="text-sm text-muted-foreground">Documentação completa das regras de negócio e funcionalidades do Pipeline.</p>
      </div>

      <Accordion type="multiple" defaultValue={["pipeline", "stages", "features"]} className="space-y-2">
        {/* Pipeline Structure */}
        <AccordionItem value="pipeline" className="border border-border rounded-lg bg-card px-4">
          <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline">
            <span className="flex items-center gap-2"><ArrowRight size={16} className="text-primary" /> Estrutura do Pipeline</span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-4 pb-4">
            <p>O pipeline é dividido em <strong className="text-foreground">dois pipes</strong>:</p>

            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="border-blue-400/50 text-blue-400">SDR</Badge>
                  Pré-vendas
                </h4>
                <div className="space-y-1.5 pl-4">
                  {SDR_STAGES.map(s => {
                    const cfg = STAGE_CONFIG[s];
                    const Icon = cfg.icon;
                    return (
                      <div key={s} className="flex items-start gap-2">
                        <Icon size={14} className={cfg.color + " mt-0.5 shrink-0"} />
                        <div>
                          <span className="font-medium text-foreground">{cfg.label}</span>
                          <span className="text-muted-foreground"> — {cfg.exitCriteria}</span>
                          <Badge variant="secondary" className="ml-2 text-[10px]">{(cfg.probability * 100)}%</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="border-emerald-400/50 text-emerald-400">Closer</Badge>
                  Vendas
                </h4>
                <div className="space-y-1.5 pl-4">
                  {CLOSER_STAGES.map(s => {
                    const cfg = STAGE_CONFIG[s];
                    const Icon = cfg.icon;
                    return (
                      <div key={s} className="flex items-start gap-2">
                        <Icon size={14} className={cfg.color + " mt-0.5 shrink-0"} />
                        <div>
                          <span className="font-medium text-foreground">{cfg.label}</span>
                          <span className="text-muted-foreground"> — {cfg.exitCriteria}</span>
                          <Badge variant="secondary" className="ml-2 text-[10px]">{(cfg.probability * 100)}%</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-xs">
              <strong className="text-foreground">Espelhamento:</strong> Leads em "Reunião Marcada" (SDR) aparecem automaticamente em "Reunião Agendada" (Closer).
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Features */}
        <AccordionItem value="features" className="border border-border rounded-lg bg-card px-4">
          <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline">
            <span className="flex items-center gap-2"><CheckCircle size={16} className="text-primary" /> Funcionalidades</span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-4 pb-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FeatureBlock icon={GripVertical} title="Drag & Drop" desc="Arraste cards entre etapas. O histórico e tarefas automáticas são gerados na movimentação." />
              <FeatureBlock icon={Users} title="Closers" desc={`Usuários: ${CLOSERS.join(", ")}. Filtro por closer e visão individual ou geral.`} />
              <FeatureBlock icon={Target} title="Metas Mensais" desc="Cada closer tem metas de reuniões marcadas, realizadas, faturamento e conversão com projeção em tempo real." />
              <FeatureBlock icon={Clock} title="Cards Parados" desc={`Cards sem movimentação há mais de ${STALE_DAYS} dias são sinalizados com indicador visual.`} />
              <FeatureBlock icon={FileText} title="Campos do Card" desc="Nome, telefone, email, CNPJ, valor da dívida, origem, anotações e anexo de contrato (PDF)." />
              <FeatureBlock icon={Upload} title="Sync com Planilha" desc="Webhook do Google Sheets sincroniza leads automaticamente. Status da planilha mapeado para etapas do pipe." />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Values */}
        <AccordionItem value="values" className="border border-border rounded-lg bg-card px-4">
          <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline">
            <span className="flex items-center gap-2"><Target size={16} className="text-primary" /> Valores e Cálculos</span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3 pb-4">
            <p><strong className="text-foreground">Valor padrão por deal:</strong> {formatBRL(DEFAULT_DEAL_VALUE)}</p>
            <p><strong className="text-foreground">Valor bruto:</strong> Soma dos deal_value de todos os cards na etapa.</p>
            <p><strong className="text-foreground">Valor ponderado:</strong> Valor bruto × probabilidade da etapa (ex: SQL 15% → R$ 1.621 × 0.15 = {formatBRL(DEFAULT_DEAL_VALUE * 0.15)}).</p>
            <p><strong className="text-foreground">Projeção de faturamento:</strong> (contratos fechados ÷ dias úteis passados) × dias úteis totais do mês.</p>
          </AccordionContent>
        </AccordionItem>

        {/* Auto Tasks */}
        <AccordionItem value="tasks" className="border border-border rounded-lg bg-card px-4">
          <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline">
            <span className="flex items-center gap-2"><Clock size={16} className="text-primary" /> Tarefas Automáticas</span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2 pb-4">
            <p>Ao mover um card para uma nova etapa, tarefas são criadas automaticamente:</p>
            <div className="space-y-2 mt-2">
              {STAGE_ORDER.filter(s => AUTO_TASKS[s].length > 0).map(s => (
                <div key={s} className="bg-muted/50 rounded-lg p-2.5">
                  <span className="font-medium text-foreground text-xs">{STAGE_CONFIG[s].label}:</span>
                  <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
                    {AUTO_TASKS[s].map((t, i) => (
                      <li key={i}>{t.title("Lead")} <span className="text-muted-foreground/70">(+{t.daysOffset} dia{t.daysOffset !== 1 ? "s" : ""})</span></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Handoff */}
        <AccordionItem value="handoff" className="border border-border rounded-lg bg-card px-4">
          <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline">
            <span className="flex items-center gap-2"><ArrowRight size={16} className="text-primary" /> Handoff SDR → Closer</span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2 pb-4">
            <p>Ao mover um lead de "Reunião Marcada" para o pipe Closer, um checklist obrigatório é exibido:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              {HANDOFF_ITEMS.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <p className="text-xs mt-2 text-muted-foreground/70">Todos os itens devem ser marcados para confirmar o handoff.</p>
          </AccordionContent>
        </AccordionItem>

        {/* Loss Reasons */}
        <AccordionItem value="loss" className="border border-border rounded-lg bg-card px-4">
          <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline">
            <span className="flex items-center gap-2"><AlertCircle size={16} className="text-primary" /> Motivos de Perda</span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2 pb-4">
            <p>Ao marcar um lead como "Perdido", é necessário selecionar uma categoria:</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {LOSS_CATEGORIES.map(c => (
                <Badge key={c.key} variant="secondary" className="text-xs">{c.label}</Badge>
              ))}
            </div>
            <p className="text-xs mt-2 text-muted-foreground/70">Além da categoria, um campo de texto livre permite detalhar o motivo.</p>
          </AccordionContent>
        </AccordionItem>

        {/* Sheets Sync */}
        <AccordionItem value="sheets" className="border border-border rounded-lg bg-card px-4">
          <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline">
            <span className="flex items-center gap-2"><Upload size={16} className="text-primary" /> Sincronização com Planilha</span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3 pb-4">
            <p>A planilha do Google Sheets envia dados via webhook para o backend. O mapeamento de status é:</p>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-xs font-mono">
              <div>"Fez contato" → <span className="text-blue-400">Conectado</span></div>
              <div>"Conectado" → <span className="text-blue-400">Conectado</span></div>
              <div>"SQL" → <span className="text-purple-400">SQL</span></div>
              <div>"Reunião Marcada" → <span className="text-emerald-400">Reunião Marcada</span></div>
              <div>"Contestado" → <span className="text-blue-400">Conectado</span></div>
            </div>
            <p className="text-xs text-muted-foreground/70">Leads existentes são atualizados pelo sheet_row_id. Novos leads são criados automaticamente.</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function FeatureBlock({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 flex gap-2.5">
      <Icon size={16} className="text-primary shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-foreground text-xs">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
