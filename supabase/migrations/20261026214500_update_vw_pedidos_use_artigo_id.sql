-- Migration: 20261026214500_update_vw_pedidos_use_artigo_id.sql
-- Descrição: Atualiza a view vw_pedidos para expor ml.artigo como artigo_id e artigo_codigo,
--            mantendo ml.artigo_cli no campo artigo_cli e recuperando a descrição real do artigo.

CREATE OR REPLACE VIEW public.vw_pedidos WITH (security_invoker = true) AS 
 SELECT (((m.cliente_id)::text || '_'::text) || m.documento_ref) AS id,
    m.documento_ref,
    m.cliente_id,
    COALESCE(min(ml.data_movimento), min(m.data_movimento)) AS data_pedido,
    min(m.created_at) AS created_at,
    (count(ml.doc_linha))::integer AS total_linhas,
    COALESCE(sum(ml.quantidade), (0)::numeric) AS total_quantidade,
    max((m.sigla)::text) AS sigla,
    max(m.nome) AS nome,
    max(m.entidade) AS entidade,
    max(m.tipo_doc) AS tipo_doc,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', ml.doc_linha, 
                'artigo_id', ml.artigo, 
                'artigo_codigo', ml.artigo, 
                'artigo_cli', ml.artigo_cli,
                'descricao', COALESCE(NULLIF(TRIM(ml.descricao), ''), ml.artigo), 
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

GRANT SELECT ON public.vw_pedidos TO authenticated, anon, service_role;
