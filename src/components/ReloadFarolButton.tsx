import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseExternal";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogDescription,
} from "@/components/ui/alert-dialog";

export function ReloadFarolButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const reloadAll = async () => {
    if (pending) return;
    setPending(true);
    try {
      const { error } = await supabase.rpc("forcar_reload_farol");
      if (error) throw error;
      toast.success("Atualização do Farol solicitada para todos");
      setOpen(false);
    } catch {
      toast.error("Não foi possível solicitar a atualização do Farol");
    } finally { setPending(false); }
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={pending}>
        <RefreshCw className="mr-2 h-4 w-4" /> Recarregar Farol de todos
      </Button>
      <AlertDialog open={open} onOpenChange={(value) => { if (!pending) setOpen(value); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>Solicitar atualização do Farol para todos os usuários?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); void reloadAll(); }}>
              {pending ? "Solicitando…" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}