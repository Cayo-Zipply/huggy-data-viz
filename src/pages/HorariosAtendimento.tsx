import { HorariosAtendimento } from "@/components/horarios/HorariosAtendimento";

export default function HorariosAtendimentoPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Horários de atendimento</h1>
      <HorariosAtendimento />
    </div>
  );
}
