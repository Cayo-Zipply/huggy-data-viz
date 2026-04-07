import { useState, useCallback, useEffect, useRef } from "react";
import type { PipelineCard, PipelineTask, PipelineGoal, Stage, PipeType, StageChange } from "./types";
import { DEFAULT_DEAL_VALUE, STAGE_CONFIG, AUTO_TASKS, addDays } from "./types";
import { sbExt as _sbExt } from "@/lib/supabaseExternal";

const sbExt = _sbExt as any;

/* ── helpers: map DB etapa → local Stage ── */
function mapEtapa(etapa: string | null): Stage {
  if (!etapa) return "fez_contato";
  const e = etapa.toLowerCase().trim();
  if (e === "fez contato" || e === "lead" || e === "fez_contato") return "fez_contato";
  if (e === "conectado") return "conectado";
  if (e === "sql") return "sql";
  if (e === "contestado") return "sql";
  if (e === "reunião marcada" || e === "reuniao_marcada" || e === "reuniao marcada") return "reuniao_marcada";
  if (e === "reunião agendada" || e === "reuniao_agendada" || e === "reuniao agendada") return "reuniao_agendada";
  if (e === "no show" || e === "no_show") return "no_show";
  if (e === "reunião realizada" || e === "reuniao_realizada" || e === "reuniao realizada") return "reuniao_realizada";
  if (e === "link enviado" || e === "link_enviado") return "link_enviado";
  if (e === "contrato assinado" || e === "contrato_assinado") return "contrato_assinado";
  return "fez_contato";
}

function mapStatus(status: string | null): "aberto" | "ganho" | "perdido" {
  if (!status) return "aberto";
  const s = status.toLowerCase().trim();
  if (s === "ganho" || s === "convertido" || s === "contrato assinado") return "ganho";
  if (s === "perdido") return "perdido";
  return "aberto";
}

function stageToEtapa(stage: Stage): string {
  const map: Record<Stage, string> = {
    fez_contato: "fez contato",
    conectado: "conectado",
    sql: "sql",
    reuniao_marcada: "reunião marcada",
    reuniao_agendada: "reunião agendada",
    no_show: "no show",
    reuniao_realizada: "reunião realizada",
    link_enviado: "link enviado",
    contrato_assinado: "contrato assinado",
  };
  return map[stage] || stage;
}

function dbRowToCard(row: any, history: StageChange[]): PipelineCard {
  const stage = mapEtapa(row.etapa_atual);
  return {
    id: row.id,
    nome: row.nome || "",
    telefone: row.telefone || null,
    email: null,
    cnpj: null,
    valor_divida: null,
    pipe: STAGE_CONFIG[stage].pipe as PipeType,
    stage,
    origem: row.origem || null,
    anotacoes: row.anotacoes || null,
    contract_url: null,
    created_at: row.data_entrada || row.created_at || new Date().toISOString(),
    updated_at: row.data_ultima_mudanca_etapa || new Date().toISOString(),
    owner: row.closer || null,
    deal_value: row.valor_negocio || DEFAULT_DEAL_VALUE,
    lead_status: mapStatus(row.status),
    loss_reason: row.motivo_perda_detalhe || row.motivo_perda || null,
    loss_category: null,
    last_stage: row.ultima_etapa || null,
    stage_changed_at: row.data_ultima_mudanca_etapa || row.data_entrada || new Date().toISOString(),
    history,
  };
}

function dbRowToTask(row: any): PipelineTask {
  return {
    id: row.id,
    card_id: row.lead_id,
    title: row.titulo,
    due_date: row.data_tarefa,
    responsible: row.closer || null,
    status: row.status === "concluida" ? "concluida" : "pendente",
    pipe_context: (row.pipeline || "sdr") as PipeType,
    auto_generated: row.auto || false,
    created_at: row.created_at || new Date().toISOString(),
  };
}

function dbRowToGoal(row: any): PipelineGoal {
  return {
    closer: row.closer,
    month: row.mes,
    reunioes_marcadas_meta: row.meta_reunioes_marcadas || 0,
    reunioes_realizadas_meta: row.meta_reunioes_realizadas || 0,
    faturamento_meta: row.meta_faturamento || 0,
    conversao_meta: row.meta_conversao || 0,
  };
}

/* ── localStorage legacy helpers ── */
function loadLS<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }

