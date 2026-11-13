-- Adiciona o campo info do tipo text à tabela clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS info text;

