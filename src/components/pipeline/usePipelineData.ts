import { useState, useCallback, useEffect, useRef, type SetStateAction } from "react";
import { toast } from "sonner";
import type { PipelineCard, PipelineTask, PipelineGoal, Stage, PipeType, StageChange } from "./types";
import { DEFAULT_DEAL_VALUE, STAGE_CONFIG, AUTO_TASKS, addDays } from "./types";
import { supabase } from "@/lib/supabaseExternal";
import { notifySlackGanho } from "@/lib/notifySlackGanho";

const sbExt = supabase as any;

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
  // Item 4: normalizar variantes legadas ("Realizada", "realizou", etc.) para "Reunião Realizada"
  if (
    e === "reunião realizada" || e === "reuniao_realizada" || e === "reuniao realizada" ||
    e === "realizada" || e === "reunião feita" || e === "reuniao feita"
  ) return "reuniao_realizada";
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
    resumo_reuniao: row.resumo_reuniao ?? null,
    transcricao_reuniao: row.transcricao_reuniao ?? null,
    data_reuniao: row.data_reuniao || null,
    data_reuniao_realizada: row.data_reuniao_realizada || null,
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
    assistente_juridico: row.assistente_juridico || null,
    responsavel_juridico: row.responsavel_juridico || null,
    cnpjs_adicionais: Array.isArray(row.cnpjs_adicionais) ? row.cnpjs_adicionais : [],
    socios_adicionais: Array.isArray(row.socios_adicionais) ? row.socios_adicionais : [],
  } as any;
}

