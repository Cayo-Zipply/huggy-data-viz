import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { PipelineCard, PipelineTask, PipelineGoal, SdrStage, CloserStage, PipeType } from "./types";
import { DEFAULT_DEAL_VALUE, SDR_STAGES, CLOSER_STAGES } from "./types";

const db = supabase as any;

export function usePipelineData() {
  const [cards, setCards] = useState<PipelineCard[]>([]);
  const [tasks, setTasks] = useState<PipelineTask[]>([]);
  const [goals, setGoals] = useState<PipelineGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [cr, tr, gr] = await Promise.all([
      db.from("pipeline_cards").select("*").order("created_at", { ascending: false }),
      db.from("pipeline_tasks").select("*").order("due_date", { ascending: true }),
      db.from("pipeline_goals").select("*"),
    ]);
    if (cr.data) setCards(cr.data.map((d: any) => ({
      ...d,
      deal_value: d.deal_value ?? DEFAULT_DEAL_VALUE,
      lead_status: d.lead_status ?? "aberto",
    })));
    if (tr.data) setTasks(tr.data);
    if (gr.data) setGoals(gr.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const ch1 = supabase.channel("crm-cards")
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_cards" }, () => fetchAll())
      .subscribe();
    const ch2 = supabase.channel("crm-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_tasks" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [fetchAll]);

  const updateCard = useCallback(async (updates: Partial<PipelineCard> & { id: string }) => {
    const { id, ...rest } = updates;
    const { error } = await db.from("pipeline_cards").update(rest).eq("id", id);
    if (error) toast({ title: "Erro ao atualizar", variant: "destructive" });
    else setCards(prev => prev.map(c => c.id === id ? { ...c, ...rest } : c));
  }, [toast]);

  const moveCard = useCallback(async (cardId: string, targetStage: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const sdrKeys = SDR_STAGES.map(s => s.key) as string[];
    const closerKeys = CLOSER_STAGES.map(s => s.key) as string[];
    const now = new Date().toISOString();

    let update: any = { stage_changed_at: now, updated_at: now };
    let newPipe: PipeType = card.pipe;
    let stageLabel = "";

    if (sdrKeys.includes(targetStage)) {
      update = { ...update, pipe: "sdr", sdr_stage: targetStage, closer_stage: null };
      newPipe = "sdr";
      stageLabel = SDR_STAGES.find(s => s.key === targetStage)?.label || targetStage;
    } else if (closerKeys.includes(targetStage)) {
      update = { ...update, pipe: "closer", sdr_stage: null, closer_stage: targetStage };
      newPipe = "closer";
      stageLabel = CLOSER_STAGES.find(s => s.key === targetStage)?.label || targetStage;
    }

    setCards(prev => prev.map(c => c.id === cardId ? { ...c, ...update } : c));
    const { error } = await db.from("pipeline_cards").update(update).eq("id", cardId);
    if (error) { toast({ title: "Erro ao mover", variant: "destructive" }); fetchAll(); return; }

    // Auto task
    await db.from("pipeline_tasks").insert({
      card_id: cardId,
      title: `Follow-up ${stageLabel} — ${card.nome}`,
      due_date: now.split("T")[0],
      responsible: card.owner,
      pipe_context: newPipe,
      auto_generated: true,
    });
  }, [cards, toast, fetchAll]);

  const markWon = useCallback(async (cardId: string) => {
    await updateCard({ id: cardId, lead_status: "ganho" } as any);
  }, [updateCard]);

  const markLost = useCallback(async (cardId: string, reason: string) => {
    const card = cards.find(c => c.id === cardId);
    const lastStage = card ? (card.pipe === "sdr" ? card.sdr_stage : card.closer_stage) : null;
    await db.from("pipeline_cards").update({
      lead_status: "perdido",
      loss_reason: reason,
      last_stage: lastStage,
    }).eq("id", cardId);
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, lead_status: "perdido" as const, loss_reason: reason, last_stage: lastStage } : c));
  }, [cards]);

  const createTask = useCallback(async (task: Omit<PipelineTask, "id" | "created_at">) => {
    const { error } = await db.from("pipeline_tasks").insert(task);
    if (error) toast({ title: "Erro ao criar tarefa", variant: "destructive" });
  }, [toast]);

  const updateTaskStatus = useCallback(async (taskId: string, status: string) => {
    await db.from("pipeline_tasks").update({ status }).eq("id", taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: status as any } : t));
  }, []);

  const updateTaskDate = useCallback(async (taskId: string, due_date: string) => {
    await db.from("pipeline_tasks").update({ due_date }).eq("id", taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date } : t));
  }, []);

  const upsertGoal = useCallback(async (goal: Omit<PipelineGoal, "id">) => {
    const { error } = await db.from("pipeline_goals").upsert(goal, { onConflict: "closer,month" });
    if (error) toast({ title: "Erro ao salvar meta", variant: "destructive" });
    else fetchAll();
  }, [toast, fetchAll]);

  const uploadContract = useCallback(async (card: PipelineCard, file: File) => {
    const path = `${card.id}/${file.name}`;
    const { error: ue } = await supabase.storage.from("contracts").upload(path, file, { upsert: true });
    if (ue) { toast({ title: "Erro ao enviar", variant: "destructive" }); return; }
    const { data } = supabase.storage.from("contracts").getPublicUrl(path);
    await updateCard({ id: card.id, contract_url: data.publicUrl } as any);
    toast({ title: "Contrato anexado!" });
  }, [toast, updateCard]);

  return { cards, tasks, goals, loading, fetchAll, updateCard, moveCard, markWon, markLost, createTask, updateTaskStatus, updateTaskDate, upsertGoal, uploadContract };
}
