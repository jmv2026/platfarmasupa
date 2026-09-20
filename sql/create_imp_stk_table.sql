-- ==============================================================================
-- CRIAÇÃO DA TABELA: public.imp_stk (Importação de Ficheiros de Stock TXT/Excel)
-- ==============================================================================
-- Campos mapeados do ficheiro de stock:
-- Artigo, Descricao, Armazem, Lote, EstadoStock, Stk, DataStock (Data-Hora),
-- Bloqueado, Familia, tipo_artigo, SubFamilia
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.imp_stk (
    artigo TEXT,
    descricao TEXT,
    armazem TEXT,
    lote TEXT,
    estado_stock TEXT,
    stk NUMERIC DEFAULT 0,
    datastock TIMESTAMPTZ,
    bloqueado TEXT,
    familia TEXT,
    tipo_artigo TEXT,
    sub_familia TEXT,
    filename TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para otimização de consultas e relatórios
CREATE INDEX IF NOT EXISTS idx_imp_stk_artigo ON public.imp_stk(artigo);
CREATE INDEX IF NOT EXISTS idx_imp_stk_armazem ON public.imp_stk(armazem);
CREATE INDEX IF NOT EXISTS idx_imp_stk_lote ON public.imp_stk(lote);
CREATE INDEX IF NOT EXISTS idx_imp_stk_datastock ON public.imp_stk(datastock);

-- Ativar RLS (Row Level Security)
ALTER TABLE public.imp_stk ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'imp_stk' AND policyname = 'Acesso total a imp_stk para autenticados'
  ) THEN
    CREATE POLICY "Acesso total a imp_stk para autenticados"
    ON public.imp_stk
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'imp_stk' AND policyname = 'Acesso total a imp_stk para anon'
  ) THEN
    CREATE POLICY "Acesso total a imp_stk para anon"
    ON public.imp_stk
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);
  END IF;
END
$$;
