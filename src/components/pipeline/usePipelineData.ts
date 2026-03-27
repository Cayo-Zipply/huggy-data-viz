import { useState, useCallback, useEffect } from "react";
import type { PipelineCard, PipelineTask, PipelineGoal, Stage, PipeType } from "./types";
import { DEFAULT_DEAL_VALUE, STAGE_CONFIG, AUTO_TASKS, addDays } from "./types";
import { supabase } from "@/integrations/supabase/client";

const K = { cards: "crm_cards", tasks: "crm_tasks", goals: "crm_goals", loaded: "crm_db_loaded" };
function load<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }

function mapDbStage(pipe: string, sdr_stage: string | null, closer_stage: string | null): Stage {
  if (pipe === "closer") {
    if (closer_stage === "reuniao_agendada") return "reuniao_agendada";
    if (closer_stage === "no_show") return "no_show";
    if (closer_stage === "reuniao_realizada") return "reuniao_realizada";
    if (closer_stage === "link_enviado") return "link_enviado";
    if (closer_stage === "contrato_assinado") return "contrato_assinado";
    return "reuniao_agendada";
  }
  if (sdr_stage === "lead" || sdr_stage === "conectado") return "conectado";
  if (sdr_stage === "sql") return "sql";
  if (sdr_stage === "reuniao_marcada") return "reuniao_marcada";
  return "conectado";
}

