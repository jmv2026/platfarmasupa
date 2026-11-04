-- =====================================================================================
-- MIGRAÇÃO: Correção da visibilidade de Stocks dos Clientes e Otimização das Views
-- =====================================================================================
-- Causas corrigidas:
-- 1. Timeout (57014: statement timeout de 8s no PostgREST) ao carregar /stocks após a
--    sincronização de ~11.600 linhas em movimentos_linhas (as views faziam LATERAL JOIN
--    com public.artigos ANTES do GROUP BY, demorando ~47s por view).
-- 2. Mapeamento de clientes na sincronização do MS Access quando o campo cliente_ser/sigla
--    trazia o nome comercial (CARDIOLINK, MAXIFAR, MEDSZO, PHARMED) em vez da sigla de 3
--    letras (CRD, MAX, MDZ, PHM), fazendo fallback para AOP.
-- =====================================================================================

-- 1. Corrigir os movimentos e movimentos_linhas já importados cujo cliente ficou associado por defeito a AOP
WITH client_map AS (
    SELECT
        ml.documento_ref,
        c.id AS true_cliente_id,
        UPPER(TRIM(c.sigla)) AS true_sigla,
        c.cli_primavera AS true_cli_primavera
    FROM public.movimentos_linhas ml
    JOIN public.clientes c
      ON UPPER(TRIM(c.sigla)) = UPPER(LEFT(TRIM(COALESCE(ml.armazem, '')), 3))
      OR UPPER(TRIM(c.name)) LIKE UPPER(TRIM(COALESCE(ml.cliente_ser, ml.sigla, ''))) || '%'
    WHERE UPPER(TRIM(COALESCE(ml.cliente_ser, ml.sigla, ''))) IN ('CARDIOLINK', 'MAXIFAR', 'MEDSZO', 'PHARMED', 'VARIMPULSE', 'GOHEALTH', 'GO HEALTHCARE', 'KOMTUR', 'PINAZS', 'SEACROSS', 'UNIVETE', 'FARMAMONDO')
       OR UPPER(LEFT(TRIM(COALESCE(ml.armazem, '')), 3)) IN ('CRD', 'MAX', 'MDZ', 'PHM', 'VAR', 'GOH', 'KMT', 'PNZ', 'SEA', 'UVT', 'FMD', 'PHS')
    GROUP BY ml.documento_ref, c.id, c.sigla, c.cli_primavera
)
UPDATE public.movimentos m
SET
    cliente_id = cm.true_cliente_id,
    sigla = cm.true_sigla,
    cliente_ser = cm.true_sigla,
    cli_primavera = COALESCE(m.cli_primavera, cm.true_cli_primavera)
FROM client_map cm
WHERE m.documento_ref = cm.documento_ref
  AND (m.cliente_id IS DISTINCT FROM cm.true_cliente_id OR m.sigla IS DISTINCT FROM cm.true_sigla);

UPDATE public.movimentos_linhas ml
SET
    sigla = m.sigla,
    cliente_ser = m.sigla,
    cli_primavera = COALESCE(ml.cli_primavera, m.cli_primavera),
    armazem_loc = m.sigla || '-' || COALESCE(NULLIF(TRIM(ml.tipo_armazem), ''), '01'),
    artigo_cli = CASE
        WHEN ml.artigo_cli LIKE 'UNK-%' OR ml.artigo_cli LIKE 'CARDIOLINK-%' OR ml.artigo_cli LIKE 'MAXIFAR-%' OR ml.artigo_cli LIKE 'MEDSZO-%' OR ml.artigo_cli LIKE 'PHARMED-%'
        THEN COALESCE(m.cli_primavera, m.sigla) || '-' || UPPER(TRIM(COALESCE(ml.artigo_id, ml.artigo, '')))
        ELSE ml.artigo_cli
    END
FROM public.movimentos m
WHERE m.documento_ref = ml.documento_ref
  AND (ml.sigla IS DISTINCT FROM m.sigla OR ml.cliente_ser IS DISTINCT FROM m.sigla);

