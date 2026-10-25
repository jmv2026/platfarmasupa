-- Migração para atualizar a view vw_stock_zero:
-- Ignora o lote na verificação de stock 0 e verifica exclusivamente o artigo a nível global.
-- Se um artigo tiver stock > 0 em qualquer lote ou armazém, é excluído da lista de stock 0.

DROP VIEW IF EXISTS public.vw_stock_zero CASCADE;

CREATE VIEW public.vw_stock_zero WITH (security_invoker = true) AS
WITH positive_articles AS (
    -- Todos os artigos com stock positivo (> 0) em qualquer lote ou armazém para o respetivo cliente
    SELECT 
        c.id AS cliente_id,
        s.artigo_id,
        REGEXP_REPLACE(s.artigo_id, '^[0-9]+-', '') AS norm_artigo_id
    FROM public.stock s
    JOIN public.clientes c ON (c.cli_primavera = s.entidade OR c.sigla = s.sigla OR c.sigla = s.cliente_ser)
    GROUP BY c.id, s.artigo_id
    HAVING SUM(s.stock) > 0
),
stock_agg AS (
    -- Agrupamento a nível de artigo ignorando o lote
    SELECT 
        s.sigla,
        s.entidade,
        s.artigo_id,
        MAX(s.descricao) AS stock_descricao,
        SUM(s.stock) AS total_stock,
        MAX(s.created_at) AS ultimo_movimento,
        COUNT(s.id) AS total_registos
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
    -- Candidatos originários da tabela de stock (com saldo total <= 0 e sem saldo positivo em nenhum lote)
    SELECT 
        c.id AS cliente_id,
        COALESCE(c.name, sa.sigla) AS cliente_nome,
        COALESCE(c.sigla, sa.sigla) AS cliente_sigla,
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
        WHERE ca1.artigo_id = sa.artigo_id 
           OR ca1.artigo_cli = sa.artigo_id
           OR ca1.artigo_id = REGEXP_REPLACE(sa.artigo_id, '^[0-9]+-', '')
           OR ca1.artigo_cli = (sa.entidade || '-' || sa.artigo_id)
           OR ca1.artigo_cli = (sa.sigla || '-' || sa.artigo_id)
           OR (c.sigla IS NOT NULL AND ca1.artigo_cli = (c.sigla || '-' || sa.artigo_id))
           OR (c.cli_primavera IS NOT NULL AND ca1.artigo_cli = (c.cli_primavera || '-' || sa.artigo_id))
        ORDER BY CASE WHEN ca1.artigo_id = REGEXP_REPLACE(sa.artigo_id, '^[0-9]+-', '') THEN 1 ELSE 2 END
        LIMIT 1
    ) ca ON true
    WHERE sa.total_stock <= 0
      AND NOT EXISTS (
          SELECT 1 FROM positive_articles pa
          WHERE pa.cliente_id = c.id
            AND (
                pa.artigo_id = sa.artigo_id
                OR pa.norm_artigo_id = sa.artigo_id
                OR pa.norm_artigo_id = REGEXP_REPLACE(sa.artigo_id, '^[0-9]+-', '')
                OR (ca.artigo_id IS NOT NULL AND (pa.artigo_id = ca.artigo_id OR pa.norm_artigo_id = ca.artigo_id))
                OR (ca.artigo_cli IS NOT NULL AND (pa.artigo_id = ca.artigo_cli OR pa.norm_artigo_id = ca.artigo_cli))
            )
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

    UNION ALL

    -- Candidatos do catálogo de artigos que nunca tiveram stock registado
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
        WHERE (
            s.artigo_id = ca.artigo_id 
            OR s.artigo_id = ca.artigo_cli 
            OR REGEXP_REPLACE(s.artigo_id, '^[0-9]+-', '') = ca.artigo_id
        )
        AND (s.sigla = ca.cliente_sigla OR s.entidade = ca.cli_primavera)
    )
      AND NOT EXISTS (
          SELECT 1 FROM positive_articles pa
          WHERE pa.cliente_id = ca.cliente_id
            AND (
                pa.artigo_id = ca.artigo_id
                OR pa.norm_artigo_id = ca.artigo_id
                OR pa.artigo_id = ca.artigo_cli
                OR pa.norm_artigo_id = ca.artigo_cli
            )
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
