-- ==============================================================================
-- Migration: 20261024233000_update_faturas_exact_fields_and_vw_fact_mes.sql
-- Descrição: Recriar a tabela public.faturas com apenas os 27 campos do ficheiro anexo:
--            documento_ref (PK), data, entidade, tipo_doc, num_doc, documento,
--            requisicao, num_contribuinte, total_iva, total_merc, total_outros,
--            total_desc, nome, morada, localidade, cod_postal, cod_postal_localidade,
--            pais, nome_entrega, morada_entrega, cod_postal_localidade_entrega,
--            cod_postal_entrega, localidade_entrega, entidade_entrega, cli_primavera,
--            sigla, cliente_ser.
-- ==============================================================================

DROP VIEW IF EXISTS public.vw_fact_mes CASCADE;
DROP TABLE IF EXISTS public.faturas CASCADE;

-- 1. Criar Tabela public.faturas com exatamente e apenas os 27 campos
CREATE TABLE public.faturas (
    documento_ref TEXT PRIMARY KEY,
    data DATE,
    entidade TEXT,
    tipo_doc TEXT,
    num_doc TEXT,
    documento TEXT,
    requisicao TEXT,
    num_contribuinte TEXT,
    total_iva NUMERIC DEFAULT 0,
    total_merc NUMERIC DEFAULT 0,
    total_outros NUMERIC DEFAULT 0,
    total_desc NUMERIC DEFAULT 0,
    nome TEXT,
    morada TEXT,
    localidade TEXT,
    cod_postal TEXT,
    cod_postal_localidade TEXT,
    pais TEXT,
    nome_entrega TEXT,
    morada_entrega TEXT,
    cod_postal_localidade_entrega TEXT,
    cod_postal_entrega TEXT,
    localidade_entrega TEXT,
    entidade_entrega TEXT,
    cli_primavera TEXT,
    sigla TEXT,
    cliente_ser TEXT
);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_faturas_data ON public.faturas(data);
CREATE INDEX IF NOT EXISTS idx_faturas_sigla ON public.faturas(sigla);
CREATE INDEX IF NOT EXISTS idx_faturas_cli_primavera ON public.faturas(cli_primavera);
CREATE INDEX IF NOT EXISTS idx_faturas_tipo_doc ON public.faturas(tipo_doc);
CREATE INDEX IF NOT EXISTS idx_faturas_documento ON public.faturas(documento);

-- 2. Configurar RLS e Permissões na tabela faturas
ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de faturas a utilizadores autenticados" ON public.faturas;
CREATE POLICY "Permitir leitura de faturas a utilizadores autenticados"
ON public.faturas
FOR SELECT
TO authenticated, anon, service_role
USING (
    auth.uid() IS NULL 
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
          AND (
              u.role IN ('admin', 'gestor') 
              OR u.cliente_id IS NULL 
              OR u.cliente_id IN (
                  SELECT c.id FROM public.clientes c 
                  WHERE UPPER(TRIM(c.sigla)) = UPPER(TRIM(faturas.sigla))
                     OR (c.cli_primavera IS NOT NULL AND TRIM(c.cli_primavera) = TRIM(faturas.cli_primavera))
              )
          )
    )
);

DROP POLICY IF EXISTS "Permitir modificação de faturas a administradores e gestores" ON public.faturas;
CREATE POLICY "Permitir modificação de faturas a administradores e gestores"
ON public.faturas
FOR ALL
TO authenticated, service_role
USING (
    auth.uid() IS NULL 
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() AND u.role IN ('admin', 'gestor')
    )
);

GRANT ALL ON public.faturas TO authenticated, service_role, anon;

