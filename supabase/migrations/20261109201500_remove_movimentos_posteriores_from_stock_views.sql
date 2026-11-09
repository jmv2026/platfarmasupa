-- =====================================================================================
-- MIGRAÇÃO: Opção A - Cálculo de stock exclusivamente a partir de public.stock
--           menos pedidos na plataforma ainda não faturados no ERP (pedidos_pendentes_erp),
--           removendo a dupla contabilização de movimentos_posteriores.
-- =====================================================================================

CREATE OR REPLACE VIEW public.vw_stock_atual WITH (security_invoker = true) AS
WITH clientes_norm AS (
    SELECT
        c_1.id,
        c_1.name,
        c_1.sigla,
        upper(TRIM(BOTH FROM c_1.sigla)) AS sigla_norm,
        TRIM(BOTH FROM c_1.cli_primavera) AS cli_primavera_norm
    FROM public.clientes c_1
), stock_resolvido AS (
    SELECT
        c.id AS cliente_id,
        c.name AS cliente_nome,
        c.sigla AS cliente_sigla,
        c.sigla_norm,
        TRIM(BOTH FROM s.artigo_id) AS artigo_id,
        lower(TRIM(BOTH FROM s.artigo_id)) AS artigo_id_lower,
        NULLIF(TRIM(BOTH FROM s.descricao), ''::text) AS descricao,
        CASE
            WHEN s.armazem ~ '[0-9]{2}$'::text THEN "substring"(s.armazem, '[0-9]{2}$'::text)
            WHEN s.armazem ~ '[0-9]{1}$'::text THEN lpad("substring"(s.armazem, '[0-9]{1}$'::text), 2, '0'::text)
            ELSE COALESCE(NULLIF(TRIM(BOTH FROM s.armazem), ''::text), '01'::text)
        END AS tipo_armazem,
        NULLIF(TRIM(BOTH FROM s.armazem), ''::text) AS armazem_raw,
        COALESCE(NULLIF(TRIM(BOTH FROM s.lote), ''::text), 'S/LOTE'::text) AS lote,
        upper(COALESCE(NULLIF(TRIM(BOTH FROM s.lote), ''::text), 'S/LOTE'::text)) AS lote_upper,
        s.validade,
        s.data_fabrico,
        COALESCE(s.stock, 0::numeric) AS delta_stock,
        s.data_stock AS data_evento,
        s.data_stock AS data_stock_ref,
        s.id::text AS doc_ref_id,
        1 AS is_stock_row
    FROM public.stock s
    JOIN LATERAL (
        SELECT c1.id, c1.name, c1.sigla, c1.sigla_norm
        FROM clientes_norm c1
        WHERE (NULLIF(TRIM(BOTH FROM COALESCE(s.sigla, s.cliente_ser)), ''::text) IS NOT NULL
               AND c1.sigla_norm = upper(TRIM(BOTH FROM COALESCE(s.sigla, s.cliente_ser))))
           OR (NULLIF(TRIM(BOTH FROM s.entidade), ''::text) IS NOT NULL
               AND c1.cli_primavera_norm = TRIM(BOTH FROM s.entidade))
           OR (NULLIF(TRIM(BOTH FROM COALESCE(s.sigla, s.cliente_ser)), ''::text) IS NULL
               AND NULLIF(TRIM(BOTH FROM s.entidade), ''::text) IS NULL
               AND s.armazem IS NOT NULL
               AND c1.sigla_norm = upper(LEFT(TRIM(BOTH FROM s.armazem), 3)))
        ORDER BY
            CASE
                WHEN NULLIF(TRIM(BOTH FROM COALESCE(s.sigla, s.cliente_ser)), ''::text) IS NOT NULL
                     AND c1.sigla_norm = upper(TRIM(BOTH FROM COALESCE(s.sigla, s.cliente_ser))) THEN 1
                WHEN NULLIF(TRIM(BOTH FROM s.entidade), ''::text) IS NOT NULL
                     AND c1.cli_primavera_norm = TRIM(BOTH FROM s.entidade) THEN 2
                ELSE 3
            END
        LIMIT 1
    ) c ON true
), pedidos_pendentes_erp AS (
    SELECT
        c.id AS cliente_id,
        c.name AS cliente_nome,
        c.sigla AS cliente_sigla,
        c.sigla_norm,
        TRIM(BOTH FROM pl.artigo_id) AS artigo_id,
        lower(TRIM(BOTH FROM pl.artigo_id)) AS artigo_id_lower,
        NULLIF(TRIM(BOTH FROM pl.descricao), ''::text) AS descricao,
        '01'::text AS tipo_armazem,
        NULL::text AS armazem_raw,
        COALESCE(NULLIF(TRIM(BOTH FROM pl.lote), ''::text), 'S/LOTE'::text) AS lote,
        upper(COALESCE(NULLIF(TRIM(BOTH FROM pl.lote), ''::text), 'S/LOTE'::text)) AS lote_upper,
        pl.validade,
        NULL::date AS data_fabrico,
        - COALESCE(pl.quantidade, 0::numeric) AS delta_stock,
        COALESCE(p.updated_at, p.created_at, p.data_pedido::timestamp with time zone) AS data_evento,
        NULL::timestamp with time zone AS data_stock_ref,
        pl.id::text AS doc_ref_id,
        0 AS is_stock_row
    FROM public.pedido_linhas pl
    JOIN public.pedidos p ON p.id = pl.pedido_id
    JOIN clientes_norm c ON c.id = p.cliente_id
    WHERE COALESCE(p.stock, true) = true
      AND lower(TRIM(BOTH FROM COALESCE(p.status, ''::text))) <> 'cancelado'::text
      AND pl.artigo_id IS NOT NULL
      AND NOT (
          NULLIF(TRIM(BOTH FROM p.doc_primavera), ''::text) IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM public.movimentos m
              WHERE lower(TRIM(BOTH FROM m.documento_ref)) = lower(TRIM(BOTH FROM p.doc_primavera))
          )
      )
), unified_stock AS (
    SELECT * FROM stock_resolvido
    UNION ALL
    SELECT * FROM pedidos_pendentes_erp
), agg_lotes AS (
    SELECT
        us.cliente_id,
        us.cliente_nome,
        us.cliente_sigla,
        us.sigla_norm,
        COALESCE(max(us.artigo_id) FILTER (WHERE us.is_stock_row = 1), max(us.artigo_id)) AS artigo_id,
        us.artigo_id_lower,
        COALESCE(max(us.descricao) FILTER (WHERE us.is_stock_row = 1), max(us.descricao)) AS stock_descricao,
        us.tipo_armazem,
        COALESCE(max(us.armazem_raw) FILTER (WHERE us.is_stock_row = 1), max(us.armazem_raw), us.cliente_sigla::text || us.tipo_armazem) AS armazem_raw,
        COALESCE(max(us.lote) FILTER (WHERE us.is_stock_row = 1), max(us.lote)) AS lote,
        COALESCE(max(us.validade) FILTER (WHERE us.is_stock_row = 1), max(us.validade)) AS validade,
        COALESCE(min(us.data_fabrico) FILTER (WHERE us.is_stock_row = 1), min(us.data_fabrico)) AS data_fabrico,
        sum(us.delta_stock) AS stock,
        max(us.data_evento) AS ultimo_movimento,
        string_agg(us.doc_ref_id, ','::text) AS stock_id,
        max(us.data_stock_ref) AS data_stock
    FROM unified_stock us
    GROUP BY
        us.cliente_id,
        us.cliente_nome,
        us.cliente_sigla,
        us.sigla_norm,
        us.artigo_id_lower,
        us.tipo_armazem,
        us.lote_upper
    HAVING sum(us.delta_stock) > 0::numeric
), artigos_por_cliente AS (
    SELECT DISTINCT ON (c_1.id, (lower(TRIM(BOTH FROM a1.artigo_id))))
        c_1.id AS cliente_id,
        lower(TRIM(BOTH FROM a1.artigo_id)) AS artigo_id_lower,
        a1.artigo_cli,
        NULLIF(TRIM(BOTH FROM a1.descricao), ''::text) AS descricao,
        a1.id_tipo_artigo,
        a1.tipo_armazenamento
    FROM public.artigos a1
    JOIN clientes_norm c_1
      ON upper(TRIM(BOTH FROM a1.cli_primavera)) = c_1.sigla_norm
      OR upper(split_part(a1.artigo_cli, '-'::text, 1)) = c_1.sigla_norm
      OR (c_1.cli_primavera_norm IS NOT NULL AND TRIM(BOTH FROM a1.cli_primavera) = c_1.cli_primavera_norm)
    ORDER BY c_1.id, (lower(TRIM(BOTH FROM a1.artigo_id)))
)
SELECT
    al.cliente_id,
    al.cliente_nome,
    al.cliente_sigla::character varying AS cliente_sigla,
    al.artigo_id,
    COALESCE(a.artigo_cli, (al.cliente_sigla::text || '-'::text) || al.artigo_id) AS artigo_cli,
    COALESCE(a.descricao, al.stock_descricao) AS descricao,
    COALESCE(a.id_tipo_artigo, ''::text) AS tipo_artigo,
    COALESCE(a.tipo_armazenamento, 'TA'::text) AS tipo_armazenamento,
    al.tipo_armazem,
    COALESCE(arm.descricao, al.armazem_raw) AS armazem_descricao,
    COALESCE(al.armazem_raw, al.cliente_sigla::text || al.tipo_armazem) AS armazem_loc,
    al.lote,
    al.validade,
    al.data_fabrico,
    al.stock,
    al.ultimo_movimento,
    al.stock_id,
    al.data_stock
