import { useState } from "react";
import { MonthSalesData } from "@/data/salesData";
import { formatCurrency } from "@/data/marketingData";
import { MessageSquare, Users, FileCheck, DollarSign, Target, TrendingUp, TrendingDown, Percent, Wallet } from "lucide-react";
import { MetricTooltip } from "./MetricTooltip";

interface SalesFunnelProps {
  data: MonthSalesData;
  investimento: number;
}

const MetaIndicator = ({ realizado, meta }: { realizado: number; meta: number; isCurrency?: boolean }) => {
  if (meta === 0) return null;
  
  const atingido = realizado >= meta;
  const percentual = ((realizado / meta) * 100).toFixed(1);
  
  return (
    <div className={`flex items-center gap-1 text-xs ${atingido ? 'text-green-400' : 'text-red-400'}`}>
      {atingido ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      <span>{percentual}% da meta</span>
    </div>
  );
};

export const SalesFunnel = ({ data, investimento }: SalesFunnelProps) => {
  const { funnel, individuais } = data;
  const [comissoes, setComissoes] = useState<Record<string, number>>({});
  
  const reunioesTotal = funnel.reunioes.realizado;
  const custoPorReuniao = reunioesTotal > 0 ? investimento / reunioesTotal : 0;
  const conversaoReunioes = reunioesTotal > 0 
    ? ((funnel.contratos.realizado / reunioesTotal) * 100).toFixed(1) 
    : "N/A";
  const conversaoMsgVenda = funnel.mensagens > 0
    ? ((funnel.contratos.realizado / funnel.mensagens) * 100).toFixed(2)
    : "N/A";
  const conversaoMsgReuniao = funnel.mensagens > 0 && reunioesTotal > 0
    ? ((reunioesTotal / funnel.mensagens) * 100).toFixed(1)
    : "N/A";

  const handleComissaoChange = (nome: string, value: string) => {
    const num = parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.'));
    setComissoes(prev => ({ ...prev, [nome]: isNaN(num) ? 0 : num }));
  };

  return (
    <div className="bg-card rounded-xl p-3 sm:p-6 border border-border animate-fade-in">
      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4 sm:mb-6 flex items-center gap-2">
        <Target className="text-primary" size={20} />
        Funil Comercial
      </h3>

      {/* Funil de Vendas */}
      <div className="space-y-4 mb-6">
        <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/10 rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="text-blue-400" size={20} />
              <div>
                <p className="text-xs text-muted-foreground">Topo do Funil</p>
                <p className="text-sm font-medium text-foreground">Mensagens</p>
              </div>
            </div>
            <span className="text-2xl font-bold text-blue-400">{funnel.mensagens}</span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500/20 to-purple-600/10 rounded-lg p-4 border border-purple-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="text-purple-400" size={20} />
              <div>
                <p className="text-xs text-muted-foreground">Meio do Funil</p>
                <p className="text-sm font-medium text-foreground">Reuniões Realizadas</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-purple-400">{funnel.reunioes.realizado}</span>
              {funnel.reunioes.meta > 0 && (
                <p className="text-xs text-muted-foreground">Meta: {funnel.reunioes.meta}</p>
              )}
              <MetaIndicator realizado={funnel.reunioes.realizado} meta={funnel.reunioes.meta} />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500/20 to-green-600/10 rounded-lg p-4 border border-green-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileCheck className="text-green-400" size={20} />
              <div>
                <p className="text-xs text-muted-foreground">Fundo do Funil</p>
                <p className="text-sm font-medium text-foreground">Contratos Fechados</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-green-400">{funnel.contratos.realizado}</span>
              {funnel.contratos.meta > 0 && (
                <p className="text-xs text-muted-foreground">Meta: {funnel.contratos.meta}</p>
              )}
              <MetaIndicator realizado={funnel.contratos.realizado} meta={funnel.contratos.meta} />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 rounded-lg p-4 border border-yellow-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="text-yellow-400" size={20} />
              <div>
                <p className="text-xs text-muted-foreground">Resultado</p>
                <p className="text-sm font-medium text-foreground">Faturamento</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold text-yellow-400">{formatCurrency(funnel.faturamento.realizado)}</span>
              {funnel.faturamento.meta > 0 && (
                <p className="text-xs text-muted-foreground">Meta: {formatCurrency(funnel.faturamento.meta)}</p>
              )}
              <MetaIndicator realizado={funnel.faturamento.realizado} meta={funnel.faturamento.meta} isCurrency />
            </div>
          </div>
        </div>

        {/* Conversões gerais */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {reunioesTotal > 0 && (
            <div className="bg-gradient-to-r from-cyan-500/20 to-cyan-600/10 rounded-lg p-4 border border-cyan-500/30">
              <p className="text-xs text-muted-foreground mb-1">
                Reuniões → Contratos
                <MetricTooltip text="Percentual de reuniões que se converteram em contratos fechados." />
              </p>
              <span className="text-xl font-bold text-cyan-400">{conversaoReunioes}%</span>
            </div>
          )}
          {conversaoMsgVenda !== "N/A" && (
            <div className="bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 rounded-lg p-4 border border-emerald-500/30">
              <p className="text-xs text-muted-foreground mb-1">
                Conversa → Venda
                <MetricTooltip text="Percentual de mensagens que se converteram em vendas/contratos." />
              </p>
              <span className="text-xl font-bold text-emerald-400">{conversaoMsgVenda}%</span>
            </div>
          )}
          {conversaoMsgReuniao !== "N/A" && (
            <div className="bg-gradient-to-r from-violet-500/20 to-violet-600/10 rounded-lg p-4 border border-violet-500/30">
              <p className="text-xs text-muted-foreground mb-1">
                Conversa → Reunião
                <MetricTooltip text="Percentual de mensagens que se converteram em reuniões agendadas." />
              </p>
              <span className="text-xl font-bold text-violet-400">{conversaoMsgReuniao}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Conversões Individuais */}
      {individuais.length > 0 && (
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-foreground mb-4">Conversões Individuais</h4>
          <div className="space-y-3">
            {individuais.map((pessoa, index) => {
              const atingiuMeta = pessoa.faturamento >= pessoa.meta;
              const percentualMeta = pessoa.meta > 0 ? ((pessoa.faturamento / pessoa.meta) * 100).toFixed(1) : "N/A";
              const conversaoIndividual = pessoa.reunioes > 0 
                ? ((pessoa.contratos / pessoa.reunioes) * 100).toFixed(1) 
                : "0";
              const custoInvestido = custoPorReuniao * pessoa.reunioes;
              const comissao = comissoes[pessoa.nome] || pessoa.comissao || 0;
              const custoReal = custoInvestido + comissao;
              const roiIndividual = custoInvestido > 0 
                ? ((pessoa.faturamento / custoInvestido) * 100).toFixed(0)
                : "0";
              const roiComComissao = custoReal > 0
                ? ((pessoa.faturamento / custoReal) * 100).toFixed(0)
                : "0";
              
              return (
                <div 
                  key={pessoa.nome} 
                  className="bg-muted/30 rounded-lg p-4 border border-border"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">{pessoa.nome}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${atingiuMeta ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {atingiuMeta ? 'Meta Atingida' : 'Abaixo da Meta'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Contratos</p>
                      <p className="font-semibold text-foreground">{pessoa.contratos}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Reuniões</p>
                      <p className="font-semibold text-foreground">{pessoa.reunioes}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Conv. Individual</p>
                      <p className="font-semibold text-cyan-400">{conversaoIndividual}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Faturamento</p>
                      <p className="font-semibold text-primary">{formatCurrency(pessoa.faturamento)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Meta</p>
                      <p className="font-semibold text-muted-foreground">{formatCurrency(pessoa.meta)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Custo Investido</p>
                      <p className="font-semibold text-orange-400">{formatCurrency(custoInvestido)}</p>
                    </div>
                    <div className="col-span-2 sm:col-span-3">
                      <p className="text-muted-foreground text-xs">ROI Individual</p>
                      <p className={`font-semibold ${parseFloat(roiIndividual) >= 100 ? 'text-green-400' : 'text-red-400'}`}>
                        {roiIndividual}% 
                        <span className="text-xs text-muted-foreground ml-1">
                          (Lucro: {formatCurrency(pessoa.faturamento - custoInvestido)})
                        </span>
                      </p>
                    </div>

                    {/* Comissão */}
                    <div className="col-span-2 sm:col-span-3 border-t border-border pt-2 mt-1">
                      <p className="text-muted-foreground text-xs mb-1">
                        Comissão Paga
                        <MetricTooltip text="Valor pago de comissão ao vendedor neste mês. Ao preencher, o custo real investido será recalculado." />
                      </p>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          placeholder="R$ 0,00"
                          defaultValue={comissao > 0 ? comissao.toString() : ""}
                          onChange={(e) => handleComissaoChange(pessoa.nome, e.target.value)}
                          className="bg-muted border border-border rounded px-2 py-1 text-sm text-foreground w-32"
                        />
                        {comissao > 0 && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Custo Real: </span>
                            <span className="font-semibold text-orange-400">{formatCurrency(custoReal)}</span>
                            <span className="text-muted-foreground ml-2">ROI Real: </span>
                            <span className={`font-semibold ${parseFloat(roiComComissao) >= 100 ? 'text-green-400' : 'text-red-400'}`}>
                              {roiComComissao}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {percentualMeta !== "N/A" && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progresso da Meta</span>
                        <span className={atingiuMeta ? 'text-green-400' : 'text-red-400'}>{percentualMeta}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${atingiuMeta ? 'bg-green-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(parseFloat(percentualMeta), 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
