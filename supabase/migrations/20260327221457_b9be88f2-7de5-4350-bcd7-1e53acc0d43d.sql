
-- Drop types if they were partially created
DROP TYPE IF EXISTS public.pipe_type CASCADE;
DROP TYPE IF EXISTS public.sdr_stage CASCADE;
DROP TYPE IF EXISTS public.closer_stage CASCADE;
DROP TABLE IF EXISTS public.pipeline_cards CASCADE;

-- Create enum for pipeline type
CREATE TYPE public.pipe_type AS ENUM ('sdr', 'closer');

-- Create enum for SDR stages
CREATE TYPE public.sdr_stage AS ENUM ('lead', 'conectado', 'sql', 'reuniao_marcada');

-- Create enum for Closer stages
CREATE TYPE public.closer_stage AS ENUM ('reuniao_agendada', 'no_show', 'reuniao_realizada', 'link_enviado', 'contrato_assinado');

-- Create pipeline cards table
CREATE TABLE public.pipeline_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  cnpj TEXT,
  valor_divida NUMERIC,
  pipe pipe_type NOT NULL DEFAULT 'sdr',
  sdr_stage sdr_stage DEFAULT 'lead',
  closer_stage closer_stage,
  origem TEXT,
  anotacoes TEXT,
  contract_url TEXT,
  sheet_row_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_cards ENABLE ROW LEVEL SECURITY;

-- Allow public access for webhook (no auth needed for Zapier)
CREATE POLICY "Allow public read" ON public.pipeline_cards FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.pipeline_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.pipeline_cards FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.pipeline_cards FOR DELETE USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_pipeline_cards_updated_at
  BEFORE UPDATE ON public.pipeline_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