function dbRowToTask(row: any): PipelineTask {
  const rawTime = row.hora_tarefa ? String(row.hora_tarefa).slice(0, 5) : null;
  return {
    id: row.id,
    card_id: row.lead_id,
    title: row.titulo,
    due_date: row.data_tarefa,
    due_time: rawTime,
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
    vendas_meta: row.meta_vendas || 0,
    ticket_medio_meta: row.meta_ticket_medio || 0,
    contratos_meta: row.meta_contratos || 0,
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
let pipelineRealtimeChannel: any = null;
let pipelineRealtimeDebounce: ReturnType<typeof setTimeout> | null = null;

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
  const legacyRef = useRef<{ cards: PipelineCard[]; tasks: PipelineTask[]; goals: PipelineGoal[] }>({
    cards: [],
    tasks: [],
    goals: [],
  });

  const fetchPipelineSnapshot = useCallback(async () => {
    if (pipelineDataCache.inFlight) return pipelineDataCache.inFlight;

    pipelineDataCache.inFlight = (async () => {
    // Paginated fetch to bypass PostgREST's default 1000-row cap
    const PAGE_SIZE = 1000;
    // Colunas leves para listas/kanban. Pesadas (transcricao_reuniao,
    // resumo_reuniao) são carregadas SÓ no LeadDrawer via fetch por id.
    // Isso reduz drasticamente o I/O de disco no PostgREST.
    const LEADS_LIST_COLS = [
      "id","nome","empresa","telefone","email","cnpj","valor_divida",
      "etapa_atual","origem","anotacoes","contract_url",
      "data_entrada","created_at","data_ultima_mudanca_etapa",
      "closer","valor_negocio","status",
      "motivo_perda","motivo_perda_detalhe","ultima_etapa",
      "data_reuniao","data_reuniao_realizada","duracao_reuniao","participantes_reuniao",
      "data_no_show","contrato_status","contrato_file_url",
      "contrato_preparado_em","contrato_preparado_por","tipo_contrato",
      "representante_nome","representante_cpf",
      "valor_mensalidade","qtd_salarios_minimos","porcentagem_exito",
      "data_primeiro_pagamento","dia_demais_pagamentos","prazo_entrega_relatorios",
      "prazo_contrato","valor_proposta",
      "endereco","cidade","estado","cep","zapsign_signed_at","fim_de_semana",
      "tipo_documento","data_venda","assistente_juridico","responsavel_juridico",
      "cnpjs_adicionais","socios_adicionais",
    ].join(",");
    const HIST_COLS = "lead_id,etapa_de,etapa_para,created_at,closer";

    async function fetchAll(table: string, cols: string, orderCol?: string) {
      const all: any[] = [];
      let from = 0;
      while (from < 100000) {
        let q = sbExt.from(table).select(cols).range(from, from + PAGE_SIZE - 1);
        if (orderCol) q = q.order(orderCol, { ascending: true });
        const { data, error } = await q;
        if (error) return { data: null, error };
        const rows = data || [];
        all.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return { data: all, error: null };
    }

    const [leadsRes, tasksRes, goalsRes, histRes] = await Promise.all([
      fetchAll("leads", LEADS_LIST_COLS),
      fetchAll("tarefas", "*"),
      sbExt.from("metas").select("*"),
      fetchAll("lead_historico", HIST_COLS, "created_at"),
    ]);

    // Log errors but DO NOT bail out — partial data is better than empty UI.
    // Previously, a single failing table (e.g. lead_historico under RLS for a
    // closer user) blanked the entire pipeline for that user.
    if (leadsRes.error || tasksRes.error || goalsRes.error || histRes.error) {
      console.warn("Pipeline snapshot — algumas tabelas falharam:", {
        leads: leadsRes.error?.message,
        tasks: tasksRes.error?.message,
        goals: goalsRes.error?.message,
        history: histRes.error?.message,
      });
    }
    // If the critical table (leads) failed entirely, keep cache untouched.
    if (leadsRes.error && !leadsRes.data) {
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

  const updateCardsState = useCallback((updater: SetStateAction<PipelineCard[]>) => {
    const next = typeof updater === "function" ? (updater as (value: PipelineCard[]) => PipelineCard[])(pipelineDataCache.cards) : updater;
    publishPipelineSnapshot({ cards: next, tasks: pipelineDataCache.tasks, goals: pipelineDataCache.goals, loaded: true });
  }, []);

  const updateTasksState = useCallback((updater: SetStateAction<PipelineTask[]>) => {
    const next = typeof updater === "function" ? (updater as (value: PipelineTask[]) => PipelineTask[])(pipelineDataCache.tasks) : updater;
    publishPipelineSnapshot({ cards: pipelineDataCache.cards, tasks: next, goals: pipelineDataCache.goals, loaded: true });
  }, []);

  const updateGoalsState = useCallback((updater: SetStateAction<PipelineGoal[]>) => {
    const next = typeof updater === "function" ? (updater as (value: PipelineGoal[]) => PipelineGoal[])(pipelineDataCache.goals) : updater;
    publishPipelineSnapshot({ cards: pipelineDataCache.cards, tasks: pipelineDataCache.tasks, goals: next, loaded: true });
  }, []);

  /* ── realtime subscription ── */
  useEffect(() => {
    if (!loaded || pipelineRealtimeChannel) return;

    const debouncedFetch = () => {
      if (pipelineRealtimeDebounce) clearTimeout(pipelineRealtimeDebounce);
      pipelineRealtimeDebounce = setTimeout(() => { void fetchPipelineSnapshot(); }, 500);
    };

    const channel = sbExt
      .channel(`crm-realtime-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_historico" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "metas" }, debouncedFetch)
      .subscribe();

    channelRef.current = channel;
    pipelineRealtimeChannel = channel;
    return () => {
      channelRef.current = null;
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
      due_time: null,
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
    if (error) {
      // Item 5: tratar 23505 (unique_violation) com mensagem amigável
      if ((error as any).code === "23505" || /duplicate|unique/i.test(error.message || "")) {
        toast.error("Lead duplicado: já existe um card aberto com este telefone neste pipe.");
        return { duplicate: true } as any;
      }
      console.error("Insert lead error:", error);
      toast.error(`Erro ao criar lead: ${error.message || "desconhecido"}`);
      return null;
    }


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
      resumo_reuniao: null, transcricao_reuniao: null, data_reuniao: null, data_reuniao_realizada: null, duracao_reuniao: null, participantes_reuniao: null,
      data_no_show: null,
      contrato_status: null, contrato_file_url: null, contrato_preparado_em: null, contrato_preparado_por: null,
      tipo_contrato: null, representante_nome: null, representante_cpf: null, valor_mensalidade: null,
      qtd_salarios_minimos: null, porcentagem_exito: null, data_primeiro_pagamento: null, dia_demais_pagamentos: null,
      prazo_entrega_relatorios: null, prazo_contrato: null, valor_proposta: null, endereco: null, cidade: null,
      estado: null, cep: null, zapsign_signed_at: null,
      fim_de_semana: isWeekendSP(data.created_at || now),
      tipo_documento: null,
      data_venda: null,
      assistente_juridico: null,
      responsavel_juridico: null,
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
    updateCardsState(prev => [card, ...prev]);

    return card;
  }, [actorName, genAutoTasks, updateCardsState]);

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
    if ((updates as any).data_reuniao_realizada !== undefined) dbUpdates.data_reuniao_realizada = (updates as any).data_reuniao_realizada;
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
    if (updates.assistente_juridico !== undefined) dbUpdates.assistente_juridico = updates.assistente_juridico;
    if (updates.responsavel_juridico !== undefined) dbUpdates.responsavel_juridico = updates.responsavel_juridico;
    if ((updates as any).cnpjs_adicionais !== undefined) dbUpdates.cnpjs_adicionais = (updates as any).cnpjs_adicionais;
    if ((updates as any).socios_adicionais !== undefined) dbUpdates.socios_adicionais = (updates as any).socios_adicionais;


    if (Object.keys(dbUpdates).length) {
      const { error } = await sbExt.from("leads").update(dbUpdates).eq("id", id);
      if (error) console.error("Update lead error:", error);
    }

    // optimistic
    updateCardsState(prev => prev.map(c => c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c));
  }, [updateCardsState]);

  /* ── move card ── */
  const moveCard = useCallback(async (cardId: string, targetStage: Stage) => {
    const card = cards.find(c => c.id === cardId);
    if (!card || card.stage === targetStage) return;

    // Item 6: ao mover SDR → "Reunião Marcada" exigir dados mínimos antes do
    // handoff para o pipe do Closer (que criará "Reunião Agendada").
    if (targetStage === "reuniao_marcada" && card.pipe === "sdr") {
      const faltando: string[] = [];
      if (!card.cnpj && !(card as any).cpf && !(card.tipo_documento)) faltando.push("CNPJ ou CPF");
      if (!card.nome || !card.nome.trim()) faltando.push("Nome");
      if (!(card as any).empresa) faltando.push("Nome da empresa");
      if (!card.owner) faltando.push("Closer responsável");
      if (!card.email) faltando.push("E-mail");
      if (card.valor_divida == null || Number(card.valor_divida) <= 0) faltando.push("Valor da dívida");
      if (faltando.length) {
        toast.error(`Não é possível marcar reunião. Faltando: ${faltando.join(", ")}.`);
        return;
      }
    }

    const now = new Date().toISOString();

    const dur = Math.round((Date.now() - new Date(card.stage_changed_at).getTime()) / 86400000);

    // Auto-preencher data_reuniao_realizada ao entrar na etapa (sem sobrescrever)
    const autoDataReuniaoRealizada =
      targetStage === "reuniao_realizada" && !card.data_reuniao_realizada ? now : null;

    // update DB
    const moveUpdate: any = {
      etapa_atual: stageToEtapa(targetStage),
      ultima_etapa: stageToEtapa(card.stage),
      data_ultima_mudanca_etapa: now,
    };
    if (autoDataReuniaoRealizada) moveUpdate.data_reuniao_realizada = autoDataReuniaoRealizada;
    await sbExt.from("leads").update(moveUpdate).eq("id", cardId);

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
      data_reuniao_realizada: autoDataReuniaoRealizada || card.data_reuniao_realizada,
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
    updateCardsState(prev => prev.map(c => c.id === cardId ? updated : c));

    // Handoff automático SDR → Closer: ao chegar em "Reunião Marcada"
    // o lead também avança para "Reunião Agendada" no pipe do Closer.
    if (targetStage === "reuniao_marcada") {
      const handoffStage: Stage = "reuniao_agendada";
      const now2 = new Date().toISOString();
      await sbExt.from("leads").update({
        etapa_atual: stageToEtapa(handoffStage),
        ultima_etapa: stageToEtapa(targetStage),
        data_ultima_mudanca_etapa: now2,
      }).eq("id", cardId);
      await sbExt.from("lead_historico").insert({
        lead_id: cardId,
        etapa_de: stageToEtapa(targetStage),
        etapa_para: stageToEtapa(handoffStage),
        evento: "handoff automático SDR → Closer",
        closer: actorName,
      });
      try {
        await supabase.from("lead_history").insert({
          lead_id: cardId, tipo: "etapa",
          descricao: `Handoff automático: ${STAGE_CONFIG[targetStage].label} → ${STAGE_CONFIG[handoffStage].label}`,
          valor_anterior: targetStage, valor_novo: handoffStage, usuario_nome: actorName,
        } as any);
      } catch (e) { console.warn("lead_history insert error:", e); }
      const handoffCard: PipelineCard = {
        ...updated, stage: handoffStage, pipe: STAGE_CONFIG[handoffStage].pipe as PipeType,
        stage_changed_at: now2, updated_at: now2,
        history: [...updated.history, { from: targetStage, to: handoffStage, at: now2, by: actorName, duration_days: 0 }],
      };
      const handoffTasks = genAutoTasks(handoffCard, handoffStage);
      if (handoffTasks.length) {
        await sbExt.from("tarefas").insert(handoffTasks.map(t => ({
          id: t.id, lead_id: t.card_id, titulo: t.title, data_tarefa: t.due_date,
          status: "pendente", pipeline: t.pipe_context, closer: t.responsible, auto: true,
        })));
      }
      updateCardsState(prev => prev.map(c => c.id === cardId ? handoffCard : c));
    }
  }, [cards, actorName, genAutoTasks, updateCardsState]);

  /* ── mark won/lost ── */
  const markWon = useCallback(async (id: string, dataVenda?: string | null) => {
    // dataVenda esperado em formato "YYYY-MM-DD" (date input). Converte para timestamp meio-dia local.
    const dataVendaIso = dataVenda
      ? new Date(`${dataVenda}T12:00:00`).toISOString()
      : new Date().toISOString();

    // Garante que o lead passe por "Reunião Realizada" e termine em "Contrato Assinado"
    // (todo ganho conta como reunião realizada e fica na coluna correta).
    const card = cards.find(c => c.id === id);
    if (card) {
      const reachedRealizada =
        ["reuniao_realizada", "link_enviado", "contrato_assinado"].includes(card.stage) ||
        (card.history || []).some(h => h.to === "reuniao_realizada");
      if (!reachedRealizada && card.stage !== "contrato_assinado") {
        await moveCard(id, "reuniao_realizada" as Stage);
      }
      if (card.stage !== "contrato_assinado") {
        await moveCard(id, "contrato_assinado" as Stage);
      }
    }

    const update: any = { status: "ganho", data_venda: dataVendaIso };
    await sbExt.from("leads").update(update).eq("id", id);

    updateCardsState(prev => prev.map(c => c.id === id ? {
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
    // Aviso no Slack #closer (idempotente; só envia se já houver contrato PDF anexado)
    notifySlackGanho(id);
  }, [cards, actorName, moveCard, updateCardsState]);

  const markLost = useCallback(async (id: string, category: string, reason: string) => {
    const card = cards.find(c => c.id === id);
    await sbExt.from("leads").update({
      status: "perdido",
      motivo_perda: category,
      motivo_perda_detalhe: reason || category,
      ultima_etapa: card ? stageToEtapa(card.stage) : null,
    }).eq("id", id);
    updateCardsState(prev => prev.map(c => c.id === id ? {
      ...c, lead_status: "perdido", loss_category: category as any,
      loss_reason: reason || category, last_stage: card?.stage || null,
      updated_at: new Date().toISOString(),
    } : c));
  }, [cards, updateCardsState]);

  /* ── tasks ── */
  const createTask = useCallback(async (task: Omit<PipelineTask, "id" | "created_at">) => {
    const id = crypto.randomUUID();
    const hora = task.due_time ? task.due_time.slice(0, 5) : null;
    await sbExt.from("tarefas").insert({
      id, lead_id: task.card_id, titulo: task.title, data_tarefa: task.due_date,
      hora_tarefa: hora,
      status: task.status, pipeline: task.pipe_context, closer: task.responsible, auto: task.auto_generated,
    });
    updateTasksState(prev => [{ ...task, id, due_time: hora, created_at: new Date().toISOString() }, ...prev]);
  }, [updateTasksState]);

  const toggleTask = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newStatus = task.status === "pendente" ? "concluida" : "pendente";
    await sbExt.from("tarefas").update({ status: newStatus }).eq("id", id);
    updateTasksState(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
  }, [tasks, updateTasksState]);

  const rescheduleTask = useCallback(async (id: string, date: string, time?: string | null) => {
    const patch: Record<string, any> = { data_tarefa: date, lembrete_enviado: false };
    if (time !== undefined) patch.hora_tarefa = time ? time.slice(0, 5) : null;
    await sbExt.from("tarefas").update(patch).eq("id", id);
    updateTasksState(prev => prev.map(t => t.id === id ? { ...t, due_date: date, ...(time !== undefined ? { due_time: time ? time.slice(0, 5) : null } : {}) } : t));
  }, [updateTasksState]);

  const deleteTask = useCallback(async (id: string) => {
    await sbExt.from("tarefas").delete().eq("id", id);
    updateTasksState(prev => prev.filter(t => t.id !== id));
  }, [updateTasksState]);

  const deleteTasks = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    await sbExt.from("tarefas").delete().in("id", ids);
    const set = new Set(ids);
    updateTasksState(prev => prev.filter(t => !set.has(t.id)));
  }, [updateTasksState]);

  /* ── goals ── */
  const upsertGoal = useCallback(async (goal: PipelineGoal) => {
    const firstNorm = (s: string) =>
      (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().split(/\s+/)[0] || "";
    const targetFirst = firstNorm(goal.closer);

    // Remove linhas antigas para o mesmo mês cujo primeiro nome bate com o
    // closer oficial mas tem grafia diferente (ex.: "Fillipe Amorim Oliveira
    // Silva" vs. "Fillipe"). Evita duplicar e migra para o nome oficial curto.
    if (targetFirst) {
      const { data: existing } = await sbExt
        .from("metas")
        .select("closer")
        .eq("mes", goal.month);
      const stale = (existing || [])
        .map((r: any) => r.closer as string)
        .filter((c) => c && c !== goal.closer && firstNorm(c) === targetFirst);
      if (stale.length) {
        await sbExt.from("metas").delete().eq("mes", goal.month).in("closer", stale);
      }
    }

    await sbExt.from("metas").upsert({
      closer: goal.closer,
      mes: goal.month,
      meta_reunioes_marcadas: goal.reunioes_marcadas_meta,
      meta_reunioes_realizadas: goal.reunioes_realizadas_meta,
      meta_faturamento: goal.faturamento_meta,
      meta_conversao: goal.conversao_meta,
      meta_vendas: goal.vendas_meta ?? 0,
      meta_ticket_medio: goal.ticket_medio_meta ?? 0,
      meta_contratos: goal.contratos_meta ?? 0,
    }, { onConflict: "closer,mes" });

    updateGoalsState(prev => {
      const filtered = prev.filter(g => !(g.month === goal.month && firstNorm(g.closer) === targetFirst && g.closer !== goal.closer));
      const idx = filtered.findIndex(g => g.closer === goal.closer && g.month === goal.month);
      if (idx >= 0) { const n = [...filtered]; n[idx] = goal; return n; }
      return [...filtered, goal];
    });
  }, [updateGoalsState]);


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
    const { error, count } = await sbExt
      .from("leads")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) {
      console.error("[deleteCard] supabase error:", error);
      toast.error(`Erro ao excluir: ${error.message || error.code || "desconhecido"}`);
      return;
    }
    if (count === 0) {
      console.warn("[deleteCard] nenhuma linha removida (RLS ou id inexistente)");
      toast.error("Nada foi removido. Verifique permissões (RLS) ou se o lead ainda existe.");
      return;
    }
    const nextCards = pipelineDataCache.cards.filter(c => c.id !== id);
    const nextTasks = pipelineDataCache.tasks.filter(t => t.card_id !== id);
    publishPipelineSnapshot({ cards: nextCards, tasks: nextTasks, goals: pipelineDataCache.goals, loaded: true });
    toast.success("Lead excluído.");
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
    updateCardsState(prev => prev.map(c => {
      if (c.id !== cardId) return c;
      return {
        ...c,
        history: [...c.history, { from: "__obs__", to: text, at: now, by: actorName, duration_days: null }],
      };
    }));
  }, [actorName, updateCardsState]);

  return {
    cards, tasks, goals,
    createCard, updateCard, moveCard, markWon, markLost,
    createTask, toggleTask, rescheduleTask, deleteTask, deleteTasks, upsertGoal, importCSV, deleteCard, saveObservation,
    refresh: fetchPipelineSnapshot,
  };
}
