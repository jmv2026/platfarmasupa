-- Migration: 20261028170000_ddd_stock_from_movimentos.sql
-- Descrição: Configura as views vw_stock_atual, vw_stock_pedidos e vw_stock_zero
--            para obterem os dados de stock exclusivamente das tabelas movimentos / movimentos_linhas
--            para o cliente DDD, mantendo a tabela public.stock como fonte para todos os restantes clientes.

-- 1. vw_stock_atual
CREATE OR REPLACE VIEW public.vw_stock_atual WITH (security_invoker = true) AS
-- Parte A: Todos os clientes EXCETO DDD (fonte: public.stock)
SELECT 
    c.id AS cliente_id,
    COALESCE(c.name, s.cliente_ser, s.sigla) AS cliente_nome,
    COALESCE(c.sigla, s.sigla::character varying, s.cliente_ser::character varying) AS cliente_sigla,
    s.artigo_id AS artigo_id,
    COALESCE(a.artigo_cli, (s.sigla || '-' || s.artigo_id), s.artigo_id) AS artigo_cli,
    COALESCE(NULLIF(TRIM(a.descricao), ''), NULLIF(TRIM(s.descricao), '')) AS descricao,
    COALESCE(a.id_tipo_artigo, '')::text AS tipo_artigo,
    COALESCE(a.tipo_armazenamento, 'TA')::text AS tipo_armazenamento,
    CASE 
        WHEN s.armazem ~ '[0-9]{2}$' THEN substring(s.armazem from '[0-9]{2}$')
        WHEN s.armazem ~ '[0-9]{1}$' THEN lpad(substring(s.armazem from '[0-9]{1}$'), 2, '0')
        ELSE s.armazem 
    END AS tipo_armazem,
    COALESCE(arm.descricao, s.armazem) AS armazem_descricao,
    s.armazem AS armazem_loc,
    COALESCE(s.lote, 'S/LOTE'::text) AS lote,
    s.validade AS validade,
    s.data_fabrico AS data_fabrico,
    SUM(s.stock) AS stock,
    MAX(s.created_at) AS ultimo_movimento,
    string_agg(s.id::text, ',') AS stock_id,
    s.data_stock AS data_stock
FROM public.stock s
LEFT JOIN LATERAL (
    SELECT c1.id, c1.name, c1.sigla, c1.cli_primavera
    FROM public.clientes c1
    WHERE c1.cli_primavera = s.entidade 
       OR c1.sigla = s.sigla 
       OR c1.sigla = s.cliente_ser
    ORDER BY 
        CASE WHEN c1.cli_primavera = s.entidade THEN 1
             WHEN c1.sigla = s.sigla THEN 2
             ELSE 3 END
    LIMIT 1
) c ON true
LEFT JOIN LATERAL (
    SELECT 
        a1.artigo_id,
        a1.artigo_cli,
        a1.descricao,
        a1.id_tipo_artigo,
        a1.tipo_armazenamento
    FROM public.artigos a1
    WHERE a1.artigo_id = s.artigo_id
       OR a1.artigo_cli = s.artigo_id
       OR a1.artigo_cli = (s.entidade || '-' || s.artigo_id)
       OR a1.artigo_cli = (s.sigla || '-' || s.artigo_id)
       OR (c.sigla IS NOT NULL AND a1.artigo_cli = (c.sigla || '-' || s.artigo_id))
       OR (c.cli_primavera IS NOT NULL AND a1.artigo_cli = (c.cli_primavera || '-' || s.artigo_id))
    ORDER BY 
        CASE WHEN a1.cli_primavera = s.entidade THEN 1 
             WHEN a1.cli_primavera = s.sigla THEN 2 
             WHEN a1.cli_primavera = c.cli_primavera THEN 3
             ELSE 4 END
    LIMIT 1
) a ON true
LEFT JOIN public.armazens arm ON arm.tipo_armazem = (
    CASE 
        WHEN s.armazem ~ '[0-9]{2}$' THEN substring(s.armazem from '[0-9]{2}$')
        WHEN s.armazem ~ '[0-9]{1}$' THEN lpad(substring(s.armazem from '[0-9]{1}$'), 2, '0')
        ELSE s.armazem 
    END
)
WHERE UPPER(TRIM(COALESCE(c.sigla, s.sigla, s.cliente_ser, ''))) <> 'DDD'
  AND UPPER(TRIM(COALESCE(s.sigla, ''))) <> 'DDD'
  AND (
    auth.uid() IS NULL
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
          AND (u.role = ANY (ARRAY['admin'::text, 'gestor'::text]) OR u.cliente_id IS NULL)
    )
    OR c.id = (
        SELECT u.cliente_id FROM public.users u 
        WHERE u.id = auth.uid()
    )
)
GROUP BY 
    c.id,
    COALESCE(c.name, s.cliente_ser, s.sigla),
    COALESCE(c.sigla, s.sigla::character varying, s.cliente_ser::character varying),
    s.artigo_id,
    COALESCE(a.artigo_cli, (s.sigla || '-' || s.artigo_id), s.artigo_id),
    COALESCE(NULLIF(TRIM(a.descricao), ''), NULLIF(TRIM(s.descricao), '')),
    COALESCE(a.id_tipo_artigo, '')::text,
    COALESCE(a.tipo_armazenamento, 'TA')::text,
    CASE 
        WHEN s.armazem ~ '[0-9]{2}$' THEN substring(s.armazem from '[0-9]{2}$')
        WHEN s.armazem ~ '[0-9]{1}$' THEN lpad(substring(s.armazem from '[0-9]{1}$'), 2, '0')
        ELSE s.armazem 
    END,
    COALESCE(arm.descricao, s.armazem),
    s.armazem,
    COALESCE(s.lote, 'S/LOTE'::text),
    s.validade,
    s.data_fabrico,
    s.data_stock
