-- View de Faturação / Movimentos de Saída Mensais Agrupados por Cliente e Mês
-- Alimentada exclusivamente a partir da tabela faturas (cabeçalhos de documentos de faturação)
-- Chave primária da tabela faturas: documento_ref
-- Nota: Os registos cujo tipo_doc é NC ou NCE são importados com valores negativos nos campos monetários.

DROP VIEW IF EXISTS public.vw_fact_mes CASCADE;

CREATE VIEW public.vw_fact_mes WITH (security_invoker = true) AS
SELECT 
    COALESCE(c.sigla, f.sigla, split_part(f.documento_ref, '-', 1))::text AS sigla_cliente,
    c.id AS cliente_id,
    (date_trunc('month'::text, (COALESCE(f.data, CURRENT_DATE))::timestamp with time zone))::date AS data,
    (EXTRACT(year FROM COALESCE(f.data, CURRENT_DATE)))::integer AS ano,
    (EXTRACT(month FROM COALESCE(f.data, CURRENT_DATE)))::integer AS mes,
    to_char((COALESCE(f.data, CURRENT_DATE))::timestamp with time zone, 'YYYY-MM'::text) AS ano_mes,
    (count(*))::integer AS total_docs,
    (count(*))::integer AS total_linhas,
    (0)::numeric AS total_quantidade,
    sum(COALESCE(f.total_merc, 0::numeric)) AS total_merc,
    sum(COALESCE(f.total_desc, 0::numeric)) AS total_desc,
    sum(COALESCE(f.total_iva, 0::numeric)) AS total_iva,
    sum(COALESCE(f.total_outros, 0::numeric)) AS total_outros,
    sum(
        COALESCE(f.total_merc, 0::numeric) 
        - COALESCE(f.total_iva, 0::numeric) 
        - COALESCE(f.total_desc, 0::numeric)
    ) AS total_liquido
FROM public.faturas f
LEFT JOIN public.clientes c ON (
    (c.cli_primavera IS NOT NULL AND TRIM(c.cli_primavera) = TRIM(f.cli_primavera))
    OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(f.sigla))
    OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(f.cliente_ser))
    OR UPPER(TRIM(c.name)) = UPPER(TRIM(f.cliente_ser))
    OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(split_part(f.documento_ref, '-', 1)))
)
WHERE UPPER(TRIM(COALESCE(f.tipo_doc, split_part(f.documento, ' ', 1)))) IN ('FA', 'NCE', 'ND', 'NC')
GROUP BY 
    COALESCE(c.sigla, f.sigla, split_part(f.documento_ref, '-', 1)),
    c.id,
    (date_trunc('month'::text, (COALESCE(f.data, CURRENT_DATE))::timestamp with time zone))::date,
    (EXTRACT(year FROM COALESCE(f.data, CURRENT_DATE))),
    (EXTRACT(month FROM COALESCE(f.data, CURRENT_DATE))),
    to_char((COALESCE(f.data, CURRENT_DATE))::timestamp with time zone, 'YYYY-MM'::text);

GRANT SELECT ON public.vw_fact_mes TO authenticated, anon, service_role;
