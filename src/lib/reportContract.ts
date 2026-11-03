export type ContractModality = "venda_relatorio" | "mensalidade";
export type ReportPayment = "pix" | "cartao";

export function contractModality(value?: ContractModality | null): ContractModality {
  return value ?? "venda_relatorio";
}

export function reportDeadline(value?: number | string | null, modality: ContractModality = "venda_relatorio"): number {
  return value != null && value !== "" ? Number(value) : modality === "venda_relatorio" ? 5 : 7;
}

export function reportPaymentFields(value: number | null, payment: ReportPayment | "", installments: number | null) {
  return {
    valor_relatorio: value,
    forma_pagamento_relatorio: payment || null,
    parcelas_relatorio: payment === "pix" ? 1 : installments,
  };
}

export function reportErrors(value: number | null, payment: ReportPayment | "", installments: number | null): string[] {
  const errors: string[] = [];
  if (value == null || !Number.isFinite(value) || value <= 0) errors.push("Valor do relatório");
  if (payment !== "pix" && payment !== "cartao") errors.push("Forma de pagamento");
  if (payment === "cartao" && (installments == null || !Number.isInteger(installments) || installments < 1 || installments > 10)) errors.push("Parcelas no cartão");
  return errors;
}