HAVING SUM(s.stock) > 0

UNION ALL

-- Parte B: Exclusivamente cliente DDD (fonte: public.movimentos e public.movimentos_linhas)
SELECT 
    c.id AS cliente_id,
    c.name AS cliente_nome,
    c.sigla AS cliente_sigla,
    COALESCE(ml.artigo_id, ml.artigo) AS artigo_id,
    COALESCE(a.artigo_cli, ml.artigo_cli, (c.sigla || '-' || COALESCE(ml.artigo_id, ml.artigo))) AS artigo_cli,
    COALESCE(NULLIF(TRIM(a.descricao), ''), MAX(NULLIF(TRIM(ml.descricao), ''))) AS descricao,
    COALESCE(a.id_tipo_artigo, MAX(NULLIF(TRIM(ml.tipo_artigo), '')), '')::text AS tipo_artigo,
    COALESCE(a.tipo_armazenamento, 'TA')::text AS tipo_armazenamento,
    COALESCE(
        NULLIF(TRIM(ml.tipo_armazem), ''),
        CASE 
            WHEN ml.armazem ~ '[0-9]{2}$' THEN substring(ml.armazem from '[0-9]{2}$')
            WHEN ml.armazem ~ '[0-9]{1}$' THEN lpad(substring(ml.armazem from '[0-9]{1}$'), 2, '0')
            ELSE COALESCE(ml.armazem, '01')
        END
    ) AS tipo_armazem,
    COALESCE(arm.descricao, ml.armazem, ml.armazem_loc) AS armazem_descricao,
    COALESCE(ml.armazem, ml.armazem_loc, 'DDD01') AS armazem_loc,
    COALESCE(NULLIF(TRIM(ml.lote), ''), 'S/LOTE'::text) AS lote,
    ml.validade AS validade,
    MIN(ml.data_fabrico) AS data_fabrico,
    SUM(
        CASE
            WHEN LOWER(TRIM(ml.tipo_movimento)) = ANY (ARRAY['es'::text, 'et'::text, 'e'::text]) THEN COALESCE(ml.quantidade, 0::numeric)
            WHEN LOWER(TRIM(ml.tipo_movimento)) = ANY (ARRAY['ss'::text, 'st'::text, 's'::text]) THEN -COALESCE(ml.quantidade, 0::numeric)
            ELSE 0::numeric
        END
    ) AS stock,
    MAX(COALESCE(ml.data_movimento, m.data_movimento, ml.created_at)) AS ultimo_movimento,
    string_agg(ml.doc_linha::text, ',') AS stock_id,
    MAX(COALESCE(ml.data, m.data, ml.data_movimento::date)) AS data_stock
