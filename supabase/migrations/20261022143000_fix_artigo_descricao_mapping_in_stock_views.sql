-- Migration: 20261022143000_fix_artigo_descricao_mapping_in_stock_views.sql
-- Corrige a atribuição errada de s.artigo (código) ao campo artigo_descricao nas views de stock
-- Adiciona suporte a coluna descricao na tabela public.stock

-- 1. Adicionar coluna descricao na tabela public.stock caso ainda não exista
ALTER TABLE public.stock 
ADD COLUMN IF NOT EXISTS descricao TEXT;

COMMENT ON COLUMN public.stock.descricao IS 'Descrição / designação do produto';

CREATE INDEX IF NOT EXISTS idx_stock_descricao ON public.stock(descricao);

-- 2. Atualizar descrições existentes na tabela stock com base no catálogo de artigos
UPDATE public.stock s
SET descricao = a.descricao
FROM public.artigos a
WHERE (
  a.artigo_id = s.artigo
  OR a.artigo_cli = s.artigo
  OR a.artigo_cli = (s.entidade || '-' || s.artigo)
  OR a.artigo_cli = (s.sigla || '-' || s.artigo)
)
AND a.descricao IS NOT NULL 
AND a.descricao <> '' 
AND a.descricao <> a.artigo_id
AND s.descricao IS NULL;

-- 3. Atualizar view vw_stock_atual
DROP VIEW IF EXISTS public.vw_stock_atual CASCADE;

CREATE VIEW public.vw_stock_atual WITH (security_invoker = true) AS
SELECT 
    c.id AS cliente_id,
    COALESCE(c.name, s.cliente_ser, s.sigla) AS cliente_nome,
    COALESCE(c.sigla, s.sigla, s.cliente_ser) AS cliente_sigla,
    COALESCE(a.artigo_id, s.artigo) AS artigo_id,
    COALESCE(a.artigo_cli, (s.sigla || '-' || s.artigo), s.artigo) AS artigo_codigo,
    COALESCE(NULLIF(TRIM(a.descricao), ''), NULLIF(TRIM(s.descricao), '')) AS artigo_descricao,
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
    WHERE a1.artigo_id = s.artigo
       OR a1.artigo_cli = s.artigo
       OR a1.artigo_cli = (s.entidade || '-' || s.artigo)
       OR a1.artigo_cli = (s.sigla || '-' || s.artigo)
       OR (c.sigla IS NOT NULL AND a1.artigo_cli = (c.sigla || '-' || s.artigo))
       OR (c.cli_primavera IS NOT NULL AND a1.artigo_cli = (c.cli_primavera || '-' || s.artigo))
    ORDER BY 
        CASE WHEN a1.cli_primavera = s.entidade THEN 1 
             WHEN a1.cli_primavera = s.sigla THEN 2 
             ELSE 3 END
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
    COALESCE(a.artigo_id, s.artigo),
    COALESCE(a.artigo_cli, (s.sigla || '-' || s.artigo), s.artigo),
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

-- 4. Atualizar view vw_stock_pedidos
DROP VIEW IF EXISTS public.vw_stock_pedidos CASCADE;

CREATE VIEW public.vw_stock_pedidos WITH (security_invoker = true) AS
SELECT 
    c.id AS cliente_id,
    COALESCE(c.name, s.cliente_ser, s.sigla) AS cliente_nome,
    COALESCE(c.sigla, s.sigla, s.cliente_ser) AS cliente_sigla,
    COALESCE(a.artigo_id, s.artigo) AS artigo_id,
    COALESCE(a.artigo_cli, (s.sigla || '-' || s.artigo), s.artigo) AS artigo_codigo,
    COALESCE(NULLIF(TRIM(a.descricao), ''), NULLIF(TRIM(s.descricao), '')) AS artigo_descricao,
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
    WHERE a1.artigo_id = s.artigo
       OR a1.artigo_cli = s.artigo
       OR a1.artigo_cli = (s.entidade || '-' || s.artigo)
       OR a1.artigo_cli = (s.sigla || '-' || s.artigo)
       OR (c.sigla IS NOT NULL AND a1.artigo_cli = (c.sigla || '-' || s.artigo))
       OR (c.cli_primavera IS NOT NULL AND a1.artigo_cli = (c.cli_primavera || '-' || s.artigo))
    ORDER BY 
        CASE WHEN a1.cli_primavera = s.entidade THEN 1 
             WHEN a1.cli_primavera = s.sigla THEN 2 
             ELSE 3 END
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
    COALESCE(a.artigo_id, s.artigo),
    COALESCE(a.artigo_cli, (s.sigla || '-' || s.artigo), s.artigo),
    COALESCE(NULLIF(TRIM(a.descricao), ''), NULLIF(TRIM(s.descricao), '')),
    COALESCE(a.id_tipo_artigo, '')::text,
    COALESCE(a.tipo_armazenamento, 'TA')::text,
    COALESCE(s.lote, 'S/LOTE'::text),
    s.data_stock