/* ── main hook ── */
export function usePipelineData(actorName: string) {
  const [cards, setCards] = useState<PipelineCard[]>([]);
  const [tasks, setTasks] = useState<PipelineTask[]>([]);
  const [goals, setGoals] = useState<PipelineGoal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const channelRef = useRef<any>(null);
  const legacyRef = useRef<{ cards: PipelineCard[]; tasks: PipelineTask[]; goals: PipelineGoal[] }>({
    cards: [],
    tasks: [],
    goals: [],
  });

  const fetchPipelineSnapshot = useCallback(async () => {
    const [leadsRes, tasksRes, goalsRes, histRes] = await Promise.all([
      sbExt.from("leads").select("*"),
      sbExt.from("tarefas").select("*"),
      sbExt.from("metas").select("*"),
      sbExt.from("lead_historico").select("*").order("created_at", { ascending: true }),
    ]);

    if (leadsRes.error || tasksRes.error || goalsRes.error || histRes.error) {
      console.error("Erro ao carregar snapshot do pipeline:", {
        leads: leadsRes.error,
        tasks: tasksRes.error,
        goals: goalsRes.error,
        history: histRes.error,
      });
      return;
    }

    const histMap = new Map<string, StageChange[]>();
    (histRes.data || []).forEach((h: any) => {
      const arr = histMap.get(h.lead_id) || [];
      arr.push({
        from: h.etapa_de || null,
        to: h.etapa_para || "",
        at: h.created_at,
        by: h.closer || "sistema",
        duration_days: null,
      });
      histMap.set(h.lead_id, arr);
    });

    const supaCards = (leadsRes.data || []).map((row: any) => {
      const hist = histMap.get(row.id) || [{ from: null, to: mapEtapa(row.etapa_atual), at: row.data_entrada || new Date().toISOString(), by: "sistema", duration_days: null }];
      return dbRowToCard(row, hist);
    });
    const supaCardIds = new Set(supaCards.map(c => c.id));
    const mergedCards = [...supaCards, ...legacyRef.current.cards.filter(c => !supaCardIds.has(c.id))];

    const supaTasks = (tasksRes.data || []).map(dbRowToTask);
    const supaTaskIds = new Set(supaTasks.map(t => t.id));
    const mergedTasks = [...supaTasks, ...legacyRef.current.tasks.filter(t => !supaTaskIds.has(t.id))];

    const supaGoals = (goalsRes.data || []).map(dbRowToGoal);

    setCards(mergedCards);
    setTasks(mergedTasks);
    setGoals(supaGoals.length ? supaGoals : legacyRef.current.goals);
    setLoaded(true);
  }, []);

  /* ── initial fetch: merge localStorage legacy + Supabase ── */
  useEffect(() => {
    legacyRef.current = {
      cards: loadLS("crm_cards", []),
      tasks: loadLS("crm_tasks", []),
      goals: loadLS("crm_goals", []),
    };
    void fetchPipelineSnapshot();
  }, [fetchPipelineSnapshot]);

  /* ── realtime subscription ── */
  useEffect(() => {
    if (!loaded) return;

    const channel = sbExt
      .channel(`crm-realtime-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => { void fetchPipelineSnapshot(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, () => { void fetchPipelineSnapshot(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_historico" }, () => { void fetchPipelineSnapshot(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "metas" }, () => { void fetchPipelineSnapshot(); })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          void fetchPipelineSnapshot();
        }
      });

    channelRef.current = channel;
    return () => { sbExt.removeChannel(channel); };
  }, [loaded, fetchPipelineSnapshot]);

  /* ── fallback sync: garante atualização mesmo se realtime falhar ── */
  useEffect(() => {
    if (!loaded) return;
    const intervalId = window.setInterval(() => {
      void fetchPipelineSnapshot();
    }, 8000);
    return () => window.clearInterval(intervalId);
  }, [loaded, fetchPipelineSnapshot]);

  /* ── auto tasks generator ── */
  const genAutoTasks = useCallback((card: PipelineCard, stage: Stage) => {
    const cfg = AUTO_TASKS[stage] || [];
    const now = new Date().toISOString();
    const pipe = STAGE_CONFIG[stage].pipe;
    return cfg.map(t => ({
      id: crypto.randomUUID(),
      card_id: card.id,
      title: t.title(card.nome),
      due_date: addDays(now, Math.max(0, t.daysOffset)),
      responsible: card.owner,
      status: "pendente" as const,
      pipe_context: pipe as PipeType,
      auto_generated: true,
      created_at: now,
    }));
  }, []);

  /* ── CRUD: create card ── */
  const createCard = useCallback(async (data: Partial<PipelineCard> & { nome: string }) => {
    const now = new Date().toISOString();
    const stage = data.stage || "conectado";
    const id = crypto.randomUUID();

    const { error } = await sbExt.from("leads").insert({
      id,
      nome: data.nome,
      telefone: data.telefone || null,
      origem: data.origem || null,
      etapa_atual: stageToEtapa(stage),
      status: "aberto",
      closer: data.owner || actorName,
      valor_negocio: data.deal_value || DEFAULT_DEAL_VALUE,
      data_entrada: data.created_at || now,
      data_ultima_mudanca_etapa: now,
      anotacoes: data.anotacoes || null,
    });
    if (error) { console.error("Insert lead error:", error); return null; }

    // insert history
    await sbExt.from("lead_historico").insert({
      lead_id: id,
      etapa_de: null,
      etapa_para: stageToEtapa(stage),
      evento: "criado",
      closer: data.owner || actorName,
    });

    // auto tasks
    const card: PipelineCard = {
      id, nome: data.nome, telefone: data.telefone || null, email: null, cnpj: null, valor_divida: null,
      pipe: STAGE_CONFIG[stage].pipe as PipeType, stage, origem: data.origem || null, anotacoes: data.anotacoes || null,
      contract_url: null, created_at: data.created_at || now, updated_at: now, owner: data.owner || actorName,
      deal_value: data.deal_value || DEFAULT_DEAL_VALUE, lead_status: "aberto", loss_reason: null, loss_category: null,
      last_stage: null, stage_changed_at: now,
      history: [{ from: null, to: stage, at: now, by: actorName, duration_days: null }],
    };

    const firstTask = {
      id: crypto.randomUUID(), lead_id: id, titulo: `Primeiro contato — ${data.nome}`,
      data_tarefa: addDays(now, 1), status: "pendente", pipeline: "sdr", closer: data.owner || actorName, auto: true,
    };
    const stageTasks = genAutoTasks(card, stage).map(t => ({
      id: t.id, lead_id: t.card_id, titulo: t.title, data_tarefa: t.due_date,
      status: "pendente", pipeline: t.pipe_context, closer: t.responsible, auto: true,
    }));
    await sbExt.from("tarefas").insert([firstTask, ...stageTasks]);

    return card;
  }, [actorName, genAutoTasks]);

  /* ── update card ── */
  const updateCard = useCallback(async (id: string, updates: Partial<PipelineCard>) => {
    const dbUpdates: any = {};
    if (updates.nome !== undefined) dbUpdates.nome = updates.nome;
    if (updates.telefone !== undefined) dbUpdates.telefone = updates.telefone;
    if (updates.origem !== undefined) dbUpdates.origem = updates.origem;
    if (updates.anotacoes !== undefined) dbUpdates.anotacoes = updates.anotacoes;
    if (updates.deal_value !== undefined) dbUpdates.valor_negocio = updates.deal_value;
    if (updates.owner !== undefined) dbUpdates.closer = updates.owner;
    if (updates.lead_status !== undefined) dbUpdates.status = updates.lead_status;
    if (updates.loss_reason !== undefined) dbUpdates.motivo_perda_detalhe = updates.loss_reason;
    if (updates.loss_category !== undefined) dbUpdates.motivo_perda = updates.loss_category;
    if (updates.last_stage !== undefined) dbUpdates.ultima_etapa = updates.last_stage;

    if (Object.keys(dbUpdates).length) {
      await sbExt.from("leads").update(dbUpdates).eq("id", id);
    }

    // optimistic
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c));
  }, []);

  /* ── move card ── */
  const moveCard = useCallback(async (cardId: string, targetStage: Stage) => {
    const card = cards.find(c => c.id === cardId);
    if (!card || card.stage === targetStage) return;
    const now = new Date().toISOString();
    const dur = Math.round((Date.now() - new Date(card.stage_changed_at).getTime()) / 86400000);

    // update DB
    await sbExt.from("leads").update({
      etapa_atual: stageToEtapa(targetStage),
      ultima_etapa: stageToEtapa(card.stage),
      data_ultima_mudanca_etapa: now,
    }).eq("id", cardId);

    // insert history
    await sbExt.from("lead_historico").insert({
      lead_id: cardId,
      etapa_de: stageToEtapa(card.stage),
      etapa_para: stageToEtapa(targetStage),
      evento: "mudança de etapa",
      closer: actorName,
    });

    // auto tasks
    const updated: PipelineCard = {
      ...card, stage: targetStage, pipe: STAGE_CONFIG[targetStage].pipe as PipeType,
      stage_changed_at: now, updated_at: now,
      history: [...card.history, { from: card.stage, to: targetStage, at: now, by: actorName, duration_days: dur }],
    };
    const newTasks = genAutoTasks(updated, targetStage);
    if (newTasks.length) {
      await sbExt.from("tarefas").insert(newTasks.map(t => ({
        id: t.id, lead_id: t.card_id, titulo: t.title, data_tarefa: t.due_date,
        status: "pendente", pipeline: t.pipe_context, closer: t.responsible, auto: true,
      })));
    }

    // optimistic
    setCards(prev => prev.map(c => c.id === cardId ? updated : c));
  }, [cards, actorName, genAutoTasks]);

  /* ── mark won/lost ── */
  const markWon = useCallback(async (id: string) => {
    await sbExt.from("leads").update({ status: "ganho" }).eq("id", id);
    setCards(prev => prev.map(c => c.id === id ? { ...c, lead_status: "ganho", updated_at: new Date().toISOString() } : c));
  }, []);

  const markLost = useCallback(async (id: string, category: string, reason: string) => {
    const card = cards.find(c => c.id === id);
    await sbExt.from("leads").update({
      status: "perdido",
      motivo_perda: category,
      motivo_perda_detalhe: reason || category,
      ultima_etapa: card ? stageToEtapa(card.stage) : null,
    }).eq("id", id);
    setCards(prev => prev.map(c => c.id === id ? {
      ...c, lead_status: "perdido", loss_category: category as any,
      loss_reason: reason || category, last_stage: card?.stage || null,
      updated_at: new Date().toISOString(),
    } : c));
  }, [cards]);

  /* ── tasks ── */
  const createTask = useCallback(async (task: Omit<PipelineTask, "id" | "created_at">) => {
    const id = crypto.randomUUID();
    await sbExt.from("tarefas").insert({
      id, lead_id: task.card_id, titulo: task.title, data_tarefa: task.due_date,
      status: task.status, pipeline: task.pipe_context, closer: task.responsible, auto: task.auto_generated,
    });
    setTasks(prev => [{ ...task, id, created_at: new Date().toISOString() }, ...prev]);
  }, []);

  const toggleTask = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newStatus = task.status === "pendente" ? "concluida" : "pendente";
    await sbExt.from("tarefas").update({ status: newStatus }).eq("id", id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
  }, [tasks]);

  const rescheduleTask = useCallback(async (id: string, date: string) => {
    await sbExt.from("tarefas").update({ data_tarefa: date }).eq("id", id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, due_date: date } : t));
  }, []);

  /* ── goals ── */
  const upsertGoal = useCallback(async (goal: PipelineGoal) => {
    await sbExt.from("metas").upsert({
      closer: goal.closer,
      mes: goal.month,
      meta_reunioes_marcadas: goal.reunioes_marcadas_meta,
      meta_reunioes_realizadas: goal.reunioes_realizadas_meta,
      meta_faturamento: goal.faturamento_meta,
      meta_conversao: goal.conversao_meta,
    }, { onConflict: "closer,mes" });

    setGoals(prev => {
      const idx = prev.findIndex(g => g.closer === goal.closer && g.month === goal.month);
      if (idx >= 0) { const n = [...prev]; n[idx] = goal; return n; }
      return [...prev, goal];
    });
  }, []);

  /* ── CSV import ── */
  const importCSV = useCallback(async (text: string) => {
    const lines = text.split("\n").map(l => l.split(",").map(c => c.trim().replace(/^"|"$/g, "")));
    if (lines.length < 2) return 0;
    const header = lines[0].map(h => h.toLowerCase());
    const ni = header.findIndex(h => h.includes("nome"));
    const ti = header.findIndex(h => h.includes("tel") || h.includes("phone"));
    const oi = header.findIndex(h => h.includes("source") || h.includes("origem"));
    const di = header.findIndex(h => h.includes("data") || h.includes("date"));
    if (ni < 0) return 0;

    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (!row[ni]) continue;
      rows.push({
        id: crypto.randomUUID(),
        nome: row[ni],
        telefone: ti >= 0 ? row[ti] : null,
        origem: oi >= 0 ? row[oi] : null,
        etapa_atual: "conectado",
        status: "aberto",
        closer: actorName,
        valor_negocio: DEFAULT_DEAL_VALUE,
        data_entrada: di >= 0 && row[di] ? new Date(row[di]).toISOString() : new Date().toISOString(),
        data_ultima_mudanca_etapa: new Date().toISOString(),
      });
    }

    if (rows.length) {
      const { error } = await sbExt.from("leads").insert(rows);
      if (error) console.error("CSV import error:", error);
    }
    return rows.length;
  }, [actorName]);

  const deleteCard = useCallback(async (id: string) => {
    await sbExt.from("leads").delete().eq("id", id);
    setCards(prev => prev.filter(c => c.id !== id));
    setTasks(prev => prev.filter(t => t.card_id !== id));
  }, []);

  return {
    cards, tasks, goals,
    createCard, updateCard, moveCard, markWon, markLost,
    createTask, toggleTask, rescheduleTask, upsertGoal, importCSV, deleteCard,
  };
}
