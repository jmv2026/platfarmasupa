-- Migration: 20261025004000_fix_vw_fact_mes_direct_nc_values.sql
-- Descrição: Ajusta o cálculo da view vw_fact_mes para somar diretamente os valores dos campos
--            (total_merc, total_iva, total_desc, total_outros) e apurar o total_liquido,
--            uma vez que os registos de NC e NCE são importados diretamente com valores negativos.

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