FROM public.movimentos_linhas ml
JOIN public.movimentos m ON m.documento_ref = ml.documento_ref
JOIN public.clientes c ON (c.id = m.cliente_id OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(COALESCE(m.sigla, ml.sigla, ml.cliente_ser))))
LEFT JOIN LATERAL (
    SELECT 
        a1.artigo_id,
        a1.artigo_cli,
        a1.descricao,
        a1.id_tipo_artigo,
        a1.tipo_armazenamento
    FROM public.artigos a1
    WHERE LOWER(a1.artigo_cli) = LOWER(COALESCE(ml.artigo_cli, c.sigla || '-' || COALESCE(ml.artigo_id, ml.artigo)))
       OR (LOWER(a1.artigo_id) = LOWER(COALESCE(ml.artigo_id, ml.artigo)) AND (UPPER(a1.cli_primavera) = 'DDD' OR UPPER(SPLIT_PART(a1.artigo_cli, '-', 1)) = 'DDD'))
    ORDER BY 
        CASE WHEN LOWER(a1.artigo_cli) = LOWER(ml.artigo_cli) THEN 1 ELSE 2 END
    LIMIT 1
) a ON true
LEFT JOIN public.armazens arm ON arm.tipo_armazem = COALESCE(
    NULLIF(TRIM(ml.tipo_armazem), ''),
    CASE 
        WHEN ml.armazem ~ '[0-9]{2}$' THEN substring(ml.armazem from '[0-9]{2}$')
        WHEN ml.armazem ~ '[0-9]{1}$' THEN lpad(substring(ml.armazem from '[0-9]{1}$'), 2, '0')
        ELSE COALESCE(ml.armazem, '01')
    END
)
WHERE UPPER(TRIM(c.sigla)) = 'DDD'
  AND (
    auth.uid() IS NULL
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
          AND (u.role = ANY (ARRAY['admin'::text, 'gestor'::text]) OR u.cliente_id IS NULL)
    )
    OR c.id = (
        SELECT u.cliente_id FROM public.users u 
        WHERE u.id = auth.uid()
    )
)
GROUP BY 
    c.id,
    c.name,
    c.sigla,
    COALESCE(ml.artigo_id, ml.artigo),
    COALESCE(a.artigo_cli, ml.artigo_cli, (c.sigla || '-' || COALESCE(ml.artigo_id, ml.artigo))),
    NULLIF(TRIM(a.descricao), ''),
    a.id_tipo_artigo,
    COALESCE(a.tipo_armazenamento, 'TA')::text,
    COALESCE(
        NULLIF(TRIM(ml.tipo_armazem), ''),
        CASE 
            WHEN ml.armazem ~ '[0-9]{2}$' THEN substring(ml.armazem from '[0-9]{2}$')
            WHEN ml.armazem ~ '[0-9]{1}$' THEN lpad(substring(ml.armazem from '[0-9]{1}$'), 2, '0')
            ELSE COALESCE(ml.armazem, '01')
        END
    ),
    COALESCE(arm.descricao, ml.armazem, ml.armazem_loc),
    COALESCE(ml.armazem, ml.armazem_loc, 'DDD01'),
    COALESCE(NULLIF(TRIM(ml.lote), ''), 'S/LOTE'::text),
    ml.validade
HAVING SUM(
    CASE
        WHEN LOWER(TRIM(ml.tipo_movimento)) = ANY (ARRAY['es'::text, 'et'::text, 'e'::text]) THEN COALESCE(ml.quantidade, 0::numeric)
        WHEN LOWER(TRIM(ml.tipo_movimento)) = ANY (ARRAY['ss'::text, 'st'::text, 's'::text]) THEN -COALESCE(ml.quantidade, 0::numeric)
        ELSE 0::numeric
    END
) > 0;

