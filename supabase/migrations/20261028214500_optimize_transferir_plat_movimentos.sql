-- Migration: 20261028214500_optimize_transferir_plat_movimentos.sql
-- Descrição: Otimiza a função transferir_plat_movimentos_para_movimentos para evitar timeout
--            filtrando antecipadamente cabeçalhos e linhas já existentes (WHERE NOT EXISTS + ON CONFLICT DO NOTHING)
--            e aumentando o statement_timeout da função.

CREATE OR REPLACE FUNCTION public.transferir_plat_movimentos_para_movimentos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '120s'
AS $$
DECLARE
    v_doc_count integer := 0;
    v_linhas_count integer := 0;
    v_total_plat integer := 0;
    v_linhas_existentes integer := 0;
    v_default_cliente_id uuid;
BEGIN
    SELECT COUNT(*) INTO v_total_plat FROM public.plat_movimentos;
    SELECT id INTO v_default_cliente_id FROM public.clientes ORDER BY id LIMIT 1;

    -- 1º PASSO: Transferência para movimentos (Apenas Cabeçalhos NOVOS que ainda não existem em public.movimentos)
    WITH pending_headers_raw AS (
        SELECT p.*
        FROM public.plat_movimentos p
        WHERE p.documento IS NOT NULL 
          AND TRIM(p.documento) <> ''
          AND (
              p.documento_ref IS NULL 
              OR TRIM(p.documento_ref) = ''
              OR NOT EXISTS (
                  SELECT 1 FROM public.movimentos m WHERE m.documento_ref = TRIM(p.documento_ref)
              )
          )
    ),
    mapped_headers AS (
        SELECT DISTINCT ON (
            COALESCE(
                NULLIF(TRIM(p.documento_ref), ''),
                COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento,
                p.documento
            )
        )
            COALESCE(
                NULLIF(TRIM(p.documento_ref), ''),
                COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento,
                p.documento
            ) AS documento_ref,
            COALESCE(c.id, v_default_cliente_id) AS cliente_id,
            COALESCE(c.sigla, p.cliente_ser, 'UNK') AS sigla,
            COALESCE(NULLIF(TRIM(p.tipo_doc), ''), p.chave1, split_part(p.documento, ' ', 1)) AS tipo_doc,
            p.num_doc,
            p.data,
            COALESCE(c.cli_primavera, p.cli_primavera) AS cli_primavera,
            COALESCE(c.sigla, p.cliente_ser, 'UNK') AS cliente_ser,
            p.tipo_movimento,
            p.documento,
            p.chave1,
            p.chave2,
            p.entidade,
            COALESCE(p.total_iva, 0) AS total_iva,
            COALESCE(p.total_merc, 0) AS total_merc,
            COALESCE(p.total_outros, 0) AS total_outros,
            COALESCE(p.totaldesc, 0) AS totaldesc,
            p.requisicao,
            p.num_contribuinte,
            p.nome,
            p.morada,
            p.localidade,
            p.cod_postal,
            p.cod_postal_localidade,
            p.pais,
            p.nome_entrega,
            p.entidade_entrega,
            p.morada_entrega,
            p.localidade_entrega,
            p.cod_postal_entrega,
            p.observacoes,
            COALESCE(p.data::timestamp with time zone, now()) AS data_movimento,
            p.tipo_movimento AS tipomovimento,
            COALESCE(p.total_iva, 0) AS totaliva,
            COALESCE(p.total_merc, 0) AS totalmerc,
            COALESCE(p.total_outros, 0) AS totaloutros,
            COALESCE(p.totaldesc, 0) AS total_desc,
            p.num_contribuinte AS numcontribuinte,
            p.cod_postal AS codpostal,
            p.cod_postal_localidade AS codpostallocalidade,
            p.nome_entrega AS nomeentrega,
            p.entidade_entrega AS entidadeentrega,
            p.morada_entrega AS moradaentrega,
            p.localidade_entrega AS localidadeentrega,
            p.cod_postal_entrega AS codpostalentrega,
            p.nome_entrega AS "NomeEntrega",
            p.entidade_entrega AS "EntidadeEntrega",
            p.morada_entrega AS "MoradaEntrega",
            p.localidade_entrega AS "LocalidadeEntrega",
            p.localidade_entrega AS "CodPostalLocalidadeEntrega",
            p.cod_postal_entrega AS "CodPostalEntrega",
            now() AS updated_at
        FROM pending_headers_raw p
        LEFT JOIN LATERAL (
            SELECT c1.id, c1.sigla, c1.cli_primavera, c1.name
            FROM public.clientes c1
            WHERE (c1.cli_primavera IS NOT NULL AND TRIM(c1.cli_primavera) = TRIM(p.cli_primavera))
               OR UPPER(TRIM(c1.sigla)) = UPPER(TRIM(p.cliente_ser))
               OR UPPER(TRIM(c1.name)) = UPPER(TRIM(p.cliente_ser))
               OR c1.name ILIKE ('%' || TRIM(p.cliente_ser) || '%')
            ORDER BY
                CASE
                    WHEN c1.cli_primavera IS NOT NULL AND TRIM(c1.cli_primavera) = TRIM(p.cli_primavera) THEN 1
                    WHEN UPPER(TRIM(c1.sigla)) = UPPER(TRIM(p.cliente_ser)) THEN 2
                    WHEN UPPER(TRIM(c1.name)) = UPPER(TRIM(p.cliente_ser)) THEN 3
                    ELSE 4
                END
            LIMIT 1
        ) c ON true
        ORDER BY 
            COALESCE(
                NULLIF(TRIM(p.documento_ref), ''),
                COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento,
                p.documento
            ), 
            p.num_linha ASC
    )
    INSERT INTO public.movimentos (
        documento_ref,
        cliente_id,
        sigla,
        tipo_doc,
        num_doc,
        data,
        cli_primavera,
        cliente_ser,
        tipo_movimento,
        tipomovimento,
        documento,
        chave1,
        chave2,
        entidade,
        total_iva,
        totaliva,
        total_merc,
        totalmerc,
        total_outros,
        totaloutros,
        totaldesc,
        total_desc,
        requisicao,
        num_contribuinte,
        numcontribuinte,
        nome,
        morada,
        localidade,
        cod_postal,
        codpostal,
        cod_postal_localidade,
        codpostallocalidade,
        pais,
        nome_entrega,
        nomeentrega,
        "NomeEntrega",
        entidade_entrega,
        entidadeentrega,
        "EntidadeEntrega",
        morada_entrega,
        moradaentrega,
        "MoradaEntrega",
        localidade_entrega,
        localidadeentrega,
        "LocalidadeEntrega",
        "CodPostalLocalidadeEntrega",
        cod_postal_entrega,
        codpostalentrega,
        "CodPostalEntrega",
        observacoes,
        data_movimento,
        updated_at
    )
    SELECT 
        h.documento_ref,
        h.cliente_id,
        h.sigla,
        h.tipo_doc,
        h.num_doc,
        h.data,
        h.cli_primavera,
        h.cliente_ser,
        h.tipo_movimento,
        h.tipomovimento,
        h.documento,
        h.chave1,
        h.chave2,
        h.entidade,
        h.total_iva,
        h.totaliva,
        h.total_merc,
        h.totalmerc,
        h.total_outros,
        h.totaloutros,
        h.totaldesc,
        h.total_desc,
        h.requisicao,
        h.num_contribuinte,
        h.numcontribuinte,
        h.nome,
        h.morada,
        h.localidade,
        h.cod_postal,
        h.codpostal,
        h.cod_postal_localidade,
        h.codpostallocalidade,
        h.pais,
        h.nome_entrega,
        h.nomeentrega,
        h."NomeEntrega",
        h.entidade_entrega,
        h.entidadeentrega,
        h."EntidadeEntrega",
        h.morada_entrega,
        h.moradaentrega,
        h."MoradaEntrega",
        h.localidade_entrega,
        h.localidadeentrega,
        h."LocalidadeEntrega",
        h."CodPostalLocalidadeEntrega",
        h.cod_postal_entrega,
        h.codpostalentrega,
        h."CodPostalEntrega",
        h.observacoes,
        h.data_movimento,
        h.updated_at
    FROM mapped_headers h
    WHERE NOT EXISTS (
        SELECT 1 FROM public.movimentos m WHERE m.documento_ref = h.documento_ref
    )
    ON CONFLICT (documento_ref) DO NOTHING;

    GET DIAGNOSTICS v_doc_count = ROW_COUNT;

    -- 2º PASSO: Transferência para movimentos_linhas (Apenas Linhas NOVAS que ainda não existem em public.movimentos_linhas)
    WITH pending_lines_raw AS (
        SELECT p.*
        FROM public.plat_movimentos p
        WHERE (
            (p.doc_linha IS NOT NULL AND TRIM(p.doc_linha) <> '')
            OR (p.num_linha IS NOT NULL)
        )
        AND (
            p.doc_linha IS NULL
            OR TRIM(p.doc_linha) = ''
            OR NOT EXISTS (
                SELECT 1 FROM public.movimentos_linhas ml WHERE ml.doc_linha = TRIM(p.doc_linha)
            )
        )
    ),
    mapped_lines AS (
        SELECT DISTINCT ON (
            COALESCE(
                NULLIF(TRIM(p.doc_linha), ''), 
                COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento || '-' || p.num_linha
            )
        )
            COALESCE(
                NULLIF(TRIM(p.doc_linha), ''), 
                COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento || '-' || p.num_linha
            ) AS doc_linha,
            COALESCE(
                NULLIF(TRIM(p.documento_ref), ''),
                COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento,
                p.documento
            ) AS documento_ref,
            p.num_linha AS num_linha,
            p.data AS data,
            COALESCE(p.data::timestamp with time zone, now()) AS data_movimento,
            COALESCE(c.sigla, p.cliente_ser, 'UNK') AS cliente_ser,
            COALESCE(c.cli_primavera, p.cli_primavera) AS cli_primavera,
            COALESCE(c.sigla, p.cliente_ser, 'UNK') AS sigla,
            p.documento AS documento,
            COALESCE(NULLIF(TRIM(p.tipo_doc), ''), p.chave1, split_part(p.documento, ' ', 1)) AS tipo_doc,
            p.num_doc AS num_doc,
            p.chave1 AS chave1,
            p.chave2 AS chave2,
            COALESCE(p.valor_unitario, 0) AS valor_unitario,
            COALESCE(p.valor_adicional, 0) AS valor_adicional,
            COALESCE(p.valor_abater, 0) AS valor_abater,
            COALESCE(p.artigo_id, p.descricao) AS artigo,
            COALESCE(p.artigo_id, p.descricao) AS artigo_id,
            COALESCE(
                p.artigo_cli,
                CASE 
                    WHEN p.artigo_id IS NOT NULL THEN COALESCE(c.cli_primavera, p.cli_primavera, UPPER(TRIM(c.sigla)), 'UNK') || '-' || UPPER(TRIM(p.artigo_id))
                    ELSE NULL
                END
            ) AS artigo_cli,
            p.descricao AS descricao,
            p.tipo_artigo AS tipo_artigo,
            p.armazem AS armazem,
            p.localizacao AS localizacao,
            p.localizacao AS posicao,
            p.lote AS lote,
            COALESCE(p.quantidade, 0) AS quantidade,
            p.familia AS familia,
            p.sub_familia AS sub_familia,
            CASE WHEN p.data_fabrico = '1980-01-01'::date THEN NULL ELSE p.data_fabrico END AS data_fabrico,
            p.validade AS validade,
            CASE 
                WHEN LOWER(TRIM(p.tipo_movimento)) IN ('e', 'es') THEN 'es'
                WHEN LOWER(TRIM(p.tipo_movimento)) IN ('s', 'ss') THEN 'ss'
                WHEN LOWER(TRIM(p.tipo_movimento)) = 'et' THEN 'et'
                WHEN LOWER(TRIM(p.tipo_movimento)) = 'st' THEN 'st'
                ELSE LOWER(TRIM(COALESCE(p.tipo_movimento, 'es')))
            END AS tipo_movimento,
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
            COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || (
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
            p.entidade AS entidade,
            COALESCE(p.total_iva, 0) AS total_iva,
            COALESCE(p.total_merc, 0) AS total_merc,
            COALESCE(p.total_outros, 0) AS total_outros,
            COALESCE(p.totaldesc, 0) AS totaldesc,
            COALESCE(p.totaldesc, 0) AS total_desc,
            p.requisicao AS requisicao,
            p.num_contribuinte AS num_contribuinte,
            p.nome AS nome,
            p.morada AS morada,
            p.localidade AS localidade,
            p.cod_postal AS cod_postal,
            p.cod_postal_localidade AS cod_postal_localidade,
            p.pais AS pais,
            p.nome_entrega AS nome_entrega,
            p.entidade_entrega AS entidade_entrega,
            p.morada_entrega AS morada_entrega,
            p.localidade_entrega AS localidade_entrega,
            p.cod_postal_entrega AS cod_postal_entrega,
            p.observacoes AS observacoes,
            p.observacoes AS observacoes_linha,
            now() AS updated_at
        FROM pending_lines_raw p
        LEFT JOIN LATERAL (
            SELECT c1.id, c1.sigla, c1.cli_primavera, c1.name
            FROM public.clientes c1
            WHERE (c1.cli_primavera IS NOT NULL AND TRIM(c1.cli_primavera) = TRIM(p.cli_primavera))
               OR UPPER(TRIM(c1.sigla)) = UPPER(TRIM(p.cliente_ser))
               OR UPPER(TRIM(c1.name)) = UPPER(TRIM(p.cliente_ser))
               OR c1.name ILIKE ('%' || TRIM(p.cliente_ser) || '%')
            ORDER BY
                CASE
                    WHEN c1.cli_primavera IS NOT NULL AND TRIM(c1.cli_primavera) = TRIM(p.cli_primavera) THEN 1
                    WHEN UPPER(TRIM(c1.sigla)) = UPPER(TRIM(p.cliente_ser)) THEN 2
                    WHEN UPPER(TRIM(c1.name)) = UPPER(TRIM(p.cliente_ser)) THEN 3
                    ELSE 4
                END
            LIMIT 1
        ) c ON true
        ORDER BY
            COALESCE(
                NULLIF(TRIM(p.doc_linha), ''), 
                COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento || '-' || p.num_linha
            )
    )
    INSERT INTO public.movimentos_linhas (
        doc_linha,
        documento_ref,
        num_linha,
        data,
        data_movimento,
        cliente_ser,
        cli_primavera,
        sigla,
        documento,
        tipo_doc,
        num_doc,
        chave1,
        chave2,
        valor_unitario,
        valor_adicional,
        valor_abater,
        artigo,
        artigo_id,
        artigo_cli,
        descricao,
        tipo_artigo,
        armazem,
        localizacao,
        posicao,
        lote,
        quantidade,
        familia,
        sub_familia,
        data_fabrico,
        validade,
        tipo_movimento,
        tipo_armazem,
        armazem_loc,
        entidade,
        total_iva,
        total_merc,
        total_outros,
        totaldesc,
        total_desc,
        requisicao,
        num_contribuinte,
        nome,
        morada,
        localidade,
        cod_postal,
        cod_postal_localidade,
        pais,
        nome_entrega,
        entidade_entrega,
        morada_entrega,
        localidade_entrega,
        cod_postal_entrega,
        observacoes,
        observacoes_linha,
        updated_at
    )
    SELECT
        l.doc_linha,
        l.documento_ref,
        l.num_linha,
        l.data,
        l.data_movimento,
        l.cliente_ser,
        l.cli_primavera,
        l.sigla,
        l.documento,
        l.tipo_doc,
        l.num_doc,
        l.chave1,
        l.chave2,
        l.valor_unitario,
        l.valor_adicional,
        l.valor_abater,
        l.artigo,
        l.artigo_id,
        l.artigo_cli,
        l.descricao,
        l.tipo_artigo,
        l.armazem,
        l.localizacao,
        l.posicao,
        l.lote,
        l.quantidade,
        l.familia,
        l.sub_familia,
        l.data_fabrico,
        l.validade,
        l.tipo_movimento,
        l.tipo_armazem,
        l.armazem_loc,
        l.entidade,
        l.total_iva,
        l.total_merc,
        l.total_outros,
        l.totaldesc,
        l.total_desc,
        l.requisicao,
        l.num_contribuinte,
        l.nome,
        l.morada,
        l.localidade,
        l.cod_postal,
        l.cod_postal_localidade,
        l.pais,
        l.nome_entrega,
        l.entidade_entrega,
        l.morada_entrega,
        l.localidade_entrega,
        l.cod_postal_entrega,
        l.observacoes,
        l.observacoes_linha,
        l.updated_at
    FROM mapped_lines l
    WHERE NOT EXISTS (
        SELECT 1 FROM public.movimentos_linhas ml WHERE ml.doc_linha = l.doc_linha
    )
    ON CONFLICT (doc_linha) DO NOTHING;

    GET DIAGNOSTICS v_linhas_count = ROW_COUNT;

    v_linhas_existentes := GREATEST(v_total_plat - v_linhas_count, 0);

    RETURN jsonb_build_object(
        'success', true,
        'count', v_linhas_count,
        'documentos', v_doc_count,
        'linhas', v_linhas_count,
        'linhas_existentes_ignoradas', v_linhas_existentes
    );
END;
$$;

ALTER FUNCTION public.get_todos_movimentos_detalhe() SET statement_timeout = '60s';

