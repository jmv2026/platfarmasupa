-- Migration: remove_cliente_id_from_movimentos_linhas
-- Remove o campo cliente_id da tabela movimentos_linhas (o cliente_id pertence ao cabeçalho movimentos)
-- e atualiza as views e políticas RLS de acordo.

-- 1. Eliminar views dependentes
DROP VIEW IF EXISTS public.vw_saidas CASCADE;
DROP VIEW IF EXISTS public.vw_stock_atual CASCADE;
DROP VIEW IF EXISTS public.vw_stock_pedidos CASCADE;
DROP VIEW IF EXISTS public.vw_pedidos CASCADE;
DROP VIEW IF EXISTS public.vw_fact_mes CASCADE;

-- 2. Atualizar políticas RLS em movimentos_linhas sem referência à coluna cliente_id
DROP POLICY IF EXISTS "Permitir inserção de movimentos_sf para utilizadores autoriza" ON public.movimentos_linhas;
DROP POLICY IF EXISTS "Permitir leitura de movimentos_sf conforme perfil" ON public.movimentos_linhas;
DROP POLICY IF EXISTS "Permitir gestão de movimentos_sf para administradores" ON public.movimentos_linhas;
DROP POLICY IF EXISTS "Permitir gestão de movimentos_linhas para administradores" ON public.movimentos_linhas;
DROP POLICY IF EXISTS "Permitir leitura de movimentos_linhas conforme perfil" ON public.movimentos_linhas;
DROP POLICY IF EXISTS "Permitir inserção de movimentos_linhas para utilizadores autorizados" ON public.movimentos_linhas;

CREATE POLICY "Permitir gestão de movimentos_linhas para administradores"
    ON public.movimentos_linhas
    FOR ALL
    TO authenticated
    USING ((SELECT users.role FROM public.users WHERE users.id = auth.uid()) = ANY (ARRAY['admin'::text, 'gestor'::text]));

CREATE POLICY "Permitir leitura de movimentos_linhas conforme perfil"
    ON public.movimentos_linhas
    FOR SELECT
    TO authenticated
    USING (
        (SELECT users.role FROM public.users WHERE users.id = auth.uid()) = ANY (ARRAY['admin'::text, 'gestor'::text])
        OR EXISTS (
            SELECT 1 FROM public.movimentos m 
            WHERE m.documento_ref = movimentos_linhas.documento_ref 
              AND m.cliente_id = (SELECT users.cliente_id FROM public.users WHERE users.id = auth.uid())
        )
    );

CREATE POLICY "Permitir inserção de movimentos_linhas para utilizadores autorizados"
    ON public.movimentos_linhas
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT users.role FROM public.users WHERE users.id = auth.uid()) = ANY (ARRAY['admin'::text, 'gestor'::text])
        OR (
            (SELECT users.role FROM public.users WHERE users.id = auth.uid()) = ANY (ARRAY['user1'::text, 'user2'::text])
            AND EXISTS (
                SELECT 1 FROM public.movimentos m 
                WHERE m.documento_ref = movimentos_linhas.documento_ref 
                  AND m.cliente_id = (SELECT users.cliente_id FROM public.users WHERE users.id = auth.uid())
            )
        )
    );

-- 3. Remover índice em cliente_id
DROP INDEX IF EXISTS public.idx_movimentos_sf_cliente_id;

-- 4. Remover coluna cliente_id de movimentos_linhas
ALTER TABLE public.movimentos_linhas DROP COLUMN IF EXISTS cliente_id;

-- 5. Recriar views analíticas associando ao cabeçalho movimentos para obter cliente_id
CREATE VIEW public.vw_saidas WITH (security_invoker = true) AS 
SELECT 
    ml.doc_linha AS id,
    m.cliente_id,
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
    ml.observacoes_linha AS observacoes,
    ml.created_by,
    ml.created_at,
    ml.updated_at,
    ml.artigo_cli,
    m.sigla,
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
JOIN public.movimentos m ON m.documento_ref = ml.documento_ref
WHERE (lower(ml.tipo_movimento) = 'ss'::text)
ORDER BY ml.artigo_cli, ml.lote;

CREATE VIEW public.vw_stock_atual WITH (security_invoker = true) AS 
SELECT 
    m.cliente_id,
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
JOIN public.movimentos m ON m.documento_ref = ml.documento_ref
JOIN public.clientes c ON (c.id = m.cliente_id)
LEFT JOIN public.armazens arm ON (arm.tipo_armazem = ml.tipo_armazem)
WHERE (
    auth.uid() IS NULL
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
          AND (u.role IN ('admin', 'gestor') OR u.cliente_id IS NULL)
    )
    OR m.cliente_id = (
        SELECT u.cliente_id FROM public.users u 
        WHERE u.id = auth.uid()
    )
)
GROUP BY 
    m.cliente_id, 
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

CREATE VIEW public.vw_stock_pedidos WITH (security_invoker = true) AS 
SELECT 
    m.cliente_id,
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
JOIN public.movimentos m ON m.documento_ref = ml.documento_ref
JOIN public.clientes c ON (c.id = m.cliente_id)
WHERE (ml.tipo_armazem = '01'::text)
  AND (
    auth.uid() IS NULL
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
          AND (u.role IN ('admin', 'gestor') OR u.cliente_id IS NULL)
    )
    OR m.cliente_id = (
        SELECT u.cliente_id FROM public.users u 
        WHERE u.id = auth.uid()
    )
  )
GROUP BY 
    m.cliente_id, 
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

CREATE VIEW public.vw_pedidos WITH (security_invoker = true) AS 
SELECT 
    (((m.cliente_id)::text || '_'::text) || m.documento_ref) AS id,
    m.documento_ref,
    m.cliente_id,
    COALESCE(min(ml.data_movimento), min(m.data_movimento)) AS data_pedido,
    min(m.created_at) AS created_at,
    (count(ml.doc_linha))::integer AS total_linhas,
    COALESCE(sum(ml.quantidade), 0) AS total_quantidade,
    max((m.sigla)::text) AS sigla,
    max(m.nome) AS nome,
    max(m.entidade) AS entidade,
    max(m.tipo_doc) AS tipo_doc,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', ml.doc_linha, 
                'artigo_id', ml.artigo_cli, 
                'artigo_codigo', ml.artigo_cli, 
                'descricao', ml.artigo_cli, 
                'quantidade', ml.quantidade, 
                'lote', ml.lote, 
                'validade', ml.validade
            )
        ) FILTER (WHERE ml.doc_linha IS NOT NULL),
        '[]'::jsonb
    ) AS pedido_linhas
FROM public.movimentos m
JOIN public.movimentos_linhas ml ON ml.documento_ref = m.documento_ref
WHERE (lower(ml.tipo_movimento) = 'ss'::text)
GROUP BY m.cliente_id, m.documento_ref
ORDER BY (COALESCE(min(ml.data_movimento), min(m.data_movimento))) DESC;

CREATE VIEW public.vw_fact_mes WITH (security_invoker = true) AS 
WITH doc_totais AS (
    SELECT 
        (m.sigla)::text AS sigla_cliente,
        m.cliente_id,
        (date_trunc('month'::text, ((m.data_movimento)::date)::timestamp with time zone))::date AS data,
        m.documento_ref,
        (count(ml.doc_linha))::integer AS doc_linhas,
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

-- 6. Atribuir permissões às views
GRANT SELECT ON public.vw_saidas TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_stock_atual TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_stock_pedidos TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_pedidos TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_fact_mes TO authenticated, anon, service_role;
