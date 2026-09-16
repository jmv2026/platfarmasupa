-- ==============================================================================
-- ATUALIZAÇÃO DA VIEW: vw_stock_atual
-- ==============================================================================
-- 1. Remove o campo 'posicao'
-- 2. Restringe a listagem exclusivamente aos produtos do cliente associado ao utilizador
--    (administradores e gestores continuam a ter acesso a todos os clientes).
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase.
-- ==============================================================================

DROP VIEW IF EXISTS public.vw_stock_atual CASCADE;

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
    m.lote,
    m.validade,
    m.data_fabrico,
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
JOIN public.artigos a ON a.id = m.artigo_id
JOIN public.armazens arm ON arm.tipo_armazem = m.tipo_armazem
WHERE (
    -- Permite visualização total para admin/gestor ou processos sem sessão direta
    auth.uid() IS NULL
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
          AND (u.role IN ('admin', 'gestor') OR u.client_id IS NULL)
    )
    -- Para utilizadores vinculados a um cliente, restringe apenas a esse cliente
    OR m.client_id = (
        SELECT u.client_id FROM public.users u 
        WHERE u.id = auth.uid()
    )
)
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
    m.lote,
    m.validade,
    m.data_fabrico
HAVING SUM(
    CASE 
        WHEN m.tipo_movimento IN ('es', 'et') THEN m.quantidade
        WHEN m.tipo_movimento IN ('ss', 'st') THEN -m.quantidade
        ELSE 0 
    END
) > 0;
