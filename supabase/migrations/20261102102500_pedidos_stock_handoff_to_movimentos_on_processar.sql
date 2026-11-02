-- Migration: 20261102102500_pedidos_stock_handoff_to_movimentos_on_processar.sql
-- Descrição:
-- 1. Na contabilização de stocks (vw_stock_atual, vw_stock_pedidos, vw_stock_zero), os pedidos ativos
--    com stock = true são contabilizados diretamente através das tabelas public.pedidos / public.pedido_linhas.
-- 2. Caso o pedido tenha o campo processar assinalado (processar = true) E exista na tabela public.movimentos
--    um movimento cujo campo documento_ref coincida com o campo doc_primavera da tabela public.pedidos,
--    então esse pedido deixa de ser contabilizado através da tabela pedidos e passa a ser contabilizado
--    apenas pela tabela movimentos.

-- Limpar eventuais movimentos sintéticos antigos gerados a partir de sigla_pedido que não correspondam a doc_primavera real
DELETE FROM public.movimentos m
WHERE EXISTS (
    SELECT 1
    FROM public.pedidos p
    WHERE LOWER(TRIM(m.documento_ref)) IN (
        LOWER(TRIM(COALESCE(p.sigla_pedido, ''))),
        LOWER(TRIM(COALESCE(p.nr_pedido, '')))
    )
    AND LOWER(TRIM(m.documento_ref)) <> LOWER(TRIM(COALESCE(p.doc_primavera, '')))
);

-- Atualizar a função sincronizar_pedido_para_movimentos para não duplicar pedidos na tabela movimentos
CREATE OR REPLACE FUNCTION public.sincronizar_pedido_para_movimentos(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_pedido record;
    v_cliente record;
    v_doc_ref text;
    v_sigla text;
    v_has_movimento_primavera boolean := false;
BEGIN
    SELECT * INTO v_pedido
    FROM public.pedidos
    WHERE id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
    END IF;

    SELECT * INTO v_cliente
    FROM public.clientes
    WHERE id = v_pedido.cliente_id;

    IF FOUND THEN
        v_sigla := UPPER(TRIM(v_cliente.sigla));
    ELSE
        v_sigla := '';
    END IF;

    v_doc_ref := COALESCE(
        NULLIF(TRIM(v_pedido.sigla_pedido), ''),
        CASE WHEN v_sigla <> '' THEN v_sigla || '-' || TRIM(v_pedido.nr_pedido) ELSE NULL END,
        TRIM(v_pedido.nr_pedido)
    );

    -- Garantir remoção de qualquer movimento sintético antigo com sigla_pedido (a contabilização do pedido é feita via tabela pedidos nas views de stock)
    IF v_doc_ref IS NOT NULL AND v_doc_ref <> '' AND LOWER(TRIM(v_doc_ref)) <> LOWER(TRIM(COALESCE(v_pedido.doc_primavera, ''))) THEN
        DELETE FROM public.movimentos WHERE LOWER(TRIM(documento_ref)) = LOWER(TRIM(v_doc_ref));
    END IF;

    IF COALESCE(v_pedido.processar, false) = true
       AND NULLIF(TRIM(v_pedido.doc_primavera), '') IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.movimentos m
            WHERE LOWER(TRIM(m.documento_ref)) = LOWER(TRIM(v_pedido.doc_primavera))
        ) INTO v_has_movimento_primavera;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', p_pedido_id,
        'stock_contabilizado_via_pedidos', (
            COALESCE(v_pedido.stock, true) = true
            AND LOWER(TRIM(COALESCE(v_pedido.status, ''))) <> 'cancelado'
            AND NOT v_has_movimento_primavera
        ),
        'stock_contabilizado_via_movimentos', v_has_movimento_primavera
    );
END;
$function$;

DROP TRIGGER IF EXISTS trg_pedidos_concluidos_sync_movimentos ON public.pedidos;

