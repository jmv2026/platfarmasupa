-- Migration: 20261026154500_sync_stock_validade_and_update_views.sql
-- Descrição: Assegura campos distintos data_stock, validade e data_fabrico na tabela public.stock
--            e atualiza as views vw_stock_atual e vw_stock_pedidos para expor os três campos distintos.

-- 1. Assegurar colunas na tabela stock
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS validade DATE;
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS data_fabrico DATE;

COMMENT ON COLUMN public.stock.data_stock IS 'Data do registo / saldo / snapshot do stock';
COMMENT ON COLUMN public.stock.validade IS 'Data de validade / caducidade do lote do artigo';
COMMENT ON COLUMN public.stock.data_fabrico IS 'Data de fabrico do lote do artigo';

-- 2. Atualizar vw_stock_atual expondo validade, data_fabrico e data_stock separadamente
CREATE OR REPLACE VIEW public.vw_stock_atual WITH (security_invoker = true) AS
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
    s.armazem,
    COALESCE(s.lote, 'S/LOTE'::text),
    s.validade,
    s.data_fabrico,
    s.data_stock
HAVING SUM(s.stock) > 0;

-- 3. Atualizar vw_stock_pedidos expondo validade, data_fabrico e data_stock separadamente
CREATE OR REPLACE VIEW public.vw_stock_pedidos WITH (security_invoker = true) AS
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
    s.validade,
    s.data_fabrico,
    s.data_stock
HAVING SUM(s.stock) > 0;
