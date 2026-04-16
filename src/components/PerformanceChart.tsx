import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface PerformanceChartProps {
  investimento: number;
  faturamento: number;
}

export const PerformanceChart = ({ investimento, faturamento }: PerformanceChartProps) => {
  const lucro = faturamento - investimento;
  
  const data = [
    { name: 'Investimento', value: investimento, color: 'hsl(207, 90%, 54%)' },
    { name: 'Lucro Bruto', value: lucro, color: 'hsl(142, 76%, 36%)' },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 opacity-0 animate-fade-in" style={{ animationDelay: '600ms' }}>
      <h3 className="text-foreground font-semibold mb-4">Distribuição Financeira</h3>
      
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'hsl(222, 47%, 9%)',
                border: '1px solid hsl(222, 47%, 16%)',
                borderRadius: '8px',
                color: 'hsl(210, 40%, 98%)',
              }}
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
            />
            <Legend 
              verticalAlign="bottom"
              formatter={(value, entry: any) => (
                <span style={{ color: 'hsl(210, 40%, 98%)' }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-muted-foreground">{item.name}</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {formatCurrency(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
