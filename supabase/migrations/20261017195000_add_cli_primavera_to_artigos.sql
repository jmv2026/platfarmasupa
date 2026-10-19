-- Adicionar coluna cli_primavera à tabela artigos
ALTER TABLE public.artigos ADD COLUMN IF NOT EXISTS cli_primavera text;
