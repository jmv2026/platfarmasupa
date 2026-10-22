-- ==============================================================================
-- ALINHAMENTO DOS CAMPOS DA TABELA: public.movimentos COM public.plat_movimentos
-- ==============================================================================
-- Campos alinhados (25 campos de cabeçalho):
-- data, cli_primavera, cliente_ser, tipomovimento, documento, chave1, chave2,
-- entidade, totaliva, totalmerc, totaloutros, totaldesc, requisicao,
-- numcontribuinte, nome, morada, localidade, codpostal, codpostallocalidade,
-- pais, nomeentrega, entidadeentrega, moradaentrega, localidadeentrega, codpostalentrega
-- ==============================================================================

-- 1. Adicionar colunas em public.movimentos caso não existam
ALTER TABLE public.movimentos
    ADD COLUMN IF NOT EXISTS "data" DATE,
    ADD COLUMN IF NOT EXISTS "cli_primavera" TEXT,
    ADD COLUMN IF NOT EXISTS "cliente_ser" TEXT,
    ADD COLUMN IF NOT EXISTS "tipomovimento" TEXT,
    ADD COLUMN IF NOT EXISTS "documento" TEXT,
    ADD COLUMN IF NOT EXISTS "chave1" TEXT,
    ADD COLUMN IF NOT EXISTS "chave2" TEXT,
    ADD COLUMN IF NOT EXISTS "entidade" TEXT,
    ADD COLUMN IF NOT EXISTS "totaliva" NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "totalmerc" NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "totaloutros" NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "totaldesc" NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "requisicao" TEXT,
    ADD COLUMN IF NOT EXISTS "numcontribuinte" TEXT,
    ADD COLUMN IF NOT EXISTS "nome" TEXT,
    ADD COLUMN IF NOT EXISTS "morada" TEXT,
    ADD COLUMN IF NOT EXISTS "localidade" TEXT,
    ADD COLUMN IF NOT EXISTS "codpostal" TEXT,
    ADD COLUMN IF NOT EXISTS "codpostallocalidade" TEXT,
    ADD COLUMN IF NOT EXISTS "pais" TEXT,
    ADD COLUMN IF NOT EXISTS "nomeentrega" TEXT,
    ADD COLUMN IF NOT EXISTS "entidadeentrega" TEXT,
    ADD COLUMN IF NOT EXISTS "moradaentrega" TEXT,
    ADD COLUMN IF NOT EXISTS "localidadeentrega" TEXT,
    ADD COLUMN IF NOT EXISTS "codpostalentrega" TEXT;

-- 2. Índices de pesquisa recomendados
CREATE INDEX IF NOT EXISTS idx_movimentos_data ON public.movimentos(data);
CREATE INDEX IF NOT EXISTS idx_movimentos_documento ON public.movimentos(documento);
CREATE INDEX IF NOT EXISTS idx_movimentos_cli_primavera ON public.movimentos(cli_primavera);
CREATE INDEX IF NOT EXISTS idx_movimentos_cliente_ser ON public.movimentos(cliente_ser);
CREATE INDEX IF NOT EXISTS idx_movimentos_entidade ON public.movimentos(entidade);
CREATE INDEX IF NOT EXISTS idx_movimentos_tipomovimento ON public.movimentos(tipomovimento);

-- 3. Atualizar constraint de quantidade em movimentos_linhas para permitir >= 0
ALTER TABLE public.movimentos_linhas
    DROP CONSTRAINT IF EXISTS movimentos_sf_quantidade_check;

ALTER TABLE public.movimentos_linhas
    ADD CONSTRAINT movimentos_sf_quantidade_check CHECK (quantidade >= 0);
