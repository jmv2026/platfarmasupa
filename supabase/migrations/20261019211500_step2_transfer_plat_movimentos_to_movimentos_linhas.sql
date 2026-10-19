-- Migration: 20261019211500_step2_transfer_plat_movimentos_to_movimentos_linhas.sql
-- 2º Passo da transferência: Popula a tabela movimentos_linhas com os 18 campos solicitados

-- 1. Assegurar colunas na tabela movimentos_linhas
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS artigo text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS armazem text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS localizacao text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS familia text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS sub_familia text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS sigla text;

-- Relaxar NOT NULL para resiliência de inserção
ALTER TABLE public.movimentos_linhas ALTER COLUMN artigo_cli DROP NOT NULL;
ALTER TABLE public.movimentos_linhas ALTER COLUMN tipo_movimento DROP NOT NULL;
ALTER TABLE public.movimentos_linhas ALTER COLUMN tipo_armazem DROP NOT NULL;
ALTER TABLE public.movimentos_linhas ALTER COLUMN armazem_loc DROP NOT NULL;

-- 2. Atualizar a função de transferência para contemplar 1º e 2º Passos
CREATE OR REPLACE FUNCTION public.transferir_plat_movimentos_para_movimentos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_doc_count integer := 0;
    v_linhas_count integer := 0;