export function usePipelineData(activeUser: string) {
  const [cards, setCards] = useState<PipelineCard[]>(() => load(K.cards, []));
  const [tasks, setTasks] = useState<PipelineTask[]>(() => load(K.tasks, []));
  const [goals, setGoals] = useState<PipelineGoal[]>(() => load(K.goals, []));

  // Load from DB on first mount
  useEffect(() => {
    const alreadyLoaded = localStorage.getItem(K.loaded);
    if (alreadyLoaded) return;

    (async () => {
      const { data, error } = await supabase.from("pipeline_cards").select("*");
      if (error || !data || data.length === 0) return;

      const mapped: PipelineCard[] = data.map((row: any) => {
        const stage = mapDbStage(row.pipe, row.sdr_stage, row.closer_stage);
        const now = row.updated_at || new Date().toISOString();
        return {
          id: row.id,
          nome: row.nome,
          telefone: row.telefone || null,
          email: row.email || null,
          cnpj: row.cnpj || null,
          valor_divida: row.valor_divida || null,
          pipe: STAGE_CONFIG[stage].pipe as PipeType,
          stage,
          origem: row.origem || null,
          anotacoes: row.anotacoes || null,
          contract_url: row.contract_url || null,
          created_at: row.created_at,
          updated_at: now,
          owner: row.owner || null,
          deal_value: row.deal_value || DEFAULT_DEAL_VALUE,
          lead_status: (row.lead_status as any) || "aberto",
          loss_reason: row.loss_reason || null,
          loss_category: null,
          last_stage: row.last_stage || null,
          stage_changed_at: row.stage_changed_at || row.created_at,
          history: [{ from: null, to: stage, at: row.created_at, by: "sistema", duration_days: null }],
        };
      });

      setCards(mapped);
      localStorage.setItem(K.cards, JSON.stringify(mapped));
      localStorage.setItem(K.loaded, "true");
    })();
  }, []);

  useEffect(() => { localStorage.setItem(K.cards, JSON.stringify(cards)); }, [cards]);
  useEffect(() => { localStorage.setItem(K.tasks, JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem(K.goals, JSON.stringify(goals)); }, [goals]);

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

  const createCard = useCallback((data: Partial<PipelineCard> & { nome: string }) => {
    const now = new Date().toISOString();
    const stage = data.stage || "conectado";
    const card: PipelineCard = {
      id: crypto.randomUUID(),
      nome: data.nome,
      telefone: data.telefone || null,
      email: data.email || null,
      cnpj: data.cnpj || null,
      valor_divida: data.valor_divida || null,
      pipe: STAGE_CONFIG[stage].pipe as PipeType,
      stage,
      origem: data.origem || null,
      anotacoes: data.anotacoes || null,
      contract_url: null,
      created_at: data.created_at || now,
      updated_at: now,
      owner: data.owner || activeUser,
      deal_value: data.deal_value || DEFAULT_DEAL_VALUE,
      lead_status: "aberto",
      loss_reason: null,
      loss_category: null,
      last_stage: null,
      stage_changed_at: now,
      history: [{ from: null, to: stage, at: now, by: activeUser, duration_days: null }],
    };
    setCards(prev => [card, ...prev]);
    // Auto task: first contact
    const firstTask: PipelineTask = {
      id: crypto.randomUUID(), card_id: card.id,
      title: `Primeiro contato — ${card.nome}`,
      due_date: addDays(now, 1), responsible: card.owner,
      status: "pendente", pipe_context: "sdr", auto_generated: true, created_at: now,
    };
    const stageTasks = genAutoTasks(card, stage);
    setTasks(prev => [firstTask, ...stageTasks, ...prev]);
    return card;
  }, [activeUser, genAutoTasks]);

  const updateCard = useCallback((id: string, updates: Partial<PipelineCard>) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c));
  }, []);

  const moveCard = useCallback((cardId: string, targetStage: Stage) => {
    const card = cards.find(c => c.id === cardId);
    if (!card || card.stage === targetStage) return;
    const now = new Date().toISOString();
    const dur = Math.round((Date.now() - new Date(card.stage_changed_at).getTime()) / 86400000);
    const entry = { from: card.stage, to: targetStage, at: now, by: activeUser, duration_days: dur };
    const updated: PipelineCard = {
      ...card, stage: targetStage, pipe: STAGE_CONFIG[targetStage].pipe as PipeType,
      stage_changed_at: now, updated_at: now, history: [...card.history, entry],
    };
    setCards(prev => prev.map(c => c.id === cardId ? updated : c));
    const newTasks = genAutoTasks(updated, targetStage);
    if (newTasks.length) setTasks(prev => [...newTasks, ...prev]);
  }, [cards, activeUser, genAutoTasks]);

  const markWon = useCallback((id: string) => {
    updateCard(id, { lead_status: "ganho" });
  }, [updateCard]);

  const markLost = useCallback((id: string, category: string, reason: string) => {
    const card = cards.find(c => c.id === id);
    updateCard(id, {
      lead_status: "perdido",
      loss_category: category as any,
      loss_reason: reason || category,
      last_stage: card?.stage || null,
    });
  }, [cards, updateCard]);

  const createTask = useCallback((task: Omit<PipelineTask, "id" | "created_at">) => {
    setTasks(prev => [{ ...task, id: crypto.randomUUID(), created_at: new Date().toISOString() }, ...prev]);
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === "pendente" ? "concluida" : "pendente" } : t));
  }, []);

  const rescheduleTask = useCallback((id: string, date: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, due_date: date } : t));
  }, []);

  const upsertGoal = useCallback((goal: PipelineGoal) => {
    setGoals(prev => {
      const idx = prev.findIndex(g => g.closer === goal.closer && g.month === goal.month);
      if (idx >= 0) { const n = [...prev]; n[idx] = goal; return n; }
      return [...prev, goal];
    });
  }, []);

  const importCSV = useCallback((text: string) => {
    const lines = text.split("\n").map(l => l.split(",").map(c => c.trim().replace(/^"|"$/g, "")));
    if (lines.length < 2) return 0;
    const header = lines[0].map(h => h.toLowerCase());
    const ni = header.findIndex(h => h.includes("nome"));
    const ti = header.findIndex(h => h.includes("tel") || h.includes("phone"));
    const oi = header.findIndex(h => h.includes("source") || h.includes("origem"));
    const di = header.findIndex(h => h.includes("data") || h.includes("date"));
    if (ni < 0) return 0;
    let count = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (!row[ni]) continue;
      createCard({
        nome: row[ni],
        telefone: ti >= 0 ? row[ti] : null,
        origem: oi >= 0 ? row[oi] : null,
        created_at: di >= 0 && row[di] ? new Date(row[di]).toISOString() : undefined,
      });
      count++;
    }
    return count;
  }, [createCard]);

  return {
    cards, tasks, goals,
    createCard, updateCard, moveCard, markWon, markLost,
    createTask, toggleTask, rescheduleTask, upsertGoal, importCSV,
  };
}
