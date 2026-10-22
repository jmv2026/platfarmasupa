-- ==============================================================================
-- CRIAÇÃO DA TABELA: public.plat_movimentos (Histórico de Movimentos de Stock)
-- ==============================================================================
-- Estrutura de 42 campos para importação de ficheiros ERP (.txt, .csv, .xlsx, .xls)
-- Chave Primária: doc_linha
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.plat_movimentos (
    doc_linha TEXT PRIMARY KEY,
    data DATE,
    cli_primavera TEXT,
    cliente_ser TEXT,
    tipomovimento TEXT,
    documento TEXT,
    numlinha INTEGER,
    chave1 TEXT,
    chave2 TEXT,
    valorunitario NUMERIC DEFAULT 0,
    valoradicional NUMERIC DEFAULT 0,
    valorabater NUMERIC DEFAULT 0,
    artigo_id TEXT,
    artigo_cli TEXT,
    descricao TEXT,
    tipoartigo TEXT,
    armazem TEXT,
    localizacao TEXT,
    lote TEXT,
    quantidade NUMERIC DEFAULT 0,
    familia TEXT,
    subfamilia TEXT,
    datafabrico DATE,
    validade DATE,
    entidade TEXT,
    totaliva NUMERIC DEFAULT 0,
    totalmerc NUMERIC DEFAULT 0,
    totaloutros NUMERIC DEFAULT 0,
    totaldesc NUMERIC DEFAULT 0,
    requisicao TEXT,
    numcontribuinte TEXT,
    nome TEXT,
    morada TEXT,
    localidade TEXT,
    codpostal TEXT,
    codpostallocalidade TEXT,
    pais TEXT,
    nomeentrega TEXT,
    entidadeentrega TEXT,
    moradaentrega TEXT,
    localidadeentrega TEXT,
    codpostalentrega TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Comentários das colunas
COMMENT ON TABLE public.plat_movimentos IS 'Tabela staging de importação de movimentos do ERP (42 campos)';
COMMENT ON COLUMN public.plat_movimentos.doc_linha IS 'Chave primária única da linha de documento (ex: SSF 26MAX/173-6)';
COMMENT ON COLUMN public.plat_movimentos.data IS 'Data do movimento';
COMMENT ON COLUMN public.plat_movimentos.cli_primavera IS 'Código de cliente no Primavera / ERP (ex: 482)';
COMMENT ON COLUMN public.plat_movimentos.cliente_ser IS 'Série ou identificador do cliente (ex: Maxifar)';
COMMENT ON COLUMN public.plat_movimentos.tipomovimento IS 'Tipo de movimento (ex: S, E, SS, ES)';
COMMENT ON COLUMN public.plat_movimentos.documento IS 'Identificador do documento (ex: SSF 26MAX/173)';
COMMENT ON COLUMN public.plat_movimentos.numlinha IS 'Número da linha no documento';
COMMENT ON COLUMN public.plat_movimentos.artigo_id IS 'Código base do artigo';
COMMENT ON COLUMN public.plat_movimentos.artigo_cli IS 'Código completo do artigo com cliente (ex: 482-5738679)';

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_artigo_cli ON public.plat_movimentos(artigo_cli);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_artigo_id ON public.plat_movimentos(artigo_id);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_documento ON public.plat_movimentos(documento);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_cli_primavera ON public.plat_movimentos(cli_primavera);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_cliente_ser ON public.plat_movimentos(cliente_ser);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_data ON public.plat_movimentos(data);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_armazem ON public.plat_movimentos(armazem);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_lote ON public.plat_movimentos(lote);

-- Ativação de RLS (Row Level Security)
ALTER TABLE public.plat_movimentos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'plat_movimentos' AND policyname = 'Acesso total a plat_movimentos para autenticados'
  ) THEN
    CREATE POLICY "Acesso total a plat_movimentos para autenticados"
    ON public.plat_movimentos
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'plat_movimentos' AND policyname = 'Acesso total a plat_movimentos para anon'
  ) THEN
    CREATE POLICY "Acesso total a plat_movimentos para anon"
    ON public.plat_movimentos
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);
  END IF;
END
$$;

-- Permissões
GRANT ALL ON public.plat_movimentos TO authenticated;
GRANT ALL ON public.plat_movimentos TO anon;
GRANT ALL ON public.plat_movimentos TO service_role;