-- 1. VIEW: vw_stock_atual
CREATE OR REPLACE VIEW public.vw_stock_atual WITH (security_invoker = true) AS
WITH base_movimentos AS (
    -- 1. Movimentos reais das tabelas movimentos e movimentos_linhas
    SELECT 
        m.cliente_id,
        UPPER(TRIM(COALESCE(c.sigla, m.sigla, ml.sigla, ml.cliente_ser))) AS cliente_sigla,
        COALESCE(ml.artigo_id, ml.artigo) AS artigo_id,
        ml.artigo_cli,
        ml.descricao,
        ml.tipo_artigo,
        ml.tipo_armazem,
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
    LEFT JOIN public.clientes c ON (c.id = m.cliente_id OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(COALESCE(m.sigla, ml.sigla, ml.cliente_ser))))
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.pedidos p0
        WHERE LOWER(TRIM(m.documento_ref)) IN (
            LOWER(TRIM(COALESCE(p0.sigla_pedido, ''))),
            LOWER(TRIM(COALESCE(p0.nr_pedido, '')))
        )
        AND LOWER(TRIM(m.documento_ref)) <> LOWER(TRIM(COALESCE(p0.doc_primavera, '')))
    )

    UNION ALL

    -- 2. Stock inicial / snapshot da tabela public.stock
    -- (apenas considerado para clientes que ainda não tenham Entradas 'ES' nas tabelas de movimentos)
    SELECT
        c.id AS cliente_id,
        UPPER(TRIM(COALESCE(c.sigla, s.sigla, s.cliente_ser))) AS cliente_sigla,
        s.artigo_id,
        NULL AS artigo_cli,
        s.descricao,
        NULL AS tipo_artigo,
        CASE 
            WHEN s.armazem ~ '[0-9]{2}$' THEN substring(s.armazem from '[0-9]{2}$')
            WHEN s.armazem ~ '[0-9]{1}$' THEN lpad(substring(s.armazem from '[0-9]{1}$'), 2, '0')
            ELSE s.armazem 
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
    LEFT JOIN LATERAL (
        SELECT c1.id, c1.sigla, c1.cli_primavera
        FROM public.clientes c1
        WHERE c1.cli_primavera = s.entidade 
           OR c1.sigla = s.sigla 
           OR c1.sigla = s.cliente_ser
        LIMIT 1
    ) c ON true
    WHERE NOT EXISTS (
        SELECT 1 
        FROM public.movimentos_linhas ml2
        JOIN public.movimentos m2 ON m2.documento_ref = ml2.documento_ref
        WHERE (m2.cliente_id = c.id OR UPPER(TRIM(COALESCE(m2.sigla, ml2.sigla, ml2.cliente_ser))) = UPPER(TRIM(COALESCE(c.sigla, s.sigla, s.cliente_ser))))
          AND LOWER(TRIM(ml2.tipo_movimento)) = ANY (ARRAY['es'::text, 'et'::text, 'e'::text])
    )
),
unified_movimentos AS (
    SELECT * FROM base_movimentos

    UNION ALL

    -- 3. Pedidos contabilizados através da tabela public.pedidos / public.pedido_linhas
    -- REGRA: Só contabiliza se stock = true, status <> 'cancelado', e NÃO tiver simultaneamente
    --        processar = true com um movimento em public.movimentos cujo documento_ref = doc_primavera.
    SELECT
        p.cliente_id,
        UPPER(TRIM(c.sigla)) AS cliente_sigla,
        COALESCE(bm.artigo_id, pl.artigo_id) AS artigo_id,
        COALESCE(bm.artigo_cli, NULLIF(TRIM(pl.artigo_cli), ''), UPPER(TRIM(c.sigla)) || '-' || pl.artigo_id) AS artigo_cli,
        COALESCE(pl.descricao, bm.descricao) AS descricao,
        bm.tipo_artigo,
        '01'::text AS tipo_armazem,
        COALESCE(bm.armazem, UPPER(TRIM(c.sigla)) || '01') AS armazem,
        COALESCE(NULLIF(TRIM(pl.lote), ''), 'S/LOTE'::text) AS lote,
        COALESCE(pl.validade, bm.validade) AS validade,
        bm.data_fabrico,
        COALESCE(p.created_at, p.data_pedido::timestamp with time zone, now()) AS data_movimento,
        COALESCE(p.data_pedido, p.created_at::date, CURRENT_DATE) AS data_stock,
        pl.id::text AS doc_ref_id,
        -COALESCE(pl.quantidade, 0::numeric) AS delta_stock
    FROM public.pedido_linhas pl
    JOIN public.pedidos p ON p.id = pl.pedido_id
    JOIN public.clientes c ON c.id = p.cliente_id
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
        WHERE (b.cliente_id = p.cliente_id OR UPPER(TRIM(b.cliente_sigla)) = UPPER(TRIM(c.sigla)))
          AND LOWER(TRIM(b.artigo_id)) = LOWER(TRIM(pl.artigo_id))
          AND b.lote = COALESCE(NULLIF(TRIM(pl.lote), ''), 'S/LOTE'::text)
          AND COALESCE(
              NULLIF(TRIM(b.tipo_armazem), ''),
              CASE
                  WHEN b.armazem ~ '[0-9]{2}$' THEN substring(b.armazem from '[0-9]{2}$')
                  WHEN b.armazem ~ '[0-9]{1}$' THEN lpad(substring(b.armazem from '[0-9]{1}$'), 2, '0')
                  ELSE COALESCE(b.armazem, '01')
              END
          ) = '01'
        ORDER BY
            CASE WHEN b.validade IS NOT DISTINCT FROM pl.validade THEN 1 ELSE 2 END,
            b.delta_stock DESC
        LIMIT 1
    ) bm ON true
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
)
SELECT 
    c.id AS cliente_id,
    c.name AS cliente_nome,
    c.sigla::character varying AS cliente_sigla,
    um.artigo_id,
    COALESCE(a.artigo_cli, um.artigo_cli, (c.sigla || '-' || um.artigo_id)) AS artigo_cli,
    COALESCE(NULLIF(TRIM(a.descricao), ''), MAX(NULLIF(TRIM(um.descricao), ''))) AS descricao,
    COALESCE(a.id_tipo_artigo, MAX(NULLIF(TRIM(um.tipo_artigo), '')), '')::text AS tipo_artigo,
    COALESCE(a.tipo_armazenamento, 'TA')::text AS tipo_armazenamento,
    COALESCE(
        NULLIF(TRIM(um.tipo_armazem), ''),
        CASE 
            WHEN um.armazem ~ '[0-9]{2}$' THEN substring(um.armazem from '[0-9]{2}$')
            WHEN um.armazem ~ '[0-9]{1}$' THEN lpad(substring(um.armazem from '[0-9]{1}$'), 2, '0')
            ELSE COALESCE(um.armazem, '01')
        END
    ) AS tipo_armazem,
    COALESCE(arm.descricao, um.armazem) AS armazem_descricao,
    COALESCE(um.armazem, c.sigla || '01') AS armazem_loc,
    COALESCE(NULLIF(TRIM(um.lote), ''), 'S/LOTE'::text) AS lote,
    um.validade,
    MIN(um.data_fabrico) AS data_fabrico,
    SUM(um.delta_stock) AS stock,
    MAX(um.data_movimento) AS ultimo_movimento,
    string_agg(um.doc_ref_id, ',') AS stock_id,
    MAX(um.data_stock) AS data_stock
