-- =========================================================================
-- TRANSFERÊNCIA DE plat_movimentos PARA movimentos
-- =========================================================================
-- Insere os registos da tabela plat_movimentos para a tabela movimentos,
-- preenchendo doc_linha com documento + '-' + num_linha.
-- Ignora registos cujo doc_linha já exista na tabela movimentos.
-- Determina o client_id através da ligação pela sigla à tabela clients.
-- =========================================================================

INSERT INTO public.movimentos (
    client_id,
    sigla,
    artigo_id,
    tipo_movimento,
    quantidade,
    tipo_armazem,
    armazem_loc,
    posicao,
    lote,
    validade,
    data_fabrico,
    data_movimento,
    documento_ref,
    doc_linha,
    observacoes
)
SELECT 
    c.id AS client_id,
    p.sigla,
    a.artigo_id AS artigo_id, -- Relacionar com o artigo_id interno
    p.tipo_movimento,
    p.quantidade,
    
    -- Lógica baseada no armazém (assumindo que o armazém no plat_movimentos contém o código '01', '02', etc.)
    CASE 
        WHEN p.armazem LIKE '%01' THEN '01'
        WHEN p.armazem LIKE '%02' THEN '02'
        WHEN p.armazem LIKE '%03' THEN '03'
        WHEN p.armazem LIKE '%04' THEN '04'
        WHEN p.armazem LIKE '%05' THEN '05'
        WHEN p.armazem LIKE '%06' THEN '06'
        WHEN p.armazem LIKE '%07' THEN '07'
        ELSE '01' 
    END AS tipo_armazem,
    
    COALESCE(p.sigla, 'UNK') || '-' || CASE 
        WHEN p.armazem LIKE '%01' THEN '01'
        WHEN p.armazem LIKE '%02' THEN '02'
        WHEN p.armazem LIKE '%03' THEN '03'
        WHEN p.armazem LIKE '%04' THEN '04'
        WHEN p.armazem LIKE '%05' THEN '05'
        WHEN p.armazem LIKE '%06' THEN '06'
        WHEN p.armazem LIKE '%07' THEN '07'
        ELSE '01' 
    END AS armazem_loc,
    
    p.localizacao AS posicao,
    p.lote,
    p.validade,
    p.datafabrico AS data_fabrico,
    COALESCE(p.data, p.created_at) AS data_movimento,
    p.documento AS documento_ref,
    p.documento || '-' || p.num_linha AS doc_linha,
    'Importado via plat_movimentos' AS observacoes
FROM public.plat_movimentos p
JOIN public.clients c ON UPPER(c.sigla) = UPPER(p.sigla)
JOIN public.artigos a ON a.artigo_id = p.artigo
WHERE NOT EXISTS (
    SELECT 1 
    FROM public.movimentos m 
    WHERE m.doc_linha = (p.documento || '-' || p.num_linha)
);
