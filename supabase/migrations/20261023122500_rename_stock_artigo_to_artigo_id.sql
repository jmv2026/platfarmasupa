-- Migration: 20261023122500_rename_stock_artigo_to_artigo_id.sql
-- Renomeia a coluna artigo para artigo_id na tabela public.stock
-- e atualiza as views de stock (vw_stock_atual, vw_stock_pedidos, vw_stock_zero)
-- para ligar diretamente por artigo_id.

-- 1. Remover views dependentes antes de alterar a tabela
DROP VIEW IF EXISTS public.vw_stock_atual CASCADE;
DROP VIEW IF EXISTS public.vw_stock_pedidos CASCADE;
DROP VIEW IF EXISTS public.vw_stock_zero CASCADE;

-- 2. Renomear a coluna artigo para artigo_id na tabela public.stock (se ainda não tiver sido renomeada)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'stock' AND column_name = 'artigo'
  ) THEN
    ALTER TABLE public.stock RENAME COLUMN artigo TO artigo_id;
  END IF;
END $$;

-- 3. Atualizar índices na tabela public.stock
DROP INDEX IF EXISTS public.idx_stock_artigo;
CREATE INDEX IF NOT EXISTS idx_stock_artigo_id ON public.stock(artigo_id);

COMMENT ON COLUMN public.stock.artigo_id IS 'Código do artigo (referência para artigos.artigo_id)';

-- 4. Reconstruir a view vw_stock_atual
CREATE VIEW public.vw_stock_atual WITH (security_invoker = true) AS
SELECT 
    c.id AS cliente_id,
    COALESCE(c.name, s.cliente_ser, s.sigla) AS cliente_nome,
    COALESCE(c.sigla, s.sigla, s.cliente_ser) AS cliente_sigla,
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
    COALESCE(s.localizacao, s.armazem) AS armazem_loc,
    COALESCE(s.lote, 'S/LOTE'::text) AS lote,
    s.data_stock AS validade,
    NULL::date AS data_fabrico,
    SUM(s.stock) AS stock,
    MAX(s.created_at) AS ultimo_movimento
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
WHERE (
    auth.uid() IS NULL
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
          AND (u.role IN ('admin', 'gestor') OR u.cliente_id IS NULL)
    )
    OR c.id = (
        SELECT u.cliente_id FROM public.users u 
        WHERE u.id = auth.uid()
    )
)
GROUP BY 
    c.id,
    COALESCE(c.name, s.cliente_ser, s.sigla),
    COALESCE(c.sigla, s.sigla, s.cliente_ser),
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
    COALESCE(s.localizacao, s.armazem),
    COALESCE(s.lote, 'S/LOTE'::text),
    s.data_stock
HAVING SUM(s.stock) > 0;

GRANT SELECT ON public.vw_stock_atual TO authenticated, anon, service_role;

-- 5. Reconstruir a view vw_stock_pedidos
CREATE VIEW public.vw_stock_pedidos WITH (security_invoker = true) AS
SELECT 
    c.id AS cliente_id,
    COALESCE(c.name, s.cliente_ser, s.sigla) AS cliente_nome,
    COALESCE(c.sigla, s.sigla, s.cliente_ser) AS cliente_sigla,
    s.artigo_id AS artigo_id,
    COALESCE(a.artigo_cli, (s.sigla || '-' || s.artigo_id), s.artigo_id) AS artigo_cli,
    COALESCE(NULLIF(TRIM(a.descricao), ''), NULLIF(TRIM(s.descricao), '')) AS descricao,
    COALESCE(a.id_tipo_artigo, '')::text AS tipo_artigo,
    COALESCE(a.tipo_armazenamento, 'TA')::text AS tipo_armazenamento,
    COALESCE(s.lote, 'S/LOTE'::text) AS lote,
    s.data_stock AS validade,
    NULL::date AS data_fabrico,
    SUM(s.stock) AS stock,
    MAX(s.created_at) AS ultimo_movimento
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
WHERE (
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
          AND (u.role IN ('admin', 'gestor') OR u.cliente_id IS NULL)
    )
    OR c.id = (
        SELECT u.cliente_id FROM public.users u 
        WHERE u.id = auth.uid()
    )
)
GROUP BY 
    c.id,
    COALESCE(c.name, s.cliente_ser, s.sigla),
    COALESCE(c.sigla, s.sigla, s.cliente_ser),
    s.artigo_id,
    COALESCE(a.artigo_cli, (s.sigla || '-' || s.artigo_id), s.artigo_id),
    COALESCE(NULLIF(TRIM(a.descricao), ''), NULLIF(TRIM(s.descricao), '')),
    COALESCE(a.id_tipo_artigo, '')::text,
    COALESCE(a.tipo_armazenamento, 'TA')::text,
    COALESCE(s.lote, 'S/LOTE'::text),
    s.data_stock