-- 3. Recriar a view vw_fact_mes alimentada pela nova tabela faturas
CREATE VIEW public.vw_fact_mes WITH (security_invoker = true) AS
SELECT 
    COALESCE(c.sigla, f.sigla, split_part(f.documento_ref, '-', 1))::text AS sigla_cliente,
    c.id AS cliente_id,
    (date_trunc('month'::text, (COALESCE(f.data, CURRENT_DATE))::timestamp with time zone))::date AS data,
    (EXTRACT(year FROM COALESCE(f.data, CURRENT_DATE)))::integer AS ano,
    (EXTRACT(month FROM COALESCE(f.data, CURRENT_DATE)))::integer AS mes,
    to_char((COALESCE(f.data, CURRENT_DATE))::timestamp with time zone, 'YYYY-MM'::text) AS ano_mes,
    (count(*))::integer AS total_docs,
    (count(*))::integer AS total_linhas,
    (0)::numeric AS total_quantidade,
    sum(
        CASE 
            WHEN UPPER(TRIM(COALESCE(f.tipo_doc, split_part(f.documento, ' ', 1)))) IN ('NC', 'NCE') THEN -ABS(COALESCE(f.total_merc, 0::numeric))
            ELSE ABS(COALESCE(f.total_merc, 0::numeric))
        END
    ) AS total_merc,
    sum(
        CASE 
            WHEN UPPER(TRIM(COALESCE(f.tipo_doc, split_part(f.documento, ' ', 1)))) IN ('NC', 'NCE') THEN -ABS(COALESCE(f.total_desc, 0::numeric))
            ELSE ABS(COALESCE(f.total_desc, 0::numeric))
        END
    ) AS total_desc,
    sum(
        CASE 
            WHEN UPPER(TRIM(COALESCE(f.tipo_doc, split_part(f.documento, ' ', 1)))) IN ('NC', 'NCE') THEN -ABS(COALESCE(f.total_iva, 0::numeric))
            ELSE ABS(COALESCE(f.total_iva, 0::numeric))
        END
    ) AS total_iva,
    sum(
        CASE 
            WHEN UPPER(TRIM(COALESCE(f.tipo_doc, split_part(f.documento, ' ', 1)))) IN ('NC', 'NCE') THEN -ABS(COALESCE(f.total_outros, 0::numeric))
            ELSE ABS(COALESCE(f.total_outros, 0::numeric))
        END
    ) AS total_outros,
    sum(
        CASE 
            WHEN UPPER(TRIM(COALESCE(f.tipo_doc, split_part(f.documento, ' ', 1)))) IN ('NC', 'NCE') THEN -(ABS(COALESCE(f.total_merc, 0::numeric)) - ABS(COALESCE(f.total_iva, 0::numeric)) - ABS(COALESCE(f.total_desc, 0::numeric)))
            ELSE (ABS(COALESCE(f.total_merc, 0::numeric)) - ABS(COALESCE(f.total_iva, 0::numeric)) - ABS(COALESCE(f.total_desc, 0::numeric)))
        END
    ) AS total_liquido
FROM public.faturas f
LEFT JOIN public.clientes c ON (
    (c.cli_primavera IS NOT NULL AND TRIM(c.cli_primavera) = TRIM(f.cli_primavera))
    OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(f.sigla))
    OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(f.cliente_ser))
    OR UPPER(TRIM(c.name)) = UPPER(TRIM(f.cliente_ser))
    OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(split_part(f.documento_ref, '-', 1)))
)
WHERE UPPER(TRIM(COALESCE(f.tipo_doc, split_part(f.documento, ' ', 1)))) IN ('FA', 'NCE', 'ND', 'NC')
GROUP BY 
    COALESCE(c.sigla, f.sigla, split_part(f.documento_ref, '-', 1)),
    c.id,
    (date_trunc('month'::text, (COALESCE(f.data, CURRENT_DATE))::timestamp with time zone))::date,
    (EXTRACT(year FROM COALESCE(f.data, CURRENT_DATE))),
    (EXTRACT(month FROM COALESCE(f.data, CURRENT_DATE))),
    to_char((COALESCE(f.data, CURRENT_DATE))::timestamp with time zone, 'YYYY-MM'::text);

GRANT SELECT ON public.vw_fact_mes TO authenticated, anon, service_role;