-- 2. Índices de suporte para acelerar as views de stock
CREATE INDEX IF NOT EXISTS idx_movimentos_linhas_documento_ref ON public.movimentos_linhas (documento_ref);
CREATE INDEX IF NOT EXISTS idx_movimentos_linhas_tipo_movimento_lower ON public.movimentos_linhas (LOWER(TRIM(tipo_movimento)));
CREATE INDEX IF NOT EXISTS idx_movimentos_cliente_id ON public.movimentos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_sigla_upper ON public.movimentos (UPPER(TRIM(sigla)));

-- 3. Otimizar public.vw_stock_atual (Agrupamento ANTES do join com artigos + Hash Joins, reduzindo de 47s para < 0.8s)
CREATE OR REPLACE VIEW public.vw_stock_atual WITH (security_invoker = true) AS
WITH clientes_norm AS (
    SELECT
        c.id,
        c.name,
        c.sigla,
        UPPER(TRIM(c.sigla)) AS sigla_norm,
        c.cli_primavera
    FROM public.clientes c
),
pedidos_sinteticos AS (
    SELECT DISTINCT LOWER(TRIM(doc_ref)) AS doc_ref_lower
    FROM (
        SELECT p0.sigla_pedido AS doc_ref, p0.doc_primavera FROM public.pedidos p0
        UNION ALL
        SELECT p0.nr_pedido AS doc_ref, p0.doc_primavera FROM public.pedidos p0
    ) t
    WHERE NULLIF(TRIM(COALESCE(doc_ref, '')), '') IS NOT NULL
      AND LOWER(TRIM(COALESCE(doc_ref, ''))) <> LOWER(TRIM(COALESCE(doc_primavera, '')))
),
clientes_com_entradas AS (
    SELECT DISTINCT
        UPPER(TRIM(COALESCE(c.sigla, m2.sigla, ml2.sigla, ml2.cliente_ser))) AS cliente_sigla
    FROM public.movimentos_linhas ml2
    JOIN public.movimentos m2 ON m2.documento_ref = ml2.documento_ref
    LEFT JOIN clientes_norm c ON c.id = m2.cliente_id
    WHERE LOWER(TRIM(ml2.tipo_movimento)) = ANY (ARRAY['es'::text, 'et'::text, 'e'::text])
),
base_movimentos AS (
    SELECT
        UPPER(TRIM(COALESCE(ci.sigla, m.sigla, ml.sigla, ml.cliente_ser))) AS cliente_sigla,
        COALESCE(ml.artigo_id, ml.artigo) AS artigo_id,
        ml.artigo_cli,
        ml.descricao,
        ml.tipo_artigo,
        COALESCE(
            NULLIF(TRIM(ml.tipo_armazem), ''),
            CASE
                WHEN COALESCE(ml.armazem, ml.armazem_loc) ~ '[0-9]{2}$' THEN substring(COALESCE(ml.armazem, ml.armazem_loc) from '[0-9]{2}$')
                WHEN COALESCE(ml.armazem, ml.armazem_loc) ~ '[0-9]{1}$' THEN lpad(substring(COALESCE(ml.armazem, ml.armazem_loc) from '[0-9]{1}$'), 2, '0')
                ELSE COALESCE(ml.armazem, ml.armazem_loc, '01')
            END
        ) AS tipo_armazem,
        COALESCE(ml.armazem, ml.armazem_loc) AS armazem,
        COALESCE(NULLIF(TRIM(ml.lote), ''), 'S/LOTE'::text) AS lote,
        ml.validade,
        ml.data_fabrico,
        COALESCE(ml.data_movimento, m.data_movimento, ml.created_at) AS data_movimento,
        COALESCE(ml.data, m.data, ml.data_movimento::date) AS data_stock,
        ml.doc_linha::text AS doc_ref_id,
        CASE
            WHEN LOWER(TRIM(ml.tipo_movimento)) = ANY (ARRAY['es'::text, 'et'::text, 'e'::text]) THEN COALESCE(ml.quantidade, 0::numeric)
            WHEN LOWER(TRIM(ml.tipo_movimento)) = ANY (ARRAY['ss'::text, 'st'::text, 's'::text]) THEN -COALESCE(ml.quantidade, 0::numeric)
            ELSE 0::numeric
        END AS delta_stock
    FROM public.movimentos_linhas ml
    JOIN public.movimentos m ON m.documento_ref = ml.documento_ref
    LEFT JOIN clientes_norm ci ON ci.id = m.cliente_id
    WHERE NOT EXISTS (
        SELECT 1 FROM pedidos_sinteticos ps WHERE ps.doc_ref_lower = LOWER(TRIM(m.documento_ref))
    )

    UNION ALL

    SELECT
        UPPER(TRIM(COALESCE(cs.sigla, ce.sigla, s.sigla, s.cliente_ser))) AS cliente_sigla,
        s.artigo_id,
        NULL::text AS artigo_cli,
        s.descricao,
        NULL::text AS tipo_artigo,
        CASE
            WHEN s.armazem ~ '[0-9]{2}$' THEN substring(s.armazem from '[0-9]{2}$')
            WHEN s.armazem ~ '[0-9]{1}$' THEN lpad(substring(s.armazem from '[0-9]{1}$'), 2, '0')
            ELSE COALESCE(s.armazem, '01')
        END AS tipo_armazem,
        s.armazem,
        COALESCE(NULLIF(TRIM(s.lote), ''), 'S/LOTE'::text) AS lote,
        s.validade,
        s.data_fabrico,
        s.created_at AS data_movimento,
        s.data_stock AS data_stock,
        s.id::text AS doc_ref_id,
        COALESCE(s.stock, 0::numeric) AS delta_stock
    FROM public.stock s
    LEFT JOIN clientes_norm cs ON cs.sigla_norm = UPPER(TRIM(COALESCE(s.sigla, s.cliente_ser)))
    LEFT JOIN clientes_norm ce ON ce.cli_primavera = s.entidade
    WHERE NOT EXISTS (
        SELECT 1
        FROM clientes_com_entradas cce
        WHERE cce.cliente_sigla = UPPER(TRIM(COALESCE(cs.sigla, ce.sigla, s.sigla, s.cliente_ser)))
    )
),
pedidos_ativos AS (
    SELECT
        p.id AS pedido_id,
        p.cliente_id,
        c.sigla_norm AS cliente_sigla,
        p.created_at,
        p.data_pedido,
        pl.id AS linha_id,
        pl.artigo_id,
        LOWER(TRIM(pl.artigo_id)) AS artigo_id_lower,
        pl.artigo_cli,
        pl.descricao,
        COALESCE(NULLIF(TRIM(pl.lote), ''), 'S/LOTE'::text) AS lote,
        pl.validade,
        pl.quantidade
    FROM public.pedido_linhas pl
    JOIN public.pedidos p ON p.id = pl.pedido_id
    JOIN clientes_norm c ON c.id = p.cliente_id
    WHERE COALESCE(p.stock, true) = true
      AND LOWER(TRIM(COALESCE(p.status, ''))) <> 'cancelado'
      AND NOT (
          COALESCE(p.processar, false) = true
          AND NULLIF(TRIM(p.doc_primavera), '') IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM public.movimentos m
              WHERE LOWER(TRIM(m.documento_ref)) = LOWER(TRIM(p.doc_primavera))
          )
      )
),
unified_movimentos AS (
    SELECT * FROM base_movimentos

    UNION ALL

    SELECT
        pa.cliente_sigla,
        COALESCE(bm.artigo_id, pa.artigo_id) AS artigo_id,
        COALESCE(bm.artigo_cli, NULLIF(TRIM(pa.artigo_cli), ''), pa.cliente_sigla || '-' || pa.artigo_id) AS artigo_cli,
        COALESCE(pa.descricao, bm.descricao) AS descricao,
        bm.tipo_artigo,
        '01'::text AS tipo_armazem,
        COALESCE(bm.armazem, pa.cliente_sigla || '01') AS armazem,
        pa.lote,
        COALESCE(pa.validade, bm.validade) AS validade,
        bm.data_fabrico,
        COALESCE(pa.created_at, pa.data_pedido::timestamp with time zone, now()) AS data_movimento,
        COALESCE(pa.data_pedido, pa.created_at::date, CURRENT_DATE) AS data_stock,
        pa.linha_id::text AS doc_ref_id,
        -COALESCE(pa.quantidade, 0::numeric) AS delta_stock
    FROM pedidos_ativos pa
    LEFT JOIN LATERAL (
        SELECT
            b.artigo_id,
            b.artigo_cli,
            b.descricao,
            b.tipo_artigo,
            b.armazem,
            b.validade,
            b.data_fabrico
        FROM base_movimentos b
        WHERE b.cliente_sigla = pa.cliente_sigla
          AND LOWER(TRIM(b.artigo_id)) = pa.artigo_id_lower
          AND b.lote = pa.lote
          AND b.tipo_armazem = '01'
        ORDER BY
            CASE WHEN b.validade IS NOT DISTINCT FROM pa.validade THEN 1 ELSE 2 END,
            b.delta_stock DESC
        LIMIT 1
    ) bm ON true
),
agg_lotes AS (
    SELECT
        um.cliente_sigla,
        um.artigo_id,
        MAX(NULLIF(TRIM(um.artigo_cli), '')) AS mov_artigo_cli,
        MAX(NULLIF(TRIM(um.descricao), '')) AS mov_descricao,
        MAX(NULLIF(TRIM(um.tipo_artigo), '')) AS mov_tipo_artigo,
        um.tipo_armazem,
        um.armazem AS armazem_raw,
        um.lote,
        um.validade,
        MIN(um.data_fabrico) AS data_fabrico,
        SUM(um.delta_stock) AS stock,
        MAX(um.data_movimento) AS ultimo_movimento,
        string_agg(um.doc_ref_id, ',') AS stock_id,
        MAX(um.data_stock) AS data_stock
    FROM unified_movimentos um
    GROUP BY
        um.cliente_sigla,
        um.artigo_id,
        um.tipo_armazem,
        um.armazem,
        um.lote,
        um.validade
    HAVING SUM(um.delta_stock) > 0
),
artigos_por_cliente AS (
    SELECT DISTINCT ON (c.id, LOWER(TRIM(a1.artigo_id)))
        c.id AS cliente_id,
        LOWER(TRIM(a1.artigo_id)) AS artigo_id_lower,
        a1.artigo_cli,
        NULLIF(TRIM(a1.descricao), '') AS descricao,
        a1.id_tipo_artigo,
        a1.tipo_armazenamento
    FROM public.artigos a1
    JOIN clientes_norm c
      ON UPPER(TRIM(a1.cli_primavera)) = c.sigla_norm
      OR UPPER(SPLIT_PART(a1.artigo_cli, '-', 1)) = c.sigla_norm
      OR (c.cli_primavera IS NOT NULL AND a1.cli_primavera = c.cli_primavera)
    ORDER BY c.id, LOWER(TRIM(a1.artigo_id))
)
SELECT
    c.id AS cliente_id,
    c.name AS cliente_nome,
    c.sigla::character varying AS cliente_sigla,
    al.artigo_id,
    COALESCE(a.artigo_cli, al.mov_artigo_cli, (c.sigla || '-' || al.artigo_id)) AS artigo_cli,
    COALESCE(a.descricao, al.mov_descricao) AS descricao,
    COALESCE(a.id_tipo_artigo, al.mov_tipo_artigo, '')::text AS tipo_artigo,
    COALESCE(a.tipo_armazenamento, 'TA')::text AS tipo_armazenamento,
    al.tipo_armazem,
    COALESCE(arm.descricao, al.armazem_raw) AS armazem_descricao,
    COALESCE(al.armazem_raw, c.sigla || '01') AS armazem_loc,
    al.lote,
    al.validade,
    al.data_fabrico,
    al.stock,
    al.ultimo_movimento,
    al.stock_id,
    al.data_stock
