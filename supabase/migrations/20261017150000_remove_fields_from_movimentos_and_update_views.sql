-- Migration: remove_fields_from_movimentos_and_update_views
-- Remove os campos de linha da tabela movimentos (cabeçalho) e redireciona as views para movimentos_linhas:
-- Campos removidos de movimentos:
--   - tipo_movimento
--   - quantidade
--   - tipo_armazem
--   - armazem_loc
--   - posicao
--   - lote
--   - nr_serie
--   - validade
--   - data_fabrico

-- 1. Recrear as 5 views analíticas com base em movimentos_linhas e cabeçalho movimentos
DROP VIEW IF EXISTS public.vw_saidas CASCADE;
DROP VIEW IF EXISTS public.vw_stock_atual CASCADE;
DROP VIEW IF EXISTS public.vw_stock_pedidos CASCADE;
DROP VIEW IF EXISTS public.vw_pedidos CASCADE;
DROP VIEW IF EXISTS public.vw_fact_mes CASCADE;

-- View 1: vw_saidas
CREATE VIEW public.vw_saidas WITH (security_invoker = true) AS 
SELECT 
    ml.id,
    ml.cliente_id,
    ml.tipo_movimento,
    ml.quantidade,
    ml.tipo_armazem,
    ml.armazem_loc,
    ml.posicao,
    ml.lote,
    ml.nr_serie,
    ml.validade,
    ml.data_fabrico,
    ml.data_movimento,
    ml.documento_ref,
    ml.observacoes,
    ml.created_by,
    ml.created_at,
    ml.updated_at,
    ml.artigo_cli,
    ml.sigla,
    ml.doc_linha,
    m.requisicao,
    m.entidade,
    m.morada,
    m.localidade,
    m.cod_postal,
    m.cod_postal_localidade,
    m.nome,
    m.num_contribuinte,
    COALESCE(ml.ref_ser, m.ref_ser) AS ref_ser,
    m.tipo_doc,
    ml.artigo_cli AS artigo_codigo,
    ml.artigo_cli AS artigo_descricao,
    ''::text AS tipo_desc
FROM public.movimentos_linhas ml
LEFT JOIN public.movimentos m ON m.documento_ref = ml.documento_ref
WHERE (lower(ml.tipo_movimento) = 'ss'::text)
ORDER BY ml.artigo_cli, ml.lote;

-- View 2: vw_stock_atual
CREATE VIEW public.vw_stock_atual WITH (security_invoker = true) AS 
SELECT 
    ml.cliente_id,
    c.name AS cliente_nome,
    c.sigla AS cliente_sigla,
    ml.artigo_cli AS artigo_id,
    ml.artigo_cli AS artigo_codigo,
    ml.artigo_cli AS artigo_descricao,
    ''::text AS tipo_artigo,
    ''::text AS tipo_armazenamento,
    ml.tipo_armazem,
    arm.descricao AS armazem_descricao,
    ml.armazem_loc,
    COALESCE(ml.lote, 'S/LOTE'::text) AS lote,
    ml.validade,
    min(ml.data_fabrico) AS data_fabrico,
    sum(
        CASE
            WHEN (ml.tipo_movimento = ANY (ARRAY['es'::text, 'et'::text])) THEN ml.quantidade
            WHEN (ml.tipo_movimento = ANY (ARRAY['ss'::text, 'st'::text])) THEN (- ml.quantidade)
            ELSE (0)::numeric
        END
    ) AS stock,
    max(ml.data_movimento) AS ultimo_movimento
FROM public.movimentos_linhas ml
JOIN public.clientes c ON (c.id = ml.cliente_id)
LEFT JOIN public.armazens arm ON (arm.tipo_armazem = ml.tipo_armazem)
WHERE (
    auth.uid() IS NULL
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
          AND (u.role IN ('admin', 'gestor') OR u.cliente_id IS NULL)
    )
    OR ml.cliente_id = (
        SELECT u.cliente_id FROM public.users u 
        WHERE u.id = auth.uid()
    )
)
GROUP BY 
    ml.cliente_id, 
    c.name, 
    c.sigla, 
    ml.artigo_cli, 
    ml.tipo_armazem, 
    arm.descricao, 
    ml.armazem_loc, 
    COALESCE(ml.lote, 'S/LOTE'::text), 
    ml.validade