BEGIN
    -- =========================================================================
    -- 1º PASSO: Transferência dos 26 campos para a tabela movimentos (Cabeçalhos)
    -- =========================================================================
    WITH headers_distinct AS (
        SELECT DISTINCT ON (COALESCE(p.documento_ref, UPPER(TRIM(p.sigla)) || '-' || p.documento))
            COALESCE(c.id, '00000000-0000-0000-0000-000000000000'::uuid) AS cliente_id,
            COALESCE(p.data_movimento, p.data::timestamp with time zone, now()) AS data_movimento,
            p.sigla,
            p.tipo_movimento,
            p.documento,
            COALESCE(p.documento_ref, UPPER(TRIM(p.sigla)) || '-' || p.documento) AS documento_ref,
            COALESCE(p.tipo_doc, p.chave1, split_part(p.documento, ' ', 1)) AS tipo_doc,
            p.chave1,
            p.chave2,
            p.entidade,
            COALESCE(p.total_iva, 0) AS total_iva,
            COALESCE(p.total_merc, 0) AS total_merc,
            COALESCE(p.total_outros, 0) AS total_outros,
            COALESCE(p.total_desc, 0) AS total_desc,
            p.requisicao,
            p.num_contribuinte,
            p.morada,
            p.nome,
            p.localidade,
            p.cod_postal,
            p.cod_postal_localidade,
            p.pais,
            p.nome_entrega,
            p.morada_entrega,
            p.cod_postal_entrega,
            p.cod_postal_localidade_entrega,
            p.entidade_entrega,
            p.nome_entrega AS "NomeEntrega",
            p.morada_entrega AS "MoradaEntrega",
            p.cod_postal_entrega AS "CodPostalEntrega",
            p.cod_postal_localidade_entrega AS "CodPostalLocalidadeEntrega",
            p.entidade_entrega AS "EntidadeEntrega",
            now() AS updated_at
        FROM public.plat_movimentos p
        LEFT JOIN public.clientes c ON UPPER(TRIM(c.sigla)) = UPPER(TRIM(p.sigla))
        WHERE (p.documento_ref IS NOT NULL AND TRIM(p.documento_ref) <> '')
           OR (p.documento IS NOT NULL AND TRIM(p.documento) <> '')
        ORDER BY COALESCE(p.documento_ref, UPPER(TRIM(p.sigla)) || '-' || p.documento), p.num_linha ASC
    )
    INSERT INTO public.movimentos (
        cliente_id,
        data_movimento,
        sigla,
        tipo_movimento,
        documento,
        documento_ref,
        tipo_doc,
        chave1,
        chave2,
        entidade,
        total_iva,
        total_merc,
        total_outros,
        total_desc,
        requisicao,
        num_contribuinte,
        morada,
        nome,
        localidade,
        cod_postal,
        cod_postal_localidade,
        pais,
        nome_entrega,
        morada_entrega,
        cod_postal_entrega,
        cod_postal_localidade_entrega,
        entidade_entrega,
        "NomeEntrega",
        "MoradaEntrega",
        "CodPostalEntrega",
        "CodPostalLocalidadeEntrega",
        "EntidadeEntrega",
        updated_at
    )
    SELECT 
        cliente_id,
        data_movimento,
        sigla,
        tipo_movimento,
        documento,
        documento_ref,
        tipo_doc,
        chave1,
        chave2,
        entidade,
        total_iva,
        total_merc,
        total_outros,
        total_desc,
        requisicao,
        num_contribuinte,
        morada,
        nome,
        localidade,
        cod_postal,
        cod_postal_localidade,
        pais,
        nome_entrega,
        morada_entrega,
        cod_postal_entrega,
        cod_postal_localidade_entrega,
        entidade_entrega,
        "NomeEntrega",
        "MoradaEntrega",
        "CodPostalEntrega",
        "CodPostalLocalidadeEntrega",
        "EntidadeEntrega",
        updated_at
    FROM headers_distinct
    ON CONFLICT (documento_ref) DO UPDATE SET
        cliente_id = EXCLUDED.cliente_id,
        data_movimento = EXCLUDED.data_movimento,
        sigla = EXCLUDED.sigla,
        tipo_movimento = EXCLUDED.tipo_movimento,
        documento = EXCLUDED.documento,
        tipo_doc = EXCLUDED.tipo_doc,
        chave1 = EXCLUDED.chave1,
        chave2 = EXCLUDED.chave2,
        entidade = EXCLUDED.entidade,
        total_iva = EXCLUDED.total_iva,
        total_merc = EXCLUDED.total_merc,
        total_outros = EXCLUDED.total_outros,
        total_desc = EXCLUDED.total_desc,
        requisicao = EXCLUDED.requisicao,
        num_contribuinte = EXCLUDED.num_contribuinte,
        morada = EXCLUDED.morada,
        nome = EXCLUDED.nome,
        localidade = EXCLUDED.localidade,
        cod_postal = EXCLUDED.cod_postal,
        cod_postal_localidade = EXCLUDED.cod_postal_localidade,
        pais = EXCLUDED.pais,
        nome_entrega = EXCLUDED.nome_entrega,
        morada_entrega = EXCLUDED.morada_entrega,
        cod_postal_entrega = EXCLUDED.cod_postal_entrega,
        cod_postal_localidade_entrega = EXCLUDED.cod_postal_localidade_entrega,
        entidade_entrega = EXCLUDED.entidade_entrega,
        "NomeEntrega" = EXCLUDED."NomeEntrega",
        "MoradaEntrega" = EXCLUDED."MoradaEntrega",
        "CodPostalEntrega" = EXCLUDED."CodPostalEntrega",
        "CodPostalLocalidadeEntrega" = EXCLUDED."CodPostalLocalidadeEntrega",
        "EntidadeEntrega" = EXCLUDED."EntidadeEntrega",
        updated_at = now();

    GET DIAGNOSTICS v_doc_count = ROW_COUNT;

    -- =========================================================================
    -- 2º PASSO: Transferência dos 18 campos para a tabela movimentos_linhas
    -- =========================================================================
    INSERT INTO public.movimentos_linhas (
        data_movimento,
        documento_ref,
        num_linha,
        doc_linha,
        valor_unitario,
        valor_adicional,
        valor_abater,
        artigo,
        descricao,
        tipo_artigo,
        armazem,
        localizacao,
        lote,
        quantidade,
        familia,
        sub_familia,
        data_fabrico,
        validade,
        -- Campos de compatibilidade para inventário e views existentes
        artigo_cli,
        tipo_movimento,
        tipo_armazem,
        armazem_loc,
        posicao,
        sigla,
        updated_at
    )
    SELECT
        COALESCE(p.data_movimento, p.data::timestamp with time zone, now()) AS data_movimento,
        COALESCE(p.documento_ref, UPPER(TRIM(p.sigla)) || '-' || p.documento) AS documento_ref,
        p.num_linha,
        COALESCE(p.doc_linha, COALESCE(p.documento_ref, UPPER(TRIM(p.sigla)) || '-' || p.documento) || '-' || p.num_linha) AS doc_linha,
        COALESCE(p.valor_unitario, 0) AS valor_unitario,
        COALESCE(p.valor_adicional, 0) AS valor_adicional,
        COALESCE(p.valor_abater, 0) AS valor_abater,
        p.artigo,
        p.descricao,
        p.tipo_artigo,
        p.armazem,
        p.localizacao,
        p.lote,
        p.quantidade,
        p.familia,
        p.sub_familia,
        CASE WHEN p.data_fabrico = '1980-01-01'::date THEN NULL ELSE p.data_fabrico END AS data_fabrico,
        p.validade,
        -- Compatibilidade
        COALESCE(UPPER(TRIM(p.sigla)) || '-' || UPPER(TRIM(p.artigo)), UPPER(TRIM(p.artigo))) AS artigo_cli,
        LOWER(TRIM(COALESCE(p.tipo_movimento, 'es'))) AS tipo_movimento,
        CASE 
            WHEN p.armazem LIKE '%01' THEN '01'
            WHEN p.armazem LIKE '%02' THEN '02'
            WHEN p.armazem LIKE '%03' THEN '03'
            WHEN p.armazem LIKE '%04' THEN '04'
            WHEN p.armazem LIKE '%05' THEN '05'
            WHEN p.armazem LIKE '%06' THEN '06'
            WHEN p.armazem LIKE '%07' THEN '07'
            WHEN p.armazem LIKE '%09' THEN '09'
            WHEN p.armazem LIKE '%10' THEN '10'
            ELSE COALESCE(NULLIF(TRIM(p.armazem), ''), '01')
        END AS tipo_armazem,
        COALESCE(p.sigla, 'UNK') || '-' || (
            CASE 
                WHEN p.armazem LIKE '%01' THEN '01'
                WHEN p.armazem LIKE '%02' THEN '02'
                WHEN p.armazem LIKE '%03' THEN '03'
                WHEN p.armazem LIKE '%04' THEN '04'
                WHEN p.armazem LIKE '%05' THEN '05'
                WHEN p.armazem LIKE '%06' THEN '06'
                WHEN p.armazem LIKE '%07' THEN '07'
                WHEN p.armazem LIKE '%09' THEN '09'
                WHEN p.armazem LIKE '%10' THEN '10'
                ELSE COALESCE(NULLIF(TRIM(p.armazem), ''), '01')
            END
        ) AS armazem_loc,
        p.localizacao AS posicao,
        p.sigla,
        now() AS updated_at
    FROM public.plat_movimentos p
    WHERE (p.doc_linha IS NOT NULL AND TRIM(p.doc_linha) <> '')
       OR (p.num_linha IS NOT NULL)
    ON CONFLICT (doc_linha) DO UPDATE SET
        data_movimento = EXCLUDED.data_movimento,
        documento_ref = EXCLUDED.documento_ref,
        num_linha = EXCLUDED.num_linha,
        valor_unitario = EXCLUDED.valor_unitario,
        valor_adicional = EXCLUDED.valor_adicional,
        valor_abater = EXCLUDED.valor_abater,
        artigo = EXCLUDED.artigo,
        descricao = EXCLUDED.descricao,
        tipo_artigo = EXCLUDED.tipo_artigo,
        armazem = EXCLUDED.armazem,
        localizacao = EXCLUDED.localizacao,
        lote = EXCLUDED.lote,
        quantidade = EXCLUDED.quantidade,
        familia = EXCLUDED.familia,
        sub_familia = EXCLUDED.sub_familia,
        data_fabrico = EXCLUDED.data_fabrico,
        validade = EXCLUDED.validade,
        artigo_cli = EXCLUDED.artigo_cli,
        tipo_movimento = EXCLUDED.tipo_movimento,
        tipo_armazem = EXCLUDED.tipo_armazem,
        armazem_loc = EXCLUDED.armazem_loc,
        posicao = EXCLUDED.posicao,
        sigla = EXCLUDED.sigla,
        updated_at = now();

    GET DIAGNOSTICS v_linhas_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'count', v_linhas_count,
        'documentos', v_doc_count,
        'linhas', v_linhas_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transferir_plat_movimentos_para_movimentos() TO authenticated, service_role, anon;
