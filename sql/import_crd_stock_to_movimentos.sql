-- =========================================================================
-- PLATAFORMA FARMA - CARGA DE STOCK DO CLIENTE CARDIOLINK (CRD)
-- =========================================================================
-- Converte e insere os registos de inventário bruto da tabela 'imp_stk'
-- na tabela transacional 'movimentos' (Tipo 'es' / Entrada de Stock)
-- para o cliente Cardiolink Portugal (CRD).
-- =========================================================================

INSERT INTO public.movimentos (
    client_id,
    artigo_id,
    sigla,
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
    observacoes,
    created_by
)
SELECT 
    'f65af07a-04a3-46e5-acb0-138008fb9b98'::uuid AS client_id,
    s.artigo AS artigo_id,
    'CRD'::varchar AS sigla,
    'es' AS tipo_movimento,
    s.stk::numeric AS quantidade,
    CASE 
        WHEN s.armazem LIKE '%01' THEN '01'
        WHEN s.armazem LIKE '%02' THEN '02'
        WHEN s.armazem LIKE '%03' THEN '03'
        WHEN s.armazem LIKE '%04' THEN '04'
        WHEN s.armazem LIKE '%05' THEN '05'
        WHEN s.armazem LIKE '%06' THEN '06'
        WHEN s.armazem LIKE '%07' THEN '07'
        ELSE '01'
    END AS tipo_armazem,
    'CRD-' || CASE 
        WHEN s.armazem LIKE '%01' THEN '01'
        WHEN s.armazem LIKE '%02' THEN '02'
        WHEN s.armazem LIKE '%03' THEN '03'
        WHEN s.armazem LIKE '%04' THEN '04'
        WHEN s.armazem LIKE '%05' THEN '05'
        WHEN s.armazem LIKE '%06' THEN '06'
        WHEN s.armazem LIKE '%07' THEN '07'
        ELSE '01'
    END AS armazem_loc,
    NULL AS posicao,
    NULLIF(TRIM(s.lote), '') AS lote,
    s.datastock::date AS validade,
    NULL::date AS data_fabrico,
    COALESCE(s.datastock, NOW()) AS data_movimento,
    'IMP-INVENTARIO-CRD' AS documento_ref,
    'Carga inicial de inventário do cliente Cardiolink (CRD)' AS observacoes,
    (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1) AS created_by
FROM public.imp_stk s
WHERE s.armazem LIKE 'CRD%' AND s.stk::numeric > 0;
