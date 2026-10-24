-- View de Faturação / Movimentos de Saída Mensais Agrupados por Cliente e Mês
-- Alimentada exclusivamente a partir da tabela movimentos (cabeçalhos de documentos)
-- Considera apenas documentos de faturação: FA, NCE, ND e NC
-- Os valores de NC e NCE são contabilizados como negativos

DROP VIEW IF EXISTS public.vw_fact_mes CASCADE;

CREATE VIEW public.vw_fact_mes WITH (security_invoker = true) AS
SELECT 
    (m.sigla)::text AS sigla_cliente,
    m.cliente_id,
    (date_trunc('month'::text, (COALESCE(m.data, (m.data_movimento)::date))::timestamp with time zone))::date AS data,
    (EXTRACT(year FROM COALESCE(m.data, (m.data_movimento)::date)))::integer AS ano,
    (EXTRACT(month FROM COALESCE(m.data, (m.data_movimento)::date)))::integer AS mes,
    to_char((COALESCE(m.data, (m.data_movimento)::date))::timestamp with time zone, 'YYYY-MM'::text) AS ano_mes,
    (count(*))::integer AS total_docs,
    (count(*))::integer AS total_linhas,
    (0)::numeric AS total_quantidade,
    sum(
        CASE 
            WHEN UPPER(TRIM(m.chave1)) IN ('NC', 'NCE') THEN -ABS(COALESCE(m.total_merc, m.totalmerc, 0::numeric))
            ELSE ABS(COALESCE(m.total_merc, m.totalmerc, 0::numeric))
        END
    ) AS total_merc,
    sum(
        CASE 
            WHEN UPPER(TRIM(m.chave1)) IN ('NC', 'NCE') THEN -ABS(COALESCE(m.total_desc, m.totaldesc, 0::numeric))
            ELSE ABS(COALESCE(m.total_desc, m.totaldesc, 0::numeric))
        END
    ) AS total_desc,
    sum(
        CASE 
            WHEN UPPER(TRIM(m.chave1)) IN ('NC', 'NCE') THEN -ABS(COALESCE(m.total_iva, m.totaliva, 0::numeric))
            ELSE ABS(COALESCE(m.total_iva, m.totaliva, 0::numeric))
        END
    ) AS total_iva,
    sum(
        CASE 
            WHEN UPPER(TRIM(m.chave1)) IN ('NC', 'NCE') THEN -ABS(COALESCE(m.total_outros, m.totaloutros, 0::numeric))
            ELSE ABS(COALESCE(m.total_outros, m.totaloutros, 0::numeric))
        END
    ) AS total_outros,
    sum(
        CASE 
            WHEN UPPER(TRIM(m.chave1)) IN ('NC', 'NCE') THEN -(ABS(COALESCE(m.total_merc, m.totalmerc, 0::numeric)) - ABS(COALESCE(m.total_iva, m.totaliva, 0::numeric)) - ABS(COALESCE(m.total_desc, m.totaldesc, 0::numeric)))
            ELSE (ABS(COALESCE(m.total_merc, m.totalmerc, 0::numeric)) - ABS(COALESCE(m.total_iva, m.totaliva, 0::numeric)) - ABS(COALESCE(m.total_desc, m.totaldesc, 0::numeric)))
        END
    ) AS total_liquido
FROM public.movimentos m
WHERE UPPER(TRIM(m.chave1)) IN ('FA', 'NCE', 'ND', 'NC')
GROUP BY 
    m.sigla, 
    m.cliente_id, 
    (date_trunc('month'::text, (COALESCE(m.data, (m.data_movimento)::date))::timestamp with time zone))::date,
    (EXTRACT(year FROM COALESCE(m.data, (m.data_movimento)::date))),
    (EXTRACT(month FROM COALESCE(m.data, (m.data_movimento)::date))),
    to_char((COALESCE(m.data, (m.data_movimento)::date))::timestamp with time zone, 'YYYY-MM'::text);

GRANT SELECT ON public.vw_fact_mes TO authenticated, anon, service_role;