FROM unified_movimentos um
JOIN public.clientes c ON (c.id = um.cliente_id OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(um.cliente_sigla)))
LEFT JOIN LATERAL (
    SELECT 
        a1.artigo_id,
        a1.artigo_cli,
        a1.descricao,
        a1.id_tipo_artigo,
        a1.tipo_armazenamento
    FROM public.artigos a1
    WHERE LOWER(a1.artigo_cli) = LOWER(COALESCE(um.artigo_cli, c.sigla || '-' || um.artigo_id))
       OR (LOWER(a1.artigo_id) = LOWER(um.artigo_id) AND (UPPER(a1.cli_primavera) = UPPER(c.sigla) OR UPPER(SPLIT_PART(a1.artigo_cli, '-', 1)) = UPPER(c.sigla) OR (c.cli_primavera IS NOT NULL AND a1.cli_primavera = c.cli_primavera)))
    ORDER BY 
        CASE WHEN LOWER(a1.artigo_cli) = LOWER(um.artigo_cli) THEN 1 ELSE 2 END
    LIMIT 1
) a ON true
LEFT JOIN public.armazens arm ON arm.tipo_armazem = COALESCE(
    NULLIF(TRIM(um.tipo_armazem), ''),
    CASE 
        WHEN um.armazem ~ '[0-9]{2}$' THEN substring(um.armazem from '[0-9]{2}$')
        WHEN um.armazem ~ '[0-9]{1}$' THEN lpad(substring(um.armazem from '[0-9]{1}$'), 2, '0')
        ELSE COALESCE(um.armazem, '01')
    END
)
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
)
GROUP BY 
    c.id,
    c.name,
    c.sigla,
    um.artigo_id,
    COALESCE(a.artigo_cli, um.artigo_cli, (c.sigla || '-' || um.artigo_id)),
    NULLIF(TRIM(a.descricao), ''),
    a.id_tipo_artigo,
    COALESCE(a.tipo_armazenamento, 'TA')::text,
    COALESCE(
        NULLIF(TRIM(um.tipo_armazem), ''),
        CASE 
            WHEN um.armazem ~ '[0-9]{2}$' THEN substring(um.armazem from '[0-9]{2}$')
            WHEN um.armazem ~ '[0-9]{1}$' THEN lpad(substring(um.armazem from '[0-9]{1}$'), 2, '0')
            ELSE COALESCE(um.armazem, '01')
        END
    ),
    COALESCE(arm.descricao, um.armazem),
    COALESCE(um.armazem, c.sigla || '01'),
    COALESCE(NULLIF(TRIM(um.lote), ''), 'S/LOTE'::text),
    um.validade