HAVING SUM(s.stock) > 0;

GRANT SELECT ON public.vw_stock_pedidos TO authenticated, anon, service_role;

-- 5. Atualizar view vw_stock_zero
DROP VIEW IF EXISTS public.vw_stock_zero CASCADE;

CREATE VIEW public.vw_stock_zero WITH (security_invoker = true) AS
WITH stock_agg AS (
    SELECT 
        s.sigla,
        s.entidade,
        s.artigo,
        MAX(s.descricao) AS stock_descricao,
        SUM(s.stock) AS total_stock,
        MAX(s.created_at) AS ultimo_movimento,
        COUNT(s.id) AS total_registos,
        COALESCE(string_agg(DISTINCT s.lote, ', ') FILTER (WHERE s.lote IS NOT NULL AND s.lote <> '' AND s.lote <> 'S/LOTE'), '-') AS lotes_historico
    FROM public.stock s
    GROUP BY s.sigla, s.entidade, s.artigo
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
        sa.artigo AS artigo_id,
        COALESCE(ca.artigo_cli, (sa.sigla || '-' || sa.artigo)) AS artigo_codigo,
        COALESCE(NULLIF(TRIM(ca.descricao), ''), NULLIF(TRIM(sa.stock_descricao), '')) AS artigo_descricao,
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
        WHERE ca1.artigo_id = sa.artigo 
           OR ca1.artigo_cli = sa.artigo
           OR ca1.artigo_cli = (sa.entidade || '-' || sa.artigo)
           OR ca1.artigo_cli = (sa.sigla || '-' || sa.artigo)
           OR (c.sigla IS NOT NULL AND ca1.artigo_cli = (c.sigla || '-' || sa.artigo))
           OR (c.cli_primavera IS NOT NULL AND ca1.artigo_cli = (c.cli_primavera || '-' || sa.artigo))
        LIMIT 1
    ) ca ON true
    WHERE sa.total_stock <= 0

    UNION ALL

    SELECT 
        ca.cliente_id,
        ca.cliente_nome,
        ca.cliente_sigla,
        ca.artigo_id,
        ca.artigo_cli AS artigo_codigo,
        ca.descricao AS artigo_descricao,
        COALESCE(ca.id_tipo_artigo, '')::text AS tipo_artigo,
        COALESCE(ca.tipo_armazenamento, 'TA')::text AS tipo_armazenamento,
        ca.familia,
        ca.subfamilia,
        0::numeric AS stock,
        NULL::timestamp with time zone AS ultimo_movimento,
        0::bigint AS total_movimentos,
        '-'::text AS lotes_historico
    FROM catalog_artigos ca
    WHERE NOT EXISTS (
        SELECT 1 FROM stock_agg sa2
        WHERE sa2.artigo = ca.artigo_id
           OR sa2.artigo = ca.artigo_cli
           OR (sa2.sigla || '-' || sa2.artigo) = ca.artigo_cli
           OR (sa2.entidade || '-' || sa2.artigo) = ca.artigo_cli
    )
)
SELECT DISTINCT ON (cliente_id, artigo_id)
    cliente_id,
    cliente_nome,
    cliente_sigla,
    artigo_id,
    artigo_codigo,
    artigo_descricao,
    tipo_artigo,
    tipo_armazenamento,
    familia,
    subfamilia,
    stock,
    ultimo_movimento,
    total_movimentos,
    lotes_historico
FROM all_zero_candidates
WHERE (
    auth.uid() IS NULL
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
          AND (u.role IN ('admin', 'gestor') OR u.cliente_id IS NULL)
    )
    OR cliente_id = (
        SELECT u.cliente_id FROM public.users u 
        WHERE u.id = auth.uid()
    )
)
ORDER BY cliente_id, artigo_id;

GRANT SELECT ON public.vw_stock_zero TO authenticated, anon, service_role;
