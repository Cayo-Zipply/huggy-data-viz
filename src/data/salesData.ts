export interface SalesFunnelData {
  mensagens: number;
  reunioes: {
    realizado: number;
    meta: number;
  };
  contratos: {
    realizado: number;
    meta: number;
  };
  faturamento: {
    realizado: number;
    meta: number;
  };
}

export interface IndividualPerformance {
  nome: string;
  contratos: number;
  faturamento: number;
  meta: number;
  reunioes: number;
}

export interface MonthSalesData {
  funnel: SalesFunnelData;
  individuais: IndividualPerformance[];
}

export const salesData: Record<string, MonthSalesData> = {
  dezembro: {
    funnel: {
      mensagens: 989,
      reunioes: {
        realizado: 83,
        meta: 87,
      },
      contratos: {
        realizado: 28,
        meta: 26,
      },
      faturamento: {
        realizado: 47706.20,
        meta: 45000.00,
      },
    },
    individuais: [
      {
        nome: "Stephanie",
        contratos: 17,
        faturamento: 31008.20,
        meta: 27000.00,
        reunioes: 35,
      },
      {
        nome: "João Reis",
        contratos: 11,
        faturamento: 16698.00,
        meta: 18000.00,
        reunioes: 48,
      },
    ],
  },
  novembro: {
    funnel: {
      mensagens: 917,
      reunioes: {
        realizado: 0,
        meta: 0,
      },
      contratos: {
        realizado: 30,
        meta: 0,
      },
      faturamento: {
        realizado: 45345.10,
        meta: 0,
      },
    },
    individuais: [],
  },
};