HAVING SUM(um.delta_stock) > 0;

-- 2. VIEW: vw_stock_pedidos
CREATE OR REPLACE VIEW public.vw_stock_pedidos WITH (security_invoker = true) AS
WITH base_movimentos AS (
    SELECT 
        m.cliente_id,
        UPPER(TRIM(COALESCE(c.sigla, m.sigla, ml.sigla, ml.cliente_ser))) AS cliente_sigla,
        COALESCE(ml.artigo_id, ml.artigo) AS artigo_id,
        ml.artigo_cli,
        ml.descricao,
        ml.tipo_artigo,
        ml.tipo_armazem,
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
    LEFT JOIN public.clientes c ON (c.id = m.cliente_id OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(COALESCE(m.sigla, ml.sigla, ml.cliente_ser))))
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.pedidos p0
        WHERE LOWER(TRIM(m.documento_ref)) IN (
            LOWER(TRIM(COALESCE(p0.sigla_pedido, ''))),
            LOWER(TRIM(COALESCE(p0.nr_pedido, '')))
        )
        AND LOWER(TRIM(m.documento_ref)) <> LOWER(TRIM(COALESCE(p0.doc_primavera, '')))
    )

    UNION ALL

    SELECT
        c.id AS cliente_id,
        UPPER(TRIM(COALESCE(c.sigla, s.sigla, s.cliente_ser))) AS cliente_sigla,
        s.artigo_id,
        NULL AS artigo_cli,
        s.descricao,
        NULL AS tipo_artigo,
        CASE 
            WHEN s.armazem ~ '[0-9]{2}$' THEN substring(s.armazem from '[0-9]{2}$')
            WHEN s.armazem ~ '[0-9]{1}$' THEN lpad(substring(s.armazem from '[0-9]{1}$'), 2, '0')
            ELSE s.armazem 
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
    LEFT JOIN LATERAL (
        SELECT c1.id, c1.sigla, c1.cli_primavera
        FROM public.clientes c1
        WHERE c1.cli_primavera = s.entidade 
           OR c1.sigla = s.sigla 
           OR c1.sigla = s.cliente_ser
        LIMIT 1
    ) c ON true
    WHERE NOT EXISTS (
        SELECT 1 
        FROM public.movimentos_linhas ml2
        JOIN public.movimentos m2 ON m2.documento_ref = ml2.documento_ref
        WHERE (m2.cliente_id = c.id OR UPPER(TRIM(COALESCE(m2.sigla, ml2.sigla, ml2.cliente_ser))) = UPPER(TRIM(COALESCE(c.sigla, s.sigla, s.cliente_ser))))
          AND LOWER(TRIM(ml2.tipo_movimento)) = ANY (ARRAY['es'::text, 'et'::text, 'e'::text])
    )
),
unified_movimentos AS (
    SELECT * FROM base_movimentos

    UNION ALL

    SELECT
        p.cliente_id,
        UPPER(TRIM(c.sigla)) AS cliente_sigla,
        COALESCE(bm.artigo_id, pl.artigo_id) AS artigo_id,
        COALESCE(bm.artigo_cli, NULLIF(TRIM(pl.artigo_cli), ''), UPPER(TRIM(c.sigla)) || '-' || pl.artigo_id) AS artigo_cli,
        COALESCE(pl.descricao, bm.descricao) AS descricao,
        bm.tipo_artigo,
        '01'::text AS tipo_armazem,
        COALESCE(bm.armazem, UPPER(TRIM(c.sigla)) || '01') AS armazem,
        COALESCE(NULLIF(TRIM(pl.lote), ''), 'S/LOTE'::text) AS lote,
        COALESCE(pl.validade, bm.validade) AS validade,
        bm.data_fabrico,
        COALESCE(p.created_at, p.data_pedido::timestamp with time zone, now()) AS data_movimento,
        COALESCE(p.data_pedido, p.created_at::date, CURRENT_DATE) AS data_stock,
        pl.id::text AS doc_ref_id,
        -COALESCE(pl.quantidade, 0::numeric) AS delta_stock
    FROM public.pedido_linhas pl
    JOIN public.pedidos p ON p.id = pl.pedido_id
    JOIN public.clientes c ON c.id = p.cliente_id
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
        WHERE (b.cliente_id = p.cliente_id OR UPPER(TRIM(b.cliente_sigla)) = UPPER(TRIM(c.sigla)))
          AND LOWER(TRIM(b.artigo_id)) = LOWER(TRIM(pl.artigo_id))
          AND b.lote = COALESCE(NULLIF(TRIM(pl.lote), ''), 'S/LOTE'::text)
          AND COALESCE(
              NULLIF(TRIM(b.tipo_armazem), ''),
              CASE
                  WHEN b.armazem ~ '[0-9]{2}$' THEN substring(b.armazem from '[0-9]{2}$')
                  WHEN b.armazem ~ '[0-9]{1}$' THEN lpad(substring(b.armazem from '[0-9]{1}$'), 2, '0')
                  ELSE COALESCE(b.armazem, '01')
              END
          ) = '01'
        ORDER BY
            CASE WHEN b.validade IS NOT DISTINCT FROM pl.validade THEN 1 ELSE 2 END,
            b.delta_stock DESC
        LIMIT 1
    ) bm ON true
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
)
SELECT 
    c.id AS cliente_id,
    c.name AS cliente_nome,
    c.sigla::character varying AS cliente_sigla,
    um.artigo_id,
    COALESCE(a.artigo_cli, um.artigo_cli, (c.sigla || '-' || um.artigo_id)) AS artigo_cli,
    COALESCE(NULLIF(TRIM(a.descricao), ''), MAX(NULLIF(TRIM(um.descricao), ''))) AS descricao,
    COALESCE(a.id_tipo_artigo, MAX(NULLIF(TRIM(um.tipo_artigo), '')), '')::text AS tipo_artigo,
    COALESCE(a.tipo_armazenamento, 'TA')::text AS tipo_armazenamento,
    COALESCE(NULLIF(TRIM(um.lote), ''), 'S/LOTE'::text) AS lote,
    um.validade,
    MIN(um.data_fabrico) AS data_fabrico,
    SUM(um.delta_stock) AS stock,
    MAX(um.data_movimento) AS ultimo_movimento,
    MAX(um.data_stock) AS data_stock
