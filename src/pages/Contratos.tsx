import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePipelineData } from "@/components/pipeline/usePipelineData";
import { formatBRL } from "@/components/pipeline/types";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarIcon, X, Download, Trash2, Plus } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type DatePreset = "todos" | "este_mes" | "mes_passado" | "ultimos_7" | "personalizado";

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "este_mes", label: "Este mês" },
  { key: "mes_passado", label: "Mês passado" },
  { key: "ultimos_7", label: "Últimos 7 dias" },
  { key: "personalizado", label: "Personalizado" },
];

function getPresetDates(preset: DatePreset): { from: Date | undefined; to: Date | undefined } {
  const now = new Date();
  switch (preset) {
    case "este_mes": return { from: startOfMonth(now), to: endOfMonth(now) };
    case "mes_passado": {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case "ultimos_7": return { from: subDays(now, 7), to: now };
    default: return { from: undefined, to: undefined };
  }
}

export default function Contratos() {
  const { profile, isAdmin } = useAuth();
  const nome = profile?.nome ?? "Admin";
  const { cards, deleteCard, markWon, createCard } = usePipelineData(nome);

  const [criacaoPreset, setCriacaoPreset] = useState<DatePreset>("todos");
  const [fechamentoPreset, setFechamentoPreset] = useState<DatePreset>("todos");
  const [criadoDe, setCriadoDe] = useState<Date | undefined>();
  const [criadoAte, setCriadoAte] = useState<Date | undefined>();
  const [fechadoDe, setFechadoDe] = useState<Date | undefined>();
  const [fechadoAte, setFechadoAte] = useState<Date | undefined>();
  const [vendedor, setVendedor] = useState<string>("todos");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [newContrato, setNewContrato] = useState({ nome: "", empresa: "", cnpj: "", telefone: "", email: "", valor_mensalidade: "", porcentagem_exito: "", estado: "", owner: "" });

  const applyCriacaoPreset = (preset: DatePreset) => {
    setCriacaoPreset(preset);
    if (preset !== "personalizado") {
      const { from, to } = getPresetDates(preset);
      setCriadoDe(from);
      setCriadoAte(to);
    }
  };

  const applyFechamentoPreset = (preset: DatePreset) => {
    setFechamentoPreset(preset);
    if (preset !== "personalizado") {
      const { from, to } = getPresetDates(preset);
      setFechadoDe(from);
      setFechadoAte(to);
    }
  };

  const contratos = useMemo(() => {
    let filtered = cards.filter(
      c => c.lead_status === "ganho" || c.stage === "contrato_assinado"
    );
    if (vendedor !== "todos") filtered = filtered.filter(c => c.owner === vendedor);
    if (criadoDe) filtered = filtered.filter(c => new Date(c.created_at) >= criadoDe);
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
      c.empresa || c.nome, c.cnpj || "", c.telefone || "", c.email || "",
      c.valor_mensalidade || c.deal_value || "",
      c.porcentagem_exito ? `${c.porcentagem_exito}%` : "",
      c.estado || "", c.owner || "",
      c.created_at ? format(new Date(c.created_at), "dd/MM/yyyy") : "",
      c.zapsign_signed_at ? format(new Date(c.zapsign_signed_at), "dd/MM/yyyy") : "",
    ]);
    const header = "Empresa,CNPJ,Telefone,Email,Mensalidade,Exito%,UF,Vendedor,Criação,Fechamento";
    const csv = [header, ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `contratos_${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setCriadoDe(undefined); setCriadoAte(undefined);
    setFechadoDe(undefined); setFechadoAte(undefined);
    setVendedor("todos"); setCriacaoPreset("todos"); setFechamentoPreset("todos");
  };

  const hasFilters = criadoDe || criadoAte || fechadoDe || fechadoAte || vendedor !== "todos";

  const owners = useMemo(() => {
    const set = new Set(cards.map(c => c.owner).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [cards]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === contratos.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(contratos.map(c => c.id)));
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Excluir ${selectedIds.size} contrato(s)?`)) return;
    for (const id of selectedIds) {
      await deleteCard(id);
    }
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} contrato(s) excluído(s)`);
  };

  const handleAddContrato = async () => {
    if (!newContrato.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const card = await createCard({
      nome: newContrato.nome,
      telefone: newContrato.telefone || undefined,
      owner: newContrato.owner || nome,
      deal_value: Number(newContrato.valor_mensalidade) || undefined,
      stage: "contrato_assinado",
    });
    if (card) {
      await markWon(card.id);
      toast.success("Contrato adicionado");
      setAddOpen(false);
      setNewContrato({ nome: "", empresa: "", cnpj: "", telefone: "", email: "", valor_mensalidade: "", porcentagem_exito: "", estado: "", owner: "" });
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Contratos Fechados</h1>
          <p className="text-xs text-muted-foreground">{contratos.length} contrato(s)</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleDeleteSelected} className="gap-2 text-xs">
              <Trash2 className="h-3.5 w-3.5" /> Excluir ({selectedIds.size})
            </Button>
          )}
          {isAdmin && (
            <Button variant="default" size="sm" onClick={() => setAddOpen(true)} className="gap-2 text-xs">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 text-xs">
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-card border border-border rounded-xl p-3">
        <select
          value={vendedor}
          onChange={e => setVendedor(e.target.value)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
        >
          <option value="todos">Todos vendedores</option>
          {owners.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        {/* Criação presets */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground font-medium mr-1">Criação:</span>
          {DATE_PRESETS.map(p => (
            <Button
              key={`c-${p.key}`}
              variant={criacaoPreset === p.key ? "default" : "outline"}
              size="sm"
              className="text-[10px] h-7 px-2"
              onClick={() => applyCriacaoPreset(p.key)}
            >
              {p.label}
            </Button>
          ))}
          {criacaoPreset === "personalizado" && (
            <>
              <DatePickerField label="De" value={criadoDe} onChange={d => { setCriadoDe(d); setCriacaoPreset("personalizado"); }} />
              <DatePickerField label="Até" value={criadoAte} onChange={d => { setCriadoAte(d); setCriacaoPreset("personalizado"); }} />
            </>
          )}
        </div>

        {/* Fechamento presets */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground font-medium mr-1">Fechamento:</span>
          {DATE_PRESETS.map(p => (
            <Button
              key={`f-${p.key}`}
              variant={fechamentoPreset === p.key ? "default" : "outline"}
              size="sm"
              className="text-[10px] h-7 px-2"
              onClick={() => applyFechamentoPreset(p.key)}
            >
              {p.label}
            </Button>
          ))}
          {fechamentoPreset === "personalizado" && (
            <>
              <DatePickerField label="De" value={fechadoDe} onChange={d => { setFechadoDe(d); setFechamentoPreset("personalizado"); }} />
              <DatePickerField label="Até" value={fechadoAte} onChange={d => { setFechadoAte(d); setFechamentoPreset("personalizado"); }} />
            </>
          )}
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1">
            <X className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && (
                <TableHead className="w-8">
                  <input type="checkbox" checked={selectedIds.size === contratos.length && contratos.length > 0} onChange={toggleAll} className="rounded" />
                </TableHead>
              )}
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
                <TableCell colSpan={isAdmin ? 11 : 10} className="text-center text-muted-foreground py-8 text-sm">
                  Nenhum contrato encontrado
                </TableCell>
              </TableRow>
            ) : (
              contratos.map(c => (
                <TableRow key={c.id} className={cn(selectedIds.has(c.id) && "bg-primary/5")}>
                  {isAdmin && (
                    <TableCell>
                      <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded" />
                    </TableCell>
                  )}
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

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Contrato Manualmente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Nome do cliente *</Label>
              <Input value={newContrato.nome} onChange={e => setNewContrato(p => ({ ...p, nome: e.target.value }))} placeholder="Nome" className="text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Empresa</Label>
                <Input value={newContrato.empresa} onChange={e => setNewContrato(p => ({ ...p, empresa: e.target.value }))} placeholder="Empresa" className="text-xs" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">CNPJ</Label>
                <Input value={newContrato.cnpj} onChange={e => setNewContrato(p => ({ ...p, cnpj: e.target.value }))} placeholder="CNPJ" className="text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={newContrato.telefone} onChange={e => setNewContrato(p => ({ ...p, telefone: e.target.value }))} placeholder="Telefone" className="text-xs" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={newContrato.email} onChange={e => setNewContrato(p => ({ ...p, email: e.target.value }))} placeholder="Email" className="text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Mensalidade (R$)</Label>
                <Input type="number" value={newContrato.valor_mensalidade} onChange={e => setNewContrato(p => ({ ...p, valor_mensalidade: e.target.value }))} placeholder="0" className="text-xs" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Êxito %</Label>
                <Input value={newContrato.porcentagem_exito} onChange={e => setNewContrato(p => ({ ...p, porcentagem_exito: e.target.value }))} placeholder="20" className="text-xs" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">UF</Label>
                <Input value={newContrato.estado} onChange={e => setNewContrato(p => ({ ...p, estado: e.target.value }))} placeholder="SP" className="text-xs" maxLength={2} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Vendedor</Label>
              <select value={newContrato.owner} onChange={e => setNewContrato(p => ({ ...p, owner: e.target.value }))} className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground">
                <option value="">Selecione</option>
                {owners.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAddContrato}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DatePickerField({ label, value, onChange }: { label: string; value: Date | undefined; onChange: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="text-[10px] gap-1 h-7 px-2">
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
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
