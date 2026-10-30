import { useIsFetching } from "@tanstack/react-query";

/** Indicador discreto "atualizando…" no rodapé enquanto a tela recarrega em segundo plano. */
export function ScreenRefreshing({ keys }: { keys: string[] }) {
  const n = useIsFetching({ predicate: (q) => keys.includes(String(q.queryKey[0])) && q.state.data !== undefined });
  if (!n) return null;
  return (
    <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 rounded-full border border-border bg-card/95 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
      atualizando…
    </div>
  );
}
