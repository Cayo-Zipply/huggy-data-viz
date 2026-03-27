import { useState, useRef, useCallback } from "react";
import { Upload, Phone, User, Calendar, Tag, MessageSquare, CheckCircle, Clock, XCircle, ChevronDown, Search, X, Filter, Users, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type LeadStatus = "novo" | "em_contato" | "reuniao_agendada" | "convertido" | "perdido";

interface Lead {
  id: string;
  nome: string;
  telefone: string;
  status: LeadStatus;
  dataEntrada: string;
  origem: string;
  anotacoes: string;
  contatado: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  novo:             { label: "Novo",              color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/30",    icon: Clock },
  em_contato:       { label: "Em Contato",        color: "text-yellow-400",  bg: "bg-yellow-400/10 border-yellow-400/30", icon: Phone },
  reuniao_agendada: { label: "Reunião Agendada",  color: "text-purple-400",  bg: "bg-purple-400/10 border-purple-400/30", icon: Calendar },
  convertido:       { label: "Convertido",        color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", icon: CheckCircle },
  perdido:          { label: "Perdido",           color: "text-red-400",     bg: "bg-red-400/10 border-red-400/30",      icon: XCircle },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as LeadStatus[];

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): Lead[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
  );

  const findCol = (...keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));

  const colNome    = findCol("nome", "name", "lead");
  const colTel     = findCol("tel", "fone", "whats", "phone", "celular", "contato");
  const colData    = findCol("data", "date", "entrada");
  const colOrigem  = findCol("origem", "source", "campanha", "canal");
  const colStatus  = findCol("status");

  return lines.slice(1).filter(l => l.trim()).map((line, i) => {
    const cols = line.split(/[,;]/).map(c => c.trim().replace(/^["']|["']$/g, ""));

    const rawStatus = colStatus >= 0 ? cols[colStatus]?.toLowerCase() ?? "" : "";
    const status: LeadStatus = ALL_STATUSES.find(s => rawStatus.includes(s.replace("_", " ")) || rawStatus.includes(s)) ?? "novo";

    return {
      id: `lead-${Date.now()}-${i}`,
      nome:       colNome   >= 0 ? cols[colNome]   || `Lead ${i + 1}` : `Lead ${i + 1}`,
      telefone:   colTel    >= 0 ? cols[colTel]    || "—"             : "—",
      dataEntrada:colData   >= 0 ? cols[colData]   || "—"             : "—",
      origem:     colOrigem >= 0 ? cols[colOrigem] || "—"             : "—",
      status,
      anotacoes: "",
      contatado: status !== "novo",
    };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: LeadStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border", cfg.color, cfg.bg)}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function LeadCard({ lead, onUpdate }: { lead: Lead; onUpdate: (updated: Lead) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(lead.anotacoes);

  const saveNote = () => {
    onUpdate({ ...lead, anotacoes: noteText });
    setEditingNote(false);
  };

  const toggleContatado = () => onUpdate({ ...lead, contatado: !lead.contatado });

  const setStatus = (status: LeadStatus) => onUpdate({ ...lead, status });

  const whatsappLink = `https://wa.me/55${lead.telefone.replace(/\D/g, "")}`;

  return (
    <div className="relative bg-card border border-border rounded-xl overflow-hidden transition-all hover:border-border/80">
      {/* Accent bar */}
      <div className={cn("absolute top-0 left-0 w-1 h-full", STATUS_CONFIG[lead.status].color.replace("text-", "bg-"))} />

      <div className="pl-4 pr-3 py-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0", STATUS_CONFIG[lead.status].bg, STATUS_CONFIG[lead.status].color)}>
              {lead.nome.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{lead.nome}</p>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-emerald-400 transition-colors flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <Phone size={10} />
                {lead.telefone}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <StatusBadge status={lead.status} />
            <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
              <ChevronDown size={14} className={cn("transition-transform", expanded && "rotate-180")} />
            </button>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          {lead.dataEntrada !== "—" && (
            <span className="flex items-center gap-1"><Calendar size={10} />{lead.dataEntrada}</span>
          )}
          {lead.origem !== "—" && (
            <span className="flex items-center gap-1"><Tag size={10} />{lead.origem}</span>
          )}
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
            {/* Status selector */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Alterar status</p>
              <div className="flex flex-wrap gap-1">
                {ALL_STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full border transition-all",
                      lead.status === s
                        ? cn(STATUS_CONFIG[s].color, STATUS_CONFIG[s].bg)
                        : "border-border/50 text-muted-foreground hover:border-border"
                    )}
                  >
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <MessageSquare size={10} /> Anotações
              </p>
              {editingNote ? (
                <div className="space-y-1.5">
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    className="w-full text-xs bg-muted/50 border border-border rounded-lg p-2 resize-none focus:outline-none focus:border-primary/50 text-foreground"
                    rows={3}
                    placeholder="Adicione uma anotação..."
                    autoFocus
                  />
                  <div className="flex gap-1.5">
                    <button onClick={saveNote} className="text-xs px-2.5 py-1 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors">Salvar</button>
                    <button onClick={() => { setEditingNote(false); setNoteText(lead.anotacoes); }} className="text-xs px-2.5 py-1 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors">Cancelar</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setEditingNote(true)}
                  className="w-full text-left text-xs p-2 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/60 transition-colors text-muted-foreground"
                >
                  {lead.anotacoes || "Clique para adicionar anotação..."}
                </button>
              )}
            </div>

            {/* Mark as contacted */}
            <button
              onClick={toggleContatado}
              className={cn(
                "w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all border",
                lead.contatado
                  ? "border-border/50 text-muted-foreground hover:border-border bg-muted/20"
                  : "border-emerald-500/30 text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20"
              )}
            >
              <CheckCircle size={12} />
              {lead.contatado ? "Marcar como não contatado" : "Marcar como contatado"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (file: File) => {
    if (file && (file.name.endsWith(".csv") || file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      onFile(file);
    }
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 py-16",
        dragging
          ? "border-primary bg-primary/10 scale-[1.01]"
          : "border-border/50 bg-card/40 hover:border-primary/50 hover:bg-primary/5"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); }}
      />
      <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center transition-colors", dragging ? "bg-primary/30" : "bg-muted/50")}>
        <Upload size={28} className={cn("transition-colors", dragging ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="text-center">
        <p className="font-semibold text-foreground">Arraste sua planilha aqui</p>
        <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar</p>
        <p className="text-xs text-muted-foreground/60 mt-2">Suporta CSV, XLSX e XLS</p>
      </div>
      <div className="bg-muted/40 rounded-xl px-4 py-2.5 text-xs text-muted-foreground max-w-xs text-center leading-relaxed">
        <span className="font-medium text-foreground">Colunas reconhecidas:</span><br />
        Nome · Telefone · Data de Entrada · Origem · Status
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CRMPanel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "todos">("todos");
  const [filterContatado, setFilterContatado] = useState<"todos" | "pendentes" | "contatados">("todos");
  const [fileName, setFileName] = useState("");

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setLeads(parsed);
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const updateLead = useCallback((updated: Lead) => {
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
  }, []);

  const filtered = leads.filter(l => {
    const matchSearch = !search || l.nome.toLowerCase().includes(search.toLowerCase()) || l.telefone.includes(search);
    const matchStatus = filterStatus === "todos" || l.status === filterStatus;
    const matchContatado = filterContatado === "todos" || (filterContatado === "contatados" ? l.contatado : !l.contatado);
    return matchSearch && matchStatus && matchContatado;
  });

  const total = leads.length;
  const contatados = leads.filter(l => l.contatado).length;
  const convertidos = leads.filter(l => l.status === "convertido").length;
  const pendentes = total - contatados;

  if (leads.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">CRM de Leads</h2>
          <p className="text-sm text-muted-foreground mt-1">Importe sua planilha do Tintim para gerenciar os leads</p>
        </div>
        <DropZone onFile={handleFile} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground">CRM de Leads</h2>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            {fileName} · {total} leads importados
          </p>
        </div>
        <button
          onClick={() => { setLeads([]); setFileName(""); }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/50 rounded-lg px-3 py-1.5 hover:bg-muted/30 transition-all"
        >
          <Upload size={12} /> Nova importação
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total de Leads",  value: total,       icon: Users,       color: "text-blue-400",    bg: "bg-blue-400/10" },
          { label: "Pendentes",       value: pendentes,   icon: Clock,       color: "text-yellow-400",  bg: "bg-yellow-400/10" },
          { label: "Contatados",      value: contatados,  icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10" },
          { label: "Convertidos",     value: convertidos, icon: TrendingUp,  color: "text-purple-400",  bg: "bg-purple-400/10" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", s.bg)}>
                <Icon size={16} className={s.color} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-card border border-border rounded-lg focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <Filter size={12} className="text-muted-foreground" />
          {(["todos", ...ALL_STATUSES] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "text-xs px-2.5 py-1.5 rounded-lg border transition-all",
                filterStatus === s
                  ? s === "todos" ? "bg-primary/20 text-primary border-primary/40" : cn(STATUS_CONFIG[s as LeadStatus].color, STATUS_CONFIG[s as LeadStatus].bg)
                  : "border-border/50 text-muted-foreground hover:border-border"
              )}
            >
              {s === "todos" ? "Todos" : STATUS_CONFIG[s as LeadStatus].label}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {(["todos", "pendentes", "contatados"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterContatado(f)}
              className={cn(
                "text-xs px-2.5 py-1.5 rounded-lg border transition-all capitalize",
                filterContatado === f
                  ? "bg-muted text-foreground border-border"
                  : "border-border/30 text-muted-foreground hover:border-border"
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        Mostrando <span className="text-foreground font-medium">{filtered.length}</span> de {total} leads
      </p>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhum lead encontrado com os filtros aplicados.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(lead => (
            <LeadCard key={lead.id} lead={lead} onUpdate={updateLead} />
          ))}
        </div>
      )}
    </div>
  );
}
