-- ==============================================================================
-- CRIAÇÃO DA TABELA: public.imp_stk (Importação de Ficheiros de Stock TXT/Excel)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.imp_stk (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artigo TEXT,
    descricao TEXT,
    armazem TEXT,
    lote TEXT,
    estado_stock TEXT,
    stk NUMERIC DEFAULT 0,
    data_stock TEXT,
    bloqueado TEXT,
    familia TEXT,
    tipo_artigo TEXT,
    sub_familia TEXT,
    filename TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ativar RLS
ALTER TABLE public.imp_stk ENABLE ROW LEVEL SECURITY;

-- Política de acesso total para utilizadores autenticados
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
END
$$;
