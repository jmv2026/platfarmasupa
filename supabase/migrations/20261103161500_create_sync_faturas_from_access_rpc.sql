-- =====================================================================================
-- MIGRAÇÃO: Sincronização direta da tabela public.faturas a partir de Query / Tabela
--           do MS Access (via RPC JSONB em lotes)
-- =====================================================================================

CREATE OR REPLACE FUNCTION public.sync_faturas_from_access(
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
    v_deleted_count integer := 0;
    v_upserted_count integer := 0;
    v_clientes text[];
    v_cli_primaveras text[];
BEGIN
    IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Nenhum registo enviado no array JSON (p_rows).'
        );
    END IF;

    DROP TABLE IF EXISTS tmp_access_faturas_sync;

    -- Criar tabela temporária da transação com as colunas normalizadas de public.faturas
    CREATE TEMP TABLE tmp_access_faturas_sync ON COMMIT DROP AS
    WITH raw_items AS (
        SELECT
            ordinality AS row_idx,
            NULLIF(TRIM(COALESCE(
                r->>'documento_ref', r->>'Documento_Ref', r->>'DOCUMENTO_REF',
                r->>'DocumentoRef', r->>'documentoref',
                r->>'documento_ser', r->>'Documento_Ser', r->>'DOCUMENTO_SER',
                r->>'DocumentoSer', r->>'documentoser',
                r->>'ref_ser', r->>'Ref_Ser', r->>'REF_SER'
            )), '') AS raw_documento_ref,
            NULLIF(TRIM(COALESCE(
                r->>'documento', r->>'Documento', r->>'DOCUMENTO',
                r->>'doc', r->>'Doc', r->>'DOC'
            )), '') AS raw_documento,
            public.fn_parse_access_date(COALESCE(
                r->>'data', r->>'Data', r->>'DATA',
                r->>'data_fatura', r->>'Data_Fatura', r->>'DataFatura',
                r->>'data_doc', r->>'Data_Doc', r->>'DataDoc'
            ), false) AS raw_data,
            NULLIF(TRIM(COALESCE(
                r->>'entidade', r->>'Entidade', r->>'ENTIDADE'
            )), '') AS raw_entidade,
            NULLIF(TRIM(COALESCE(
                r->>'tipo_doc', r->>'Tipo_Doc', r->>'TIPO_DOC',
                r->>'TipoDoc', r->>'tipodoc'
            )), '') AS raw_tipo_doc,
            NULLIF(TRIM(COALESCE(
                r->>'num_doc', r->>'Num_Doc', r->>'NUM_DOC',
                r->>'NumDoc', r->>'numdoc'
            )), '') AS raw_num_doc,
            NULLIF(TRIM(COALESCE(
                r->>'requisicao', r->>'Requisicao', r->>'REQUISICAO',
                r->>'vosso_doc', r->>'Vosso_Doc', r->>'VossoDoc'
            )), '') AS raw_requisicao,
            NULLIF(TRIM(COALESCE(
                r->>'num_contribuinte', r->>'Num_Contribuinte', r->>'NUM_CONTRIBUINTE',
                r->>'NumContribuinte', r->>'numcontribuinte',
                r->>'nif', r->>'NIF'
            )), '') AS raw_num_contribuinte,
            public.fn_parse_access_numeric(COALESCE(
                r->>'total_iva', r->>'Total_Iva', r->>'TOTAL_IVA',
                r->>'TotalIva', r->>'totaliva', r->>'TotalIVA'
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
                r->>'total_desc', r->>'Total_Desc', r->>'TOTAL_DESC',
                r->>'TotalDesc', r->>'totaldesc'
            ), 0) AS raw_total_desc,
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
                r->>'morada_entrega', r->>'Morada_Entrega', r->>'MORADA_ENTREGA',
                r->>'MoradaEntrega', r->>'moradaentrega'
            )), '') AS raw_morada_entrega,
            NULLIF(TRIM(COALESCE(
                r->>'cod_postal_localidade_entrega', r->>'Cod_Postal_Localidade_Entrega', r->>'COD_POSTAL_LOCALIDADE_ENTREGA',
                r->>'CodPostalLocalidadeEntrega', r->>'codpostallocalidadeentrega'
            )), '') AS raw_cod_postal_localidade_entrega,
            NULLIF(TRIM(COALESCE(
                r->>'cod_postal_entrega', r->>'Cod_Postal_Entrega', r->>'COD_POSTAL_ENTREGA',
                r->>'CodPostalEntrega', r->>'codpostalentrega'
            )), '') AS raw_cod_postal_entrega,
            NULLIF(TRIM(COALESCE(
                r->>'localidade_entrega', r->>'Localidade_Entrega', r->>'LOCALIDADE_ENTREGA',
                r->>'LocalidadeEntrega', r->>'localidadeentrega'
            )), '') AS raw_localidade_entrega,
            NULLIF(TRIM(COALESCE(
                r->>'entidade_entrega', r->>'Entidade_Entrega', r->>'ENTIDADE_ENTREGA',
                r->>'EntidadeEntrega', r->>'entidadeentrega'
            )), '') AS raw_entidade_entrega,
            NULLIF(TRIM(COALESCE(
                r->>'cli_primavera', r->>'Cli_Primavera', r->>'CLI_PRIMAVERA',
                r->>'CliPrimavera', r->>'cliprimavera',
                r->>'cliente_primavera', r->>'Cliente_Primavera'
            )), '') AS raw_cli_primavera,
            NULLIF(TRIM(COALESCE(
                r->>'sigla', r->>'Sigla', r->>'SIGLA'
            )), '') AS raw_sigla,
            NULLIF(TRIM(COALESCE(
                r->>'cliente_ser', r->>'Cliente_Ser', r->>'CLIENTE_SER',
                r->>'ClienteSer', r->>'clienteser',
                r->>'cliente', r->>'Cliente', r->>'CLIENTE'
            )), '') AS raw_cliente_ser
        FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(r, ordinality)
    ),
    resolved AS (
        SELECT
            ri.*,
            UPPER(COALESCE(
                c.sigla,
                ri.raw_sigla,
                CASE
                    WHEN ri.raw_documento_ref IS NOT NULL AND position('-' in ri.raw_documento_ref) > 0
                    THEN split_part(ri.raw_documento_ref, '-', 1)
                    ELSE NULL
                END
            )) AS resolved_sigla,
            COALESCE(c.cli_primavera, ri.raw_cli_primavera) AS resolved_cli_primavera,
            COALESCE(ri.raw_cliente_ser, c.name, c.sigla, ri.raw_sigla) AS resolved_cliente_ser
        FROM raw_items ri
        LEFT JOIN LATERAL (
            SELECT c1.id, c1.name, c1.sigla, c1.cli_primavera
            FROM public.clientes c1
            WHERE (ri.raw_cli_primavera IS NOT NULL AND TRIM(c1.cli_primavera) = ri.raw_cli_primavera)
               OR (ri.raw_sigla IS NOT NULL AND UPPER(TRIM(c1.sigla)) = UPPER(ri.raw_sigla))
               OR (ri.raw_cliente_ser IS NOT NULL AND (
                    UPPER(TRIM(c1.sigla)) = UPPER(ri.raw_cliente_ser)
                    OR UPPER(TRIM(c1.name)) = UPPER(ri.raw_cliente_ser)
                    OR UPPER(TRIM(c1.name)) LIKE UPPER(ri.raw_cliente_ser) || '%'
                  ))
               OR (ri.raw_sigla IS NULL AND ri.raw_documento_ref IS NOT NULL AND position('-' in ri.raw_documento_ref) > 0
                   AND UPPER(TRIM(c1.sigla)) = UPPER(split_part(ri.raw_documento_ref, '-', 1)))
            ORDER BY
                CASE
                    WHEN ri.raw_cli_primavera IS NOT NULL AND TRIM(c1.cli_primavera) = ri.raw_cli_primavera THEN 1
                    WHEN ri.raw_sigla IS NOT NULL AND UPPER(TRIM(c1.sigla)) = UPPER(ri.raw_sigla) THEN 2
                    WHEN ri.raw_cliente_ser IS NOT NULL AND UPPER(TRIM(c1.sigla)) = UPPER(ri.raw_cliente_ser) THEN 3
                    WHEN ri.raw_cliente_ser IS NOT NULL AND UPPER(TRIM(c1.name)) LIKE UPPER(ri.raw_cliente_ser) || '%' THEN 4
                    ELSE 5
                END
            LIMIT 1
        ) c ON true
        WHERE COALESCE(ri.raw_documento_ref, ri.raw_documento) IS NOT NULL
    )
    SELECT
        r.row_idx,
        COALESCE(
            r.raw_documento_ref,
            CASE
                WHEN r.resolved_sigla IS NOT NULL AND r.raw_documento IS NOT NULL
                THEN r.resolved_sigla || '-' || r.raw_documento
                ELSE r.raw_documento
            END
        ) AS documento_ref,
        r.raw_data AS data,
        r.raw_entidade AS entidade,
        UPPER(COALESCE(
            r.raw_tipo_doc,
            CASE
                WHEN r.raw_documento IS NOT NULL AND TRIM(r.raw_documento) <> ''
                THEN split_part(TRIM(r.raw_documento), ' ', 1)
                WHEN r.raw_documento_ref LIKE '%-FA %' THEN 'FA'
                WHEN r.raw_documento_ref LIKE '%-NC %' THEN 'NC'
                WHEN r.raw_documento_ref LIKE '%-NCE %' THEN 'NCE'
                WHEN r.raw_documento_ref LIKE '%-ND %' THEN 'ND'
                ELSE NULL
            END
        )) AS tipo_doc,
        COALESCE(
            r.raw_num_doc,
            CASE
                WHEN position('/' in COALESCE(r.raw_documento, '')) > 0
                THEN split_part(r.raw_documento, '/', 2)
                WHEN position('/' in COALESCE(r.raw_documento_ref, '')) > 0
                THEN split_part(r.raw_documento_ref, '/', 2)
                ELSE NULL
            END
        ) AS num_doc,
        COALESCE(
            r.raw_documento,
            CASE
                WHEN r.raw_documento_ref IS NOT NULL AND position('-' in r.raw_documento_ref) > 0
                THEN substring(r.raw_documento_ref from position('-' in r.raw_documento_ref) + 1)
                ELSE r.raw_documento_ref
            END
        ) AS documento,
        r.raw_requisicao AS requisicao,
        r.raw_num_contribuinte AS num_contribuinte,
        r.raw_total_iva AS total_iva,
        r.raw_total_merc AS total_merc,
        r.raw_total_outros AS total_outros,
        r.raw_total_desc AS total_desc,
        r.raw_nome AS nome,
        r.raw_morada AS morada,
        r.raw_localidade AS localidade,
        r.raw_cod_postal AS cod_postal,
        r.raw_cod_postal_localidade AS cod_postal_localidade,
        r.raw_pais AS pais,
        r.raw_nome_entrega AS nome_entrega,
        r.raw_morada_entrega AS morada_entrega,
        r.raw_cod_postal_localidade_entrega AS cod_postal_localidade_entrega,
        r.raw_cod_postal_entrega AS cod_postal_entrega,
        r.raw_localidade_entrega AS localidade_entrega,
        r.raw_entidade_entrega AS entidade_entrega,
        r.resolved_cli_primavera AS cli_primavera,
        r.resolved_sigla AS sigla,
        r.resolved_cliente_ser AS cliente_ser
    FROM resolved r;

    -- Verificar se existem registos válidos para sincronizar
    IF NOT EXISTS (SELECT 1 FROM tmp_access_faturas_sync WHERE documento_ref IS NOT NULL) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Nenhum registo válido de fatura encontrado (verifique se a query contém documento_ref ou documento).'
        );
    END IF;

    SELECT
        array_agg(DISTINCT UPPER(TRIM(sigla))) FILTER (WHERE sigla IS NOT NULL),
        array_agg(DISTINCT TRIM(cli_primavera)) FILTER (WHERE cli_primavera IS NOT NULL)
    INTO v_clientes, v_cli_primaveras
    FROM tmp_access_faturas_sync;

    -- 1º Passo (Opcional): Limpar faturas anteriores caso solicitado (p_limpar_tudo ou p_limpar_clientes)
    IF COALESCE(p_limpar_tudo, false) THEN
        DELETE FROM public.faturas
        WHERE documento_ref IS NOT NULL;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    ELSIF COALESCE(p_limpar_clientes, false) THEN
        DELETE FROM public.faturas
        WHERE documento_ref IS NOT NULL
          AND (
              (v_clientes IS NOT NULL AND UPPER(TRIM(sigla)) = ANY(v_clientes))
              OR (v_cli_primaveras IS NOT NULL AND TRIM(cli_primavera) = ANY(v_cli_primaveras))
          );
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    END IF;

    -- 2º Passo: Inserir / Atualizar faturas em public.faturas
    IF COALESCE(p_atualizar_existentes, true) THEN
        WITH distinct_faturas AS (
            SELECT DISTINCT ON (t.documento_ref)
                t.*
            FROM tmp_access_faturas_sync t
            WHERE t.documento_ref IS NOT NULL
            ORDER BY t.documento_ref, t.row_idx ASC
        )
        INSERT INTO public.faturas (
            documento_ref,
            data,
            entidade,
            tipo_doc,
            num_doc,
            documento,
            requisicao,
            num_contribuinte,
            total_iva,
            total_merc,
            total_outros,
            total_desc,
            nome,
            morada,
            localidade,
            cod_postal,
            cod_postal_localidade,
            pais,
            nome_entrega,
            morada_entrega,
            cod_postal_localidade_entrega,
            cod_postal_entrega,
            localidade_entrega,
            entidade_entrega,
            cli_primavera,
            sigla,
            cliente_ser
        )
        SELECT
            f.documento_ref,
            f.data,
            f.entidade,
            f.tipo_doc,
            f.num_doc,
            f.documento,
            f.requisicao,
            f.num_contribuinte,
            f.total_iva,
            f.total_merc,
            f.total_outros,
            f.total_desc,
            f.nome,
            f.morada,
            f.localidade,
            f.cod_postal,
            f.cod_postal_localidade,
            f.pais,
            f.nome_entrega,
            f.morada_entrega,
            f.cod_postal_localidade_entrega,
            f.cod_postal_entrega,
            f.localidade_entrega,
            f.entidade_entrega,
            f.cli_primavera,
            f.sigla,
            f.cliente_ser
        FROM distinct_faturas f
        ON CONFLICT (documento_ref) DO UPDATE SET
            data = COALESCE(EXCLUDED.data, public.faturas.data),
            entidade = COALESCE(EXCLUDED.entidade, public.faturas.entidade),
            tipo_doc = COALESCE(EXCLUDED.tipo_doc, public.faturas.tipo_doc),
            num_doc = COALESCE(EXCLUDED.num_doc, public.faturas.num_doc),
            documento = COALESCE(EXCLUDED.documento, public.faturas.documento),
            requisicao = COALESCE(EXCLUDED.requisicao, public.faturas.requisicao),
            num_contribuinte = COALESCE(EXCLUDED.num_contribuinte, public.faturas.num_contribuinte),
            total_iva = EXCLUDED.total_iva,
            total_merc = EXCLUDED.total_merc,
            total_outros = EXCLUDED.total_outros,
            total_desc = EXCLUDED.total_desc,
            nome = COALESCE(EXCLUDED.nome, public.faturas.nome),
            morada = COALESCE(EXCLUDED.morada, public.faturas.morada),
            localidade = COALESCE(EXCLUDED.localidade, public.faturas.localidade),
            cod_postal = COALESCE(EXCLUDED.cod_postal, public.faturas.cod_postal),
            cod_postal_localidade = COALESCE(EXCLUDED.cod_postal_localidade, public.faturas.cod_postal_localidade),
            pais = COALESCE(EXCLUDED.pais, public.faturas.pais),
            nome_entrega = COALESCE(EXCLUDED.nome_entrega, public.faturas.nome_entrega),
            morada_entrega = COALESCE(EXCLUDED.morada_entrega, public.faturas.morada_entrega),
            cod_postal_localidade_entrega = COALESCE(EXCLUDED.cod_postal_localidade_entrega, public.faturas.cod_postal_localidade_entrega),
            cod_postal_entrega = COALESCE(EXCLUDED.cod_postal_entrega, public.faturas.cod_postal_entrega),
            localidade_entrega = COALESCE(EXCLUDED.localidade_entrega, public.faturas.localidade_entrega),
            entidade_entrega = COALESCE(EXCLUDED.entidade_entrega, public.faturas.entidade_entrega),
            cli_primavera = COALESCE(EXCLUDED.cli_primavera, public.faturas.cli_primavera),
            sigla = COALESCE(EXCLUDED.sigla, public.faturas.sigla),
            cliente_ser = COALESCE(EXCLUDED.cliente_ser, public.faturas.cliente_ser);

        GET DIAGNOSTICS v_upserted_count = ROW_COUNT;
    ELSE
        WITH distinct_faturas AS (
            SELECT DISTINCT ON (t.documento_ref)
                t.*
            FROM tmp_access_faturas_sync t
            WHERE t.documento_ref IS NOT NULL
            ORDER BY t.documento_ref, t.row_idx ASC
        )
        INSERT INTO public.faturas (
            documento_ref,
            data,
            entidade,
            tipo_doc,
            num_doc,
            documento,
            requisicao,
            num_contribuinte,
            total_iva,
            total_merc,
            total_outros,
            total_desc,
            nome,
            morada,
            localidade,
            cod_postal,
            cod_postal_localidade,
            pais,
            nome_entrega,
            morada_entrega,
            cod_postal_localidade_entrega,
            cod_postal_entrega,
            localidade_entrega,
            entidade_entrega,
            cli_primavera,
            sigla,
            cliente_ser
        )
        SELECT
            f.documento_ref,
            f.data,
            f.entidade,
            f.tipo_doc,
            f.num_doc,
            f.documento,
            f.requisicao,
            f.num_contribuinte,
            f.total_iva,
            f.total_merc,
            f.total_outros,
            f.total_desc,
            f.nome,
            f.morada,
            f.localidade,
            f.cod_postal,
            f.cod_postal_localidade,
            f.pais,
            f.nome_entrega,
            f.morada_entrega,
            f.cod_postal_localidade_entrega,
            f.cod_postal_entrega,
            f.localidade_entrega,
            f.entidade_entrega,
            f.cli_primavera,
            f.sigla,
            f.cliente_ser
        FROM distinct_faturas f
        ON CONFLICT (documento_ref) DO NOTHING;

        GET DIAGNOSTICS v_upserted_count = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'deleted', v_deleted_count,
        'upserted', v_upserted_count,
        'clientes', COALESCE(to_jsonb(v_clientes), '[]'::jsonb)
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sync_faturas_from_access(jsonb, boolean, boolean, boolean) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

