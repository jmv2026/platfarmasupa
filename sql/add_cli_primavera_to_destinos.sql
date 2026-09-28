-- ==============================================================================
-- ADIÇÃO DO CAMPO cli_primavera À TABELA public.destinos
-- ==============================================================================
-- Descrição: Cria o campo cli_primavera (TEXT) para associar o código da entidade
--            ou cliente de destino no ERP / software de faturação Primavera.
-- ==============================================================================

-- 1. Adicionar a coluna cli_primavera
ALTER TABLE public.destinos 
ADD COLUMN IF NOT EXISTS cli_primavera TEXT;

-- 2. Adicionar comentário descritivo na coluna
COMMENT ON COLUMN public.destinos.cli_primavera IS 'Código da entidade/cliente de destino no ERP Primavera';

-- 3. Criar índice para pesquisas rápidas
CREATE INDEX IF NOT EXISTS idx_destinos_cli_primavera ON public.destinos(cli_primavera);