HAVING (sum(
    CASE
        WHEN (ml.tipo_movimento = ANY (ARRAY['es'::text, 'et'::text])) THEN ml.quantidade
        WHEN (ml.tipo_movimento = ANY (ARRAY['ss'::text, 'st'::text])) THEN (- ml.quantidade)
        ELSE (0)::numeric
    END
) > (0)::numeric);

-- View 3: vw_stock_pedidos
CREATE VIEW public.vw_stock_pedidos WITH (security_invoker = true) AS 
SELECT 
    ml.cliente_id,
    c.name AS cliente_nome,
    c.sigla AS cliente_sigla,
    ml.artigo_cli AS artigo_id,
    ml.artigo_cli AS artigo_codigo,
    ml.artigo_cli AS artigo_descricao,
    ''::text AS tipo_artigo,
    ''::text AS tipo_armazenamento,
    COALESCE(ml.lote, 'S/LOTE'::text) AS lote,
    ml.validade,
    min(ml.data_fabrico) AS data_fabrico,
    sum(
        CASE
            WHEN (ml.tipo_movimento = ANY (ARRAY['es'::text, 'et'::text])) THEN ml.quantidade
            WHEN (ml.tipo_movimento = ANY (ARRAY['ss'::text, 'st'::text])) THEN (- ml.quantidade)
            ELSE (0)::numeric
        END
    ) AS stock,
    max(ml.data_movimento) AS ultimo_movimento
FROM public.movimentos_linhas ml
JOIN public.clientes c ON (c.id = ml.cliente_id)
WHERE (ml.tipo_armazem = '01'::text)
  AND (
    auth.uid() IS NULL
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
          AND (u.role IN ('admin', 'gestor') OR u.cliente_id IS NULL)
    )
    OR ml.cliente_id = (
        SELECT u.cliente_id FROM public.users u 
        WHERE u.id = auth.uid()
    )
  )
GROUP BY 
    ml.cliente_id, 
    c.name, 
    c.sigla, 
    ml.artigo_cli, 
    COALESCE(ml.lote, 'S/LOTE'::text), 
    ml.validade
HAVING (sum(
    CASE
        WHEN (ml.tipo_movimento = ANY (ARRAY['es'::text, 'et'::text])) THEN ml.quantidade
        WHEN (ml.tipo_movimento = ANY (ARRAY['ss'::text, 'st'::text])) THEN (- ml.quantidade)
        ELSE (0)::numeric
    END
) > (0)::numeric);

-- View 4: vw_pedidos
CREATE VIEW public.vw_pedidos WITH (security_invoker = true) AS 
SELECT 
    (((m.cliente_id)::text || '_'::text) || m.documento_ref) AS id,
    m.documento_ref,
    m.cliente_id,
    COALESCE(min(ml.data_movimento), min(m.data_movimento)) AS data_pedido,
    min(m.created_at) AS created_at,
    (count(ml.id))::integer AS total_linhas,
    COALESCE(sum(ml.quantidade), 0) AS total_quantidade,
    max((m.sigla)::text) AS sigla,
    max(m.nome) AS nome,
    max(m.entidade) AS entidade,
    max(m.tipo_doc) AS tipo_doc,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', ml.id, 
                'artigo_id', ml.artigo_cli, 
                'artigo_codigo', ml.artigo_cli, 
                'descricao', ml.artigo_cli, 
                'quantidade', ml.quantidade, 
                'lote', ml.lote, 
                'validade', ml.validade
            )
        ) FILTER (WHERE ml.id IS NOT NULL),
        '[]'::jsonb
    ) AS pedido_linhas
