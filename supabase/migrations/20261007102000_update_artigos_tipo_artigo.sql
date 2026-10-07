-- Drop existing check constraint that enforces old names
ALTER TABLE public.artigos DROP CONSTRAINT IF EXISTS artigos_tipo_artigo_check;

-- Convert data from 'tipo_artigo' name to 'id_tipo_artigo'
UPDATE public.artigos a
SET tipo_artigo = t.id_tipo_artigo
FROM public.tipos_artigo t
WHERE a.tipo_artigo = t.tipo_artigo;

-- Rename the column
ALTER TABLE public.artigos
RENAME COLUMN tipo_artigo TO id_tipo_artigo;

-- Add Foreign Key constraint
ALTER TABLE public.artigos
ADD CONSTRAINT fk_artigos_id_tipo_artigo
FOREIGN KEY (id_tipo_artigo)
REFERENCES public.tipos_artigo (id_tipo_artigo);

-- Update Views to restore semantic API (returning 'tipo_artigo' string from tipos_artigo)
CREATE OR REPLACE VIEW public.vw_stock_atual AS
SELECT m.client_id,
    c.name AS cliente_nome,
    c.sigla AS cliente_sigla,
    m.artigo_cli AS artigo_id,
    a.artigo_id AS artigo_codigo,
    a.descricao AS artigo_descricao,
    ta.tipo_artigo,
    a.tipo_armazenamento,
    m.tipo_armazem,
    arm.descricao AS armazem_descricao,
    m.armazem_loc,
    COALESCE(m.lote, 'S/LOTE'::text) AS lote,
    m.validade,
    min(m.data_fabrico) AS data_fabrico,
    sum(
        CASE
            WHEN (m.tipo_movimento = ANY (ARRAY['es'::text, 'et'::text])) THEN m.quantidade
            WHEN (m.tipo_movimento = ANY (ARRAY['ss'::text, 'st'::text])) THEN (- m.quantidade)
            ELSE (0)::numeric
        END) AS stock,
    max(m.data_movimento) AS ultimo_movimento
FROM movimentos m
JOIN clients c ON c.id = m.client_id
JOIN artigos a ON a.artigo_cli = m.artigo_cli
JOIN tipos_artigo ta ON ta.id_tipo_artigo = a.id_tipo_artigo
LEFT JOIN armazens arm ON arm.tipo_armazem = m.tipo_armazem
GROUP BY m.client_id, c.name, c.sigla, m.artigo_cli, a.artigo_id, a.descricao, ta.tipo_artigo, a.tipo_armazenamento, m.tipo_armazem, arm.descricao, m.armazem_loc, COALESCE(m.lote, 'S/LOTE'::text), m.validade
HAVING sum(
    CASE
        WHEN (m.tipo_movimento = ANY (ARRAY['es'::text, 'et'::text])) THEN m.quantidade
        WHEN (m.tipo_movimento = ANY (ARRAY['ss'::text, 'st'::text])) THEN (- m.quantidade)
        ELSE (0)::numeric
    END) > (0)::numeric;

CREATE OR REPLACE VIEW public.vw_stock_pedidos AS
SELECT m.client_id,
    c.name AS cliente_nome,
    c.sigla AS cliente_sigla,
    m.artigo_cli AS artigo_id,
    a.artigo_id AS artigo_codigo,
    a.descricao AS artigo_descricao,
    ta.tipo_artigo,
    a.tipo_armazenamento,
    COALESCE(m.lote, 'S/LOTE'::text) AS lote,
    m.validade,
    min(m.data_fabrico) AS data_fabrico,
    sum(
        CASE
            WHEN (m.tipo_movimento = ANY (ARRAY['es'::text, 'et'::text])) THEN m.quantidade
            WHEN (m.tipo_movimento = ANY (ARRAY['ss'::text, 'st'::text])) THEN (- m.quantidade)
            ELSE (0)::numeric
        END) AS stock,
    max(m.data_movimento) AS ultimo_movimento
FROM movimentos m
JOIN clients c ON c.id = m.client_id
JOIN artigos a ON a.artigo_cli = m.artigo_cli
JOIN tipos_artigo ta ON ta.id_tipo_artigo = a.id_tipo_artigo
WHERE m.tipo_armazem = '01'::text
GROUP BY m.client_id, c.name, c.sigla, m.artigo_cli, a.artigo_id, a.descricao, ta.tipo_artigo, a.tipo_armazenamento, COALESCE(m.lote, 'S/LOTE'::text), m.validade
HAVING sum(
    CASE
        WHEN (m.tipo_movimento = ANY (ARRAY['es'::text, 'et'::text])) THEN m.quantidade
        WHEN (m.tipo_movimento = ANY (ARRAY['ss'::text, 'st'::text])) THEN (- m.quantidade)
        ELSE (0)::numeric
    END) > (0)::numeric;