FROM agg_lotes al
LEFT JOIN artigos_por_cliente a
  ON a.cliente_id = al.cliente_id
 AND a.artigo_id_lower = al.artigo_id_lower
LEFT JOIN public.armazens arm
  ON arm.tipo_armazem = al.tipo_armazem
WHERE auth.uid() IS NULL
   OR (EXISTS (
       SELECT 1 FROM public.users u
       WHERE u.id = auth.uid()
         AND ((u.role = ANY (ARRAY['admin'::text, 'gestor'::text])) OR u.cliente_id IS NULL)
   ))
   OR al.cliente_id = ((
       SELECT u.cliente_id FROM public.users u WHERE u.id = auth.uid()
   ));

CREATE OR REPLACE VIEW public.vw_stock_pedidos WITH (security_invoker = true) AS
SELECT
    cliente_id,
    cliente_nome,
    cliente_sigla,
    artigo_id,
    artigo_cli,
    descricao,
    tipo_artigo,
    tipo_armazenamento,
    lote,
    validade,
    min(data_fabrico) AS data_fabrico,
    sum(stock) AS stock,
    max(ultimo_movimento) AS ultimo_movimento,
    max(data_stock) AS data_stock
FROM public.vw_stock_atual s
WHERE tipo_armazem = '01'::text
GROUP BY
    cliente_id,
    cliente_nome,
    cliente_sigla,
    artigo_id,
    artigo_cli,
    descricao,
    tipo_artigo,
    tipo_armazenamento,
    lote,
    validade
