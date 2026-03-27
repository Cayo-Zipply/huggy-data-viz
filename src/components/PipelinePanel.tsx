import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Clock, Phone, CalendarCheck, CheckCircle, XCircle, FileText, Send,
  ChevronDown, ChevronUp, Mail, Building2, DollarSign, Paperclip,
  Upload, GripVertical, RefreshCw, Settings, Link2
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────

type PipeType = "sdr" | "closer";
type SdrStage = "lead" | "conectado" | "sql" | "reuniao_marcada";
type CloserStage = "reuniao_agendada" | "no_show" | "reuniao_realizada" | "link_enviado" | "contrato_assinado";

interface PipelineCard {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cnpj: string | null;
  valor_divida: number | null;
  pipe: PipeType;
  sdr_stage: SdrStage | null;
  closer_stage: CloserStage | null;
  origem: string | null;
  anotacoes: string | null;
  contract_url: string | null;
  sheet_row_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────

const SDR_STAGES: { key: SdrStage; label: string; icon: any; color: string; bg: string }[] = [
  { key: "lead", label: "Lead", icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" },
  { key: "conectado", label: "Conectado", icon: Phone, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" },
  { key: "sql", label: "SQL", icon: CalendarCheck, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/30" },
  { key: "reuniao_marcada", label: "Reunião Marcada", icon: CalendarCheck, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30" },
];

const CLOSER_STAGES: { key: CloserStage; label: string; icon: any; color: string; bg: string }[] = [
  { key: "reuniao_agendada", label: "Reunião Agendada", icon: CalendarCheck, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" },
  { key: "no_show", label: "No Show", icon: XCircle, color: "text-red-400", bg: "bg-red-400/10 border-red-400/30" },
  { key: "reuniao_realizada", label: "Reunião Realizada", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30" },
  { key: "link_enviado", label: "Link Enviado", icon: Send, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" },
  { key: "contrato_assinado", label: "Contrato Assinado", icon: FileText, color: "text-green-400", bg: "bg-green-400/10 border-green-400/30" },
];

// ─── Card Component ───────────────────────────────────────────────────────

function CardItem({ card, onUpdate, onUploadContract }: {
  card: PipelineCard;
  onUpdate: (card: PipelineCard) => void;
  onUploadContract: (card: PipelineCard, file: File) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (field: string, value: string) => {
    setEditing(field);
    setEditValue(value || "");
  };

  const saveEdit = (field: string) => {
    const updated = { ...card, [field]: editValue || null };
    if (field === "valor_divida") {
      updated.valor_divida = editValue ? parseFloat(editValue.replace(/[^\d.,]/g, "").replace(",", ".")) : null;
    }
    onUpdate(updated);
    setEditing(null);
  };

  const whatsappLink = card.telefone ? `https://wa.me/55${card.telefone.replace(/\D/g, "")}` : null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-all group">
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">{card.nome}</p>
            {card.telefone && (
              <a
                href={whatsappLink || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1 mt-0.5"
              >
                <Phone size={10} /> {card.telefone}
              </a>
            )}
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground p-0.5">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Quick info */}
        <div className="flex flex-wrap gap-1 mt-2">
          {card.origem && (
            <span className="text-[10px] px-1.5 py-0.5 bg-muted/50 rounded text-muted-foreground">{card.origem}</span>
          )}
          {card.created_at && (
            <span className="text-[10px] px-1.5 py-0.5 bg-muted/50 rounded text-muted-foreground flex items-center gap-0.5">
              <Clock size={8} /> {new Date(card.created_at).toLocaleDateString("pt-BR")}
            </span>
          )}
          {card.valor_divida && (
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-400/10 rounded text-emerald-400">
              R$ {card.valor_divida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          )}
          {card.contract_url && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-400/10 rounded text-blue-400 flex items-center gap-0.5">
              <FileText size={8} /> Contrato
            </span>
          )}
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            {/* Custom fields */}
            {[
              { key: "email", label: "Email", icon: Mail, value: card.email },
              { key: "cnpj", label: "CNPJ", icon: Building2, value: card.cnpj },
              { key: "valor_divida", label: "Valor da Dívida", icon: DollarSign, value: card.valor_divida?.toString() },
            ].map((field) => (
              <div key={field.key} className="flex items-center gap-2">
                <field.icon size={12} className="text-muted-foreground flex-shrink-0" />
                {editing === field.key ? (
                  <div className="flex-1 flex gap-1">
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 text-xs bg-muted/50 border border-border rounded px-2 py-1 focus:outline-none focus:border-primary/50 text-foreground"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(field.key)}
                    />
                    <button onClick={() => saveEdit(field.key)} className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">OK</button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(field.key, field.value || "")}
                    className="flex-1 text-left text-xs text-muted-foreground hover:text-foreground truncate"
                  >
                    {field.value || `Adicionar ${field.label}...`}
                  </button>
                )}
              </div>
            ))}

            {/* Contract upload */}
            <div className="flex items-center gap-2">
              <Paperclip size={12} className="text-muted-foreground flex-shrink-0" />
              {card.contract_url ? (
                <a href={card.contract_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <FileText size={10} /> Ver contrato
                </a>
              ) : (
                <label className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
                  <Upload size={10} /> Anexar contrato (PDF)
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadContract(card, file);
                    }}
                  />
                </label>
              )}
            </div>

            {/* Notes */}
            {editing === "anotacoes" ? (
              <div className="space-y-1">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full text-xs bg-muted/50 border border-border rounded-lg p-2 resize-none focus:outline-none focus:border-primary/50 text-foreground"
                  rows={2}
                  autoFocus
                />
                <div className="flex gap-1">
                  <button onClick={() => saveEdit("anotacoes")} className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">Salvar</button>
                  <button onClick={() => setEditing(null)} className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded">Cancelar</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => startEdit("anotacoes", card.anotacoes || "")}
                className="w-full text-left text-xs p-2 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/60 text-muted-foreground"
              >
                {card.anotacoes || "Adicionar anotação..."}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Column Component ─────────────────────────────────────────────────────

function StageColumn({
  stage,
  cards,
  onUpdate,
  onUploadContract,
  onDrop,
}: {
  stage: { key: string; label: string; icon: any; color: string; bg: string };
  cards: PipelineCard[];
  onUpdate: (card: PipelineCard) => void;
  onUploadContract: (card: PipelineCard, file: File) => void;
  onDrop: (cardId: string, stage: string) => void;
}) {
  const Icon = stage.icon;
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={cn(
        "flex-1 min-w-[260px] max-w-[320px] flex flex-col rounded-xl border transition-all",
        dragOver ? "border-primary/50 bg-primary/5" : "border-border bg-card/30"
      )}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const cardId = e.dataTransfer.getData("cardId");
        if (cardId) onDrop(cardId, stage.key);
      }}
    >
      <div className="p-3 border-b border-border flex items-center gap-2">
        <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", stage.bg.split(" ")[0])}>
          <Icon size={12} className={stage.color} />
        </div>
        <span className="text-sm font-medium text-foreground">{stage.label}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">{cards.length}</span>
      </div>
      <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[60vh]">
        {cards.map((card) => (
          <div
            key={card.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("cardId", card.id)}
            className="cursor-grab active:cursor-grabbing"
          >
            <CardItem card={card} onUpdate={onUpdate} onUploadContract={onUploadContract} />
          </div>
        ))}
        {cards.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhum card</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export function PipelinePanel() {
  const [cards, setCards] = useState<PipelineCard[]>([]);
  const [activePipe, setActivePipe] = useState<PipeType>("sdr");
  const [loading, setLoading] = useState(true);
  const [showWebhook, setShowWebhook] = useState(false);
  const { toast } = useToast();

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";
  const webhookUrl = projectId
    ? `https://${projectId}.supabase.co/functions/v1/webhook-zapier`
    : "Configure o VITE_SUPABASE_PROJECT_ID";

  const fetchCards = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pipeline_cards")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching cards:", error);
      toast({ title: "Erro", description: "Não foi possível carregar os cards", variant: "destructive" });
    } else {
      setCards((data as PipelineCard[]) || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchCards();

    // Real-time subscription
    const channel = supabase
      .channel("pipeline-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_cards" }, () => {
        fetchCards();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchCards]);

  const updateCard = useCallback(async (updated: PipelineCard) => {
    const { error } = await supabase
      .from("pipeline_cards")
      .update({
        nome: updated.nome,
        telefone: updated.telefone,
        email: updated.email,
        cnpj: updated.cnpj,
        valor_divida: updated.valor_divida,
        pipe: updated.pipe,
        sdr_stage: updated.sdr_stage,
        closer_stage: updated.closer_stage,
        anotacoes: updated.anotacoes,
        contract_url: updated.contract_url,
      })
      .eq("id", updated.id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao atualizar card", variant: "destructive" });
    }
  }, [toast]);

  const handleDrop = useCallback(async (cardId: string, stageKey: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const sdrKeys = SDR_STAGES.map((s) => s.key);
    const closerKeys = CLOSER_STAGES.map((s) => s.key);

    let updated: Partial<PipelineCard> = {};
    if (sdrKeys.includes(stageKey as SdrStage)) {
      updated = { pipe: "sdr", sdr_stage: stageKey as SdrStage, closer_stage: null };
    } else if (closerKeys.includes(stageKey as CloserStage)) {
      updated = { pipe: "closer", sdr_stage: null, closer_stage: stageKey as CloserStage };
    }

    // Optimistic update
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...updated } : c)));

    const { error } = await supabase
      .from("pipeline_cards")
      .update(updated)
      .eq("id", cardId);

    if (error) {
      toast({ title: "Erro", description: "Falha ao mover card", variant: "destructive" });
      fetchCards();
    }
  }, [cards, toast, fetchCards]);

  const uploadContract = useCallback(async (card: PipelineCard, file: File) => {
    const filePath = `${card.id}/${file.name}`;
    const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Erro", description: "Falha ao enviar contrato", variant: "destructive" });
      return;
    }

    const { data: urlData } = supabase.storage.from("contracts").getPublicUrl(filePath);

    const { error } = await supabase
      .from("pipeline_cards")
      .update({ contract_url: urlData.publicUrl })
      .eq("id", card.id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao salvar URL do contrato", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Contrato anexado com sucesso!" });
      fetchCards();
    }
  }, [toast, fetchCards]);

  const stages = activePipe === "sdr" ? SDR_STAGES : CLOSER_STAGES;

  const getCardsForStage = (stageKey: string) => {
    if (activePipe === "sdr") {
      return cards.filter((c) => c.pipe === "sdr" && c.sdr_stage === stageKey);
    }
    return cards.filter((c) => c.pipe === "closer" && c.closer_stage === stageKey);
  };

  const sdrCount = cards.filter((c) => c.pipe === "sdr").length;
  const closerCount = cards.filter((c) => c.pipe === "closer").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground">Pipeline de Vendas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{cards.length} cards no total</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowWebhook(!showWebhook)}
            className="flex items-center gap-1.5 text-xs border border-border/50 rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
          >
            <Settings size={12} /> Webhook
          </button>
          <button
            onClick={fetchCards}
            className="flex items-center gap-1.5 text-xs border border-border/50 rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
          >
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>
      </div>

      {/* Webhook info */}
      {showWebhook && (
        <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            <Link2 size={14} /> Webhook — Google Sheets
          </p>
          <p className="text-xs text-muted-foreground">Cole esta URL na extensão de webhook da sua planilha. Quando uma linha for alterada, o card será criado ou atualizado automaticamente.</p>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-card border border-border rounded-lg p-2.5 text-foreground break-all select-all">
              {webhookUrl}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                toast({ title: "Copiado!", description: "URL copiada para a área de transferência" });
              }}
              className="px-3 py-1.5 text-xs bg-primary/20 text-primary rounded-lg hover:bg-primary/30 flex-shrink-0"
            >
              Copiar
            </button>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Método:</strong> POST</p>
            <p><strong>Campos reconhecidos:</strong> Nome, Telefone, Source, Etapa, ID, UF, Data</p>
            <p><strong>Etapas mapeadas:</strong> Fez Contato → Lead · Conectado → Conectado · SQL → SQL · Reunião marcada → Closer</p>
          </div>
        </div>
      )}

      {/* Pipe toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setActivePipe("sdr")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all",
            activePipe === "sdr"
              ? "bg-primary/20 text-primary border-primary/40"
              : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
          )}
        >
          Pipe SDR
          <span className="text-xs bg-muted/50 rounded-full px-2 py-0.5">{sdrCount}</span>
        </button>
        <button
          onClick={() => setActivePipe("closer")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all",
            activePipe === "closer"
              ? "bg-primary/20 text-primary border-primary/40"
              : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
          )}
        >
          Pipe Closer
          <span className="text-xs bg-muted/50 rounded-full px-2 py-0.5">{closerCount}</span>
        </button>
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando pipeline...</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <StageColumn
              key={stage.key}
              stage={stage}
              cards={getCardsForStage(stage.key)}
              onUpdate={updateCard}
              onUploadContract={uploadContract}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}
