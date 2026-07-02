import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, ExternalLink, AlertCircle, CheckCircle2, MessageCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Participante = {
  nome: string;
  telefone: string;
  tipo: "cliente" | "fixo";
  responsavel_juridica?: boolean;
};

type GrupoRow = {
  lead_id: string;
  nome_grupo: string | null;
  participantes: Participante[] | null;
  status: "rascunho" | "criado" | "erro" | string | null;
  grupo_id: string | null;
  grupo_link: string | null;
  erro_msg: string | null;
};

export function GrupoWhatsappSection({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<GrupoRow | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTel, setNovoTel] = useState("");
  const [addingOpen, setAddingOpen] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("lead_grupo_whatsapp")
      .select("lead_id, nome_grupo, participantes, status, grupo_id, grupo_link, erro_msg")
      .eq("lead_id", leadId)
      .maybeSingle();
    if (error) console.warn("[GrupoWpp] load", error);
    setRow(data ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, [leadId]);

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground py-3"><Loader2 size={12} className="animate-spin" /> Carregando grupo…</div>;
  }
  if (!row) return null; // seção some quando não há rascunho

  const participantes: Participante[] = Array.isArray(row.participantes) ? row.participantes : [];

  async function updateField(patch: Partial<GrupoRow>) {
    const { error } = await (supabase as any)
      .from("lead_grupo_whatsapp")
      .update(patch)
      .eq("lead_id", leadId);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return false;
    }
    setRow(r => (r ? { ...r, ...patch } as GrupoRow : r));
    return true;
  }

  async function salvarNome(v: string) {
    setSavingName(true);
    await updateField({ nome_grupo: v });
    setSavingName(false);
  }

  async function removerParticipante(idx: number) {
    const p = participantes[idx];
    if (p?.tipo === "cliente") return;
    const next = participantes.filter((_, i) => i !== idx);
    await updateField({ participantes: next as any });
  }

  async function adicionarParticipante() {
    const nome = novoNome.trim();
    const telefone = novoTel.replace(/\D/g, "");
    if (!nome || !telefone) {
      toast({ title: "Preencha nome e telefone", variant: "destructive" });
      return;
    }
    const next = [...participantes, { nome, telefone, tipo: "fixo", responsavel_juridica: false } as Participante];
    const ok = await updateField({ participantes: next as any });
    if (ok) { setNovoNome(""); setNovoTel(""); setAddingOpen(false); }
  }

  async function gerarGrupo() {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("criar-grupo-whatsapp", { body: { lead_id: leadId } });
      if (error) throw error;
      if ((data as any)?.success) {
        toast({ title: "Grupo criado com sucesso" });
        await load();
      } else {
        const msg = (data as any)?.error || "Não foi possível criar o grupo";
        toast({ title: "Erro ao criar grupo", description: msg, variant: "destructive" });
        await load();
      }
    } catch (e: any) {
      toast({ title: "Erro ao criar grupo", description: e?.message ?? String(e), variant: "destructive" });
      await load();
    } finally {
      setGenerating(false);
    }
  }

  // ============ ESTADO CRIADO ============
  if (row.status === "criado") {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-500">Grupo criado</span>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Nome do grupo</p>
          <p className="text-sm text-foreground">{row.nome_grupo}</p>
        </div>
        {row.grupo_link && (
          <a href={row.grupo_link} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700">
            <ExternalLink size={12} /> Abrir grupo
          </a>
        )}
      </div>
    );
  }

  // ============ RASCUNHO / ERRO ============
  return (
    <div className="rounded-lg border border-border bg-card/40 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle size={16} className="text-primary" />
        <span className="text-sm font-semibold text-foreground">Grupo WhatsApp</span>
        {row.status === "erro" && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-red-500/15 text-red-500 border border-red-500/30">Erro</span>
        )}
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Nome do grupo</label>
        <div className="flex items-center gap-2 mt-1">
          <input
            defaultValue={row.nome_grupo ?? ""}
            onBlur={e => { if (e.target.value !== (row.nome_grupo ?? "")) salvarNome(e.target.value); }}
            className="flex-1 text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {savingName && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Participantes</p>
        <div className="space-y-1.5">
          {participantes.map((p, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted/30 rounded-md px-2.5 py-1.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm text-foreground truncate">{p.nome}</span>
                  {p.tipo === "cliente" && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500 border border-blue-500/30">Cliente</span>
                  )}
                  {p.responsavel_juridica && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-500 border border-purple-500/30">Resp. jurídica</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">{p.telefone}</p>
              </div>
              {p.tipo !== "cliente" && (
                <button onClick={() => removerParticipante(i)} className="text-muted-foreground hover:text-red-500 p-1" title="Remover">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          {participantes.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nenhum participante</p>
          )}
        </div>

        {addingOpen ? (
          <div className="mt-2 flex gap-1.5">
            <input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome"
              className="flex-1 text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5" />
            <input value={novoTel} onChange={e => setNovoTel(e.target.value)} placeholder="Telefone (DDD)"
              className="w-36 text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5" />
            <button onClick={adicionarParticipante} className="text-xs px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">OK</button>
            <button onClick={() => { setAddingOpen(false); setNovoNome(""); setNovoTel(""); }} className="text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-muted/40">X</button>
          </div>
        ) : (
          <button onClick={() => setAddingOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-muted/40">
            <Plus size={12} /> Adicionar participante
          </button>
        )}
      </div>

      {row.status === "erro" && row.erro_msg && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
          <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-500">{row.erro_msg}</p>
        </div>
      )}

      <button
        onClick={gerarGrupo}
        disabled={generating}
        className="w-full inline-flex items-center justify-center gap-2 text-sm px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {generating ? <><Loader2 size={14} className="animate-spin" /> Gerando grupo…</> : <><MessageCircle size={14} /> Gerar grupo</>}
      </button>
    </div>
  );
}