-- 2. vw_stock_pedidos
CREATE OR REPLACE VIEW public.vw_stock_pedidos WITH (security_invoker = true) AS
-- Parte A: Todos os clientes EXCETO DDD (fonte: public.stock)
SELECT 
    c.id AS cliente_id,
    COALESCE(c.name, s.cliente_ser, s.sigla) AS cliente_nome,
    COALESCE(c.sigla, s.sigla::character varying, s.cliente_ser::character varying) AS cliente_sigla,
    s.artigo_id AS artigo_id,
    COALESCE(a.artigo_cli, (s.sigla || '-' || s.artigo_id), s.artigo_id) AS artigo_cli,
    COALESCE(NULLIF(TRIM(a.descricao), ''), NULLIF(TRIM(s.descricao), '')) AS descricao,
    COALESCE(a.id_tipo_artigo, '')::text AS tipo_artigo,
    COALESCE(a.tipo_armazenamento, 'TA')::text AS tipo_armazenamento,
    COALESCE(s.lote, 'S/LOTE'::text) AS lote,
    s.validade AS validade,
    s.data_fabrico AS data_fabrico,
    SUM(s.stock) AS stock,
    MAX(s.created_at) AS ultimo_movimento,
    s.data_stock AS data_stock
FROM public.stock s
LEFT JOIN LATERAL (
    SELECT c1.id, c1.name, c1.sigla, c1.cli_primavera
    FROM public.clientes c1
    WHERE c1.cli_primavera = s.entidade 
       OR c1.sigla = s.sigla 
       OR c1.sigla = s.cliente_ser
    ORDER BY 
        CASE WHEN c1.cli_primavera = s.entidade THEN 1
             WHEN c1.sigla = s.sigla THEN 2
             ELSE 3 END
    LIMIT 1
) c ON true
LEFT JOIN LATERAL (
    SELECT 
        a1.artigo_id,
        a1.artigo_cli,
        a1.descricao,
        a1.id_tipo_artigo,
        a1.tipo_armazenamento
    FROM public.artigos a1
    WHERE a1.artigo_id = s.artigo_id
       OR a1.artigo_cli = s.artigo_id
       OR a1.artigo_cli = (s.entidade || '-' || s.artigo_id)
       OR a1.artigo_cli = (s.sigla || '-' || s.artigo_id)
       OR (c.sigla IS NOT NULL AND a1.artigo_cli = (c.sigla || '-' || s.artigo_id))
       OR (c.cli_primavera IS NOT NULL AND a1.artigo_cli = (c.cli_primavera || '-' || s.artigo_id))
    ORDER BY 
        CASE WHEN a1.cli_primavera = s.entidade THEN 1 
             WHEN a1.cli_primavera = s.sigla THEN 2 
             WHEN a1.cli_primavera = c.cli_primavera THEN 3
             ELSE 4 END
    LIMIT 1
) a ON true
WHERE UPPER(TRIM(COALESCE(c.sigla, s.sigla, s.cliente_ser, ''))) <> 'DDD'
  AND UPPER(TRIM(COALESCE(s.sigla, ''))) <> 'DDD'
  AND (
    CASE 
        WHEN s.armazem ~ '[0-9]{2}$' THEN substring(s.armazem from '[0-9]{2}$')
        WHEN s.armazem ~ '[0-9]{1}$' THEN lpad(substring(s.armazem from '[0-9]{1}$'), 2, '0')
        ELSE s.armazem 
    END = '01'
  )
  AND (
    auth.uid() IS NULL
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
          AND (u.role = ANY (ARRAY['admin'::text, 'gestor'::text]) OR u.cliente_id IS NULL)
    )
    OR c.id = (
        SELECT u.cliente_id FROM public.users u 
        WHERE u.id = auth.uid()
    )
  )
GROUP BY 
    c.id,
    COALESCE(c.name, s.cliente_ser, s.sigla),
    COALESCE(c.sigla, s.sigla::character varying, s.cliente_ser::character varying),
    s.artigo_id,
    COALESCE(a.artigo_cli, (s.sigla || '-' || s.artigo_id), s.artigo_id),
    COALESCE(NULLIF(TRIM(a.descricao), ''), NULLIF(TRIM(s.descricao), '')),
    COALESCE(a.id_tipo_artigo, '')::text,
    COALESCE(a.tipo_armazenamento, 'TA')::text,
    COALESCE(s.lote, 'S/LOTE'::text),
    s.validade,
    s.data_fabrico,
    s.data_stock
HAVING SUM(s.stock) > 0

