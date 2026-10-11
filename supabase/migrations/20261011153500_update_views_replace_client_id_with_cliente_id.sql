-- Migration: update_views_replace_client_id_with_cliente_id
-- Remover alias legado client_id das views vw_stock_atual e vw_stock_pedidos

DROP VIEW IF EXISTS public.vw_stock_atual;
CREATE VIEW public.vw_stock_atual
WITH (security_invoker = true)
AS
SELECT 
    m.cliente_id,
    c.name AS cliente_nome,
    c.sigla AS cliente_sigla,
    m.artigo_cli AS artigo_id,
    a.artigo_id AS artigo_codigo,
    a.descricao AS artigo_descricao,
    ta.tipo_artigo,
    a.tipo_armazenamento,
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
        END) AS stock,
    max(m.data_movimento) AS ultimo_movimento
FROM public.movimentos m
JOIN public.clientes c ON c.id = m.cliente_id
JOIN public.artigos a ON a.artigo_cli = m.artigo_cli
JOIN public.tipos_artigo ta ON ta.id_tipo_artigo = a.id_tipo_artigo
LEFT JOIN public.armazens arm ON arm.tipo_armazem = m.tipo_armazem
GROUP BY 
    m.cliente_id, 
    c.name, 
    c.sigla, 
    m.artigo_cli, 
    a.artigo_id, 
    a.descricao, 
    ta.tipo_artigo, 
    a.tipo_armazenamento, 
    m.tipo_armazem, 
    arm.descricao, 
    m.armazem_loc, 
    COALESCE(m.lote, 'S/LOTE'::text), 
    m.validade
HAVING sum(
    CASE
        WHEN (m.tipo_movimento = ANY (ARRAY['es'::text, 'et'::text])) THEN m.quantidade
        WHEN (m.tipo_movimento = ANY (ARRAY['ss'::text, 'st'::text])) THEN (- m.quantidade)
        ELSE (0)::numeric
    END) > (0)::numeric;

DROP VIEW IF EXISTS public.vw_stock_pedidos;
CREATE VIEW public.vw_stock_pedidos
WITH (security_invoker = true)
AS
SELECT 
    m.cliente_id,
    c.name AS cliente_nome,
    c.sigla AS cliente_sigla,
    m.artigo_cli AS artigo_id,
    a.artigo_id AS artigo_codigo,
    a.descricao AS artigo_descricao,
    ta.tipo_artigo,
    a.tipo_armazenamento,
    COALESCE(m.lote, 'S/LOTE'::text) AS lote,
    m.validade,
    min(m.data_fabrico) AS data_fabrico,
    sum(
        CASE
            WHEN (m.tipo_movimento = ANY (ARRAY['es'::text, 'et'::text])) THEN m.quantidade
            WHEN (m.tipo_movimento = ANY (ARRAY['ss'::text, 'st'::text])) THEN (- m.quantidade)
            ELSE (0)::numeric
        END) AS stock,
    max(m.data_movimento) AS ultimo_movimento
FROM public.movimentos m
JOIN public.clientes c ON c.id = m.cliente_id
JOIN public.artigos a ON a.artigo_cli = m.artigo_cli
JOIN public.tipos_artigo ta ON ta.id_tipo_artigo = a.id_tipo_artigo
WHERE m.tipo_armazem = '01'::text
GROUP BY 
    m.cliente_id, 
    c.name, 
    c.sigla, 
    m.artigo_cli, 
    a.artigo_id, 
    a.descricao, 
    ta.tipo_artigo, 
    a.tipo_armazenamento, 
    COALESCE(m.lote, 'S/LOTE'::text), 
    m.validade
HAVING sum(
    CASE
        WHEN (m.tipo_movimento = ANY (ARRAY['es'::text, 'et'::text])) THEN m.quantidade
        WHEN (m.tipo_movimento = ANY (ARRAY['ss'::text, 'st'::text])) THEN (- m.quantidade)
        ELSE (0)::numeric
    END) > (0)::numeric;

GRANT SELECT ON public.vw_stock_atual TO authenticated;
GRANT SELECT ON public.vw_stock_atual TO anon;
GRANT SELECT ON public.vw_stock_pedidos TO authenticated;
GRANT SELECT ON public.vw_stock_pedidos TO anon;
