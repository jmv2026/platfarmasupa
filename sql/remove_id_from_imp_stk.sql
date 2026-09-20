-- ==============================================================================
-- MIGRAÇÃO: Remover coluna 'id' da tabela public.imp_stk
-- ==============================================================================

-- 1. Remover a restrição de chave primária se existir
ALTER TABLE IF EXISTS public.imp_stk DROP CONSTRAINT IF EXISTS imp_stk_pkey;

-- 2. Remover a coluna id se existir
ALTER TABLE IF EXISTS public.imp_stk DROP COLUMN IF EXISTS id;
