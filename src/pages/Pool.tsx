import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePool, puxarProximoLead, registrarResultadoPool, type PoolLead } from "@/hooks/usePool";
import { CallButton } from "@/components/pipeline/CallButton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Flame, Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

function brl(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dt(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function Pool() {
  const { profile, isAdmin } = useAuth();
  const { config, elegiveis, emAtendimento, convertidosMes, rotacoes, loading, refetch, saveConfig } = usePool();

  const closerId = profile?.email ?? "";
  const poolAtivo = !!config?.pool_ativo;

  // ---- estado do modo Burn (closer) ----
  const [pulling, setPulling] = useState(false);
  const [lead, setLead] = useState<PoolLead | null>(null);
  const [oferta, setOferta] = useState("");
  const [saving, setSaving] = useState(false);

  async function handlePuxar() {
    if (!poolAtivo) {
      toast.error("Modo Pool inativo");
      return;
    }
    setPulling(true);
    const { lead: next, error } = await puxarProximoLead(closerId);
    setPulling(false);
    if (error) {
      toast.error(error.message ?? "Erro ao puxar lead");
      return;
    }
    if (!next) {
      toast.info("Nenhum lead disponível no pool para você agora");
      return;
    }
    setLead(next);
    setOferta("");
    refetch();
  }

  async function handleResultado(resultado: "convertido" | "sem_sucesso" | "devolvido") {
    if (!lead) return;
    setSaving(true);
    const tier = oferta ? Number(oferta.replace(",", ".")) : null;
    const { error } = await registrarResultadoPool(lead.id, closerId, resultado, tier);
    setSaving(false);
    if (error) {
      toast.error(error.message ?? "Erro ao registrar resultado");
      return;
    }
    toast.success("Resultado registrado");
    setLead(null);
    refetch();
  }

  // ---- agregação por closer (admin) ----
  const porCloser = useMemo(() => {
    const map = new Map<string, { puxou: number; converteu: number; soma: number }>();
    rotacoes.forEach((r) => {
      const k = r.closer_atribuido ?? "—";
      const cur = map.get(k) ?? { puxou: 0, converteu: 0, soma: 0 };
      cur.puxou += 1;
      if (r.resultado === "convertido") {
        cur.converteu += 1;
        cur.soma += Number(r.oferta_tier ?? 0);
      }
      map.set(k, cur);
    });
    return Array.from(map.entries())
      .map(([closer, v]) => ({
        closer,
        ...v,
        ticket: v.converteu ? v.soma / v.converteu : 0,
      }))
      .sort((a, b) => b.puxou - a.puxou);
  }, [rotacoes]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Flame className="h-5 w-5 text-orange-500" />
        <h1 className="text-lg font-bold text-foreground">Modo Pool</h1>
        <span
          className={cn(
            "text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5",
            poolAtivo ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground",
          )}
        >
          {poolAtivo ? "ativo" : "inativo"}
        </span>
      </div>

      {/* ================= BURN (todos os closers) ================= */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Burn — puxar lead do pool</h2>
        {!poolAtivo && (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Modo Pool inativo. Aguarde o admin liberar a fila.
          </p>
        )}

        {!lead ? (
          <Button onClick={handlePuxar} disabled={!poolAtivo || pulling}>
            {pulling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Puxar próximo lead do Pool
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Nome" value={lead.nome} />
              <Field label="Empresa" value={lead.empresa ?? "—"} />
              <Field label="Telefone" value={lead.telefone ?? "—"} />
              <Field label="Valor da dívida" value={brl(lead.valor_divida)} />
              <Field label="Origem da dívida" value={lead.origem_divida ?? "—"} />
              <Field label="Etapa atual" value={lead.etapa_atual ?? "—"} />
              <Field label="Prazo no pool" value={dt(lead.pool_prazo_ate)} />
            </div>

            {lead.resumo_reuniao && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Resumo da reunião</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{lead.resumo_reuniao}</p>
              </div>
            )}

            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <CallButton leadId={lead.id} />
                <span className="text-xs text-muted-foreground">Discar via IPBOX</span>
              </div>
              <div className="w-40">
                <Label className="text-xs">Oferta (mensalidade)</Label>
                <Input
                  value={oferta}
                  onChange={(e) => setOferta(e.target.value)}
                  placeholder="1134.70"
                  inputMode="decimal"
                />
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button size="sm" disabled={saving} onClick={() => handleResultado("convertido")}>
                Convertido
              </Button>
              <Button size="sm" variant="secondary" disabled={saving} onClick={() => handleResultado("sem_sucesso")}>
                Sem sucesso
              </Button>
              <Button size="sm" variant="outline" disabled={saving} onClick={() => handleResultado("devolvido")}>
                Devolver ao pool
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ================= ADMIN ================= */}
      {isAdmin && config && (
        <Tabs defaultValue="config" className="space-y-4">
          <TabsList>
            <TabsTrigger value="config">Configuração</TabsTrigger>
            <TabsTrigger value="closers">Por closer</TabsTrigger>
            <TabsTrigger value="log">Log de rotações</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Modo Pool</p>
                <p className="text-xs text-muted-foreground">
                  Ligado: closers conseguem puxar leads. Desligado: fila congelada.
                  {config.updated_by ? ` · Última alteração: ${config.updated_by} em ${dt(config.updated_at)}` : ""}
                </p>
              </div>
              <Switch
                checked={poolAtivo}
                onCheckedChange={async (v) => {
                  const { error } = await saveConfig({ pool_ativo: v }, profile?.email ?? null);
                  if (error) toast.error("Erro ao salvar");
                  else toast.success(v ? "Modo Pool ligado" : "Modo Pool desligado");
                }}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label="Leads elegíveis" value={elegiveis} />
              <Stat label="Em atendimento" value={emAtendimento} />
              <Stat label="Convertidos no mês" value={convertidosMes} />
            </div>

            <ConfigForm config={config} onSave={saveConfig} email={profile?.email ?? null} onSaved={refetch} />
          </TabsContent>

          <TabsContent value="closers">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Closer</th>
                    <th className="text-right p-2">Puxou</th>
                    <th className="text-right p-2">Converteu</th>
                    <th className="text-right p-2">Ticket médio</th>
                  </tr>
                </thead>
                <tbody>
                  {porCloser.map((r) => (
                    <tr key={r.closer} className="border-t border-border">
                      <td className="p-2">{r.closer}</td>
                      <td className="p-2 text-right">{r.puxou}</td>
                      <td className="p-2 text-right">{r.converteu}</td>
                      <td className="p-2 text-right">{brl(r.ticket || null)}</td>
                    </tr>
                  ))}
                  {porCloser.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-xs text-muted-foreground">
                        Nenhuma rotação registrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="log">
            <ScrollArea className="h-[60vh] rounded-xl border border-border bg-card">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left p-2">Lead</th>
                    <th className="text-left p-2">Closer original</th>
                    <th className="text-left p-2">Atribuído</th>
                    <th className="text-left p-2">Data</th>
                    <th className="text-left p-2">Prazo</th>
                    <th className="text-left p-2">Resultado</th>
                    <th className="text-left p-2">Comissionável</th>
                  </tr>
                </thead>
                <tbody>
                  {rotacoes.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-2 font-mono">{r.lead_id?.slice(0, 8)}</td>
                      <td className="p-2">{r.closer_original ?? "—"}</td>
                      <td className="p-2">{r.closer_atribuido ?? "—"}</td>
                      <td className="p-2">{dt(r.atribuido_em)}</td>
                      <td className="p-2">{dt(r.prazo_ate)}</td>
                      <td className="p-2">{r.resultado ?? "em aberto"}</td>
                      <td className="p-2">{r.comissionavel ? "sim" : "não"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function ConfigForm({
  config,
  onSave,
  email,
  onSaved,
}: {
  config: any;
  onSave: (patch: any, by?: string | null) => Promise<{ error: any }>;
  email: string | null;
  onSaved: () => void;
}) {
  const [dias, setDias] = useState(String(config.dias_inatividade));
  const [prazo, setPrazo] = useState(String(config.prazo_pool_dias));
  const [etapas, setEtapas] = useState((config.etapas_elegiveis ?? []).join(", "));
  const [motivos, setMotivos] = useState((config.motivos_excluidos ?? []).join(", "));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await onSave(
      {
        dias_inatividade: Number(dias) || 10,
        prazo_pool_dias: Number(prazo) || 10,
        etapas_elegiveis: etapas.split(",").map((s) => s.trim()).filter(Boolean),
        motivos_excluidos: motivos.split(",").map((s) => s.trim()).filter(Boolean),
      },
      email,
    );
    setSaving(false);
    if (error) toast.error("Erro ao salvar parâmetros");
    else {
      toast.success("Parâmetros salvos");
      onSaved();
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Dias de inatividade</Label>
          <Input value={dias} onChange={(e) => setDias(e.target.value)} inputMode="numeric" />
        </div>
        <div>
          <Label className="text-xs">Prazo no pool (dias)</Label>
          <Input value={prazo} onChange={(e) => setPrazo(e.target.value)} inputMode="numeric" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Etapas elegíveis (separadas por vírgula)</Label>
        <Input value={etapas} onChange={(e) => setEtapas(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Motivos de perda excluídos (separados por vírgula)</Label>
        <Input value={motivos} onChange={(e) => setMotivos(e.target.value)} />
      </div>
      <Button size="sm" onClick={save} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Salvar parâmetros
      </Button>
    </div>
  );
}
