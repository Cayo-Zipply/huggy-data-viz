
-- Table: SLA rules per pipeline stage
CREATE TABLE IF NOT EXISTS public.pipeline_sla_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etapa TEXT NOT NULL UNIQUE,
  sla_horas INTEGER NOT NULL DEFAULT 24,
  alerta_para TEXT[] DEFAULT '{"responsavel"}',
  acao_ao_estourar TEXT DEFAULT 'destacar',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pipeline_sla_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access sla_rules" ON public.pipeline_sla_rules FOR ALL TO public USING (true) WITH CHECK (true);

-- Table: Loss reasons
CREATE TABLE IF NOT EXISTS public.motivos_perda (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Outros',
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.motivos_perda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access motivos_perda" ON public.motivos_perda FOR ALL TO public USING (true) WITH CHECK (true);

-- Table: Lead history (structured log)
CREATE TABLE IF NOT EXISTS public.lead_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  usuario_nome TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lead_history_lead_id ON public.lead_history(lead_id);

ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access lead_history" ON public.lead_history FOR ALL TO public USING (true) WITH CHECK (true);

-- Add loss reason fields to pipeline_cards
ALTER TABLE public.pipeline_cards ADD COLUMN IF NOT EXISTS motivo_perda_id UUID;
ALTER TABLE public.pipeline_cards ADD COLUMN IF NOT EXISTS observacao_perda TEXT;
ALTER TABLE public.pipeline_cards ADD COLUMN IF NOT EXISTS data_perda TIMESTAMPTZ;