UNION ALL

-- Parte B: Exclusivamente cliente DDD (fonte: public.movimentos e public.movimentos_linhas, armazém 01)
SELECT 
    c.id AS cliente_id,
    c.name AS cliente_nome,
    c.sigla AS cliente_sigla,
    COALESCE(ml.artigo_id, ml.artigo) AS artigo_id,
    COALESCE(a.artigo_cli, ml.artigo_cli, (c.sigla || '-' || COALESCE(ml.artigo_id, ml.artigo))) AS artigo_cli,
    COALESCE(NULLIF(TRIM(a.descricao), ''), MAX(NULLIF(TRIM(ml.descricao), ''))) AS descricao,
    COALESCE(a.id_tipo_artigo, MAX(NULLIF(TRIM(ml.tipo_artigo), '')), '')::text AS tipo_artigo,
    COALESCE(a.tipo_armazenamento, 'TA')::text AS tipo_armazenamento,
    COALESCE(NULLIF(TRIM(ml.lote), ''), 'S/LOTE'::text) AS lote,
    ml.validade AS validade,
    MIN(ml.data_fabrico) AS data_fabrico,
    SUM(
        CASE
            WHEN LOWER(TRIM(ml.tipo_movimento)) = ANY (ARRAY['es'::text, 'et'::text, 'e'::text]) THEN COALESCE(ml.quantidade, 0::numeric)
            WHEN LOWER(TRIM(ml.tipo_movimento)) = ANY (ARRAY['ss'::text, 'st'::text, 's'::text]) THEN -COALESCE(ml.quantidade, 0::numeric)
            ELSE 0::numeric
        END
    ) AS stock,
    MAX(COALESCE(ml.data_movimento, m.data_movimento, ml.created_at)) AS ultimo_movimento,
    MAX(COALESCE(ml.data, m.data, ml.data_movimento::date)) AS data_stock
FROM public.movimentos_linhas ml
JOIN public.movimentos m ON m.documento_ref = ml.documento_ref
JOIN public.clientes c ON (c.id = m.cliente_id OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(COALESCE(m.sigla, ml.sigla, ml.cliente_ser))))
LEFT JOIN LATERAL (
    SELECT 
        a1.artigo_id,
        a1.artigo_cli,
        a1.descricao,
        a1.id_tipo_artigo,
        a1.tipo_armazenamento
    FROM public.artigos a1
    WHERE LOWER(a1.artigo_cli) = LOWER(COALESCE(ml.artigo_cli, c.sigla || '-' || COALESCE(ml.artigo_id, ml.artigo)))
       OR (LOWER(a1.artigo_id) = LOWER(COALESCE(ml.artigo_id, ml.artigo)) AND (UPPER(a1.cli_primavera) = 'DDD' OR UPPER(SPLIT_PART(a1.artigo_cli, '-', 1)) = 'DDD'))
    ORDER BY 
        CASE WHEN LOWER(a1.artigo_cli) = LOWER(ml.artigo_cli) THEN 1 ELSE 2 END
    LIMIT 1
) a ON true
WHERE UPPER(TRIM(c.sigla)) = 'DDD'
  AND COALESCE(
        NULLIF(TRIM(ml.tipo_armazem), ''),
        CASE 
            WHEN ml.armazem ~ '[0-9]{2}$' THEN substring(ml.armazem from '[0-9]{2}$')
            WHEN ml.armazem ~ '[0-9]{1}$' THEN lpad(substring(ml.armazem from '[0-9]{1}$'), 2, '0')
            ELSE COALESCE(ml.armazem, '01')
        END
  ) = '01'
  AND (
    auth.uid() IS NULL
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
          AND (u.role = ANY (ARRAY['admin'::text, 'gestor'::text]) OR u.cliente_id IS NULL)
    )
    OR c.id = (
        SELECT u.cliente_id FROM public.users u 
        WHERE u.id = auth.uid()
    )
  )
GROUP BY 
    c.id,
    c.name,
    c.sigla,
    COALESCE(ml.artigo_id, ml.artigo),
    COALESCE(a.artigo_cli, ml.artigo_cli, (c.sigla || '-' || COALESCE(ml.artigo_id, ml.artigo))),
    NULLIF(TRIM(a.descricao), ''),
    a.id_tipo_artigo,
    COALESCE(a.tipo_armazenamento, 'TA')::text,
    COALESCE(NULLIF(TRIM(ml.lote), ''), 'S/LOTE'::text),
    ml.validade
