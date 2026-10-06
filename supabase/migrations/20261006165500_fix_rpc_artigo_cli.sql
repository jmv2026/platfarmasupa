CREATE OR REPLACE FUNCTION public.transferir_plat_movimentos_para_movimentos()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    inserted_count integer;
BEGIN
    WITH inserted AS (
        INSERT INTO public.movimentos (
            client_id,
            sigla,
            artigo_cli,
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
            a.artigo_cli AS artigo_cli,
            p.tipo_movimento,
            p.quantidade,
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
        JOIN public.artigos a ON a.artigo_cli = (COALESCE(UPPER(p.sigla), 'UNK') || '-' || UPPER(p.artigo))
        WHERE NOT EXISTS (
            SELECT 1 
            FROM public.movimentos m 
            WHERE m.doc_linha = (p.documento || '-' || p.num_linha)
        )
        RETURNING 1
    )
    SELECT count(*) INTO inserted_count FROM inserted;
    
    RETURN inserted_count;
END;
$function$;
