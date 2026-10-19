-- Migração: Transferência de plat_movimentos para movimentos (cabeçalhos) e movimentos_linhas (linhas)
-- e criação da view vw_movimentos_detalhe

-- 1. Remover trigger obsoleto em movimentos_linhas que assumia a existência de cliente_id
DROP TRIGGER IF EXISTS trg_sync_movimento_sf_sigla ON public.movimentos_linhas;

-- 2. View para leitura completa de movimentos e linhas
CREATE OR REPLACE VIEW public.vw_movimentos_detalhe AS
SELECT 
    ml.doc_linha AS id,
    ml.doc_linha,
    ml.documento_ref,
    ml.num_linha,
    ml.artigo_cli,
    ml.tipo_movimento,
    ml.quantidade,
    ml.tipo_armazem,
    ml.armazem_loc,
    ml.posicao,
    ml.lote,
    ml.nr_serie,
    ml.validade,
    ml.data_fabrico,
    ml.data_movimento,
    ml.valor_unitario,
    ml.valor_adicional,
    ml.valor_abater,
    ml.estado_stock,
    ml.tipo_artigo,
    ml.observacoes_linha,
    ml.created_at,
    ml.updated_at,
    m.cliente_id,
    m.sigla,
    m.tipo_doc,
    m.chave1,
    m.chave2,
    m.total_iva,
    m.total_merc,
    m.total_outros,
    m.total_desc,
    m.entidade,
    m.requisicao,
    m.num_contribuinte,
    m.morada,
    m.nome,
    m.localidade,
    m.cod_postal,
    m.cod_postal_localidade,
    m.pais,
    m."EntidadeEntrega",
    m."NomeEntrega",
    m."MoradaEntrega",
    m."LocalidadeEntrega",
    m."CodPostalEntrega",
    m."CodPostalLocalidadeEntrega",
    m.observacoes,
    c.name AS cliente_nome,
    c.sigla AS cliente_sigla,
    a.descricao AS artigo_descricao
FROM public.movimentos_linhas ml
JOIN public.movimentos m ON m.documento_ref = ml.documento_ref
LEFT JOIN public.clientes c ON c.id = m.cliente_id
LEFT JOIN public.artigos a ON a.artigo_cli = ml.artigo_cli;

GRANT SELECT ON public.vw_movimentos_detalhe TO authenticated, anon, service_role;

-- 3. Função de transferência relacional completa
DROP FUNCTION IF EXISTS public.transferir_plat_movimentos_para_movimentos();

CREATE OR REPLACE FUNCTION public.transferir_plat_movimentos_para_movimentos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_headers_count integer := 0;
    v_lines_count integer := 0;
    v_artigos_count integer := 0;
    v_siglas_em_falta text;
