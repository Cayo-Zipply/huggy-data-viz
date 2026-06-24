import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata CPF (11 dígitos) ou CNPJ (14 dígitos) para exibição.
 * Não altera o dado salvo — usar apenas na renderização.
 * Ex.: "28746854000130" → "28.746.854/0001-30"
 */
export function formatDocumento(raw?: string | null): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return String(raw ?? "").trim();
}
