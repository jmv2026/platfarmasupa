-- Migration: remove_artigos_joins_from_views
-- Remove os JOINs com a tabela artigos (e tipos_artigo) das views dependentes de movimentos:
-- - vw_saidas
-- - vw_stock_atual
-- - vw_stock_pedidos
-- - vw_pedidos

DROP VIEW IF EXISTS public.vw_saidas CASCADE;
DROP VIEW IF EXISTS public.vw_stock_atual CASCADE;
DROP VIEW IF EXISTS public.vw_stock_pedidos CASCADE;
DROP VIEW IF EXISTS public.vw_pedidos CASCADE;

-- 1. vw_saidas sem JOIN com artigos
CREATE VIEW public.vw_saidas WITH (security_invoker = true) AS 
SELECT 
    s.id,
    s.cliente_id,
    s.tipo_movimento,
    s.quantidade,
    s.tipo_armazem,
    s.armazem_loc,
    s.posicao,
    s.lote,
    s.nr_serie,
    s.validade,
    s.data_fabrico,
    s.data_movimento,
    s.documento_ref,
    s.observacoes,
    s.created_by,
    s.created_at,
    s.updated_at,
    s.artigo_cli,
    s.sigla,
    s.doc_linha,
    s.requisicao,
    s.entidade,
    s.morada,
    s.localidade,
    s.cod_postal,
    s.cod_postal_localidade,
    s.nome,
    s.num_contribuinte,
    s.ref_ser,
    s.tipo_doc,
    s.artigo_cli AS artigo_codigo,
    s.artigo_cli AS artigo_descricao,
    ''::text AS tipo_desc
FROM public.movimentos s
WHERE (lower(s.tipo_movimento) = 'ss'::text)
ORDER BY s.artigo_cli, s.lote;

-- 2. vw_stock_atual sem JOIN com artigos
CREATE VIEW public.vw_stock_atual WITH (security_invoker = true) AS 
SELECT 
    m.cliente_id,
    c.name AS cliente_nome,
    c.sigla AS cliente_sigla,
    m.artigo_cli AS artigo_id,
    m.artigo_cli AS artigo_codigo,
    m.artigo_cli AS artigo_descricao,
    ''::text AS tipo_artigo,
    ''::text AS tipo_armazenamento,
    m.tipo_armazem,
    arm.descricao AS armazem_descricao,
    m.armazem_loc,
    COALESCE(m.lote, 'S/LOTE'::text) AS lote,
    m.validade,
    min(m.data_fabrico) AS data_fabrico,
    sum(
        CASE
            WHEN (m.tipo_movimento = ANY (ARRAY['es'::text, 'et'::text])) THEN m.quantidade
            WHEN (m.tipo_movimento = ANY (ARRAY['ss'::text, 'st'::text])) THEN (- m.quantidade)
            ELSE (0)::numeric
        END
    ) AS stock,
    max(m.data_movimento) AS ultimo_movimento
FROM public.movimentos m
JOIN public.clientes c ON (c.id = m.cliente_id)
LEFT JOIN public.armazens arm ON (arm.tipo_armazem = m.tipo_armazem)
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
    m.artigo_cli, 
    m.tipo_armazem, 
    arm.descricao, 
    m.armazem_loc, 
    COALESCE(m.lote, 'S/LOTE'::text), 
    m.validade
HAVING (sum(
    CASE
        WHEN (m.tipo_movimento = ANY (ARRAY['es'::text, 'et'::text])) THEN m.quantidade
        WHEN (m.tipo_movimento = ANY (ARRAY['ss'::text, 'st'::text])) THEN (- m.quantidade)
        ELSE (0)::numeric
    END
) > (0)::numeric);

-- 3. vw_stock_pedidos sem JOIN com artigos
CREATE VIEW public.vw_stock_pedidos WITH (security_invoker = true) AS 
SELECT 
    m.cliente_id,
    c.name AS cliente_nome,
    c.sigla AS cliente_sigla,
    m.artigo_cli AS artigo_id,
    m.artigo_cli AS artigo_codigo,
    m.artigo_cli AS artigo_descricao,
    ''::text AS tipo_artigo,
    ''::text AS tipo_armazenamento,
    COALESCE(m.lote, 'S/LOTE'::text) AS lote,
    m.validade,
    min(m.data_fabrico) AS data_fabrico,
    sum(
        CASE
            WHEN (m.tipo_movimento = ANY (ARRAY['es'::text, 'et'::text])) THEN m.quantidade
            WHEN (m.tipo_movimento = ANY (ARRAY['ss'::text, 'st'::text])) THEN (- m.quantidade)
            ELSE (0)::numeric
        END
    ) AS stock,
    max(m.data_movimento) AS ultimo_movimento
FROM public.movimentos m
JOIN public.clientes c ON (c.id = m.cliente_id)
WHERE (m.tipo_armazem = '01'::text)
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
    m.artigo_cli, 
    COALESCE(m.lote, 'S/LOTE'::text), 
    m.validade
HAVING (sum(
    CASE
        WHEN (m.tipo_movimento = ANY (ARRAY['es'::text, 'et'::text])) THEN m.quantidade
        WHEN (m.tipo_movimento = ANY (ARRAY['ss'::text, 'st'::text])) THEN (- m.quantidade)
        ELSE (0)::numeric
    END
) > (0)::numeric);

-- 4. vw_pedidos sem JOIN com artigos
CREATE VIEW public.vw_pedidos WITH (security_invoker = true) AS 
SELECT 
    (((m.cliente_id)::text || '_'::text) || m.documento_ref) AS id,
    m.documento_ref,
    m.cliente_id,
    min(m.data_movimento) AS data_pedido,
    min(m.created_at) AS created_at,
    (count(*))::integer AS total_linhas,
    sum(m.quantidade) AS total_quantidade,
    max((m.sigla)::text) AS sigla,
    max(m.nome) AS nome,
    max(m.entidade) AS entidade,
    max(m.tipo_doc) AS tipo_doc,
    jsonb_agg(
        jsonb_build_object(
            'id', m.id, 
            'artigo_id', m.artigo_cli, 
            'artigo_codigo', m.artigo_cli, 
            'descricao', m.artigo_cli, 
            'quantidade', m.quantidade, 
            'lote', m.lote, 
            'validade', m.validade
        )
    ) AS pedido_linhas
FROM public.movimentos m
WHERE (lower(m.tipo_movimento) = 'ss'::text)
GROUP BY m.cliente_id, m.documento_ref
ORDER BY (min(m.data_movimento)) DESC;

-- 5. Garantir privilégios para roles da API do Supabase
GRANT SELECT ON public.vw_saidas TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_stock_atual TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_stock_pedidos TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_pedidos TO authenticated, anon, service_role;