FROM public.movimentos m
JOIN public.movimentos_linhas ml ON ml.documento_ref = m.documento_ref
WHERE (lower(ml.tipo_movimento) = 'ss'::text)
GROUP BY m.cliente_id, m.documento_ref
ORDER BY (COALESCE(min(ml.data_movimento), min(m.data_movimento))) DESC;

-- View 5: vw_fact_mes
CREATE VIEW public.vw_fact_mes WITH (security_invoker = true) AS 
WITH doc_totais AS (
    SELECT 
        (m.sigla)::text AS sigla_cliente,
        m.cliente_id,
        (date_trunc('month'::text, ((m.data_movimento)::date)::timestamp with time zone))::date AS data,
        m.documento_ref,
        (count(ml.id))::integer AS doc_linhas,
        sum(COALESCE(ml.quantidade, (0)::numeric)) AS doc_quantidade,
        max(COALESCE(m.total_merc, (0)::numeric)) AS doc_merc,
        max(COALESCE(m.total_desc, (0)::numeric)) AS doc_desc,
        max(COALESCE(m.total_iva, (0)::numeric)) AS doc_iva,
        max(COALESCE(m.total_outros, (0)::numeric)) AS doc_outros
    FROM public.movimentos m
    JOIN public.movimentos_linhas ml ON ml.documento_ref = m.documento_ref
    WHERE (lower(ml.tipo_movimento) = 'ss'::text)
    GROUP BY m.sigla, m.cliente_id, ((date_trunc('month'::text, ((m.data_movimento)::date)::timestamp with time zone))::date), m.documento_ref
)
SELECT 
    sigla_cliente,
    cliente_id,
    data,
    (EXTRACT(year FROM data))::integer AS ano,
    (EXTRACT(month FROM data))::integer AS mes,
    to_char((data)::timestamp with time zone, 'YYYY-MM'::text) AS ano_mes,
    (count(DISTINCT documento_ref))::integer AS total_docs,
    (sum(doc_linhas))::integer AS total_linhas,
    sum(doc_quantidade) AS total_quantidade,
    sum(doc_merc) AS total_merc,
    sum(doc_desc) AS total_desc,
    sum(doc_iva) AS total_iva,
    sum(doc_outros) AS total_outros,
    sum(((doc_merc - doc_iva) - doc_desc)) AS total_liquido
FROM doc_totais
GROUP BY sigla_cliente, cliente_id, data, (EXTRACT(year FROM data)), (EXTRACT(month FROM data)), (to_char((data)::timestamp with time zone, 'YYYY-MM'::text));

-- Privilégios das views para a API
GRANT SELECT ON public.vw_saidas TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_stock_atual TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_stock_pedidos TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_pedidos TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_fact_mes TO authenticated, anon, service_role;

-- 2. Remover restrições de verificação e índices em movimentos
ALTER TABLE public.movimentos DROP CONSTRAINT IF EXISTS movimentos_quantidade_check;
ALTER TABLE public.movimentos DROP CONSTRAINT IF EXISTS movimentos_tipo_movimento_check;

DROP INDEX IF EXISTS public.idx_movimentos_tipo_armazem;
DROP INDEX IF EXISTS public.idx_movimentos_armazem_loc;
DROP INDEX IF EXISTS public.idx_movimentos_lote;
DROP INDEX IF EXISTS public.idx_movimentos_tipo_movimento;
DROP INDEX IF EXISTS public.idx_movimentos_tipo_mov_cliente;

-- 3. Remover os 9 campos da tabela movimentos
ALTER TABLE public.movimentos 
    DROP COLUMN IF EXISTS tipo_movimento,
    DROP COLUMN IF EXISTS quantidade,
    DROP COLUMN IF EXISTS tipo_armazem,
    DROP COLUMN IF EXISTS armazem_loc,
    DROP COLUMN IF EXISTS posicao,
    DROP COLUMN IF EXISTS lote,
    DROP COLUMN IF EXISTS nr_serie,
    DROP COLUMN IF EXISTS validade,
    DROP COLUMN IF EXISTS data_fabrico;
