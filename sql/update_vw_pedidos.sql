-- ==============================================================================
-- ATUALIZAÇÃO DA VIEW: vw_pedidos
-- ==============================================================================
-- Adiciona a coluna agregada em formato JSONB 'pedido_linhas' contendo as linhas
-- de cada pedido/documento (artigo_id, artigo_codigo, descricao, quantidade, lote, validade),
-- permitindo que a view vw_pedidos substitua diretamente a consulta a pedidos e pedidos_linhas
-- no gráfico de Previsão de Stock e no Dashboard.
-- ==============================================================================

CREATE OR REPLACE VIEW public.vw_pedidos AS
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
            'artigo_codigo', COALESCE(a.artigo_id, m.artigo_cli),
            'descricao', COALESCE(a.descricao, m.artigo_cli),
            'quantidade', m.quantidade,
            'lote', m.lote,
            'validade', m.validade
        )
    ) AS pedido_linhas
FROM public.movimentos m
LEFT JOIN public.artigos a ON a.artigo_cli = m.artigo_cli
WHERE (lower(m.tipo_movimento) = 'ss'::text)
GROUP BY m.cliente_id, m.documento_ref
ORDER BY (min(m.data_movimento)) DESC;
