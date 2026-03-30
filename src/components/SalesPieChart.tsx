import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { marketingData } from "@/data/marketingData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#7c3aed", "#4f46e5"];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
  const allData = Object.values(marketingData);
  const total = allData.reduce((s, d) => s + d.faturamento, 0);
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl text-sm">
        <p className="text-white font-semibold mb-1">{item.name}</p>
        <p className="text-purple-400">{formatCurrency(item.faturamento)}</p>
        <p className="text-gray-400">{item.vendas} vendas</p>
        <p className="text-gray-500">{((item.faturamento / total) * 100).toFixed(1)}% do total</p>
      </div>
    );
  }
  return null;
};

export const SalesPieChart = () => {
  const data = Object.values(marketingData).map((d) => ({
    name: d.month + "/" + String(d.year).slice(2),
    faturamento: d.faturamento,
    vendas: d.vendas,
    investimento: d.investimento,
  }));

  const total = data.reduce((s, d) => s + d.faturamento, 0);
  const totalVendas = data.reduce((s, d) => s + d.vendas, 0);

  const renderCustomLabel = ({ cx, cy }: any) => (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.6em" fill="#ffffff" fontSize="13" fontWeight="600">Total</tspan>
      <tspan x={cx} dy="1.4em" fill="#a78bfa" fontSize="12">{totalVendas} vendas</tspan>
    </text>
  );

  return (
    <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
          <span className="text-purple-400">●</span>
          Faturamento por Mês
        </CardTitle>
        <p className="text-gray-400 text-xs mt-1">
          Total acumulado: <span className="text-white font-medium">{formatCurrency(total)}</span>
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={100}
              paddingAngle={3}
              dataKey="faturamento"
              labelLine={false}
              label={renderCustomLabel}
            >
              {data.map((_, i) => (
                <Cell key={"cell-" + i} fill={COLORS[i % COLORS.length]} opacity={0.9} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ color: "#9ca3af", fontSize: "12px" }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-700">
          {data.slice(-3).map((d, i) => (
            <div key={i} className="text-center">
              <div className="text-xs text-gray-500 mb-0.5">{d.name}</div>
              <div className="text-sm font-semibold text-white">{d.vendas} vendas</div>
              <div className="text-xs text-purple-400">{formatCurrency(d.faturamento)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};