HAVING SUM(s.stock) > 0;

GRANT SELECT ON public.vw_stock_pedidos TO authenticated, anon, service_role;

-- 6. Reconstruir a view vw_stock_zero
CREATE VIEW public.vw_stock_zero WITH (security_invoker = true) AS
WITH stock_agg AS (
    SELECT 
        s.sigla,
        s.entidade,
        s.artigo_id,
        MAX(s.descricao) AS stock_descricao,
        SUM(s.stock) AS total_stock,
        MAX(s.created_at) AS ultimo_movimento,
        COUNT(s.id) AS total_registos,
        COALESCE(string_agg(DISTINCT s.lote, ', ') FILTER (WHERE s.lote IS NOT NULL AND s.lote <> '' AND s.lote <> 'S/LOTE'), '-') AS lotes_historico
    FROM public.stock s
    GROUP BY s.sigla, s.entidade, s.artigo_id
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
    JOIN public.clientes c ON (c.sigla = a.cli_primavera OR c.cli_primavera = a.cli_primavera)
),
all_zero_candidates AS (
    SELECT 
        c.id AS cliente_id,
        COALESCE(c.name, sa.sigla) AS cliente_nome,
        COALESCE(c.sigla, sa.sigla) AS cliente_sigla,
        sa.artigo_id AS artigo_id,
        COALESCE(ca.artigo_cli, (sa.sigla || '-' || sa.artigo_id)) AS artigo_cli,
        COALESCE(NULLIF(TRIM(ca.descricao), ''), NULLIF(TRIM(sa.stock_descricao), '')) AS descricao,
        COALESCE(ca.id_tipo_artigo, '')::text AS tipo_artigo,
        COALESCE(ca.tipo_armazenamento, 'TA')::text AS tipo_armazenamento,
        ca.familia,
        ca.subfamilia,
        0::numeric AS stock,
        sa.ultimo_movimento,
        sa.total_registos AS total_movimentos,
        sa.lotes_historico
    FROM stock_agg sa
    LEFT JOIN LATERAL (
        SELECT c1.id, c1.name, c1.sigla, c1.cli_primavera
        FROM public.clientes c1
        WHERE c1.cli_primavera = sa.entidade OR c1.sigla = sa.sigla
        LIMIT 1
    ) c ON true
    LEFT JOIN LATERAL (
        SELECT ca1.artigo_cli, ca1.descricao, ca1.id_tipo_artigo, ca1.tipo_armazenamento, ca1.familia, ca1.subfamilia
        FROM public.artigos ca1
        WHERE ca1.artigo_id = sa.artigo_id 
           OR ca1.artigo_cli = sa.artigo_id
           OR ca1.artigo_cli = (sa.entidade || '-' || sa.artigo_id)
           OR ca1.artigo_cli = (sa.sigla || '-' || sa.artigo_id)
           OR (c.sigla IS NOT NULL AND ca1.artigo_cli = (c.sigla || '-' || sa.artigo_id))
           OR (c.cli_primavera IS NOT NULL AND ca1.artigo_cli = (c.cli_primavera || '-' || sa.artigo_id))
        LIMIT 1
    ) ca ON true
    WHERE sa.total_stock <= 0
      AND (
          auth.uid() IS NULL
          OR EXISTS (
              SELECT 1 FROM public.users u 
              WHERE u.id = auth.uid() 
                AND (u.role IN ('admin', 'gestor') OR u.cliente_id IS NULL)
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
        FROM public.stock s
        WHERE (s.artigo_id = ca.artigo_id OR s.artigo_id = ca.artigo_cli)
          AND (s.sigla = ca.cliente_sigla OR s.entidade = ca.cli_primavera)
    )
    AND (
        auth.uid() IS NULL
        OR EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() 
              AND (u.role IN ('admin', 'gestor') OR u.cliente_id IS NULL)
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

GRANT SELECT ON public.vw_stock_zero TO authenticated, anon, service_role;
