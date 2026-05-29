import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUltimaNovidade } from "@/hooks/useUltimaNovidade";
import { Sparkles } from "lucide-react";

export function NovidadesModal() {
  const { novidade, marcarComoVista } = useUltimaNovidade();
  if (!novidade) return null;

  return (
    <Dialog open={!!novidade} onOpenChange={(aberto) => { if (!aberto) marcarComoVista(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {novidade.titulo}
          </DialogTitle>
        </DialogHeader>

        <ul className="space-y-2 mt-2">
          {novidade.itens.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-foreground">
              <span className="text-primary">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground mt-3">
          Atualizado em {new Date(novidade.publicado_em).toLocaleDateString("pt-BR")}
        </p>

        <DialogFooter>
          <Button onClick={marcarComoVista}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
