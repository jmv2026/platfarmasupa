-- =====================================================================================
-- MIGRAÇÃO: Sincronização direta das tabelas public.movimentos e public.movimentos_linhas
--           a partir de Query / Tabela do MS Access (via RPC JSONB em lotes)
-- =====================================================================================

-- 1. Função auxiliar imutável para converter valores numéricos vindos do MS Access / JSON
CREATE OR REPLACE FUNCTION public.fn_parse_access_numeric(
    p_val text,
    p_default numeric DEFAULT 0
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
    v_clean text;
BEGIN
    IF p_val IS NULL THEN
        RETURN p_default;
    END IF;

    v_clean := regexp_replace(TRIM(p_val), '\s+', '', 'g');
    IF v_clean = '' OR LOWER(v_clean) = 'null' THEN
        RETURN p_default;
    END IF;

    -- Se tiver ponto e vírgula (ex: 1.234,56 ou 1,234.56)
    IF position(',' in v_clean) > 0 AND position('.' in v_clean) > 0 THEN
        IF position(',' in reverse(v_clean)) < position('.' in reverse(v_clean)) THEN
            -- Vírgula é o separador decimal (formato PT: 1.234,56)
            v_clean := replace(replace(v_clean, '.', ''), ',', '.');
        ELSE
            -- Ponto é o separador decimal (formato EN: 1,234.56)
            v_clean := replace(v_clean, ',', '');
        END IF;
    ELSIF position(',' in v_clean) > 0 THEN
        v_clean := replace(v_clean, ',', '.');
    END IF;

    BEGIN
        RETURN v_clean::numeric;
    EXCEPTION WHEN OTHERS THEN
        RETURN p_default;
    END;
END;
$function$;

-- 2. Função RPC principal para sincronizar movimentos e movimentos_linhas a partir do MS Access
CREATE OR REPLACE FUNCTION public.sync_movimentos_from_access(
    p_rows jsonb,
    p_limpar_tudo boolean DEFAULT false,
    p_limpar_clientes boolean DEFAULT false,
    p_atualizar_existentes boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $function$
DECLARE
    v_deleted_lines integer := 0;
    v_deleted_headers integer := 0;
    v_upserted_headers integer := 0;
    v_upserted_lines integer := 0;
    v_clientes text[];
    v_cliente_ids uuid[];
    v_default_cliente_id uuid;
BEGIN
    IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Nenhum registo enviado no array JSON (p_rows).'
        );
    END IF;

    SELECT id INTO v_default_cliente_id FROM public.clientes ORDER BY ativo DESC, name ASC LIMIT 1;

    DROP TABLE IF EXISTS tmp_access_mov_sync;

    -- Criar tabela temporária da transação com todas as colunas normalizadas
    CREATE TEMP TABLE tmp_access_mov_sync ON COMMIT DROP AS
    WITH raw_items AS (
        SELECT
            ordinality AS row_idx,
            NULLIF(TRIM(COALESCE(
                r->>'documento_ref', r->>'Documento_Ref', r->>'DOCUMENTO_REF',
                r->>'DocumentoRef', r->>'documentoref'
            )), '') AS raw_documento_ref,
            NULLIF(TRIM(COALESCE(
                r->>'documento', r->>'Documento', r->>'DOCUMENTO',
                r->>'doc', r->>'Doc', r->>'DOC'
            )), '') AS raw_documento,
            NULLIF(TRIM(COALESCE(
                r->>'doc_linha', r->>'Doc_Linha', r->>'DOC_LINHA',
                r->>'DocLinha', r->>'doclinha'
            )), '') AS raw_doc_linha,
            public.fn_parse_access_numeric(COALESCE(
                r->>'num_linha', r->>'Num_Linha', r->>'NUM_LINHA',
                r->>'NumLinha', r->>'numlinha', r->>'linha', r->>'Linha'
            ), NULL)::integer AS raw_num_linha,
            public.fn_parse_access_date(COALESCE(
                r->>'data', r->>'Data', r->>'DATA',
                r->>'data_movimento', r->>'Data_Movimento', r->>'DATA_MOVIMENTO',
                r->>'DataMovimento', r->>'datamovimento'
            ), false) AS raw_data,
            NULLIF(TRIM(COALESCE(
                r->>'cliente_ser', r->>'Cliente_Ser', r->>'CLIENTE_SER',
                r->>'ClienteSer', r->>'clienteser',
                r->>'sigla', r->>'Sigla', r->>'SIGLA'
            )), '') AS raw_sigla,
            NULLIF(TRIM(COALESCE(
                r->>'cli_primavera', r->>'Cli_Primavera', r->>'CLI_PRIMAVERA',
                r->>'CliPrimavera', r->>'cliprimavera'
            )), '') AS raw_cli_primavera,
            NULLIF(TRIM(COALESCE(
                r->>'entidade', r->>'Entidade', r->>'ENTIDADE'
            )), '') AS raw_entidade,
            NULLIF(TRIM(COALESCE(
                r->>'tipo_movimento', r->>'Tipo_Movimento', r->>'TIPO_MOVIMENTO',
                r->>'TipoMovimento', r->>'tipomovimento'
            )), '') AS raw_tipo_movimento,
            NULLIF(TRIM(COALESCE(
                r->>'tipo_doc', r->>'Tipo_Doc', r->>'TIPO_DOC',
                r->>'TipoDoc', r->>'tipodoc'
            )), '') AS raw_tipo_doc,
            NULLIF(TRIM(COALESCE(
                r->>'num_doc', r->>'Num_Doc', r->>'NUM_DOC',
                r->>'NumDoc', r->>'numdoc'
            )), '') AS raw_num_doc,
            NULLIF(TRIM(COALESCE(
                r->>'chave1', r->>'Chave1', r->>'CHAVE1'
            )), '') AS raw_chave1,
            NULLIF(TRIM(COALESCE(
                r->>'chave2', r->>'Chave2', r->>'CHAVE2'
            )), '') AS raw_chave2,
            NULLIF(TRIM(COALESCE(
                r->>'artigo_id', r->>'Artigo_Id', r->>'ARTIGO_ID',
                r->>'ArtigoId', r->>'artigoid',
                r->>'artigo', r->>'Artigo', r->>'ARTIGO'
            )), '') AS raw_artigo_id,
            NULLIF(TRIM(COALESCE(
                r->>'artigo_cli', r->>'Artigo_Cli', r->>'ARTIGO_CLI',
                r->>'ArtigoCli', r->>'artigocli'
            )), '') AS raw_artigo_cli,
            NULLIF(TRIM(COALESCE(
                r->>'descricao', r->>'Descricao', r->>'DESCRICAO'
            )), '') AS raw_descricao,
            NULLIF(TRIM(COALESCE(
                r->>'tipo_artigo', r->>'Tipo_Artigo', r->>'TIPO_ARTIGO',
                r->>'TipoArtigo', r->>'tipoartigo'
            )), '') AS raw_tipo_artigo,
            NULLIF(TRIM(COALESCE(
                r->>'familia', r->>'Familia', r->>'FAMILIA'
            )), '') AS raw_familia,
            NULLIF(TRIM(COALESCE(
                r->>'sub_familia', r->>'Sub_Familia', r->>'SUB_FAMILIA',
                r->>'sub_Familia', r->>'SubFamilia', r->>'subfamilia'
            )), '') AS raw_sub_familia,
            NULLIF(TRIM(COALESCE(
                r->>'armazem', r->>'Armazem', r->>'ARMAZEM'
            )), '') AS raw_armazem,
            NULLIF(TRIM(COALESCE(
                r->>'localizacao', r->>'Localizacao', r->>'LOCALIZACAO',
                r->>'posicao', r->>'Posicao', r->>'POSICAO'
            )), '') AS raw_localizacao,
            NULLIF(TRIM(COALESCE(
                r->>'lote', r->>'Lote', r->>'LOTE'
            )), '') AS raw_lote,
            NULLIF(TRIM(COALESCE(
                r->>'nr_serie', r->>'Nr_Serie', r->>'NR_SERIE',
                r->>'serie', r->>'Serie', r->>'SERIE'
            )), '') AS raw_nr_serie,
            ABS(public.fn_parse_access_numeric(COALESCE(
                r->>'quantidade', r->>'Quantidade', r->>'QUANTIDADE',
                r->>'qtd', r->>'Qtd', r->>'QTD'
            ), 0)) AS raw_quantidade,
            public.fn_parse_access_date(COALESCE(
                r->>'data_fabrico', r->>'Data_Fabrico', r->>'DATA_FABRICO',
                r->>'DataFabrico', r->>'datafabrico'
            ), true) AS raw_data_fabrico,
            public.fn_parse_access_date(COALESCE(
                r->>'validade', r->>'Validade', r->>'VALIDADE'
            ), false) AS raw_validade,
            public.fn_parse_access_numeric(COALESCE(
                r->>'valor_unitario', r->>'Valor_Unitario', r->>'VALOR_UNITARIO',
                r->>'ValorUnitario', r->>'valorunitario'
            ), 0) AS raw_valor_unitario,
            public.fn_parse_access_numeric(COALESCE(
                r->>'valor_adicional', r->>'Valor_Adicional', r->>'VALOR_ADICIONAL',
                r->>'ValorAdicional', r->>'valoradicional'
            ), 0) AS raw_valor_adicional,
            public.fn_parse_access_numeric(COALESCE(
                r->>'valor_abater', r->>'Valor_Abater', r->>'VALOR_ABATER',
                r->>'ValorAbater', r->>'valorabater'
            ), 0) AS raw_valor_abater,
            public.fn_parse_access_numeric(COALESCE(
                r->>'total_iva', r->>'Total_Iva', r->>'TOTAL_IVA',
                r->>'TotalIva', r->>'totaliva'
            ), 0) AS raw_total_iva,
            public.fn_parse_access_numeric(COALESCE(
                r->>'total_merc', r->>'Total_Merc', r->>'TOTAL_MERC',
                r->>'TotalMerc', r->>'totalmerc'
            ), 0) AS raw_total_merc,
            public.fn_parse_access_numeric(COALESCE(
                r->>'total_outros', r->>'Total_Outros', r->>'TOTAL_OUTROS',
                r->>'TotalOutros', r->>'totaloutros'
            ), 0) AS raw_total_outros,
            public.fn_parse_access_numeric(COALESCE(
                r->>'totaldesc', r->>'TotalDesc', r->>'TOTALDESC',
                r->>'total_desc', r->>'Total_Desc', r->>'TOTAL_DESC'
            ), 0) AS raw_total_desc,
            NULLIF(TRIM(COALESCE(
                r->>'requisicao', r->>'Requisicao', r->>'REQUISICAO'
            )), '') AS raw_requisicao,
            NULLIF(TRIM(COALESCE(
                r->>'ref_ser', r->>'Ref_Ser', r->>'REF_SER',
                r->>'RefSer', r->>'refser'
            )), '') AS raw_ref_ser,
            NULLIF(TRIM(COALESCE(
                r->>'num_contribuinte', r->>'Num_Contribuinte', r->>'NUM_CONTRIBUINTE',
                r->>'NumContribuinte', r->>'numcontribuinte', r->>'nif', r->>'NIF'
            )), '') AS raw_num_contribuinte,
            NULLIF(TRIM(COALESCE(
                r->>'nome', r->>'Nome', r->>'NOME'
            )), '') AS raw_nome,
            NULLIF(TRIM(COALESCE(
                r->>'morada', r->>'Morada', r->>'MORADA'
            )), '') AS raw_morada,
            NULLIF(TRIM(COALESCE(
                r->>'localidade', r->>'Localidade', r->>'LOCALIDADE'
            )), '') AS raw_localidade,
            NULLIF(TRIM(COALESCE(
                r->>'cod_postal', r->>'Cod_Postal', r->>'COD_POSTAL',
                r->>'CodPostal', r->>'codpostal', r->>'codigo_postal'
            )), '') AS raw_cod_postal,
            NULLIF(TRIM(COALESCE(
                r->>'cod_postal_localidade', r->>'Cod_Postal_Localidade', r->>'COD_POSTAL_LOCALIDADE',
                r->>'CodPostalLocalidade', r->>'codpostallocalidade'
            )), '') AS raw_cod_postal_localidade,
            NULLIF(TRIM(COALESCE(
                r->>'pais', r->>'Pais', r->>'PAIS'
            )), '') AS raw_pais,
            NULLIF(TRIM(COALESCE(
                r->>'nome_entrega', r->>'Nome_Entrega', r->>'NOME_ENTREGA',
                r->>'NomeEntrega', r->>'nomeentrega'
            )), '') AS raw_nome_entrega,
            NULLIF(TRIM(COALESCE(
                r->>'entidade_entrega', r->>'Entidade_Entrega', r->>'ENTIDADE_ENTREGA',
                r->>'EntidadeEntrega', r->>'entidadeentrega'
            )), '') AS raw_entidade_entrega,
            NULLIF(TRIM(COALESCE(
                r->>'morada_entrega', r->>'Morada_Entrega', r->>'MORADA_ENTREGA',
                r->>'MoradaEntrega', r->>'moradaentrega'
            )), '') AS raw_morada_entrega,
            NULLIF(TRIM(COALESCE(
                r->>'localidade_entrega', r->>'Localidade_Entrega', r->>'LOCALIDADE_ENTREGA',
                r->>'LocalidadeEntrega', r->>'localidadeentrega',
                r->>'CodPostalLocalidadeEntrega', r->>'cod_postal_localidade_entrega'
            )), '') AS raw_localidade_entrega,
            NULLIF(TRIM(COALESCE(
                r->>'cod_postal_entrega', r->>'Cod_Postal_Entrega', r->>'COD_POSTAL_ENTREGA',
                r->>'CodPostalEntrega', r->>'codpostalentrega'
            )), '') AS raw_cod_postal_entrega,
            NULLIF(TRIM(COALESCE(
                r->>'observacoes', r->>'Observacoes', r->>'OBSERVACOES',
                r->>'observacoes_linha', r->>'Observacoes_Linha', r->>'obs', r->>'Obs'
            )), '') AS raw_observacoes
        FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(r, ordinality)
    ),
    resolved AS (
        SELECT
            ri.*,
            COALESCE(c.id, v_default_cliente_id) AS resolved_cliente_id,
            UPPER(COALESCE(
                c.sigla,
                NULLIF(regexp_replace(COALESCE(ri.raw_chave2, ''), '[0-9]', '', 'g'), ''),
                NULLIF(regexp_replace(COALESCE(ri.raw_armazem, ''), '[0-9]', '', 'g'), ''),
                ri.raw_sigla,
                ri.raw_sub_familia,
                'UNK'
            )) AS resolved_sigla,
            COALESCE(c.cli_primavera, ri.raw_cli_primavera) AS resolved_cli_primavera
        FROM raw_items ri
        LEFT JOIN LATERAL (
            SELECT c1.id, c1.sigla, c1.cli_primavera
            FROM public.clientes c1
            WHERE (ri.raw_cli_primavera IS NOT NULL AND TRIM(c1.cli_primavera) = ri.raw_cli_primavera)
               OR (ri.raw_sigla IS NOT NULL AND UPPER(TRIM(c1.sigla)) = UPPER(ri.raw_sigla))
               OR (ri.raw_sub_familia IS NOT NULL AND UPPER(TRIM(c1.sigla)) = UPPER(ri.raw_sub_familia))
               OR (ri.raw_chave2 IS NOT NULL AND UPPER(TRIM(c1.sigla)) = UPPER(NULLIF(regexp_replace(ri.raw_chave2, '[0-9]', '', 'g'), '')))
               OR (ri.raw_armazem IS NOT NULL AND UPPER(TRIM(c1.sigla)) = UPPER(LEFT(ri.raw_armazem, 3)))
               OR (ri.raw_sigla IS NOT NULL AND (UPPER(TRIM(c1.name)) = UPPER(ri.raw_sigla) OR UPPER(TRIM(c1.name)) LIKE UPPER(ri.raw_sigla) || '%'))
               OR (ri.raw_sub_familia IS NOT NULL AND (UPPER(TRIM(c1.name)) = UPPER(ri.raw_sub_familia) OR UPPER(TRIM(c1.name)) LIKE UPPER(ri.raw_sub_familia) || '%'))
            ORDER BY
                CASE
                    WHEN ri.raw_cli_primavera IS NOT NULL AND TRIM(c1.cli_primavera) = ri.raw_cli_primavera THEN 1
                    WHEN ri.raw_sigla IS NOT NULL AND UPPER(TRIM(c1.sigla)) = UPPER(ri.raw_sigla) THEN 2
                    WHEN ri.raw_sub_familia IS NOT NULL AND UPPER(TRIM(c1.sigla)) = UPPER(ri.raw_sub_familia) THEN 3
                    WHEN ri.raw_chave2 IS NOT NULL AND UPPER(TRIM(c1.sigla)) = UPPER(NULLIF(regexp_replace(ri.raw_chave2, '[0-9]', '', 'g'), '')) THEN 4
                    WHEN ri.raw_armazem IS NOT NULL AND UPPER(TRIM(c1.sigla)) = UPPER(LEFT(ri.raw_armazem, 3)) THEN 5
                    WHEN ri.raw_sigla IS NOT NULL AND (UPPER(TRIM(c1.name)) = UPPER(ri.raw_sigla) OR UPPER(TRIM(c1.name)) LIKE UPPER(ri.raw_sigla) || '%') THEN 6
                    ELSE 7
                END
            LIMIT 1
        ) c ON true
        WHERE COALESCE(ri.raw_documento_ref, ri.raw_documento, ri.raw_doc_linha) IS NOT NULL
    )
    SELECT
        r.row_idx,
        COALESCE(
            r.raw_documento_ref,
            CASE
                WHEN r.raw_documento IS NOT NULL THEN r.resolved_sigla || '-' || r.raw_documento
                ELSE r.raw_doc_linha
            END
        ) AS documento_ref,
        r.resolved_cliente_id AS cliente_id,
        r.resolved_sigla AS sigla,
        r.resolved_sigla AS cliente_ser,
        r.resolved_cli_primavera AS cli_primavera,
        COALESCE(r.raw_documento, r.raw_documento_ref) AS documento,
        COALESCE(r.raw_tipo_doc, r.raw_chave1, split_part(COALESCE(r.raw_documento, ''), ' ', 1)) AS tipo_doc,
        COALESCE(
            r.raw_num_doc,
            CASE
                WHEN position('/' in COALESCE(r.raw_documento, '')) > 0 THEN split_part(r.raw_documento, '/', 2)
                ELSE NULL
            END
        ) AS num_doc,
        COALESCE(
            r.raw_doc_linha,
            CASE
                WHEN r.raw_documento IS NOT NULL AND r.raw_num_linha IS NOT NULL THEN r.raw_documento || '-' || r.raw_num_linha::text
                WHEN r.raw_documento_ref IS NOT NULL AND r.raw_num_linha IS NOT NULL THEN r.raw_documento_ref || '-' || r.raw_num_linha::text
                WHEN r.raw_artigo_id IS NOT NULL THEN COALESCE(r.raw_documento, r.raw_documento_ref, 'DOC') || '-' || r.row_idx::text
                ELSE NULL
            END
        ) AS doc_linha,
        COALESCE(r.raw_num_linha, r.row_idx::integer) AS num_linha,
        COALESCE(r.raw_data, CURRENT_DATE) AS data,
        COALESCE(r.raw_data::timestamp with time zone, now()) AS data_movimento,
        UPPER(COALESCE(
            CASE
                WHEN LOWER(COALESCE(r.raw_tipo_movimento, '')) IN ('e', 'es', 'entrada') THEN 'ES'
                WHEN LOWER(COALESCE(r.raw_tipo_movimento, '')) IN ('s', 'ss', 'saida', 'saída') THEN 'SS'
                WHEN LOWER(COALESCE(r.raw_tipo_movimento, '')) = 'et' THEN 'ET'
                WHEN LOWER(COALESCE(r.raw_tipo_movimento, '')) = 'st' THEN 'ST'
                ELSE UPPER(r.raw_tipo_movimento)
            END,
            'SS'
        )) AS tipo_movimento_header,
        CASE
            WHEN LOWER(COALESCE(r.raw_tipo_movimento, '')) IN ('e', 'es', 'entrada') THEN 'es'
            WHEN LOWER(COALESCE(r.raw_tipo_movimento, '')) IN ('s', 'ss', 'saida', 'saída') THEN 'ss'
            WHEN LOWER(COALESCE(r.raw_tipo_movimento, '')) = 'et' THEN 'et'
            WHEN LOWER(COALESCE(r.raw_tipo_movimento, '')) = 'st' THEN 'st'
            ELSE 'ss'
        END AS tipo_movimento_line,
        r.raw_chave1 AS chave1,
        r.raw_chave2 AS chave2,
        r.raw_entidade AS entidade,
        COALESCE(r.raw_artigo_id, r.raw_descricao) AS artigo_id,
        COALESCE(
            r.raw_artigo_cli,
            CASE
                WHEN COALESCE(r.raw_artigo_id, r.raw_descricao) IS NOT NULL THEN
                    COALESCE(r.resolved_cli_primavera, r.resolved_sigla, 'UNK') || '-' || UPPER(TRIM(COALESCE(r.raw_artigo_id, r.raw_descricao)))
                ELSE NULL
            END
        ) AS artigo_cli,
        r.raw_descricao AS descricao,
        r.raw_tipo_artigo AS tipo_artigo,
        r.raw_familia AS familia,
        r.raw_sub_familia AS sub_familia,
        r.raw_armazem AS armazem,
        CASE
            WHEN r.raw_armazem LIKE '%01' THEN '01'
            WHEN r.raw_armazem LIKE '%02' THEN '02'
            WHEN r.raw_armazem LIKE '%03' THEN '03'
            WHEN r.raw_armazem LIKE '%04' THEN '04'
            WHEN r.raw_armazem LIKE '%05' THEN '05'
            WHEN r.raw_armazem LIKE '%06' THEN '06'
            WHEN r.raw_armazem LIKE '%07' THEN '07'
            WHEN r.raw_armazem LIKE '%08' THEN '08'
            WHEN r.raw_armazem LIKE '%09' THEN '09'
            WHEN r.raw_armazem LIKE '%10' THEN '10'
            ELSE COALESCE(NULLIF(RIGHT(TRIM(COALESCE(r.raw_armazem, '')), 2), ''), '01')
        END AS tipo_armazem,
        r.resolved_sigla || '-' || (
            CASE
                WHEN r.raw_armazem LIKE '%01' THEN '01'
                WHEN r.raw_armazem LIKE '%02' THEN '02'
                WHEN r.raw_armazem LIKE '%03' THEN '03'
                WHEN r.raw_armazem LIKE '%04' THEN '04'
                WHEN r.raw_armazem LIKE '%05' THEN '05'
                WHEN r.raw_armazem LIKE '%06' THEN '06'
                WHEN r.raw_armazem LIKE '%07' THEN '07'
                WHEN r.raw_armazem LIKE '%08' THEN '08'
                WHEN r.raw_armazem LIKE '%09' THEN '09'
                WHEN r.raw_armazem LIKE '%10' THEN '10'
                ELSE '01'
            END
        ) AS armazem_loc,
        r.raw_localizacao AS localizacao,
        r.raw_lote AS lote,
        r.raw_nr_serie AS nr_serie,
        r.raw_quantidade AS quantidade,
        r.raw_data_fabrico AS data_fabrico,
        r.raw_validade AS validade,
        r.raw_valor_unitario AS valor_unitario,
        r.raw_valor_adicional AS valor_adicional,
        r.raw_valor_abater AS valor_abater,
        r.raw_total_iva AS total_iva,
        r.raw_total_merc AS total_merc,
        r.raw_total_outros AS total_outros,
        r.raw_total_desc AS total_desc,
        r.raw_requisicao AS requisicao,
        r.raw_ref_ser AS ref_ser,
        r.raw_num_contribuinte AS num_contribuinte,
        r.raw_nome AS nome,
        r.raw_morada AS morada,
        r.raw_localidade AS localidade,
        r.raw_cod_postal AS cod_postal,
        r.raw_cod_postal_localidade AS cod_postal_localidade,
        r.raw_pais AS pais,
        r.raw_nome_entrega AS nome_entrega,
        r.raw_entidade_entrega AS entidade_entrega,
        r.raw_morada_entrega AS morada_entrega,
        r.raw_localidade_entrega AS localidade_entrega,
        r.raw_cod_postal_entrega AS cod_postal_entrega,
        r.raw_observacoes AS observacoes
    FROM resolved r;

    -- Obter lista de clientes presentes no lote enviado
    SELECT
        array_agg(DISTINCT UPPER(TRIM(sigla))),
        array_agg(DISTINCT cliente_id)
    INTO v_clientes, v_cliente_ids
    FROM tmp_access_mov_sync
    WHERE sigla IS NOT NULL;

    IF v_clientes IS NULL OR array_length(v_clientes, 1) IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Nenhum registo válido de movimento encontrado (verifique documento/documento_ref e cliente).'
        );
    END IF;

    -- 1º Passo (Opcional): Limpar movimentos anteriores caso solicitado (p_limpar_tudo ou p_limpar_clientes)
    IF COALESCE(p_limpar_tudo, false) THEN
        DELETE FROM public.movimentos_linhas WHERE doc_linha IS NOT NULL;
        GET DIAGNOSTICS v_deleted_lines = ROW_COUNT;

        DELETE FROM public.movimentos WHERE documento_ref IS NOT NULL;
        GET DIAGNOSTICS v_deleted_headers = ROW_COUNT;
    ELSIF COALESCE(p_limpar_clientes, false) THEN
        DELETE FROM public.movimentos_linhas
        WHERE doc_linha IS NOT NULL
          AND (UPPER(TRIM(sigla)) = ANY(v_clientes) OR UPPER(TRIM(cliente_ser)) = ANY(v_clientes));
        GET DIAGNOSTICS v_deleted_lines = ROW_COUNT;

        DELETE FROM public.movimentos
        WHERE documento_ref IS NOT NULL
          AND (cliente_id = ANY(v_cliente_ids) OR UPPER(TRIM(sigla)) = ANY(v_clientes));
        GET DIAGNOSTICS v_deleted_headers = ROW_COUNT;
    END IF;

    -- 2º Passo: Sincronizar cabeçalhos em public.movimentos
    IF COALESCE(p_atualizar_existentes, true) THEN
        WITH distinct_headers AS (
            SELECT DISTINCT ON (t.documento_ref)
                t.*
            FROM tmp_access_mov_sync t
            WHERE t.documento_ref IS NOT NULL
            ORDER BY t.documento_ref, t.num_linha ASC, t.row_idx ASC
        )
        INSERT INTO public.movimentos (
            documento_ref,
            cliente_id,
            sigla,
            cliente_ser,
            cli_primavera,
            documento,
            tipo_doc,
            num_doc,
            data,
            data_movimento,
            tipo_movimento,
            tipomovimento,
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
            updated_at
        )
        SELECT
            h.documento_ref,
            h.cliente_id,
            h.sigla,
            h.cliente_ser,
            h.cli_primavera,
            h.documento,
            h.tipo_doc,
            h.num_doc,
            h.data,
            h.data_movimento,
            h.tipo_movimento_header,
            h.tipo_movimento_header,
            h.chave1,
            h.chave2,
            h.entidade,
            h.total_iva,
            h.total_iva,
            h.total_merc,
            h.total_merc,
            h.total_outros,
            h.total_outros,
            h.total_desc,
            h.total_desc,
            h.requisicao,
            h.num_contribuinte,
            h.num_contribuinte,
            h.nome,
            h.morada,
            h.localidade,
            h.cod_postal,
            h.cod_postal,
            h.cod_postal_localidade,
            h.cod_postal_localidade,
            h.pais,
            h.nome_entrega,
            h.nome_entrega,
            h.nome_entrega,
            h.entidade_entrega,
            h.entidade_entrega,
            h.entidade_entrega,
            h.morada_entrega,
            h.morada_entrega,
            h.morada_entrega,
            h.localidade_entrega,
            h.localidade_entrega,
            h.localidade_entrega,
            h.localidade_entrega,
            h.cod_postal_entrega,
            h.cod_postal_entrega,
            h.cod_postal_entrega,
            h.observacoes,
            now()
        FROM distinct_headers h
        ON CONFLICT (documento_ref) DO UPDATE SET
            cliente_id = EXCLUDED.cliente_id,
            sigla = COALESCE(EXCLUDED.sigla, public.movimentos.sigla),
            cliente_ser = COALESCE(EXCLUDED.cliente_ser, public.movimentos.cliente_ser),
            cli_primavera = COALESCE(EXCLUDED.cli_primavera, public.movimentos.cli_primavera),
            documento = COALESCE(EXCLUDED.documento, public.movimentos.documento),
            tipo_doc = COALESCE(EXCLUDED.tipo_doc, public.movimentos.tipo_doc),
            num_doc = COALESCE(EXCLUDED.num_doc, public.movimentos.num_doc),
            data = COALESCE(EXCLUDED.data, public.movimentos.data),
            data_movimento = COALESCE(EXCLUDED.data_movimento, public.movimentos.data_movimento),
            tipo_movimento = COALESCE(EXCLUDED.tipo_movimento, public.movimentos.tipo_movimento),
            tipomovimento = COALESCE(EXCLUDED.tipomovimento, public.movimentos.tipomovimento),
            chave1 = COALESCE(EXCLUDED.chave1, public.movimentos.chave1),
            chave2 = COALESCE(EXCLUDED.chave2, public.movimentos.chave2),
            entidade = COALESCE(EXCLUDED.entidade, public.movimentos.entidade),
            total_iva = EXCLUDED.total_iva,
            totaliva = EXCLUDED.totaliva,
            total_merc = EXCLUDED.total_merc,
            totalmerc = EXCLUDED.totalmerc,
            total_outros = EXCLUDED.total_outros,
            totaloutros = EXCLUDED.totaloutros,
            totaldesc = EXCLUDED.totaldesc,
            total_desc = EXCLUDED.total_desc,
            requisicao = COALESCE(EXCLUDED.requisicao, public.movimentos.requisicao),
            num_contribuinte = COALESCE(EXCLUDED.num_contribuinte, public.movimentos.num_contribuinte),
            numcontribuinte = COALESCE(EXCLUDED.numcontribuinte, public.movimentos.numcontribuinte),
            nome = COALESCE(EXCLUDED.nome, public.movimentos.nome),
            morada = COALESCE(EXCLUDED.morada, public.movimentos.morada),
            localidade = COALESCE(EXCLUDED.localidade, public.movimentos.localidade),
            cod_postal = COALESCE(EXCLUDED.cod_postal, public.movimentos.cod_postal),
            codpostal = COALESCE(EXCLUDED.codpostal, public.movimentos.codpostal),
            cod_postal_localidade = COALESCE(EXCLUDED.cod_postal_localidade, public.movimentos.cod_postal_localidade),
            codpostallocalidade = COALESCE(EXCLUDED.codpostallocalidade, public.movimentos.codpostallocalidade),
            pais = COALESCE(EXCLUDED.pais, public.movimentos.pais),
            nome_entrega = COALESCE(EXCLUDED.nome_entrega, public.movimentos.nome_entrega),
            nomeentrega = COALESCE(EXCLUDED.nomeentrega, public.movimentos.nomeentrega),
            "NomeEntrega" = COALESCE(EXCLUDED."NomeEntrega", public.movimentos."NomeEntrega"),
            entidade_entrega = COALESCE(EXCLUDED.entidade_entrega, public.movimentos.entidade_entrega),
            entidadeentrega = COALESCE(EXCLUDED.entidadeentrega, public.movimentos.entidadeentrega),
            "EntidadeEntrega" = COALESCE(EXCLUDED."EntidadeEntrega", public.movimentos."EntidadeEntrega"),
            morada_entrega = COALESCE(EXCLUDED.morada_entrega, public.movimentos.morada_entrega),
            moradaentrega = COALESCE(EXCLUDED.moradaentrega, public.movimentos.moradaentrega),
            "MoradaEntrega" = COALESCE(EXCLUDED."MoradaEntrega", public.movimentos."MoradaEntrega"),
            localidade_entrega = COALESCE(EXCLUDED.localidade_entrega, public.movimentos.localidade_entrega),
            localidadeentrega = COALESCE(EXCLUDED.localidadeentrega, public.movimentos.localidadeentrega),
            "LocalidadeEntrega" = COALESCE(EXCLUDED."LocalidadeEntrega", public.movimentos."LocalidadeEntrega"),
            "CodPostalLocalidadeEntrega" = COALESCE(EXCLUDED."CodPostalLocalidadeEntrega", public.movimentos."CodPostalLocalidadeEntrega"),
            cod_postal_entrega = COALESCE(EXCLUDED.cod_postal_entrega, public.movimentos.cod_postal_entrega),
            codpostalentrega = COALESCE(EXCLUDED.codpostalentrega, public.movimentos.codpostalentrega),
            "CodPostalEntrega" = COALESCE(EXCLUDED."CodPostalEntrega", public.movimentos."CodPostalEntrega"),
            observacoes = COALESCE(EXCLUDED.observacoes, public.movimentos.observacoes),
            updated_at = now()
        WHERE
            public.movimentos.cliente_id IS DISTINCT FROM EXCLUDED.cliente_id
            OR public.movimentos.sigla IS DISTINCT FROM COALESCE(EXCLUDED.sigla, public.movimentos.sigla)
            OR public.movimentos.cli_primavera IS DISTINCT FROM COALESCE(EXCLUDED.cli_primavera, public.movimentos.cli_primavera)
            OR public.movimentos.documento IS DISTINCT FROM COALESCE(EXCLUDED.documento, public.movimentos.documento)
            OR public.movimentos.tipo_doc IS DISTINCT FROM COALESCE(EXCLUDED.tipo_doc, public.movimentos.tipo_doc)
            OR public.movimentos.num_doc IS DISTINCT FROM COALESCE(EXCLUDED.num_doc, public.movimentos.num_doc)
            OR public.movimentos.data IS DISTINCT FROM COALESCE(EXCLUDED.data, public.movimentos.data)
            OR public.movimentos.tipo_movimento IS DISTINCT FROM COALESCE(EXCLUDED.tipo_movimento, public.movimentos.tipo_movimento)
            OR public.movimentos.chave1 IS DISTINCT FROM COALESCE(EXCLUDED.chave1, public.movimentos.chave1)
            OR public.movimentos.chave2 IS DISTINCT FROM COALESCE(EXCLUDED.chave2, public.movimentos.chave2)
            OR public.movimentos.entidade IS DISTINCT FROM COALESCE(EXCLUDED.entidade, public.movimentos.entidade)
            OR public.movimentos.total_iva IS DISTINCT FROM EXCLUDED.total_iva
            OR public.movimentos.total_merc IS DISTINCT FROM EXCLUDED.total_merc
            OR public.movimentos.total_outros IS DISTINCT FROM EXCLUDED.total_outros
            OR public.movimentos.total_desc IS DISTINCT FROM EXCLUDED.total_desc
            OR public.movimentos.requisicao IS DISTINCT FROM COALESCE(EXCLUDED.requisicao, public.movimentos.requisicao)
            OR public.movimentos.num_contribuinte IS DISTINCT FROM COALESCE(EXCLUDED.num_contribuinte, public.movimentos.num_contribuinte)
            OR public.movimentos.nome IS DISTINCT FROM COALESCE(EXCLUDED.nome, public.movimentos.nome)
            OR public.movimentos.morada IS DISTINCT FROM COALESCE(EXCLUDED.morada, public.movimentos.morada)
            OR public.movimentos.localidade IS DISTINCT FROM COALESCE(EXCLUDED.localidade, public.movimentos.localidade)
            OR public.movimentos.cod_postal IS DISTINCT FROM COALESCE(EXCLUDED.cod_postal, public.movimentos.cod_postal)
            OR public.movimentos.pais IS DISTINCT FROM COALESCE(EXCLUDED.pais, public.movimentos.pais)
            OR public.movimentos.nome_entrega IS DISTINCT FROM COALESCE(EXCLUDED.nome_entrega, public.movimentos.nome_entrega)
            OR public.movimentos.entidade_entrega IS DISTINCT FROM COALESCE(EXCLUDED.entidade_entrega, public.movimentos.entidade_entrega)
            OR public.movimentos.morada_entrega IS DISTINCT FROM COALESCE(EXCLUDED.morada_entrega, public.movimentos.morada_entrega)
            OR public.movimentos.localidade_entrega IS DISTINCT FROM COALESCE(EXCLUDED.localidade_entrega, public.movimentos.localidade_entrega)
            OR public.movimentos.cod_postal_entrega IS DISTINCT FROM COALESCE(EXCLUDED.cod_postal_entrega, public.movimentos.cod_postal_entrega)
            OR public.movimentos.observacoes IS DISTINCT FROM COALESCE(EXCLUDED.observacoes, public.movimentos.observacoes);

        GET DIAGNOSTICS v_upserted_headers = ROW_COUNT;
    ELSE
        WITH distinct_headers AS (
            SELECT DISTINCT ON (t.documento_ref)
                t.*
            FROM tmp_access_mov_sync t
            WHERE t.documento_ref IS NOT NULL
            ORDER BY t.documento_ref, t.num_linha ASC, t.row_idx ASC
        )
        INSERT INTO public.movimentos (
            documento_ref,
            cliente_id,
            sigla,
            cliente_ser,
            cli_primavera,
            documento,
            tipo_doc,
            num_doc,
            data,
            data_movimento,
            tipo_movimento,
            tipomovimento,
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
            updated_at
        )
        SELECT
            h.documento_ref,
            h.cliente_id,
            h.sigla,
            h.cliente_ser,
            h.cli_primavera,
            h.documento,
            h.tipo_doc,
            h.num_doc,
            h.data,
            h.data_movimento,
            h.tipo_movimento_header,
            h.tipo_movimento_header,
            h.chave1,
            h.chave2,
            h.entidade,
            h.total_iva,
            h.total_iva,
            h.total_merc,
            h.total_merc,
            h.total_outros,
            h.total_outros,
            h.total_desc,
            h.total_desc,
            h.requisicao,
            h.num_contribuinte,
            h.num_contribuinte,
            h.nome,
            h.morada,
            h.localidade,
            h.cod_postal,
            h.cod_postal,
            h.cod_postal_localidade,
            h.cod_postal_localidade,
            h.pais,
            h.nome_entrega,
            h.nome_entrega,
            h.nome_entrega,
            h.entidade_entrega,
            h.entidade_entrega,
            h.entidade_entrega,
            h.morada_entrega,
            h.morada_entrega,
            h.morada_entrega,
            h.localidade_entrega,
            h.localidade_entrega,
            h.localidade_entrega,
            h.localidade_entrega,
            h.cod_postal_entrega,
            h.cod_postal_entrega,
            h.cod_postal_entrega,
            h.observacoes,
            now()
        FROM distinct_headers h
        ON CONFLICT (documento_ref) DO NOTHING;

        GET DIAGNOSTICS v_upserted_headers = ROW_COUNT;
    END IF;

    -- 3º Passo: Sincronizar linhas em public.movimentos_linhas (apenas linhas com doc_linha e artigo/quantidade)
    IF COALESCE(p_atualizar_existentes, true) THEN
        WITH distinct_lines AS (
            SELECT DISTINCT ON (t.doc_linha)
                t.*
            FROM tmp_access_mov_sync t
            WHERE t.doc_linha IS NOT NULL
              AND (t.artigo_id IS NOT NULL OR t.descricao IS NOT NULL)
            ORDER BY t.doc_linha, t.row_idx ASC
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
            nr_serie,
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
            ref_ser,
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
            l.artigo_id,
            l.artigo_id,
            l.artigo_cli,
            l.descricao,
            l.tipo_artigo,
            l.armazem,
            l.localizacao,
            l.localizacao,
            l.lote,
            l.nr_serie,
            l.quantidade,
            l.familia,
            l.sub_familia,
            l.data_fabrico,
            l.validade,
            l.tipo_movimento_line,
            l.tipo_armazem,
            l.armazem_loc,
            l.entidade,
            l.total_iva,
            l.total_merc,
            l.total_outros,
            l.total_desc,
            l.total_desc,
            l.requisicao,
            l.ref_ser,
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
            l.observacoes,
            now()
        FROM distinct_lines l
        ON CONFLICT (doc_linha) DO UPDATE SET
            documento_ref = EXCLUDED.documento_ref,
            num_linha = EXCLUDED.num_linha,
            data = EXCLUDED.data,
            data_movimento = EXCLUDED.data_movimento,
            cliente_ser = EXCLUDED.cliente_ser,
            cli_primavera = COALESCE(EXCLUDED.cli_primavera, public.movimentos_linhas.cli_primavera),
            sigla = EXCLUDED.sigla,
            documento = EXCLUDED.documento,
            tipo_doc = EXCLUDED.tipo_doc,
            num_doc = EXCLUDED.num_doc,
            chave1 = EXCLUDED.chave1,
            chave2 = EXCLUDED.chave2,
            valor_unitario = EXCLUDED.valor_unitario,
            valor_adicional = EXCLUDED.valor_adicional,
            valor_abater = EXCLUDED.valor_abater,
            artigo = EXCLUDED.artigo,
            artigo_id = EXCLUDED.artigo_id,
            artigo_cli = EXCLUDED.artigo_cli,
            descricao = COALESCE(EXCLUDED.descricao, public.movimentos_linhas.descricao),
            tipo_artigo = COALESCE(EXCLUDED.tipo_artigo, public.movimentos_linhas.tipo_artigo),
            armazem = EXCLUDED.armazem,
            localizacao = EXCLUDED.localizacao,
            posicao = EXCLUDED.posicao,
            lote = EXCLUDED.lote,
            nr_serie = EXCLUDED.nr_serie,
            quantidade = EXCLUDED.quantidade,
            familia = COALESCE(EXCLUDED.familia, public.movimentos_linhas.familia),
            sub_familia = COALESCE(EXCLUDED.sub_familia, public.movimentos_linhas.sub_familia),
            data_fabrico = EXCLUDED.data_fabrico,
            validade = EXCLUDED.validade,
            tipo_movimento = EXCLUDED.tipo_movimento,
            tipo_armazem = EXCLUDED.tipo_armazem,
            armazem_loc = EXCLUDED.armazem_loc,
            entidade = COALESCE(EXCLUDED.entidade, public.movimentos_linhas.entidade),
            total_iva = EXCLUDED.total_iva,
            total_merc = EXCLUDED.total_merc,
            total_outros = EXCLUDED.total_outros,
            totaldesc = EXCLUDED.totaldesc,
            total_desc = EXCLUDED.total_desc,
            requisicao = COALESCE(EXCLUDED.requisicao, public.movimentos_linhas.requisicao),
            ref_ser = COALESCE(EXCLUDED.ref_ser, public.movimentos_linhas.ref_ser),
            num_contribuinte = COALESCE(EXCLUDED.num_contribuinte, public.movimentos_linhas.num_contribuinte),
            nome = COALESCE(EXCLUDED.nome, public.movimentos_linhas.nome),
            morada = COALESCE(EXCLUDED.morada, public.movimentos_linhas.morada),
            localidade = COALESCE(EXCLUDED.localidade, public.movimentos_linhas.localidade),
            cod_postal = COALESCE(EXCLUDED.cod_postal, public.movimentos_linhas.cod_postal),
            cod_postal_localidade = COALESCE(EXCLUDED.cod_postal_localidade, public.movimentos_linhas.cod_postal_localidade),
            pais = COALESCE(EXCLUDED.pais, public.movimentos_linhas.pais),
            nome_entrega = COALESCE(EXCLUDED.nome_entrega, public.movimentos_linhas.nome_entrega),
            entidade_entrega = COALESCE(EXCLUDED.entidade_entrega, public.movimentos_linhas.entidade_entrega),
            morada_entrega = COALESCE(EXCLUDED.morada_entrega, public.movimentos_linhas.morada_entrega),
            localidade_entrega = COALESCE(EXCLUDED.localidade_entrega, public.movimentos_linhas.localidade_entrega),
            cod_postal_entrega = COALESCE(EXCLUDED.cod_postal_entrega, public.movimentos_linhas.cod_postal_entrega),
            observacoes = COALESCE(EXCLUDED.observacoes, public.movimentos_linhas.observacoes),
            observacoes_linha = COALESCE(EXCLUDED.observacoes_linha, public.movimentos_linhas.observacoes_linha),
            updated_at = now()
        WHERE
            public.movimentos_linhas.documento_ref IS DISTINCT FROM EXCLUDED.documento_ref
            OR public.movimentos_linhas.num_linha IS DISTINCT FROM EXCLUDED.num_linha
            OR public.movimentos_linhas.data IS DISTINCT FROM EXCLUDED.data
            OR public.movimentos_linhas.cliente_ser IS DISTINCT FROM EXCLUDED.cliente_ser
            OR public.movimentos_linhas.cli_primavera IS DISTINCT FROM COALESCE(EXCLUDED.cli_primavera, public.movimentos_linhas.cli_primavera)
            OR public.movimentos_linhas.sigla IS DISTINCT FROM EXCLUDED.sigla
            OR public.movimentos_linhas.documento IS DISTINCT FROM EXCLUDED.documento
            OR public.movimentos_linhas.tipo_doc IS DISTINCT FROM EXCLUDED.tipo_doc
            OR public.movimentos_linhas.num_doc IS DISTINCT FROM EXCLUDED.num_doc
            OR public.movimentos_linhas.chave1 IS DISTINCT FROM EXCLUDED.chave1
            OR public.movimentos_linhas.chave2 IS DISTINCT FROM EXCLUDED.chave2
            OR public.movimentos_linhas.valor_unitario IS DISTINCT FROM EXCLUDED.valor_unitario
            OR public.movimentos_linhas.valor_adicional IS DISTINCT FROM EXCLUDED.valor_adicional
            OR public.movimentos_linhas.valor_abater IS DISTINCT FROM EXCLUDED.valor_abater
            OR public.movimentos_linhas.artigo_id IS DISTINCT FROM EXCLUDED.artigo_id
            OR public.movimentos_linhas.artigo_cli IS DISTINCT FROM EXCLUDED.artigo_cli
            OR public.movimentos_linhas.descricao IS DISTINCT FROM COALESCE(EXCLUDED.descricao, public.movimentos_linhas.descricao)
            OR public.movimentos_linhas.tipo_artigo IS DISTINCT FROM COALESCE(EXCLUDED.tipo_artigo, public.movimentos_linhas.tipo_artigo)
            OR public.movimentos_linhas.armazem IS DISTINCT FROM EXCLUDED.armazem
            OR public.movimentos_linhas.localizacao IS DISTINCT FROM EXCLUDED.localizacao
            OR public.movimentos_linhas.lote IS DISTINCT FROM EXCLUDED.lote
            OR public.movimentos_linhas.nr_serie IS DISTINCT FROM EXCLUDED.nr_serie
            OR public.movimentos_linhas.quantidade IS DISTINCT FROM EXCLUDED.quantidade
            OR public.movimentos_linhas.familia IS DISTINCT FROM COALESCE(EXCLUDED.familia, public.movimentos_linhas.familia)
            OR public.movimentos_linhas.sub_familia IS DISTINCT FROM COALESCE(EXCLUDED.sub_familia, public.movimentos_linhas.sub_familia)
            OR public.movimentos_linhas.data_fabrico IS DISTINCT FROM EXCLUDED.data_fabrico
            OR public.movimentos_linhas.validade IS DISTINCT FROM EXCLUDED.validade
            OR public.movimentos_linhas.tipo_movimento IS DISTINCT FROM EXCLUDED.tipo_movimento
            OR public.movimentos_linhas.tipo_armazem IS DISTINCT FROM EXCLUDED.tipo_armazem
            OR public.movimentos_linhas.armazem_loc IS DISTINCT FROM EXCLUDED.armazem_loc
            OR public.movimentos_linhas.entidade IS DISTINCT FROM COALESCE(EXCLUDED.entidade, public.movimentos_linhas.entidade)
            OR public.movimentos_linhas.total_iva IS DISTINCT FROM EXCLUDED.total_iva
            OR public.movimentos_linhas.total_merc IS DISTINCT FROM EXCLUDED.total_merc
            OR public.movimentos_linhas.total_outros IS DISTINCT FROM EXCLUDED.total_outros
            OR public.movimentos_linhas.total_desc IS DISTINCT FROM EXCLUDED.total_desc
            OR public.movimentos_linhas.requisicao IS DISTINCT FROM COALESCE(EXCLUDED.requisicao, public.movimentos_linhas.requisicao)
            OR public.movimentos_linhas.ref_ser IS DISTINCT FROM COALESCE(EXCLUDED.ref_ser, public.movimentos_linhas.ref_ser)
            OR public.movimentos_linhas.num_contribuinte IS DISTINCT FROM COALESCE(EXCLUDED.num_contribuinte, public.movimentos_linhas.num_contribuinte)
            OR public.movimentos_linhas.nome IS DISTINCT FROM COALESCE(EXCLUDED.nome, public.movimentos_linhas.nome)
            OR public.movimentos_linhas.morada IS DISTINCT FROM COALESCE(EXCLUDED.morada, public.movimentos_linhas.morada)
            OR public.movimentos_linhas.localidade IS DISTINCT FROM COALESCE(EXCLUDED.localidade, public.movimentos_linhas.localidade)
            OR public.movimentos_linhas.cod_postal IS DISTINCT FROM COALESCE(EXCLUDED.cod_postal, public.movimentos_linhas.cod_postal)
            OR public.movimentos_linhas.pais IS DISTINCT FROM COALESCE(EXCLUDED.pais, public.movimentos_linhas.pais)
            OR public.movimentos_linhas.nome_entrega IS DISTINCT FROM COALESCE(EXCLUDED.nome_entrega, public.movimentos_linhas.nome_entrega)
            OR public.movimentos_linhas.entidade_entrega IS DISTINCT FROM COALESCE(EXCLUDED.entidade_entrega, public.movimentos_linhas.entidade_entrega)
            OR public.movimentos_linhas.morada_entrega IS DISTINCT FROM COALESCE(EXCLUDED.morada_entrega, public.movimentos_linhas.morada_entrega)
            OR public.movimentos_linhas.localidade_entrega IS DISTINCT FROM COALESCE(EXCLUDED.localidade_entrega, public.movimentos_linhas.localidade_entrega)
            OR public.movimentos_linhas.cod_postal_entrega IS DISTINCT FROM COALESCE(EXCLUDED.cod_postal_entrega, public.movimentos_linhas.cod_postal_entrega)
            OR public.movimentos_linhas.observacoes IS DISTINCT FROM COALESCE(EXCLUDED.observacoes, public.movimentos_linhas.observacoes);

        GET DIAGNOSTICS v_upserted_lines = ROW_COUNT;
    ELSE
        WITH distinct_lines AS (
            SELECT DISTINCT ON (t.doc_linha)
                t.*
            FROM tmp_access_mov_sync t
            WHERE t.doc_linha IS NOT NULL
              AND (t.artigo_id IS NOT NULL OR t.descricao IS NOT NULL)
            ORDER BY t.doc_linha, t.row_idx ASC
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
            nr_serie,
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
            ref_ser,
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
            l.artigo_id,
            l.artigo_id,
            l.artigo_cli,
            l.descricao,
            l.tipo_artigo,
            l.armazem,
            l.localizacao,
            l.localizacao,
            l.lote,
            l.nr_serie,
            l.quantidade,
            l.familia,
            l.sub_familia,
            l.data_fabrico,
            l.validade,
            l.tipo_movimento_line,
            l.tipo_armazem,
            l.armazem_loc,
            l.entidade,
            l.total_iva,
            l.total_merc,
            l.total_outros,
            l.total_desc,
            l.total_desc,
            l.requisicao,
            l.ref_ser,
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
            l.observacoes,
            now()
        FROM distinct_lines l
        ON CONFLICT (doc_linha) DO NOTHING;

        GET DIAGNOSTICS v_upserted_lines = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_headers', v_deleted_headers,
        'deleted_lines', v_deleted_lines,
        'upserted_headers', v_upserted_headers,
        'upserted_lines', v_upserted_lines,
        'clientes', to_jsonb(v_clientes)
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_parse_access_numeric(text, numeric) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_movimentos_from_access(jsonb, boolean, boolean, boolean) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

