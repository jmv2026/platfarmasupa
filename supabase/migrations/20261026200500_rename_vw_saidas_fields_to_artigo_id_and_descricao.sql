-- Migration: 20261026200500_rename_vw_saidas_fields_to_artigo_id_and_descricao.sql
-- Renomear campos na view vw_saidas:
-- - artigo -> artigo_id
-- - artigo_descricao -> descricao

DROP VIEW IF EXISTS public.vw_saidas CASCADE;

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
    COALESCE(ml.artigo_id, ml.artigo, ml.artigo_cli) AS artigo_id,
    COALESCE(ml.descricao, ml.artigo_cli) AS descricao,
    ''::text AS tipo_desc
FROM public.movimentos_linhas ml
JOIN public.movimentos m ON m.documento_ref = ml.documento_ref
WHERE (lower(ml.tipo_movimento) = 'ss'::text)
ORDER BY ml.artigo_cli, ml.lote;

GRANT SELECT ON public.vw_saidas TO authenticated, anon, service_role;
