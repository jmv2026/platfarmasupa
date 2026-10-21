-- ==============================================================================
-- Migration: 20261021114500_create_table_stock.sql
-- Descrição: Criação da tabela public.stock com chave primária em id (UUID)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_ser TEXT NOT NULL,
    entidade TEXT,
    sigla TEXT,
    artigo TEXT NOT NULL,
    armazem TEXT NOT NULL,
    localizacao TEXT,
    lote TEXT,
    stock NUMERIC NOT NULL DEFAULT 0,
    data_stock DATE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Comentários explicativos sobre as colunas
COMMENT ON TABLE public.stock IS 'Tabela de registo de stock por artigo, lote e localização';
COMMENT ON COLUMN public.stock.id IS 'Identificador único do registo (UUID PK)';
COMMENT ON COLUMN public.stock.cliente_ser IS 'Sigla / código de série do cliente';
COMMENT ON COLUMN public.stock.entidade IS 'Código ou identificador da entidade';
COMMENT ON COLUMN public.stock.sigla IS 'Sigla do cliente / empresa';
COMMENT ON COLUMN public.stock.artigo IS 'Código do artigo';
COMMENT ON COLUMN public.stock.armazem IS 'Código do armazém';
COMMENT ON COLUMN public.stock.localizacao IS 'Localização detalhada no armazém';
COMMENT ON COLUMN public.stock.lote IS 'Lote do artigo';
COMMENT ON COLUMN public.stock.stock IS 'Quantidade em stock';
COMMENT ON COLUMN public.stock.data_stock IS 'Data associada ao registo de stock';

-- Índices para otimização de consultas
CREATE INDEX IF NOT EXISTS idx_stock_cliente_ser ON public.stock(cliente_ser);
CREATE INDEX IF NOT EXISTS idx_stock_entidade ON public.stock(entidade);
CREATE INDEX IF NOT EXISTS idx_stock_sigla ON public.stock(sigla);
CREATE INDEX IF NOT EXISTS idx_stock_artigo ON public.stock(artigo);
CREATE INDEX IF NOT EXISTS idx_stock_armazem ON public.stock(armazem);
CREATE INDEX IF NOT EXISTS idx_stock_lote ON public.stock(lote);
CREATE INDEX IF NOT EXISTS idx_stock_data_stock ON public.stock(data_stock);

-- Ativação de RLS (Row Level Security)
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stock' AND policyname = 'Acesso total a stock para autenticados'
  ) THEN
    CREATE POLICY "Acesso total a stock para autenticados"
    ON public.stock
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stock' AND policyname = 'Acesso total a stock para anon'
  ) THEN
    CREATE POLICY "Acesso total a stock para anon"
    ON public.stock
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);
  END IF;
END
$$;

-- Permissões para autenticados, anon e service_role
GRANT ALL ON public.stock TO authenticated;
GRANT ALL ON public.stock TO anon;
GRANT ALL ON public.stock TO service_role;
