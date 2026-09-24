-- =========================================================================
-- PLATAFORMA FARMA - ALTERAÇÃO DE CAMPO: PVP -> PVA NA TABELA ARTIGOS
-- =========================================================================
-- Renomeia a coluna 'pvp' para 'pva' e assegura o formato NUMERIC(12, 2).
-- =========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'artigos' 
      AND column_name = 'pvp'
  ) THEN
    ALTER TABLE public.artigos RENAME COLUMN pvp TO pva;
  ELSIF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'artigos' 
      AND column_name = 'pva'
  ) THEN
    ALTER TABLE public.artigos ADD COLUMN pva NUMERIC(12, 2) DEFAULT 0.00;
  END IF;
END $$;

-- Garantir tipo e precisão decimal (2 casas decimais)
ALTER TABLE public.artigos ALTER COLUMN pva TYPE NUMERIC(12, 2);
ALTER TABLE public.artigos ALTER COLUMN pva SET DEFAULT 0.00;

COMMENT ON COLUMN public.artigos.pva IS 'Preço de Venda / PVA (Numérico com 2 decimais)';