HAVING sum(stock) > 0::numeric;

CREATE OR REPLACE VIEW public.vw_stock_zero WITH (security_invoker = true) AS
WITH clientes_norm AS (
    SELECT
        c.id,
        c.name,
        c.sigla,
        upper(TRIM(BOTH FROM c.sigla)) AS sigla_norm,
        TRIM(BOTH FROM c.cli_primavera) AS cli_primavera_norm
    FROM public.clientes c
), stock_resolvido AS (
    SELECT
        c.id AS cliente_id,
        c.name AS cliente_nome,
        c.sigla AS cliente_sigla,
        c.sigla_norm,
        TRIM(BOTH FROM s.artigo_id) AS artigo_id,
        lower(TRIM(BOTH FROM regexp_replace(s.artigo_id, '^[0-9]+-'::text, ''::text))) AS norm_artigo_id,
        NULLIF(TRIM(BOTH FROM s.descricao), ''::text) AS descricao,
        CASE
            WHEN s.armazem ~ '[0-9]{2}$'::text THEN "substring"(s.armazem, '[0-9]{2}$'::text)
            WHEN s.armazem ~ '[0-9]{1}$'::text THEN lpad("substring"(s.armazem, '[0-9]{1}$'::text), 2, '0'::text)
            ELSE COALESCE(NULLIF(TRIM(BOTH FROM s.armazem), ''::text), '01'::text)
        END AS tipo_armazem,
        upper(COALESCE(NULLIF(TRIM(BOTH FROM s.lote), ''::text), 'S/LOTE'::text)) AS lote_upper,
        COALESCE(s.stock, 0::numeric) AS delta_stock,
        s.data_stock AS data_evento,
        s.data_stock AS data_stock_ref,
        s.id::text AS doc_ref_id
    FROM public.stock s
    JOIN LATERAL (
        SELECT c1.id, c1.name, c1.sigla, c1.sigla_norm
        FROM clientes_norm c1
        WHERE (NULLIF(TRIM(BOTH FROM COALESCE(s.sigla, s.cliente_ser)), ''::text) IS NOT NULL
               AND c1.sigla_norm = upper(TRIM(BOTH FROM COALESCE(s.sigla, s.cliente_ser))))
           OR (NULLIF(TRIM(BOTH FROM s.entidade), ''::text) IS NOT NULL
               AND c1.cli_primavera_norm = TRIM(BOTH FROM s.entidade))
           OR (NULLIF(TRIM(BOTH FROM COALESCE(s.sigla, s.cliente_ser)), ''::text) IS NULL
               AND NULLIF(TRIM(BOTH FROM s.entidade), ''::text) IS NULL
               AND s.armazem IS NOT NULL
               AND c1.sigla_norm = upper(LEFT(TRIM(BOTH FROM s.armazem), 3)))
        ORDER BY
            CASE
                WHEN NULLIF(TRIM(BOTH FROM COALESCE(s.sigla, s.cliente_ser)), ''::text) IS NOT NULL
                     AND c1.sigla_norm = upper(TRIM(BOTH FROM COALESCE(s.sigla, s.cliente_ser))) THEN 1
                WHEN NULLIF(TRIM(BOTH FROM s.entidade), ''::text) IS NOT NULL
                     AND c1.cli_primavera_norm = TRIM(BOTH FROM s.entidade) THEN 2
                ELSE 3
            END
        LIMIT 1
    ) c ON true
), pedidos_pendentes_erp AS (
    SELECT
        c.id AS cliente_id,
        c.name AS cliente_nome,
        c.sigla AS cliente_sigla,
        c.sigla_norm,
        TRIM(BOTH FROM pl.artigo_id) AS artigo_id,
        lower(TRIM(BOTH FROM regexp_replace(pl.artigo_id, '^[0-9]+-'::text, ''::text))) AS norm_artigo_id,
        NULLIF(TRIM(BOTH FROM pl.descricao), ''::text) AS descricao,
        '01'::text AS tipo_armazem,
        upper(COALESCE(NULLIF(TRIM(BOTH FROM pl.lote), ''::text), 'S/LOTE'::text)) AS lote_upper,
        - COALESCE(pl.quantidade, 0::numeric) AS delta_stock,
        COALESCE(p.updated_at, p.created_at, p.data_pedido::timestamp with time zone) AS data_evento,
        NULL::timestamp with time zone AS data_stock_ref,
        pl.id::text AS doc_ref_id
    FROM public.pedido_linhas pl
    JOIN public.pedidos p ON p.id = pl.pedido_id
    JOIN clientes_norm c ON c.id = p.cliente_id
    WHERE COALESCE(p.stock, true) = true
      AND lower(TRIM(BOTH FROM COALESCE(p.status, ''::text))) <> 'cancelado'::text
      AND pl.artigo_id IS NOT NULL
      AND NOT (
          NULLIF(TRIM(BOTH FROM p.doc_primavera), ''::text) IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM public.movimentos m
              WHERE lower(TRIM(BOTH FROM m.documento_ref)) = lower(TRIM(BOTH FROM p.doc_primavera))
          )
      )
), unified_stock AS (
    SELECT * FROM stock_resolvido
    UNION ALL
    SELECT * FROM pedidos_pendentes_erp
), stock_agg AS (
    SELECT
        us.cliente_id,
        us.cliente_sigla AS sigla_raw,
        us.sigla_norm AS cliente_sigla,
        us.norm_artigo_id,
        max(regexp_replace(us.artigo_id, '^[0-9]+-'::text, ''::text)) AS clean_artigo_id,
        max(us.descricao) AS stock_descricao,
        sum(us.delta_stock) AS total_stock,
        max(us.data_evento) AS ultimo_movimento,
        count(us.doc_ref_id) AS total_registos
    FROM unified_stock us
    GROUP BY us.cliente_id, us.cliente_sigla, us.sigla_norm, us.norm_artigo_id
), positive_articles AS (
    SELECT DISTINCT
        sa.cliente_id,
        sa.norm_artigo_id
    FROM stock_agg sa
    WHERE sa.total_stock > 0::numeric
), catalog_artigos AS (
    SELECT DISTINCT ON (c.id, (lower(TRIM(BOTH FROM regexp_replace(a.artigo_id, '^[0-9]+-'::text, ''::text)))))
        a.artigo_id,
        lower(TRIM(BOTH FROM regexp_replace(a.artigo_id, '^[0-9]+-'::text, ''::text))) AS norm_artigo_id,
        a.artigo_cli,
        NULLIF(TRIM(BOTH FROM a.descricao), ''::text) AS descricao,
        a.id_tipo_artigo,
        a.tipo_armazenamento,
        a.familia,
        a.subfamilia,
        c.id AS cliente_id,
        c.name AS cliente_nome,
        c.sigla AS cliente_sigla,
        c.sigla_norm
    FROM public.artigos a
    JOIN clientes_norm c
      ON upper(TRIM(BOTH FROM a.cli_primavera)) = c.sigla_norm
      OR (c.cli_primavera_norm IS NOT NULL AND TRIM(BOTH FROM a.cli_primavera) = c.cli_primavera_norm)
      OR upper(split_part(a.artigo_cli, '-'::text, 1)) = c.sigla_norm
    ORDER BY c.id, (lower(TRIM(BOTH FROM regexp_replace(a.artigo_id, '^[0-9]+-'::text, ''::text))))
), all_zero_candidates AS (
    SELECT
        c.id AS cliente_id,
        c.name AS cliente_nome,
        c.sigla::character varying AS cliente_sigla,
        COALESCE(ca.artigo_id, sa.clean_artigo_id) AS artigo_id,
        COALESCE(ca.artigo_cli, (c.sigla::text || '-'::text) || sa.clean_artigo_id) AS artigo_cli,
        COALESCE(ca.descricao, sa.stock_descricao) AS descricao,
        COALESCE(ca.id_tipo_artigo, ''::text) AS tipo_artigo,
        COALESCE(ca.tipo_armazenamento, 'TA'::text) AS tipo_armazenamento,
        ca.familia,
        ca.subfamilia,
        0::numeric AS stock,
        sa.ultimo_movimento,
        sa.total_registos AS total_movimentos,
        '-'::text AS lotes_historico
    FROM stock_agg sa
    JOIN clientes_norm c ON c.id = sa.cliente_id
    LEFT JOIN catalog_artigos ca
      ON ca.cliente_id = c.id
     AND ca.norm_artigo_id = sa.norm_artigo_id
    WHERE sa.total_stock <= 0::numeric
      AND NOT (EXISTS (
          SELECT 1
          FROM positive_articles pa
          WHERE pa.cliente_id = sa.cliente_id
            AND pa.norm_artigo_id = sa.norm_artigo_id
      ))
    UNION ALL
    SELECT
        ca.cliente_id,
        ca.cliente_nome,
        ca.cliente_sigla::character varying AS cliente_sigla,
        ca.artigo_id,
        ca.artigo_cli,
        ca.descricao,
        COALESCE(ca.id_tipo_artigo, ''::text) AS tipo_artigo,
        COALESCE(ca.tipo_armazenamento, 'TA'::text) AS tipo_armazenamento,
        ca.familia,
        ca.subfamilia,
        0::numeric AS stock,
        NULL::timestamp with time zone AS ultimo_movimento,
        0::bigint AS total_movimentos,
        '-'::text AS lotes_historico
    FROM catalog_artigos ca
    WHERE NOT (EXISTS (
        SELECT 1
        FROM stock_agg sa
        WHERE sa.cliente_id = ca.cliente_id
          AND sa.norm_artigo_id = ca.norm_artigo_id
    ))
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
FROM all_zero_candidates az
WHERE auth.uid() IS NULL
   OR (EXISTS (
       SELECT 1 FROM public.users u
       WHERE u.id = auth.uid()
         AND ((u.role = ANY (ARRAY['admin'::text, 'gestor'::text])) OR u.cliente_id IS NULL)
   ))
   OR cliente_id = ((
       SELECT u.cliente_id FROM public.users u WHERE u.id = auth.uid()
   ))
ORDER BY cliente_id, artigo_id, ultimo_movimento DESC NULLS LAST;

GRANT SELECT ON public.vw_stock_atual TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_stock_pedidos TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_stock_zero TO authenticated, anon, service_role;

