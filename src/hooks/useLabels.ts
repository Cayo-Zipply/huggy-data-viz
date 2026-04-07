import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PipelineLabel {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface CardLabel {
  card_id: string;
  label_id: string;
}

export function useLabels() {
  const [labels, setLabels] = useState<PipelineLabel[]>([]);
  const [cardLabels, setCardLabels] = useState<CardLabel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLabels = useCallback(async () => {
    const [labelsRes, cardLabelsRes] = await Promise.all([
      supabase.from("pipeline_labels").select("*").order("name"),
      supabase.from("pipeline_card_labels").select("card_id, label_id"),
    ]);

    if (labelsRes.data) setLabels(labelsRes.data as PipelineLabel[]);
    if (cardLabelsRes.data) setCardLabels(cardLabelsRes.data as CardLabel[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const createLabel = useCallback(async (name: string, color: string) => {
    const { data, error } = await supabase.from("pipeline_labels").insert({ name, color }).select().single();
    if (!error && data) {
      setLabels(prev => [...prev, data as PipelineLabel]);
    }
    return { data, error };
  }, []);

  const deleteLabel = useCallback(async (id: string) => {
    await supabase.from("pipeline_labels").delete().eq("id", id);
    setLabels(prev => prev.filter(l => l.id !== id));
    setCardLabels(prev => prev.filter(cl => cl.label_id !== id));
  }, []);

  const updateLabel = useCallback(async (id: string, name: string, color: string) => {
    await supabase.from("pipeline_labels").update({ name, color }).eq("id", id);
    setLabels(prev => prev.map(l => l.id === id ? { ...l, name, color } : l));
  }, []);

  const addLabelToCard = useCallback(async (cardId: string, labelId: string) => {
    const exists = cardLabels.some(cl => cl.card_id === cardId && cl.label_id === labelId);
    if (exists) return;
    await supabase.from("pipeline_card_labels").insert({ card_id: cardId, label_id: labelId });
    setCardLabels(prev => [...prev, { card_id: cardId, label_id: labelId }]);
  }, [cardLabels]);

  const removeLabelFromCard = useCallback(async (cardId: string, labelId: string) => {
    await supabase.from("pipeline_card_labels").delete().eq("card_id", cardId).eq("label_id", labelId);
    setCardLabels(prev => prev.filter(cl => !(cl.card_id === cardId && cl.label_id === labelId)));
  }, []);

  const getCardLabels = useCallback((cardId: string) => {
    const ids = cardLabels.filter(cl => cl.card_id === cardId).map(cl => cl.label_id);
    return labels.filter(l => ids.includes(l.id));
  }, [cardLabels, labels]);

  return { labels, cardLabels, loading, createLabel, deleteLabel, updateLabel, addLabelToCard, removeLabelFromCard, getCardLabels, refetch: fetchLabels };
}
