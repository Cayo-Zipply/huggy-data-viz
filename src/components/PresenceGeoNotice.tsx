import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction,
} from "@/components/ui/alert-dialog";

export function PresenceGeoNotice({ open, onConfirm }: { open: boolean; onConfirm: () => void }) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Localização durante o uso do Farol</AlertDialogTitle>
          <AlertDialogDescription>
            Enquanto o Farol estiver aberto, a PQA registra sua localização aproximada para gestão da equipe comercial. Só a última posição é guardada, e nada é coletado com o Farol fechado. A seguir o navegador vai pedir sua permissão.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onConfirm}>Entendi</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}