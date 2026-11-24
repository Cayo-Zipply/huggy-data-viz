import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HorariosAtendimento } from "./HorariosAtendimento";

export function HorariosDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Horários de atendimento</DialogTitle></DialogHeader>
        {open && <HorariosAtendimento />}
      </DialogContent>
    </Dialog>
  );
}
