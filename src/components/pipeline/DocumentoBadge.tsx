import { Badge } from "@/components/ui/badge";

export function DocumentoBadge({ tipo }: { tipo?: string | null }) {
  if (tipo !== "cpf") return null;
  return (
    <Badge variant="outline" className="shrink-0 whitespace-nowrap rounded-md border-warning/40 bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
      CPF
    </Badge>
  );
}