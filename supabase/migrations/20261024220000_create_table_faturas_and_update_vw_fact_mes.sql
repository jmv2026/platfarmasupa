-- ==============================================================================
-- Migration: 20261024220000_create_table_faturas_and_update_vw_fact_mes.sql
-- Descrição: 1. Criar a tabela public.faturas com chave primária documento_ser.
--            2. Implementar triggers de sincronização e associação de cliente.
--            3. Redirecionar a view vw_fact_mes para recolher dados da tabela faturas.
-- ==============================================================================

-- 1. Criar Tabela public.faturas
CREATE TABLE IF NOT EXISTS public.faturas (
    documento_ser TEXT PRIMARY KEY,
    documento_ref TEXT,
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
    sigla TEXT,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_faturas_data ON public.faturas(data);
CREATE INDEX IF NOT EXISTS idx_faturas_cliente_id ON public.faturas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_faturas_sigla ON public.faturas(sigla);
CREATE INDEX IF NOT EXISTS idx_faturas_tipo_doc ON public.faturas(tipo_doc);
CREATE INDEX IF NOT EXISTS idx_faturas_documento ON public.faturas(documento);

-- 2. Trigger para inferir cliente, sigla e tipo_doc automaticamente
CREATE OR REPLACE FUNCTION public.fn_sync_faturas_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Sincronizar documento_ser e documento_ref
    IF NEW.documento_ser IS NULL AND NEW.documento_ref IS NOT NULL THEN
        NEW.documento_ser := NEW.documento_ref;
    ELSIF NEW.documento_ref IS NULL AND NEW.documento_ser IS NOT NULL THEN
        NEW.documento_ref := NEW.documento_ser;
    END IF;

    -- Inferir sigla se vazia (ex: MAX a partir de 'MAX-FA 26MAX/1')
    IF NEW.sigla IS NULL OR TRIM(NEW.sigla) = '' THEN
        NEW.sigla := split_part(NEW.documento_ser, '-', 1);
    END IF;

    -- Inferir tipo_doc se vazio (ex: a partir de 'documento' como 'FA 2026/1')
    IF NEW.tipo_doc IS NULL OR TRIM(NEW.tipo_doc) = '' THEN
        IF NEW.documento IS NOT NULL AND TRIM(NEW.documento) <> '' THEN
            NEW.tipo_doc := split_part(TRIM(NEW.documento), ' ', 1);
        ELSIF NEW.documento_ser LIKE '%-FA %' THEN
            NEW.tipo_doc := 'FA';
        ELSIF NEW.documento_ser LIKE '%-NC %' THEN
            NEW.tipo_doc := 'NC';
        ELSIF NEW.documento_ser LIKE '%-NCE %' THEN
            NEW.tipo_doc := 'NCE';
        ELSIF NEW.documento_ser LIKE '%-ND %' THEN
            NEW.tipo_doc := 'ND';
        END IF;
    END IF;

    -- Normalizar tipo_doc para maiúsculas
    IF NEW.tipo_doc IS NOT NULL THEN
        NEW.tipo_doc := UPPER(TRIM(NEW.tipo_doc));
    END IF;

    -- Associar cliente_id caso ainda não esteja preenchido
    IF NEW.cliente_id IS NULL AND NEW.sigla IS NOT NULL THEN
        SELECT id INTO NEW.cliente_id
        FROM public.clientes
        WHERE UPPER(TRIM(sigla)) = UPPER(TRIM(NEW.sigla))
        LIMIT 1;
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_faturas_defaults ON public.faturas;
CREATE TRIGGER trg_sync_faturas_defaults
BEFORE INSERT OR UPDATE ON public.faturas
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_faturas_defaults();

-- 3. Configurar RLS e Permissões na tabela faturas
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
          AND (u.role IN ('admin', 'gestor') OR u.cliente_id IS NULL OR u.cliente_id = faturas.cliente_id)
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

-- 4. Recriar a view vw_fact_mes alimentada pela tabela faturas
DROP VIEW IF EXISTS public.vw_fact_mes CASCADE;

CREATE VIEW public.vw_fact_mes WITH (security_invoker = true) AS
SELECT 
    COALESCE(c.sigla, f.sigla, split_part(f.documento_ser, '-', 1))::text AS sigla_cliente,
    COALESCE(f.cliente_id, c.id) AS cliente_id,
    (date_trunc('month'::text, (COALESCE(f.data, f.created_at::date))::timestamp with time zone))::date AS data,
    (EXTRACT(year FROM COALESCE(f.data, f.created_at::date)))::integer AS ano,
    (EXTRACT(month FROM COALESCE(f.data, f.created_at::date)))::integer AS mes,
    to_char((COALESCE(f.data, f.created_at::date))::timestamp with time zone, 'YYYY-MM'::text) AS ano_mes,
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
    c.id = f.cliente_id 
    OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(COALESCE(f.sigla, split_part(f.documento_ser, '-', 1))))
)
WHERE UPPER(TRIM(COALESCE(f.tipo_doc, split_part(f.documento, ' ', 1)))) IN ('FA', 'NCE', 'ND', 'NC')
GROUP BY 
    COALESCE(c.sigla, f.sigla, split_part(f.documento_ser, '-', 1)),
    COALESCE(f.cliente_id, c.id),
    (date_trunc('month'::text, (COALESCE(f.data, f.created_at::date))::timestamp with time zone))::date,
    (EXTRACT(year FROM COALESCE(f.data, f.created_at::date))),
    (EXTRACT(month FROM COALESCE(f.data, f.created_at::date))),
    to_char((COALESCE(f.data, f.created_at::date))::timestamp with time zone, 'YYYY-MM'::text);

GRANT SELECT ON public.vw_fact_mes TO authenticated, anon, service_role;