FROM agg_lotes al
JOIN clientes_norm c ON c.sigla_norm = al.cliente_sigla
LEFT JOIN artigos_por_cliente a
  ON a.cliente_id = c.id
 AND a.artigo_id_lower = LOWER(TRIM(al.artigo_id))
LEFT JOIN public.armazens arm
  ON arm.tipo_armazem = al.tipo_armazem
WHERE (
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
);

-- 4. Otimizar public.vw_stock_pedidos reutilizando a mesma arquitetura rápida filtrada para tipo_armazem = '01'
CREATE OR REPLACE VIEW public.vw_stock_pedidos WITH (security_invoker = true) AS
SELECT
    s.cliente_id,
    s.cliente_nome,
    s.cliente_sigla,
    s.artigo_id,
    s.artigo_cli,
    s.descricao,
    s.tipo_artigo,
    s.tipo_armazenamento,
    s.lote,
    s.validade,
    MIN(s.data_fabrico) AS data_fabrico,
    SUM(s.stock) AS stock,
    MAX(s.ultimo_movimento) AS ultimo_movimento,
    MAX(s.data_stock) AS data_stock
FROM public.vw_stock_atual s
WHERE s.tipo_armazem = '01'
GROUP BY
    s.cliente_id,
    s.cliente_nome,
    s.cliente_sigla,
    s.artigo_id,
    s.artigo_cli,
    s.descricao,
    s.tipo_artigo,
    s.tipo_armazenamento,
    s.lote,
    s.validade
