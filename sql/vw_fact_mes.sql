CREATE OR REPLACE VIEW public.vw_fact_mes AS
SELECT 
    sigla_cliente,
    data,
    serie,
    tipo_doc,
    num_doc,
    entidade,
    MAX(total_merc) AS total_merc,
    MAX(total_desc) AS total_desc,
    MAX(total_iva) AS total_iva
FROM 
    public.doc_venda
GROUP BY 
    sigla_cliente,
    data,
    serie,
    tipo_doc,
    num_doc,
    entidade;
