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
  comissao?: number;
}

export interface MonthSalesData {
  funnel: SalesFunnelData;
  individuais: IndividualPerformance[];
}

export const salesData: Record<string, MonthSalesData> = {
  setembro: {
    funnel: {
      mensagens: 362,
      reunioes: {
        realizado: 121,
        meta: 0,
      },
      contratos: {
        realizado: 32,
        meta: 0,
      },
      faturamento: {
        realizado: 60249.60,
        meta: 61600.00,
      },
    },
    individuais: [
      {
        nome: "Stephanie",
        contratos: 18,
        faturamento: 37149.40,
        meta: 30800.00,
        reunioes: 68,
      },
      {
        nome: "Vitor",
        contratos: 11,
        faturamento: 19305.20,
        meta: 30800.00,
        reunioes: 53,
      },
    ],
  },
  outubro: {
    funnel: {
      mensagens: 273,
      reunioes: {
        realizado: 82,
        meta: 130,
      },
      contratos: {
        realizado: 8,
        meta: 28,
      },
      faturamento: {
        realizado: 11968.40,
        meta: 50000.00,
      },
    },
    individuais: [
      {
        nome: "Stephanie",
        contratos: 8,
        faturamento: 11968.40,
        meta: 50000.00,
        reunioes: 82,
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
  janeiro: {
    funnel: {
      mensagens: 1496,
      reunioes: {
        realizado: 137,
        meta: 130,
      },
      contratos: {
        realizado: 46,
        meta: 43,
      },
      faturamento: {
        realizado: 71240.50,
        meta: 66550.00,
      },
    },
    individuais: [
      {
        nome: "Stephanie",
        contratos: 22,
        faturamento: 36310.40,
        meta: 29750.00,
        reunioes: 57,
      },
      {
        nome: "João Reis",
        contratos: 15,
        faturamento: 20989.50,
        meta: 20000.00,
        reunioes: 57,
      },
      {
        nome: "Cayo",
        contratos: 7,
        faturamento: 10374.40,
        meta: 16800.00,
        reunioes: 23,
      },
    ],
  },
  fevereiro: {
    funnel: {
      mensagens: 1483,
      reunioes: {
        realizado: 90,
        meta: 119,
      },
      contratos: {
        realizado: 33,
        meta: 40,
      },
      faturamento: {
        realizado: 49557.40,
        meta: 65800.00,
      },
    },
    individuais: [
      {
        nome: "Stephanie",
        contratos: 17,
        faturamento: 25080.30,
        meta: 29650.00,
        reunioes: 46,
      },
      {
        nome: "João Reis",
        contratos: 6,
        faturamento: 8753.40,
        meta: 19650.00,
        reunioes: 25,
      },
      {
        nome: "Cayo",
        contratos: 10,
        faturamento: 15723.70,
        meta: 16500.00,
        reunioes: 19,
      },
    ],
  },
};
