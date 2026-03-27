
ALTER TABLE pipeline_cards ADD COLUMN IF NOT EXISTS owner text;
ALTER TABLE pipeline_cards ADD COLUMN IF NOT EXISTS deal_value numeric DEFAULT 1621;
ALTER TABLE pipeline_cards ADD COLUMN IF NOT EXISTS lead_status text DEFAULT 'aberto';
ALTER TABLE pipeline_cards ADD COLUMN IF NOT EXISTS loss_reason text;
ALTER TABLE pipeline_cards ADD COLUMN IF NOT EXISTS last_stage text;
ALTER TABLE pipeline_cards ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz DEFAULT now();

UPDATE pipeline_cards SET deal_value = 1621 WHERE deal_value IS NULL;
UPDATE pipeline_cards SET lead_status = 'aberto' WHERE lead_status IS NULL;
UPDATE pipeline_cards SET stage_changed_at = COALESCE(updated_at, created_at) WHERE stage_changed_at IS NULL;

CREATE TABLE IF NOT EXISTS pipeline_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES pipeline_cards(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  responsible text,
  status text DEFAULT 'pendente',
  pipe_context text DEFAULT 'sdr',
  auto_generated boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pipeline_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer text NOT NULL,
  month text NOT NULL,
  reunioes_marcadas_meta integer DEFAULT 0,
  reunioes_realizadas_meta integer DEFAULT 0,
  faturamento_meta numeric DEFAULT 0,
  conversao_meta numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(closer, month)
);

ALTER TABLE pipeline_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_access_tasks" ON pipeline_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_access_goals" ON pipeline_goals FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_tasks;
