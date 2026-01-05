import { MonthSalesData } from "@/data/salesData";
import { formatCurrency } from "@/data/marketingData";
import { MessageSquare, Users, FileCheck, DollarSign, Target, TrendingUp, TrendingDown } from "lucide-react";

interface SalesFunnelProps {
  data: MonthSalesData;
}

const MetaIndicator = ({ realizado, meta, isCurrency = false }: { realizado: number; meta: number; isCurrency?: boolean }) => {
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

export const SalesFunnel = ({ data }: SalesFunnelProps) => {
  const { funnel, individuais } = data;
  
  const hasData = funnel.reunioes.meta > 0 || funnel.contratos.meta > 0;

  return (
    <div className="bg-card rounded-xl p-6 border border-border animate-fade-in">
      <h3 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
        <Target className="text-primary" size={20} />
        Funil Comercial
      </h3>

      {/* Funil de Vendas */}
      <div className="space-y-4 mb-6">
        {/* Topo do Funil - Mensagens */}
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

        {/* Meio do Funil - Reuniões */}
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

        {/* Fundo do Funil - Contratos */}
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

        {/* Faturamento */}
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
      </div>

      {/* Conversões Individuais */}
      {individuais.length > 0 && (
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-foreground mb-4">Conversões Individuais</h4>
          <div className="space-y-3">
            {individuais.map((pessoa, index) => {
              const atingiuMeta = pessoa.faturamento >= pessoa.meta;
              const percentualMeta = ((pessoa.faturamento / pessoa.meta) * 100).toFixed(1);
              
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
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Contratos</p>
                      <p className="font-semibold text-foreground">{pessoa.contratos}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Reuniões</p>
                      <p className="font-semibold text-foreground">{pessoa.reunioes}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Faturamento</p>
                      <p className="font-semibold text-primary">{formatCurrency(pessoa.faturamento)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Meta</p>
                      <p className="font-semibold text-muted-foreground">{formatCurrency(pessoa.meta)}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className={atingiuMeta ? 'text-green-400' : 'text-red-400'}>{percentualMeta}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${atingiuMeta ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(parseFloat(percentualMeta), 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