HAVING SUM(s.stock) > 0;

-- 5. Otimizar public.vw_stock_zero com Hash Joins (de >40s para ~0.35s)
CREATE OR REPLACE VIEW public.vw_stock_zero WITH (security_invoker = true) AS
WITH clientes_norm AS (
    SELECT
        c.id,
        c.name,
        c.sigla,
        UPPER(TRIM(c.sigla)) AS sigla_norm,
        c.cli_primavera
    FROM public.clientes c
),
pedidos_sinteticos AS (
    SELECT DISTINCT LOWER(TRIM(doc_ref)) AS doc_ref_lower
    FROM (
        SELECT p0.sigla_pedido AS doc_ref, p0.doc_primavera FROM public.pedidos p0
        UNION ALL
        SELECT p0.nr_pedido AS doc_ref, p0.doc_primavera FROM public.pedidos p0
    ) t
    WHERE NULLIF(TRIM(COALESCE(doc_ref, '')), '') IS NOT NULL
      AND LOWER(TRIM(COALESCE(doc_ref, ''))) <> LOWER(TRIM(COALESCE(doc_primavera, '')))
),
clientes_com_entradas AS (
    SELECT DISTINCT
        UPPER(TRIM(COALESCE(c.sigla, m2.sigla, ml2.sigla, ml2.cliente_ser))) AS cliente_sigla
    FROM public.movimentos_linhas ml2
    JOIN public.movimentos m2 ON m2.documento_ref = ml2.documento_ref
    LEFT JOIN clientes_norm c ON c.id = m2.cliente_id
    WHERE LOWER(TRIM(ml2.tipo_movimento)) = ANY (ARRAY['es'::text, 'et'::text, 'e'::text])
),
base_movimentos AS (
    SELECT
        UPPER(TRIM(COALESCE(ci.sigla, m.sigla, ml.sigla, ml.cliente_ser))) AS cliente_sigla,
        COALESCE(ml.artigo_id, ml.artigo) AS artigo_id,
        LOWER(TRIM(REGEXP_REPLACE(COALESCE(ml.artigo_id, ml.artigo), '^[0-9]+-', ''))) AS norm_artigo_id,
        ml.descricao,
        COALESCE(NULLIF(TRIM(ml.lote), ''), 'S/LOTE'::text) AS lote,
        COALESCE(ml.data_movimento, m.data_movimento, ml.created_at) AS data_movimento,
        ml.doc_linha::text AS doc_ref_id,
        CASE
            WHEN LOWER(TRIM(ml.tipo_movimento)) = ANY (ARRAY['es'::text, 'et'::text, 'e'::text]) THEN COALESCE(ml.quantidade, 0::numeric)
            WHEN LOWER(TRIM(ml.tipo_movimento)) = ANY (ARRAY['ss'::text, 'st'::text, 's'::text]) THEN -COALESCE(ml.quantidade, 0::numeric)
            ELSE 0::numeric
        END AS delta_stock
    FROM public.movimentos_linhas ml
    JOIN public.movimentos m ON m.documento_ref = ml.documento_ref
    LEFT JOIN clientes_norm ci ON ci.id = m.cliente_id
    WHERE NOT EXISTS (
        SELECT 1 FROM pedidos_sinteticos ps WHERE ps.doc_ref_lower = LOWER(TRIM(m.documento_ref))
    )

    UNION ALL

    SELECT
        UPPER(TRIM(COALESCE(cs.sigla, ce.sigla, s.sigla, s.cliente_ser))) AS cliente_sigla,
        s.artigo_id,
        LOWER(TRIM(REGEXP_REPLACE(s.artigo_id, '^[0-9]+-', ''))) AS norm_artigo_id,
        s.descricao,
        COALESCE(NULLIF(TRIM(s.lote), ''), 'S/LOTE'::text) AS lote,
        s.created_at AS data_movimento,
        s.id::text AS doc_ref_id,
        COALESCE(s.stock, 0::numeric) AS delta_stock
    FROM public.stock s
    LEFT JOIN clientes_norm cs ON cs.sigla_norm = UPPER(TRIM(COALESCE(s.sigla, s.cliente_ser)))
    LEFT JOIN clientes_norm ce ON ce.cli_primavera = s.entidade
    WHERE NOT EXISTS (
        SELECT 1
        FROM clientes_com_entradas cce
        WHERE cce.cliente_sigla = UPPER(TRIM(COALESCE(cs.sigla, ce.sigla, s.sigla, s.cliente_ser)))
    )
),
unified_movimentos AS (
    SELECT * FROM base_movimentos

    UNION ALL

    SELECT
        c.sigla_norm AS cliente_sigla,
        pl.artigo_id,
        LOWER(TRIM(REGEXP_REPLACE(pl.artigo_id, '^[0-9]+-', ''))) AS norm_artigo_id,
        pl.descricao,
        COALESCE(NULLIF(TRIM(pl.lote), ''), 'S/LOTE'::text) AS lote,
        COALESCE(p.created_at, p.data_pedido::timestamp with time zone, now()) AS data_movimento,
        pl.id::text AS doc_ref_id,
        -COALESCE(pl.quantidade, 0::numeric) AS delta_stock
    FROM public.pedido_linhas pl
    JOIN public.pedidos p ON p.id = pl.pedido_id
    JOIN clientes_norm c ON c.id = p.cliente_id
    WHERE COALESCE(p.stock, true) = true
      AND LOWER(TRIM(COALESCE(p.status, ''))) <> 'cancelado'
      AND NOT (
          COALESCE(p.processar, false) = true
          AND NULLIF(TRIM(p.doc_primavera), '') IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM public.movimentos m
              WHERE LOWER(TRIM(m.documento_ref)) = LOWER(TRIM(p.doc_primavera))
          )
      )
),
stock_agg AS (
    SELECT
        um.cliente_sigla,
        um.norm_artigo_id,
        MAX(REGEXP_REPLACE(um.artigo_id, '^[0-9]+-', '')) AS clean_artigo_id,
        MAX(NULLIF(TRIM(um.descricao), '')) AS stock_descricao,
        SUM(um.delta_stock) AS total_stock,
        MAX(um.data_movimento) AS ultimo_movimento,
        COUNT(um.doc_ref_id) AS total_registos
    FROM unified_movimentos um
    GROUP BY um.cliente_sigla, um.norm_artigo_id
),
positive_articles AS (
    SELECT DISTINCT
        sa.cliente_sigla,
        sa.norm_artigo_id
    FROM stock_agg sa
    WHERE sa.total_stock > 0
),
catalog_artigos AS (
    SELECT DISTINCT ON (c.id, LOWER(TRIM(REGEXP_REPLACE(a.artigo_id, '^[0-9]+-', ''))))
        a.artigo_id,
        LOWER(TRIM(REGEXP_REPLACE(a.artigo_id, '^[0-9]+-', ''))) AS norm_artigo_id,
        a.artigo_cli,
        NULLIF(TRIM(a1_desc.descricao), '') AS descricao,
        a.id_tipo_artigo,
        a.tipo_armazenamento,
        a.familia,
        a.subfamilia,
        c.id AS cliente_id,
        c.name AS cliente_nome,
        c.sigla AS cliente_sigla,
        c.sigla_norm
    FROM public.artigos a
    CROSS JOIN LATERAL (SELECT a.descricao) a1_desc
    JOIN clientes_norm c ON (
        UPPER(TRIM(a.cli_primavera)) = c.sigla_norm
        OR (c.cli_primavera IS NOT NULL AND a.cli_primavera = c.cli_primavera)
        OR UPPER(SPLIT_PART(a.artigo_cli, '-', 1)) = c.sigla_norm
    )
    ORDER BY c.id, LOWER(TRIM(REGEXP_REPLACE(a.artigo_id, '^[0-9]+-', '')))
),
all_zero_candidates AS (
    SELECT
        c.id AS cliente_id,
        c.name AS cliente_nome,
        c.sigla::character varying AS cliente_sigla,
        COALESCE(ca.artigo_id, sa.clean_artigo_id) AS artigo_id,
        COALESCE(ca.artigo_cli, (c.sigla || '-' || sa.clean_artigo_id)) AS artigo_cli,
        COALESCE(ca.descricao, sa.stock_descricao) AS descricao,
        COALESCE(ca.id_tipo_artigo, '')::text AS tipo_artigo,
        COALESCE(ca.tipo_armazenamento, 'TA')::text AS tipo_armazenamento,
        ca.familia,
        ca.subfamilia,
        0::numeric AS stock,
        sa.ultimo_movimento,
        sa.total_registos AS total_movimentos,
        '-'::text AS lotes_historico
    FROM stock_agg sa
    JOIN clientes_norm c ON c.sigla_norm = sa.cliente_sigla
    LEFT JOIN catalog_artigos ca
      ON ca.cliente_id = c.id
     AND ca.norm_artigo_id = sa.norm_artigo_id
    WHERE sa.total_stock <= 0
      AND NOT EXISTS (
          SELECT 1 FROM positive_articles pa
          WHERE pa.cliente_sigla = sa.cliente_sigla
            AND pa.norm_artigo_id = sa.norm_artigo_id
      )

    UNION ALL

    SELECT
        ca.cliente_id,
        ca.cliente_nome,
        ca.cliente_sigla::character varying AS cliente_sigla,
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
        SELECT 1 FROM stock_agg sa
        WHERE sa.cliente_sigla = ca.sigla_norm
          AND sa.norm_artigo_id = ca.norm_artigo_id
    )
)
SELECT DISTINCT ON (az.cliente_id, az.artigo_id)
    az.cliente_id,
    az.cliente_nome,
    az.cliente_sigla,
    az.artigo_id,
    az.artigo_cli,
    az.descricao,
    az.tipo_artigo,
    az.tipo_armazenamento,
    az.familia,
    az.subfamilia,
    az.stock,
    az.ultimo_movimento,
    az.total_movimentos,
    az.lotes_historico
FROM all_zero_candidates az
WHERE (
    auth.uid() IS NULL
    OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND (u.role = ANY (ARRAY['admin'::text, 'gestor'::text]) OR u.cliente_id IS NULL)
    )
    OR az.cliente_id = (
        SELECT u.cliente_id FROM public.users u
        WHERE u.id = auth.uid()
    )
)
ORDER BY az.cliente_id, az.artigo_id, az.ultimo_movimento DESC NULLS LAST;

