-- =========================================================================
-- PLATAFORMA FARMA - REMOVER CAMPO ID DA TABELA ARTIGOS
-- Torna 'artigo_id' (TEXT) a Primary Key da tabela artigos
-- =========================================================================

-- 1. Eliminar views dependentes
DROP VIEW IF EXISTS public.vw_stock_atual CASCADE;
DROP VIEW IF EXISTS public.vw_stock_pedidos CASCADE;

-- 2. Eliminar foreign keys existentes que apontavam para artigos(id)
ALTER TABLE public.movimentos DROP CONSTRAINT IF EXISTS movimentos_artigo_id_fkey;
ALTER TABLE public.pedido_linhas DROP CONSTRAINT IF EXISTS pedido_linhas_artigo_id_fkey;

-- 3. Atualizar coluna artigo_id de movimentos para conter o código do artigo (TEXT)
ALTER TABLE public.movimentos ADD COLUMN IF NOT EXISTS artigo_codigo_temp text;
UPDATE public.movimentos m SET artigo_codigo_temp = a.artigo_id FROM public.artigos a WHERE a.id = m.artigo_id;
ALTER TABLE public.movimentos DROP COLUMN IF EXISTS artigo_id;
ALTER TABLE public.movimentos RENAME COLUMN artigo_codigo_temp TO artigo_id;
ALTER TABLE public.movimentos ALTER COLUMN artigo_id SET NOT NULL;

-- 4. Alterar coluna artigo_id de pedido_linhas para TEXT
ALTER TABLE public.pedido_linhas ALTER COLUMN artigo_id TYPE text;

-- 5. Remover a coluna id e definir artigo_id como PRIMARY KEY em public.artigos
ALTER TABLE public.artigos DROP CONSTRAINT IF EXISTS artigos_pkey CASCADE;
ALTER TABLE public.artigos DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE public.artigos ADD PRIMARY KEY (artigo_id);

-- 6. Recriar as restrições de Foreign Key para artigos(artigo_id)
ALTER TABLE public.movimentos
  ADD CONSTRAINT movimentos_artigo_id_fkey
  FOREIGN KEY (artigo_id) REFERENCES public.artigos(artigo_id) ON DELETE RESTRICT;

ALTER TABLE public.pedido_linhas
  ADD CONSTRAINT pedido_linhas_artigo_id_fkey
  FOREIGN KEY (artigo_id) REFERENCES public.artigos(artigo_id) ON DELETE RESTRICT;

-- 7. Recriar Views de Stock
CREATE OR REPLACE VIEW public.vw_stock_atual AS
SELECT
    m.client_id,
    c.name AS cliente_nome,
    c.sigla AS cliente_sigla,
    m.artigo_id,
    a.artigo_id AS artigo_codigo,
    a.descricao AS artigo_descricao,
    a.tipo_artigo,
    a.tipo_armazenamento,
    m.tipo_armazem,
    arm.descricao AS armazem_descricao,
    m.armazem_loc,
    COALESCE(m.posicao, 'N/A') AS posicao,
    COALESCE(m.lote, 'S/LOTE') AS lote,
    m.validade,
    MIN(m.data_fabrico) AS data_fabrico,
    SUM(
        CASE
            WHEN m.tipo_movimento IN ('es', 'et') THEN m.quantidade
            WHEN m.tipo_movimento IN ('ss', 'st') THEN -m.quantidade
            ELSE 0
        END
    ) AS stock,
    MAX(m.data_movimento) AS ultimo_movimento
FROM public.movimentos m
JOIN public.clients c ON c.id = m.client_id
JOIN public.artigos a ON a.artigo_id = m.artigo_id
LEFT JOIN public.armazens arm ON arm.tipo_armazem = m.tipo_armazem
GROUP BY
    m.client_id,
    c.name,
    c.sigla,
    m.artigo_id,
    a.artigo_id,
    a.descricao,
    a.tipo_artigo,
    a.tipo_armazenamento,
    m.tipo_armazem,
    arm.descricao,
    m.armazem_loc,
    COALESCE(m.posicao, 'N/A'),
    COALESCE(m.lote, 'S/LOTE'),
    m.validade
HAVING SUM(
    CASE
        WHEN m.tipo_movimento IN ('es', 'et') THEN m.quantidade
        WHEN m.tipo_movimento IN ('ss', 'st') THEN -m.quantidade
        ELSE 0
    END
) > 0;

CREATE OR REPLACE VIEW public.vw_stock_pedidos AS
SELECT
    m.client_id,
    c.name AS cliente_nome,
    c.sigla AS cliente_sigla,
    m.artigo_id,
    a.artigo_id AS artigo_codigo,
    a.descricao AS artigo_descricao,
    a.tipo_artigo,
    a.tipo_armazenamento,
    COALESCE(m.lote, 'S/LOTE') AS lote,
    m.validade,
    MIN(m.data_fabrico) AS data_fabrico,
    SUM(
        CASE
            WHEN m.tipo_movimento IN ('es', 'et') THEN m.quantidade
            WHEN m.tipo_movimento IN ('ss', 'st') THEN -m.quantidade
            ELSE 0
        END
    ) AS stock,
    MAX(m.data_movimento) AS ultimo_movimento
FROM public.movimentos m
JOIN public.clients c ON c.id = m.client_id
JOIN public.artigos a ON a.artigo_id = m.artigo_id
WHERE m.tipo_armazem = '01'
GROUP BY
    m.client_id,
    c.name,
    c.sigla,
    m.artigo_id,
    a.artigo_id,
    a.descricao,
    a.tipo_artigo,
    a.tipo_armazenamento,
    COALESCE(m.lote, 'S/LOTE'),
    m.validade
HAVING SUM(
    CASE
        WHEN m.tipo_movimento IN ('es', 'et') THEN m.quantidade
        WHEN m.tipo_movimento IN ('ss', 'st') THEN -m.quantidade
        ELSE 0
    END
) > 0;
