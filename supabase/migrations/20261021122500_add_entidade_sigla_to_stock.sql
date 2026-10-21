-- ==============================================================================
-- Migration: 20261021122500_add_entidade_sigla_to_stock.sql
-- Descrição: Adicionar colunas entidade e sigla à tabela public.stock
-- ==============================================================================

ALTER TABLE public.stock 
ADD COLUMN IF NOT EXISTS entidade TEXT,
ADD COLUMN IF NOT EXISTS sigla TEXT;

COMMENT ON COLUMN public.stock.entidade IS 'Código ou identificador da entidade';
COMMENT ON COLUMN public.stock.sigla IS 'Sigla do cliente / empresa';

CREATE INDEX IF NOT EXISTS idx_stock_entidade ON public.stock(entidade);
CREATE INDEX IF NOT EXISTS idx_stock_sigla ON public.stock(sigla);
