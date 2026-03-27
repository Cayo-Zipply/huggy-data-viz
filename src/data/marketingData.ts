export interface MonthData {
  month: string;
  year: number;
  investimento: number;
  impressoes: number;
  ctr: number;
  cpc: number;
  mensagens: number;
  mensagensEfetivas: number;
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
    mensagensEfetivas: 908,
    cpa: 15.97,
    cpm: 29.52,
    frequencia: 1.75,
    vendas: 30,
    faturamento: 45345.10,
  },
  dezembro: {
    month: "Dezembro",
    year: 2024,
    investimento: 13475.14,
    impressoes: 627560,
    ctr: 0.71,
    cpc: 2.31,
    mensagens: 989,
    mensagensEfetivas: 911,
    cpa: 13.67,
    cpm: 21.47,
    frequencia: 1.61,
    vendas: 28,
    faturamento: 47706.20,
  },
  janeiro: {
    month: "Janeiro",
    year: 2025,
    investimento: 22950.59,
    impressoes: 769291,
    ctr: 0.43,
    cpc: 3.41,
    mensagens: 1483,
    mensagensEfetivas: 1483,
    cpa: 15.34,
    cpm: 29.83,
    frequencia: 1.76,
    vendas: 46,
    faturamento: 71240.50,
  },
  fevereiro: {
    month: "Fevereiro",
    year: 2025,
    investimento: 20694.44,
    impressoes: 769291,
    ctr: 0.39,
    cpc: 3.03,
    mensagens: 1483,
    mensagensEfetivas: 1483,
    cpa: 13.95,
    cpm: 25.82,
    frequencia: 1.64,
    vendas: 33,
    faturamento: 49557.40,
  },
};

export const monthOrder = ["novembro", "dezembro", "janeiro", "fevereiro"];

export const getPreviousMonth = (month: string): string | null => {
  const idx = monthOrder.indexOf(month);
  return idx > 0 ? monthOrder[idx - 1] : null;
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
