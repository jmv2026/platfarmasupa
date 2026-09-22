-- =========================================================================
-- PLATAFORMA FARMA - ADICIONAR CAMPO PVP À TABELA ARTIGOS
-- =========================================================================

ALTER TABLE public.artigos 
ADD COLUMN IF NOT EXISTS pvp NUMERIC(12, 2) DEFAULT 0.00;

COMMENT ON COLUMN public.artigos.pvp IS 'Preço de Venda ao Público (PVP)';