HAVING SUM(
    CASE
        WHEN LOWER(TRIM(ml.tipo_movimento)) = ANY (ARRAY['es'::text, 'et'::text, 'e'::text]) THEN COALESCE(ml.quantidade, 0::numeric)
        WHEN LOWER(TRIM(ml.tipo_movimento)) = ANY (ARRAY['ss'::text, 'st'::text, 's'::text]) THEN -COALESCE(ml.quantidade, 0::numeric)
        ELSE 0::numeric
    END
) > 0;

-- 3. vw_stock_zero
CREATE OR REPLACE VIEW public.vw_stock_zero WITH (security_invoker = true) AS
WITH positive_articles AS (
    -- Clientes <> DDD: artigos com stock positivo na tabela public.stock
    SELECT 
        c.id AS cliente_id,
        s.artigo_id,
        REGEXP_REPLACE(s.artigo_id, '^[0-9]+-', '') AS norm_artigo_id
    FROM public.stock s
    JOIN public.clientes c ON (c.cli_primavera = s.entidade OR c.sigla = s.sigla OR c.sigla = s.cliente_ser)
    WHERE UPPER(TRIM(c.sigla)) <> 'DDD'
    GROUP BY c.id, s.artigo_id
    HAVING SUM(s.stock) > 0

    UNION ALL

    -- Cliente DDD: artigos com saldo positivo nas tabelas movimentos / movimentos_linhas
    SELECT 
        c.id AS cliente_id,
        COALESCE(ml.artigo_id, ml.artigo) AS artigo_id,
        REGEXP_REPLACE(COALESCE(ml.artigo_id, ml.artigo), '^[0-9]+-', '') AS norm_artigo_id
    FROM public.movimentos_linhas ml
    JOIN public.movimentos m ON m.documento_ref = ml.documento_ref
    JOIN public.clientes c ON (c.id = m.cliente_id OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(COALESCE(m.sigla, ml.sigla, ml.cliente_ser))))
    WHERE UPPER(TRIM(c.sigla)) = 'DDD'
    GROUP BY c.id, COALESCE(ml.artigo_id, ml.artigo)
    HAVING SUM(
        CASE
            WHEN LOWER(TRIM(ml.tipo_movimento)) = ANY (ARRAY['es'::text, 'et'::text, 'e'::text]) THEN COALESCE(ml.quantidade, 0::numeric)
            WHEN LOWER(TRIM(ml.tipo_movimento)) = ANY (ARRAY['ss'::text, 'st'::text, 's'::text]) THEN -COALESCE(ml.quantidade, 0::numeric)
            ELSE 0::numeric
        END
    ) > 0
),
stock_agg AS (
    -- Clientes <> DDD: agrupamento a partir de public.stock
    SELECT 
        s.sigla,
        s.entidade,
        s.artigo_id,
        MAX(s.descricao) AS stock_descricao,
        SUM(s.stock) AS total_stock,
        MAX(s.created_at) AS ultimo_movimento,
        COUNT(s.id) AS total_registos
    FROM public.stock s
    WHERE UPPER(TRIM(COALESCE(s.sigla, ''))) <> 'DDD'
      AND UPPER(TRIM(COALESCE(s.cliente_ser, ''))) <> 'DDD'
    GROUP BY s.sigla, s.entidade, s.artigo_id

    UNION ALL

    -- Cliente DDD: agrupamento a partir de public.movimentos e public.movimentos_linhas
    SELECT 
        'DDD'::text AS sigla,
        MAX(m.entidade) AS entidade,
        COALESCE(ml.artigo_id, ml.artigo) AS artigo_id,
        MAX(ml.descricao) AS stock_descricao,
        SUM(
            CASE
                WHEN LOWER(TRIM(ml.tipo_movimento)) = ANY (ARRAY['es'::text, 'et'::text, 'e'::text]) THEN COALESCE(ml.quantidade, 0::numeric)
                WHEN LOWER(TRIM(ml.tipo_movimento)) = ANY (ARRAY['ss'::text, 'st'::text, 's'::text]) THEN -COALESCE(ml.quantidade, 0::numeric)
                ELSE 0::numeric
            END
        ) AS total_stock,
        MAX(COALESCE(ml.data_movimento, m.data_movimento, ml.created_at)) AS ultimo_movimento,
        COUNT(ml.doc_linha) AS total_registos
    FROM public.movimentos_linhas ml
    JOIN public.movimentos m ON m.documento_ref = ml.documento_ref
    JOIN public.clientes c ON (c.id = m.cliente_id OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(COALESCE(m.sigla, ml.sigla, ml.cliente_ser))))
    WHERE UPPER(TRIM(c.sigla)) = 'DDD'
    GROUP BY COALESCE(ml.artigo_id, ml.artigo)
),
catalog_artigos AS (
    SELECT 
        a.artigo_id,
        a.artigo_cli,
        a.descricao,
        a.id_tipo_artigo,
        a.tipo_armazenamento,
        a.familia,
        a.subfamilia,
        c.id AS cliente_id,
        c.name AS cliente_nome,
        c.sigla AS cliente_sigla,
        c.cli_primavera
    FROM public.artigos a
    JOIN public.clientes c ON (
        c.sigla = a.cli_primavera 
        OR c.cli_primavera = a.cli_primavera
        OR (UPPER(TRIM(c.sigla)) = 'DDD' AND UPPER(SPLIT_PART(a.artigo_cli, '-', 1)) = 'DDD')
    )
),
all_zero_candidates AS (
    SELECT 
        c.id AS cliente_id,
        COALESCE(c.name, sa.sigla) AS cliente_nome,
        COALESCE(c.sigla, sa.sigla::character varying) AS cliente_sigla,
        COALESCE(ca.artigo_id, REGEXP_REPLACE(sa.artigo_id, '^[0-9]+-', ''), sa.artigo_id) AS artigo_id,
        COALESCE(ca.artigo_cli, (sa.sigla || '-' || sa.artigo_id)) AS artigo_cli,
        COALESCE(NULLIF(TRIM(ca.descricao), ''), NULLIF(TRIM(sa.stock_descricao), '')) AS descricao,
        COALESCE(ca.id_tipo_artigo, '')::text AS tipo_artigo,
        COALESCE(ca.tipo_armazenamento, 'TA')::text AS tipo_armazenamento,
        ca.familia,
        ca.subfamilia,
        0::numeric AS stock,
        sa.ultimo_movimento,
        sa.total_registos AS total_movimentos,
        '-'::text AS lotes_historico
    FROM stock_agg sa
    LEFT JOIN LATERAL (
        SELECT c1.id, c1.name, c1.sigla, c1.cli_primavera
        FROM public.clientes c1
        WHERE c1.cli_primavera = sa.entidade OR c1.sigla = sa.sigla
        LIMIT 1
    ) c ON true
    LEFT JOIN LATERAL (
        SELECT ca1.artigo_id, ca1.artigo_cli, ca1.descricao, ca1.id_tipo_artigo, ca1.tipo_armazenamento, ca1.familia, ca1.subfamilia
        FROM public.artigos ca1
        WHERE LOWER(ca1.artigo_id) = LOWER(sa.artigo_id)
           OR LOWER(ca1.artigo_cli) = LOWER(sa.artigo_id)
           OR LOWER(ca1.artigo_id) = LOWER(REGEXP_REPLACE(sa.artigo_id, '^[0-9]+-', ''))
           OR LOWER(ca1.artigo_cli) = LOWER(COALESCE(sa.entidade, '') || '-' || sa.artigo_id)
           OR LOWER(ca1.artigo_cli) = LOWER(COALESCE(sa.sigla, '') || '-' || sa.artigo_id)
           OR (c.sigla IS NOT NULL AND LOWER(ca1.artigo_cli) = LOWER(c.sigla || '-' || sa.artigo_id))
           OR (c.cli_primavera IS NOT NULL AND LOWER(ca1.artigo_cli) = LOWER(c.cli_primavera || '-' || sa.artigo_id))
        ORDER BY CASE WHEN LOWER(ca1.artigo_id) = LOWER(REGEXP_REPLACE(sa.artigo_id, '^[0-9]+-', '')) THEN 1 ELSE 2 END
        LIMIT 1
    ) ca ON true
    WHERE sa.total_stock <= 0
      AND NOT EXISTS (
          SELECT 1 FROM positive_articles pa
          WHERE pa.cliente_id = c.id
            AND (
                LOWER(pa.artigo_id) = LOWER(sa.artigo_id)
                OR LOWER(pa.norm_artigo_id) = LOWER(sa.artigo_id)
                OR LOWER(pa.norm_artigo_id) = LOWER(REGEXP_REPLACE(sa.artigo_id, '^[0-9]+-', ''))
                OR (ca.artigo_id IS NOT NULL AND (LOWER(pa.artigo_id) = LOWER(ca.artigo_id) OR LOWER(pa.norm_artigo_id) = LOWER(ca.artigo_id)))
                OR (ca.artigo_cli IS NOT NULL AND (LOWER(pa.artigo_id) = LOWER(ca.artigo_cli) OR LOWER(pa.norm_artigo_id) = LOWER(ca.artigo_cli)))
            )
      )
      AND (
          auth.uid() IS NULL
          OR EXISTS (
              SELECT 1 FROM public.users u 
              WHERE u.id = auth.uid() 
                AND (u.role = ANY (ARRAY['admin'::text, 'gestor'::text]) OR u.cliente_id IS NULL)
          )
          OR c.id = (
              SELECT u.cliente_id FROM public.users u 
              WHERE u.id = auth.uid()
          )
      )

    UNION ALL

    SELECT 
        ca.cliente_id,
        ca.cliente_nome,
        ca.cliente_sigla,
        ca.artigo_id,
        ca.artigo_cli,
        ca.descricao,
        COALESCE(ca.id_tipo_artigo, '')::text AS tipo_artigo,
        COALESCE(ca.tipo_armazenamento, 'TA')::text AS tipo_armazenamento,
        ca.familia,
        ca.subfamilia,
        0::numeric AS stock,
        NULL::timestamptz AS ultimo_movimento,
        0::bigint AS total_movimentos,
        '-'::text AS lotes_historico
    FROM catalog_artigos ca
    WHERE NOT EXISTS (
        SELECT 1 
        FROM stock_agg sa
        WHERE (
            LOWER(sa.artigo_id) = LOWER(ca.artigo_id)
            OR LOWER(sa.artigo_id) = LOWER(ca.artigo_cli)
            OR LOWER(REGEXP_REPLACE(sa.artigo_id, '^[0-9]+-', '')) = LOWER(ca.artigo_id)
        )
        AND (sa.sigla = ca.cliente_sigla OR sa.entidade = ca.cli_primavera)
    )
      AND NOT EXISTS (
          SELECT 1 FROM positive_articles pa
          WHERE pa.cliente_id = ca.cliente_id
            AND (
                LOWER(pa.artigo_id) = LOWER(ca.artigo_id)
                OR LOWER(pa.norm_artigo_id) = LOWER(ca.artigo_id)
                OR LOWER(pa.artigo_id) = LOWER(ca.artigo_cli)
                OR LOWER(pa.norm_artigo_id) = LOWER(ca.artigo_cli)
            )
      )
      AND (
          auth.uid() IS NULL
          OR EXISTS (
              SELECT 1 FROM public.users u 
              WHERE u.id = auth.uid() 
                AND (u.role = ANY (ARRAY['admin'::text, 'gestor'::text]) OR u.cliente_id IS NULL)
          )
          OR ca.cliente_id = (
              SELECT u.cliente_id FROM public.users u 
              WHERE u.id = auth.uid()
          )
      )
)
SELECT DISTINCT ON (cliente_id, artigo_id)
    cliente_id,
    cliente_nome,
    cliente_sigla,
    artigo_id,
    artigo_cli,
    descricao,
    tipo_artigo,
    tipo_armazenamento,
    familia,
    subfamilia,
    stock,
    ultimo_movimento,
    total_movimentos,
    lotes_historico
FROM all_zero_candidates
ORDER BY cliente_id, artigo_id, ultimo_movimento DESC NULLS LAST;

