export interface MonthRevenueData {
  valorDeixado: number; // Total clients have paid so far from that month's cohort
}

export const revenueData: Record<string, MonthRevenueData> = {
  setembro: { valorDeixado: 136474.67 },
  outubro: { valorDeixado: 33691.11 },
  novembro: { valorDeixado: 81340.80 },
  dezembro: { valorDeixado: 70541.50 },
  janeiro: { valorDeixado: 40340.87 },
  fevereiro: { valorDeixado: 0 },
};
