import { useState, useCallback, useEffect, useRef } from "react";
import type { PipelineCard, PipelineTask, PipelineGoal, Stage, PipeType, StageChange } from "./types";
import { DEFAULT_DEAL_VALUE, STAGE_CONFIG, AUTO_TASKS, addDays } from "./types";
import { sbExt as _sbExt } from "@/lib/supabaseExternal";
import { supabase } from "@/integrations/supabase/client";

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
    fez_contato: "Fez Contato",
    conectado: "Conectado",
    sql: "SQL",
    reuniao_marcada: "Reunião Marcada",
    reuniao_agendada: "Reunião Agendada",
    no_show: "No Show",
    reuniao_realizada: "Reunião Realizada",
    link_enviado: "Link Enviado",
    contrato_assinado: "Contrato Assinado",
  };
  return map[stage] || stage;
}

function isWeekendSP(dateStr: string): boolean {
  const d = new Date(dateStr);
  // Convert to São Paulo timezone and check day of week
  const spDate = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dow = spDate.getDay();
  return dow === 0 || dow === 6;
}

function dbRowToCard(row: any, history: StageChange[]): PipelineCard {
  const stage = mapEtapa(row.etapa_atual);
  const createdAt = row.data_entrada || row.created_at || new Date().toISOString();
  return {
    id: row.id,
    nome: row.nome || "",
    empresa: row.empresa || null,
    telefone: row.telefone || null,
    email: row.email || null,
    cnpj: row.cnpj || null,
    valor_divida: row.valor_divida != null ? Number(row.valor_divida) : null,
    pipe: STAGE_CONFIG[stage].pipe as PipeType,
    stage,
    origem: row.origem || null,
    anotacoes: row.anotacoes || null,
    contract_url: row.contract_url || null,
    created_at: createdAt,
    updated_at: row.data_ultima_mudanca_etapa || new Date().toISOString(),
    owner: row.closer || null,
    deal_value: row.valor_negocio || DEFAULT_DEAL_VALUE,
    lead_status: mapStatus(row.status),
    loss_reason: row.motivo_perda_detalhe || row.motivo_perda || null,
    loss_category: null,
    last_stage: row.ultima_etapa || null,
    stage_changed_at: row.data_ultima_mudanca_etapa || row.data_entrada || new Date().toISOString(),
    history,
    resumo_reuniao: row.resumo_reuniao || null,
    transcricao_reuniao: row.transcricao_reuniao || null,
    data_reuniao: row.data_reuniao || null,
    duracao_reuniao: row.duracao_reuniao || null,
    participantes_reuniao: row.participantes_reuniao || null,
    data_no_show: row.data_no_show || null,
    contrato_status: row.contrato_status || null,
    contrato_file_url: row.contrato_file_url || null,
    contrato_preparado_em: row.contrato_preparado_em || null,
    contrato_preparado_por: row.contrato_preparado_por || null,
    tipo_contrato: row.tipo_contrato || null,
    representante_nome: row.representante_nome || null,
    representante_cpf: row.representante_cpf || null,
    valor_mensalidade: row.valor_mensalidade != null ? Number(row.valor_mensalidade) : null,
    qtd_salarios_minimos: row.qtd_salarios_minimos || null,
    porcentagem_exito: row.porcentagem_exito || null,
    data_primeiro_pagamento: row.data_primeiro_pagamento || null,
    dia_demais_pagamentos: row.dia_demais_pagamentos || null,
    prazo_entrega_relatorios: row.prazo_entrega_relatorios != null ? Number(row.prazo_entrega_relatorios) : null,
    prazo_contrato: row.prazo_contrato || null,
    valor_proposta: row.valor_proposta != null ? Number(row.valor_proposta) : null,
    endereco: row.endereco || null,
    cidade: row.cidade || null,
    estado: row.estado || null,
    cep: row.cep || null,
    zapsign_signed_at: row.zapsign_signed_at || null,
    fim_de_semana: row.fim_de_semana === true || isWeekendSP(createdAt),
    tipo_documento: (row.tipo_documento === "cpf" || row.tipo_documento === "cnpj") ? row.tipo_documento : null,
    data_venda: row.data_venda || null,
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

type PipelineSnapshot = { cards: PipelineCard[]; tasks: PipelineTask[]; goals: PipelineGoal[]; loaded: boolean };
const pipelineDataCache: PipelineSnapshot & { inFlight: Promise<void> | null } = {
  cards: [],
  tasks: [],
  goals: [],
  loaded: false,
  inFlight: null,
};
const pipelineDataListeners = new Set<(snapshot: PipelineSnapshot) => void>();

function publishPipelineSnapshot(snapshot: PipelineSnapshot) {
  pipelineDataCache.cards = snapshot.cards;
  pipelineDataCache.tasks = snapshot.tasks;
  pipelineDataCache.goals = snapshot.goals;
  pipelineDataCache.loaded = snapshot.loaded;
  pipelineDataListeners.forEach((listener) => listener(snapshot));
}

/* ── main hook ── */
export function usePipelineData(actorName: string) {
  const [cards, setCards] = useState<PipelineCard[]>(() => pipelineDataCache.cards);
  const [tasks, setTasks] = useState<PipelineTask[]>(() => pipelineDataCache.tasks);
  const [goals, setGoals] = useState<PipelineGoal[]>(() => pipelineDataCache.goals);
  const [loaded, setLoaded] = useState(() => pipelineDataCache.loaded);
  const channelRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const legacyRef = useRef<{ cards: PipelineCard[]; tasks: PipelineTask[]; goals: PipelineGoal[] }>({
    cards: [],
    tasks: [],
    goals: [],
  });

  const fetchPipelineSnapshot = useCallback(async () => {
    if (pipelineDataCache.inFlight) return pipelineDataCache.inFlight;

    pipelineDataCache.inFlight = (async () => {
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
    const nextSnapshot = {
      cards: mergedCards,
      tasks: mergedTasks,
      goals: supaGoals.length ? supaGoals : legacyRef.current.goals,
      loaded: true,
    };

    publishPipelineSnapshot(nextSnapshot);
    })().finally(() => {
      pipelineDataCache.inFlight = null;
    });

    return pipelineDataCache.inFlight;
  }, []);

  /* ── initial fetch: merge localStorage legacy + Supabase ── */
  useEffect(() => {
    const listener = (snapshot: PipelineSnapshot) => {
      setCards(snapshot.cards);
      setTasks(snapshot.tasks);
      setGoals(snapshot.goals);
      setLoaded(snapshot.loaded);
    };
    pipelineDataListeners.add(listener);
    listener(pipelineDataCache);

    return () => {
      pipelineDataListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (pipelineDataCache.loaded || pipelineDataCache.inFlight) return;
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

    const debouncedFetch = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => { void fetchPipelineSnapshot(); }, 500);
    };

    const channel = sbExt
      .channel(`crm-realtime-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_historico" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "metas" }, debouncedFetch)
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          debouncedFetch();
        }
      });

    channelRef.current = channel;
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      sbExt.removeChannel(channel);
    };
  }, [loaded, fetchPipelineSnapshot]);

  /* ── fallback sync removido — atualização agora é manual via botão ── */

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

    // Duplicate detection by phone
    if (data.telefone) {
      const digits = data.telefone.replace(/\D/g, "");
      if (digits.length >= 8) {
        const existing = cards.find(c => c.telefone && c.telefone.replace(/\D/g, "").endsWith(digits.slice(-8)));
        if (existing) {
          // Log duplicate attempt in history
          try {
            await supabase.from("lead_history").insert({
              lead_id: existing.id, tipo: "campo",
              descricao: `Tentativa de criação duplicada (telefone: ${data.telefone}) por ${actorName}`,
              valor_anterior: null, valor_novo: data.nome, usuario_nome: actorName,
            } as any);
          } catch (e) { console.warn("Duplicate log error:", e); }
          // Return null to signal duplicate — caller can show warning
          return { duplicate: true, existingCard: existing } as any;
        }
      }
    }

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

    // insert legacy history
    await sbExt.from("lead_historico").insert({
      lead_id: id, etapa_de: null, etapa_para: stageToEtapa(stage), evento: "criado", closer: data.owner || actorName,
    });

    // insert structured history
    try {
      await supabase.from("lead_history").insert({
        lead_id: id, tipo: "criacao",
        descricao: `Lead criado${data.origem ? ` via ${data.origem}` : ""} por ${data.owner || actorName}`,
        valor_anterior: null, valor_novo: stageToEtapa(stage), usuario_nome: data.owner || actorName,
      } as any);
    } catch (e) { console.warn("lead_history insert error:", e); }

    // auto tasks
    const card: PipelineCard = {
      id, nome: data.nome, empresa: null, telefone: data.telefone || null, email: null, cnpj: null, valor_divida: null,
      pipe: STAGE_CONFIG[stage].pipe as PipeType, stage, origem: data.origem || null, anotacoes: data.anotacoes || null,
      contract_url: null, created_at: data.created_at || now, updated_at: now, owner: data.owner || actorName,
      deal_value: data.deal_value || DEFAULT_DEAL_VALUE, lead_status: "aberto", loss_reason: null, loss_category: null,
      last_stage: null, stage_changed_at: now,
      history: [{ from: null, to: stage, at: now, by: actorName, duration_days: null }],
      resumo_reuniao: null, transcricao_reuniao: null, data_reuniao: null, duracao_reuniao: null, participantes_reuniao: null,
      data_no_show: null,
      contrato_status: null, contrato_file_url: null, contrato_preparado_em: null, contrato_preparado_por: null,
      tipo_contrato: null, representante_nome: null, representante_cpf: null, valor_mensalidade: null,
      qtd_salarios_minimos: null, porcentagem_exito: null, data_primeiro_pagamento: null, dia_demais_pagamentos: null,
      prazo_entrega_relatorios: null, prazo_contrato: null, valor_proposta: null, endereco: null, cidade: null,
      estado: null, cep: null, zapsign_signed_at: null,
      fim_de_semana: isWeekendSP(data.created_at || now),
      tipo_documento: null,
      data_venda: null,
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

    // Auto-tag FS for weekend leads
    const createdDay = new Date(data.created_at || now).getDay();
    if (createdDay === 0 || createdDay === 6) {
      try {
        // Find or create "FS" label
        let { data: fsLabel } = await supabase.from("pipeline_labels").select("id").eq("name", "FS").single();
        if (!fsLabel) {
          const { data: newLabel } = await supabase.from("pipeline_labels").insert({ name: "FS", color: "#f59e0b" }).select("id").single();
          fsLabel = newLabel;
        }
        if (fsLabel) {
          await supabase.from("pipeline_card_labels").insert({ card_id: id, label_id: fsLabel.id });
        }
      } catch (e) {
        console.warn("Auto-tag FS error:", e);
      }
    }

    // Optimistic: add card to local state immediately
    setCards(prev => [card, ...prev]);

    return card;
  }, [actorName, genAutoTasks]);

  /* ── update card ── */
  const updateCard = useCallback(async (id: string, updates: Partial<PipelineCard>) => {
    const dbUpdates: any = {};
    if (updates.nome !== undefined) dbUpdates.nome = updates.nome;
    if (updates.empresa !== undefined) dbUpdates.empresa = updates.empresa;
    if (updates.telefone !== undefined) dbUpdates.telefone = updates.telefone;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.cnpj !== undefined) dbUpdates.cnpj = updates.cnpj;
    if (updates.valor_divida !== undefined) dbUpdates.valor_divida = updates.valor_divida;
    if (updates.origem !== undefined) dbUpdates.origem = updates.origem;
    if (updates.anotacoes !== undefined) dbUpdates.anotacoes = updates.anotacoes;
    if (updates.deal_value !== undefined) dbUpdates.valor_negocio = updates.deal_value;
    if (updates.owner !== undefined) dbUpdates.closer = updates.owner;
    if (updates.lead_status !== undefined) dbUpdates.status = updates.lead_status;
    if (updates.loss_reason !== undefined) dbUpdates.motivo_perda_detalhe = updates.loss_reason;
    if (updates.loss_category !== undefined) dbUpdates.motivo_perda = updates.loss_category;
    if (updates.last_stage !== undefined) dbUpdates.ultima_etapa = updates.last_stage;
    if (updates.contract_url !== undefined) dbUpdates.contract_url = updates.contract_url;
    if (updates.data_no_show !== undefined) dbUpdates.data_no_show = updates.data_no_show;
    // Contract fields
    if (updates.contrato_status !== undefined) dbUpdates.contrato_status = updates.contrato_status;
    if (updates.contrato_file_url !== undefined) dbUpdates.contrato_file_url = updates.contrato_file_url;
    if (updates.contrato_preparado_em !== undefined) dbUpdates.contrato_preparado_em = updates.contrato_preparado_em;
    if (updates.contrato_preparado_por !== undefined) dbUpdates.contrato_preparado_por = updates.contrato_preparado_por;
    if (updates.tipo_contrato !== undefined) dbUpdates.tipo_contrato = updates.tipo_contrato;
    if (updates.representante_nome !== undefined) dbUpdates.representante_nome = updates.representante_nome;
    if (updates.representante_cpf !== undefined) dbUpdates.representante_cpf = updates.representante_cpf;
    if (updates.valor_mensalidade !== undefined) dbUpdates.valor_mensalidade = updates.valor_mensalidade;
    if (updates.qtd_salarios_minimos !== undefined) dbUpdates.qtd_salarios_minimos = updates.qtd_salarios_minimos;
    if (updates.porcentagem_exito !== undefined) dbUpdates.porcentagem_exito = updates.porcentagem_exito;
    if (updates.data_primeiro_pagamento !== undefined) dbUpdates.data_primeiro_pagamento = updates.data_primeiro_pagamento;
    if (updates.dia_demais_pagamentos !== undefined) dbUpdates.dia_demais_pagamentos = updates.dia_demais_pagamentos;
    if (updates.prazo_entrega_relatorios !== undefined) dbUpdates.prazo_entrega_relatorios = updates.prazo_entrega_relatorios;
    if (updates.prazo_contrato !== undefined) dbUpdates.prazo_contrato = updates.prazo_contrato;
    if (updates.valor_proposta !== undefined) dbUpdates.valor_proposta = updates.valor_proposta;
    if (updates.endereco !== undefined) dbUpdates.endereco = updates.endereco;
    if (updates.cidade !== undefined) dbUpdates.cidade = updates.cidade;
    if (updates.estado !== undefined) dbUpdates.estado = updates.estado;
    if (updates.cep !== undefined) dbUpdates.cep = updates.cep;
    if (updates.data_venda !== undefined) dbUpdates.data_venda = updates.data_venda;

    if (Object.keys(dbUpdates).length) {
      const { error } = await sbExt.from("leads").update(dbUpdates).eq("id", id);
      if (error) console.error("Update lead error:", error);
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

    // insert legacy history
    await sbExt.from("lead_historico").insert({
      lead_id: cardId,
      etapa_de: stageToEtapa(card.stage),
      etapa_para: stageToEtapa(targetStage),
      evento: "mudança de etapa",
      closer: actorName,
    });

    // insert structured history
    try {
      const fromLabel = STAGE_CONFIG[card.stage]?.label || card.stage;
      const toLabel = STAGE_CONFIG[targetStage]?.label || targetStage;
      await supabase.from("lead_history").insert({
        lead_id: cardId,
        tipo: "etapa",
        descricao: `Lead movido de ${fromLabel} para ${toLabel} por ${actorName}`,
        valor_anterior: card.stage,
        valor_novo: targetStage,
        usuario_nome: actorName,
      } as any);
    } catch (e) { console.warn("lead_history insert error:", e); }

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
  const markWon = useCallback(async (id: string, dataVenda?: string | null) => {
    // dataVenda esperado em formato "YYYY-MM-DD" (date input). Converte para timestamp meio-dia local.
    const dataVendaIso = dataVenda
      ? new Date(`${dataVenda}T12:00:00`).toISOString()
      : new Date().toISOString();

    const update: any = { status: "ganho", data_venda: dataVendaIso };
    await sbExt.from("leads").update(update).eq("id", id);

    setCards(prev => prev.map(c => c.id === id ? {
      ...c,
      lead_status: "ganho",
      data_venda: dataVendaIso,
      updated_at: new Date().toISOString(),
    } : c));
    try {
      await supabase.from("lead_history").insert({
        lead_id: id, tipo: "etapa",
        descricao: `Lead marcado como ganho por ${actorName}${dataVenda ? ` (data da venda: ${dataVenda})` : ""}`,
        valor_anterior: "aberto", valor_novo: "ganho", usuario_nome: actorName,
      } as any);
    } catch (e) { console.warn("lead_history insert error:", e); }
  }, [actorName]);

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

  /* ── save observation as history entry ── */
  const saveObservation = useCallback(async (cardId: string, text: string) => {
    const now = new Date().toISOString();
    await sbExt.from("lead_historico").insert({
      lead_id: cardId,
      etapa_de: "__obs__",
      etapa_para: text,
      evento: "observação",
      closer: actorName,
    });

    // Optimistic update
    setCards(prev => prev.map(c => {
      if (c.id !== cardId) return c;
      return {
        ...c,
        history: [...c.history, { from: "__obs__", to: text, at: now, by: actorName, duration_days: null }],
      };
    }));
  }, [actorName]);

  return {
    cards, tasks, goals,
    createCard, updateCard, moveCard, markWon, markLost,
    createTask, toggleTask, rescheduleTask, upsertGoal, importCSV, deleteCard, saveObservation,
    refresh: fetchPipelineSnapshot,
  };
}
