import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePipelineData } from "@/components/pipeline/usePipelineData";
import { formatBRL, CLOSERS } from "@/components/pipeline/types";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, X, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Contratos() {
  const { profile } = useAuth();
  const nome = profile?.nome ?? "Admin";
  const { cards } = usePipelineData(nome);

  const [criadoDe, setCriadoDe] = useState<Date | undefined>();
  const [criadoAte, setCriadoAte] = useState<Date | undefined>();
  const [fechadoDe, setFechadoDe] = useState<Date | undefined>();
  const [fechadoAte, setFechadoAte] = useState<Date | undefined>();
  const [vendedor, setVendedor] = useState<string>("todos");

  const contratos = useMemo(() => {
    let filtered = cards.filter(
      c => c.lead_status === "ganho" || c.stage === "contrato_assinado"
    );

    if (vendedor !== "todos") {
      filtered = filtered.filter(c => c.owner === vendedor);
    }

    if (criadoDe) {
      filtered = filtered.filter(c => new Date(c.created_at) >= criadoDe);
    }
    if (criadoAte) {
      const end = new Date(criadoAte);
      end.setHours(23, 59, 59);
      filtered = filtered.filter(c => new Date(c.created_at) <= end);
    }

    if (fechadoDe) {
      filtered = filtered.filter(c => {
        const d = c.zapsign_signed_at || c.contrato_preparado_em;
        return d ? new Date(d) >= fechadoDe : false;
      });
    }
    if (fechadoAte) {
      const end = new Date(fechadoAte);
      end.setHours(23, 59, 59);
      filtered = filtered.filter(c => {
        const d = c.zapsign_signed_at || c.contrato_preparado_em;
        return d ? new Date(d) <= end : false;
      });
    }

    return filtered;
  }, [cards, vendedor, criadoDe, criadoAte, fechadoDe, fechadoAte]);

  const exportCSV = () => {
    const rows = contratos.map(c => [
      c.empresa || c.nome,
      c.cnpj || "",
      c.telefone || "",
      c.email || "",
      c.valor_mensalidade || c.deal_value || "",
      c.porcentagem_exito ? `${c.porcentagem_exito}%` : "",
      c.estado || "",
      c.owner || "",
      c.created_at ? format(new Date(c.created_at), "dd/MM/yyyy") : "",
      c.zapsign_signed_at ? format(new Date(c.zapsign_signed_at), "dd/MM/yyyy") : "",
    ]);
    const header = "Empresa,CNPJ,Telefone,Email,Mensalidade,Exito%,UF,Vendedor,Criação,Fechamento";
    const csv = [header, ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contratos_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setCriadoDe(undefined);
    setCriadoAte(undefined);
    setFechadoDe(undefined);
    setFechadoAte(undefined);
    setVendedor("todos");
  };

  const hasFilters = criadoDe || criadoAte || fechadoDe || fechadoAte || vendedor !== "todos";

  const owners = useMemo(() => {
    const set = new Set(cards.map(c => c.owner).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [cards]);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Contratos Fechados</h1>
          <p className="text-xs text-muted-foreground">{contratos.length} contrato(s)</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-card border border-border rounded-xl p-3">
        <select
          value={vendedor}
          onChange={e => setVendedor(e.target.value)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
        >
          <option value="todos">Todos vendedores</option>
          {owners.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>

        <DatePickerField label="Criação de" value={criadoDe} onChange={setCriadoDe} />
        <DatePickerField label="Criação até" value={criadoAte} onChange={setCriadoAte} />
        <DatePickerField label="Fechamento de" value={fechadoDe} onChange={setFechadoDe} />
        <DatePickerField label="Fechamento até" value={fechadoAte} onChange={setFechadoAte} />

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1">
            <X className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Empresa</TableHead>
              <TableHead className="text-xs">CNPJ</TableHead>
              <TableHead className="text-xs">Telefone</TableHead>
              <TableHead className="text-xs">Email</TableHead>
              <TableHead className="text-xs">Mensalidade</TableHead>
              <TableHead className="text-xs">Êxito %</TableHead>
              <TableHead className="text-xs">UF</TableHead>
              <TableHead className="text-xs">Vendedor</TableHead>
              <TableHead className="text-xs">Criação</TableHead>
              <TableHead className="text-xs">Fechamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contratos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8 text-sm">
                  Nenhum contrato encontrado
                </TableCell>
              </TableRow>
            ) : (
              contratos.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs font-medium">{c.empresa || c.nome}</TableCell>
                  <TableCell className="text-xs">{c.cnpj || "—"}</TableCell>
                  <TableCell className="text-xs">{c.telefone || "—"}</TableCell>
                  <TableCell className="text-xs">{c.email || "—"}</TableCell>
                  <TableCell className="text-xs">{formatBRL(c.valor_mensalidade || c.deal_value || 0)}</TableCell>
                  <TableCell className="text-xs">{c.porcentagem_exito ? `${c.porcentagem_exito}%` : "—"}</TableCell>
                  <TableCell className="text-xs">{c.estado || "—"}</TableCell>
                  <TableCell className="text-xs">{c.owner || "—"}</TableCell>
                  <TableCell className="text-xs">{format(new Date(c.created_at), "dd/MM/yy")}</TableCell>
                  <TableCell className="text-xs">
                    {c.zapsign_signed_at
                      ? format(new Date(c.zapsign_signed_at), "dd/MM/yy")
                      : c.contrato_preparado_em
                        ? format(new Date(c.contrato_preparado_em), "dd/MM/yy")
                        : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DatePickerField({ label, value, onChange }: { label: string; value: Date | undefined; onChange: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8">
          <CalendarIcon className="h-3 w-3" />
          {value ? format(value, "dd/MM/yy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  );
}