BEGIN
    -- 0. Validar se existem registos com cliente/sigla não registada na tabela clientes
    SELECT string_agg(DISTINCT p.sigla, ', ')
    INTO v_siglas_em_falta
    FROM public.plat_movimentos p
    LEFT JOIN public.clientes c ON UPPER(TRIM(c.sigla)) = UPPER(TRIM(p.sigla))
    WHERE c.id IS NULL AND p.sigla IS NOT NULL;

    IF v_siglas_em_falta IS NOT NULL AND v_siglas_em_falta <> '' THEN
        RAISE EXCEPTION 'Existem registos com cliente/sigla não registada na tabela clientes: %', v_siglas_em_falta;
    END IF;

    -- 1. Auto-criar artigos em falta na tabela artigos
    INSERT INTO public.artigos (
        artigo_cli,
        artigo_id,
        descricao,
        id_tipo_artigo,
        tipo_armazenamento,
        tratamento_lote,
        tratamento_serie,
        ativo,
        familia,
        subfamilia,
        cli_primavera
    )
    SELECT DISTINCT ON (UPPER(TRIM(p.sigla)) || '-' || UPPER(TRIM(p.artigo)))
        (UPPER(TRIM(p.sigla)) || '-' || UPPER(TRIM(p.artigo))) AS artigo_cli,
        UPPER(TRIM(p.artigo)) AS artigo_id,
        COALESCE(NULLIF(TRIM(p.descricao), ''), UPPER(TRIM(p.artigo))) AS descricao,
        CASE 
            WHEN ta.id_tipo_artigo IS NOT NULL THEN ta.id_tipo_artigo
            WHEN p.tipo_artigo = 'MH' THEN '80'
            WHEN p.tipo_artigo = 'MV' THEN '81'
            WHEN p.tipo_artigo = 'DM' THEN '82'
            WHEN p.tipo_artigo = 'DC' THEN '83'
            WHEN p.tipo_artigo = 'SA' THEN '84'
            WHEN p.tipo_artigo = 'SC' THEN '85'
            ELSE '80'
        END AS id_tipo_artigo,
        'TA' AS tipo_armazenamento,
        true AS tratamento_lote,
        false AS tratamento_serie,
        true AS ativo,
        p.familia,
        p.sub_familia AS subfamilia,
        p.sigla AS cli_primavera
    FROM public.plat_movimentos p
    LEFT JOIN public.tipos_artigo ta ON ta.id_tipo_artigo = p.tipo_artigo
    WHERE p.artigo IS NOT NULL AND TRIM(p.artigo) <> ''
    ON CONFLICT (artigo_cli) DO NOTHING;

    GET DIAGNOSTICS v_artigos_count = ROW_COUNT;

    -- 2. Preenchimento da tabela movimentos (Cabeçalhos / Documentos)
    WITH headers_distinct AS (
        SELECT DISTINCT ON (COALESCE(p.documento_ref, UPPER(TRIM(p.sigla)) || '-' || p.documento))
            c.id AS cliente_id,
            p.sigla,
            COALESCE(p.data_movimento, p.data::timestamp with time zone, p.created_at, now()) AS data_movimento,
            COALESCE(p.documento_ref, UPPER(TRIM(p.sigla)) || '-' || p.documento) AS documento_ref,
            COALESCE(p.tipo_doc, split_part(p.documento, ' ', 1)) AS tipo_doc,
            p.chave1,
            p.chave2,
            COALESCE(p.total_iva, 0) AS total_iva,
            COALESCE(p.total_merc, 0) AS total_merc,
            COALESCE(p.total_outros, 0) AS total_outros,
            COALESCE(p.total_desc, 0) AS total_desc,
            p.entidade,
            p.requisicao,
            p.num_contribuinte,
            p.morada,
            p.nome,
            p.localidade,
            p.cod_postal,
            p.cod_postal_localidade,
            p.pais,
            p.entidade_entrega AS "EntidadeEntrega",
            p.nome_entrega AS "NomeEntrega",
            p.morada_entrega AS "MoradaEntrega",
            p.cod_postal_entrega AS "CodPostalEntrega",
            p.cod_postal_localidade_entrega AS "CodPostalLocalidadeEntrega",
            COALESCE(p.cod_postal_localidade_entrega, p.localidade) AS "LocalidadeEntrega",
            'Transferido de plat_movimentos' AS observacoes
        FROM public.plat_movimentos p
        JOIN public.clientes c ON UPPER(TRIM(c.sigla)) = UPPER(TRIM(p.sigla))
        ORDER BY COALESCE(p.documento_ref, UPPER(TRIM(p.sigla)) || '-' || p.documento), p.id ASC
    )
    INSERT INTO public.movimentos (
        cliente_id,
        sigla,
        data_movimento,
        documento_ref,
        tipo_doc,
        chave1,
        chave2,
        total_iva,
        total_merc,
        total_outros,
        total_desc,
        entidade,
        requisicao,
        num_contribuinte,
        morada,
        nome,
        localidade,
        cod_postal,
        cod_postal_localidade,
        pais,
        "EntidadeEntrega",
        "NomeEntrega",
        "MoradaEntrega",
        "LocalidadeEntrega",
        "CodPostalEntrega",
        "CodPostalLocalidadeEntrega",
        observacoes
    )
    SELECT * FROM headers_distinct
    ON CONFLICT (documento_ref) DO UPDATE SET
        total_merc = EXCLUDED.total_merc,
        total_iva = EXCLUDED.total_iva,
        total_outros = EXCLUDED.total_outros,
        total_desc = EXCLUDED.total_desc,
        tipo_doc = COALESCE(EXCLUDED.tipo_doc, public.movimentos.tipo_doc),
        "EntidadeEntrega" = COALESCE(EXCLUDED."EntidadeEntrega", public.movimentos."EntidadeEntrega"),
        "NomeEntrega" = COALESCE(EXCLUDED."NomeEntrega", public.movimentos."NomeEntrega"),
        "MoradaEntrega" = COALESCE(EXCLUDED."MoradaEntrega", public.movimentos."MoradaEntrega"),
        "LocalidadeEntrega" = COALESCE(EXCLUDED."LocalidadeEntrega", public.movimentos."LocalidadeEntrega"),
        "CodPostalEntrega" = COALESCE(EXCLUDED."CodPostalEntrega", public.movimentos."CodPostalEntrega"),
        "CodPostalLocalidadeEntrega" = COALESCE(EXCLUDED."CodPostalLocalidadeEntrega", public.movimentos."CodPostalLocalidadeEntrega"),
        updated_at = now();

    GET DIAGNOSTICS v_headers_count = ROW_COUNT;

    -- 3. Preenchimento da tabela movimentos_linhas (Linhas de Movimento)
    INSERT INTO public.movimentos_linhas (
        doc_linha,
        documento_ref,
        num_linha,
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
        valor_unitario,
        valor_adicional,
        valor_abater,
        tipo_artigo,
        observacoes_linha
    )
    SELECT 
        COALESCE(p.doc_linha, COALESCE(p.documento_ref, UPPER(TRIM(p.sigla)) || '-' || p.documento) || '-' || p.num_linha) AS doc_linha,
        COALESCE(p.documento_ref, UPPER(TRIM(p.sigla)) || '-' || p.documento) AS documento_ref,
        p.num_linha,
        UPPER(TRIM(p.sigla)) || '-' || UPPER(TRIM(p.artigo)) AS artigo_cli,
        LOWER(TRIM(p.tipo_movimento)) AS tipo_movimento,
        p.quantidade,
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
            ELSE '01' 
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
                ELSE '01' 
            END
        ) AS armazem_loc,
        p.localizacao AS posicao,
        p.lote,
        p.validade,
        CASE WHEN p.datafabrico = '1980-01-01'::date THEN NULL ELSE p.datafabrico END AS data_fabrico,
        COALESCE(p.data_movimento, p.data::timestamp with time zone, p.created_at, now()) AS data_movimento,
        COALESCE(p.valor_unitario, 0) AS valor_unitario,
        COALESCE(p.valor_adicional, 0) AS valor_adicional,
        COALESCE(p.valor_abater, 0) AS valor_abater,
        p.tipo_artigo,
        'Transferido de plat_movimentos' AS observacoes_linha
    FROM public.plat_movimentos p
    WHERE NOT EXISTS (
        SELECT 1 FROM public.movimentos_linhas ml 
        WHERE ml.doc_linha = COALESCE(p.doc_linha, COALESCE(p.documento_ref, UPPER(TRIM(p.sigla)) || '-' || p.documento) || '-' || p.num_linha)
    )
    ON CONFLICT (doc_linha) DO UPDATE SET
        quantidade = EXCLUDED.quantidade,
        tipo_movimento = EXCLUDED.tipo_movimento,
        lote = EXCLUDED.lote,
        validade = EXCLUDED.validade,
        data_fabrico = EXCLUDED.data_fabrico,
        data_movimento = EXCLUDED.data_movimento,
        posicao = EXCLUDED.posicao,
        tipo_armazem = EXCLUDED.tipo_armazem,
        armazem_loc = EXCLUDED.armazem_loc,
        updated_at = now();

    GET DIAGNOSTICS v_lines_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'artigos', v_artigos_count,
        'cabecalhos', v_headers_count,
        'linhas', v_lines_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transferir_plat_movimentos_para_movimentos() TO authenticated, service_role, anon;
