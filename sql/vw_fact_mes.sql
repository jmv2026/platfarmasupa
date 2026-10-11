-- View de Faturação / Movimentos de Saída Mensais Agrupados por Cliente e Mês
-- Contabiliza apenas uma ocorrência dos totais de cabeçalho por documento
CREATE OR REPLACE VIEW public.vw_fact_mes AS
WITH doc_totais AS (
    SELECT 
        m.sigla::text AS sigla_cliente,
        m.cliente_id,
        date_trunc('month', m.data_movimento::date)::date AS data,
        m.documento_ref,
        count(*)::integer AS doc_linhas,
        sum(COALESCE(m.quantidade, 0::numeric)) AS doc_quantidade,
        MAX(COALESCE(m.total_merc, 0::numeric)) AS doc_merc,
        MAX(COALESCE(m.total_desc, 0::numeric)) AS doc_desc,
        MAX(COALESCE(m.total_iva, 0::numeric)) AS doc_iva,
        MAX(COALESCE(m.total_outros, 0::numeric)) AS doc_outros
    FROM public.movimentos m
    WHERE lower(m.tipo_movimento) = 'ss'
    GROUP BY 
        m.sigla,
        m.cliente_id,
        date_trunc('month', m.data_movimento::date)::date,
        m.documento_ref
)
SELECT 
    sigla_cliente,
    cliente_id,
    data,
    EXTRACT(YEAR FROM data)::integer AS ano,
    EXTRACT(MONTH FROM data)::integer AS mes,
    to_char(data, 'YYYY-MM') AS ano_mes,
    count(DISTINCT documento_ref)::integer AS total_docs,
    sum(doc_linhas)::integer AS total_linhas,
    sum(doc_quantidade) AS total_quantidade,
    sum(doc_merc) AS total_merc,
    sum(doc_desc) AS total_desc,
    sum(doc_iva) AS total_iva,
    sum(doc_outros) AS total_outros,
    sum(doc_merc - doc_iva - doc_desc) AS total_liquido
FROM doc_totais
GROUP BY 
    sigla_cliente,
    cliente_id,
    data,
    EXTRACT(YEAR FROM data),
    EXTRACT(MONTH FROM data),
    to_char(data, 'YYYY-MM');

GRANT SELECT ON public.vw_fact_mes TO authenticated;
GRANT SELECT ON public.vw_fact_mes TO anon;
GRANT SELECT ON public.vw_fact_mes TO service_role;