FROM unified_movimentos um
JOIN public.clientes c ON (c.id = um.cliente_id OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(um.cliente_sigla)))
LEFT JOIN LATERAL (
    SELECT 
        a1.artigo_id,
        a1.artigo_cli,
        a1.descricao,
        a1.id_tipo_artigo,
        a1.tipo_armazenamento
    FROM public.artigos a1
    WHERE LOWER(a1.artigo_cli) = LOWER(COALESCE(um.artigo_cli, c.sigla || '-' || um.artigo_id))
       OR (LOWER(a1.artigo_id) = LOWER(um.artigo_id) AND (UPPER(a1.cli_primavera) = UPPER(c.sigla) OR UPPER(SPLIT_PART(a1.artigo_cli, '-', 1)) = UPPER(c.sigla) OR (c.cli_primavera IS NOT NULL AND a1.cli_primavera = c.cli_primavera)))
    ORDER BY 
        CASE WHEN LOWER(a1.artigo_cli) = LOWER(um.artigo_cli) THEN 1 ELSE 2 END
    LIMIT 1
) a ON true
WHERE COALESCE(
    NULLIF(TRIM(um.tipo_armazem), ''),
    CASE 
        WHEN um.armazem ~ '[0-9]{2}$' THEN substring(um.armazem from '[0-9]{2}$')
        WHEN um.armazem ~ '[0-9]{1}$' THEN lpad(substring(um.armazem from '[0-9]{1}$'), 2, '0')
        ELSE COALESCE(um.armazem, '01')
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
    um.artigo_id,
    COALESCE(a.artigo_cli, um.artigo_cli, (c.sigla || '-' || um.artigo_id)),
    NULLIF(TRIM(a.descricao), ''),
    a.id_tipo_artigo,
    COALESCE(a.tipo_armazenamento, 'TA')::text,
    COALESCE(NULLIF(TRIM(um.lote), ''), 'S/LOTE'::text),
    um.validade
HAVING SUM(um.delta_stock) > 0;

-- 3. VIEW: vw_stock_zero
CREATE OR REPLACE VIEW public.vw_stock_zero WITH (security_invoker = true) AS
WITH base_movimentos AS (
    SELECT 
        m.cliente_id,
        UPPER(TRIM(COALESCE(c.sigla, m.sigla, ml.sigla, ml.cliente_ser))) AS cliente_sigla,
        c.cli_primavera,
        COALESCE(ml.artigo_id, ml.artigo) AS artigo_id,
        ml.artigo_cli,
        ml.descricao,
        ml.tipo_artigo,
        ml.tipo_armazem,
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
    LEFT JOIN public.clientes c ON (c.id = m.cliente_id OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(COALESCE(m.sigla, ml.sigla, ml.cliente_ser))))
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.pedidos p0
        WHERE LOWER(TRIM(m.documento_ref)) IN (
            LOWER(TRIM(COALESCE(p0.sigla_pedido, ''))),
            LOWER(TRIM(COALESCE(p0.nr_pedido, '')))
        )
        AND LOWER(TRIM(m.documento_ref)) <> LOWER(TRIM(COALESCE(p0.doc_primavera, '')))
    )

    UNION ALL

    SELECT
        c.id AS cliente_id,
        UPPER(TRIM(COALESCE(c.sigla, s.sigla, s.cliente_ser))) AS cliente_sigla,
        c.cli_primavera,
        s.artigo_id,
        NULL AS artigo_cli,
        s.descricao,
        NULL AS tipo_artigo,
        CASE 
            WHEN s.armazem ~ '[0-9]{2}$' THEN substring(s.armazem from '[0-9]{2}$')
            WHEN s.armazem ~ '[0-9]{1}$' THEN lpad(substring(s.armazem from '[0-9]{1}$'), 2, '0')
            ELSE s.armazem 
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
    LEFT JOIN LATERAL (
        SELECT c1.id, c1.sigla, c1.cli_primavera
        FROM public.clientes c1
        WHERE c1.cli_primavera = s.entidade 
           OR c1.sigla = s.sigla 
           OR c1.sigla = s.cliente_ser
        LIMIT 1
    ) c ON true
    WHERE NOT EXISTS (
        SELECT 1 
        FROM public.movimentos_linhas ml2
        JOIN public.movimentos m2 ON m2.documento_ref = ml2.documento_ref
        WHERE (m2.cliente_id = c.id OR UPPER(TRIM(COALESCE(m2.sigla, ml2.sigla, ml2.cliente_ser))) = UPPER(TRIM(COALESCE(c.sigla, s.sigla, s.cliente_ser))))
          AND LOWER(TRIM(ml2.tipo_movimento)) = ANY (ARRAY['es'::text, 'et'::text, 'e'::text])
    )
),
unified_movimentos AS (
    SELECT * FROM base_movimentos

    UNION ALL

    SELECT
        p.cliente_id,
        UPPER(TRIM(c.sigla)) AS cliente_sigla,
        c.cli_primavera,
        COALESCE(bm.artigo_id, pl.artigo_id) AS artigo_id,
        COALESCE(bm.artigo_cli, NULLIF(TRIM(pl.artigo_cli), ''), UPPER(TRIM(c.sigla)) || '-' || pl.artigo_id) AS artigo_cli,
        COALESCE(pl.descricao, bm.descricao) AS descricao,
        bm.tipo_artigo,
        '01'::text AS tipo_armazem,
        COALESCE(bm.armazem, UPPER(TRIM(c.sigla)) || '01') AS armazem,
        COALESCE(NULLIF(TRIM(pl.lote), ''), 'S/LOTE'::text) AS lote,
        COALESCE(pl.validade, bm.validade) AS validade,
        bm.data_fabrico,
        COALESCE(p.created_at, p.data_pedido::timestamp with time zone, now()) AS data_movimento,
        COALESCE(p.data_pedido, p.created_at::date, CURRENT_DATE) AS data_stock,
        pl.id::text AS doc_ref_id,
        -COALESCE(pl.quantidade, 0::numeric) AS delta_stock
    FROM public.pedido_linhas pl
    JOIN public.pedidos p ON p.id = pl.pedido_id
    JOIN public.clientes c ON c.id = p.cliente_id
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
        WHERE (b.cliente_id = p.cliente_id OR UPPER(TRIM(b.cliente_sigla)) = UPPER(TRIM(c.sigla)))
          AND LOWER(TRIM(b.artigo_id)) = LOWER(TRIM(pl.artigo_id))
          AND b.lote = COALESCE(NULLIF(TRIM(pl.lote), ''), 'S/LOTE'::text)
          AND COALESCE(
              NULLIF(TRIM(b.tipo_armazem), ''),
              CASE
                  WHEN b.armazem ~ '[0-9]{2}$' THEN substring(b.armazem from '[0-9]{2}$')
                  WHEN b.armazem ~ '[0-9]{1}$' THEN lpad(substring(b.armazem from '[0-9]{1}$'), 2, '0')
                  ELSE COALESCE(b.armazem, '01')
              END
          ) = '01'
        ORDER BY
            CASE WHEN b.validade IS NOT DISTINCT FROM pl.validade THEN 1 ELSE 2 END,
            b.delta_stock DESC
        LIMIT 1
    ) bm ON true
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
positive_articles AS (
    SELECT 
        um.cliente_id,
        um.artigo_id,
        REGEXP_REPLACE(um.artigo_id, '^[0-9]+-', '') AS norm_artigo_id
    FROM unified_movimentos um
    GROUP BY um.cliente_id, um.artigo_id
    HAVING SUM(um.delta_stock) > 0
),
stock_agg AS (
    SELECT 
        um.cliente_sigla AS sigla,
        um.cli_primavera AS entidade,
        um.artigo_id,
        MAX(um.descricao) AS stock_descricao,
        SUM(um.delta_stock) AS total_stock,
        MAX(um.data_movimento) AS ultimo_movimento,
        COUNT(um.doc_ref_id) AS total_registos
    FROM unified_movimentos um
    GROUP BY um.cliente_sigla, um.cli_primavera, um.artigo_id
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
        OR UPPER(SPLIT_PART(a.artigo_cli, '-', 1)) = UPPER(c.sigla)
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

GRANT SELECT ON public.vw_stock_atual TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_stock_pedidos TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_stock_zero TO authenticated, anon, service_role;

