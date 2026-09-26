-- ==============================================================================
-- ADIÇÃO DO CAMPO cli_primavera À TABELA public.clients
-- ==============================================================================
-- Descrição: Cria o campo cli_primavera (TEXT) para associar o código do cliente
--            no software de faturação / ERP Primavera.
-- ==============================================================================

-- 1. Adicionar a coluna cli_primavera
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS cli_primavera TEXT;

-- 2. Adicionar comentário descritivo na coluna
COMMENT ON COLUMN public.clients.cli_primavera IS 'Código do cliente no software de faturação / ERP Primavera';
