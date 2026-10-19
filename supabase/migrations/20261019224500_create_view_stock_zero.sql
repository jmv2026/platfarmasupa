-- Migration: 20261019224500_create_view_stock_zero.sql
-- Criação da view vw_stock_zero para listagem de artigos sem stock / stock esgotado

CREATE OR REPLACE VIEW public.vw_stock_zero AS
WITH art_agg AS (
    SELECT 
        a.artigo_id,
        c.id AS cliente_id,
        c.name AS cliente_nome,
        c.sigla AS cliente_sigla,
        MAX(a.descricao) AS artigo_descricao,
        MAX(a.id_tipo_artigo) AS tipo_artigo,
        MAX(a.tipo_armazenamento) AS tipo_armazenamento,
        MAX(a.familia) AS familia,
        MAX(a.subfamilia) AS subfamilia
    FROM public.artigos a
    JOIN public.clientes c ON (c.sigla = a.cli_primavera OR c.cli_primavera = a.cli_primavera)
    WHERE auth.uid() IS NULL 
       OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role = ANY (ARRAY['admin'::text, 'gestor'::text]) OR u.cliente_id IS NULL)))
       OR c.id = (SELECT u.cliente_id FROM public.users u WHERE u.id = auth.uid())
    GROUP BY a.artigo_id, c.id, c.name, c.sigla
),
mov_agg AS (
    SELECT 
        m.cliente_id,
        ml.artigo,
        SUM(CASE WHEN ml.tipo_movimento = ANY (ARRAY['es'::text, 'et'::text]) THEN ml.quantidade 
                 WHEN ml.tipo_movimento = ANY (ARRAY['ss'::text, 'st'::text]) THEN - ml.quantidade 
                 ELSE 0::numeric END) AS stock,
        MAX(ml.data_movimento) AS ultimo_movimento,
        COUNT(ml.doc_linha) AS total_movimentos,
        COALESCE(string_agg(DISTINCT ml.lote, ', ') FILTER (WHERE ml.lote IS NOT NULL AND ml.lote <> ''), '-') AS lotes_historico
    FROM public.movimentos_linhas ml
    JOIN public.movimentos m ON m.documento_ref = ml.documento_ref
    GROUP BY m.cliente_id, ml.artigo
)
SELECT 
    art.cliente_id,
    art.cliente_nome,
    art.cliente_sigla,
    art.artigo_id,
    art.cliente_sigla || '-' || art.artigo_id AS artigo_codigo,
    art.artigo_descricao,
    art.tipo_artigo,
    art.tipo_armazenamento,
    art.familia,
    art.subfamilia,
    COALESCE(mov.stock, 0::numeric) AS stock,
    mov.ultimo_movimento,
    COALESCE(mov.total_movimentos, 0::bigint) AS total_movimentos,
    COALESCE(mov.lotes_historico, '-'::text) AS lotes_historico
FROM art_agg art
LEFT JOIN mov_agg mov ON mov.cliente_id = art.cliente_id AND mov.artigo = art.artigo_id
WHERE COALESCE(mov.stock, 0::numeric) <= 0::numeric;

GRANT SELECT ON public.vw_stock_zero TO authenticated, anon, service_role;
