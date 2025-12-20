export interface MonthData {
  month: string;
  year: number;
  investimento: number;
  impressoes: number;
  ctr: number;
  cpc: number;
  mensagens: number;
  cpa: number;
  cpm: number;
  frequencia: number;
  vendas: number;
  faturamento: number;
  diasUteis?: string;
}

export const marketingData: Record<string, MonthData> = {
  novembro: {
    month: "Novembro",
    year: 2024,
    investimento: 14886.89,
    impressoes: 504372,
    ctr: 0.46,
    cpc: 6.36,
    mensagens: 917,
    cpa: 15.97,
    cpm: 29.52,
    frequencia: 1.75,
    vendas: 30,
    faturamento: 45345.10,
  },
  dezembro: {
    month: "Dezembro",
    year: 2024,
    investimento: 9154.49,
    impressoes: 430687,
    ctr: 0.52,
    cpc: 4.08,
    mensagens: 680,
    cpa: 12.87,
    cpm: 21.23,
    frequencia: 1.49,
    vendas: 24,
    faturamento: 40875.20,
    diasUteis: "15º dia útil",
  },
};

export const calculateVariation = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('pt-BR').format(value);
};

export const formatPercent = (value: number): string => {
  return `${value.toFixed(2)}%`;
};
