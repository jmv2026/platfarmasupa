-- =====================================================================================
-- MIGRAÇÃO: Sincronização direta da tabela public.stock a partir de Query do MS Access
-- =====================================================================================

-- 1. Função auxiliar para converter datas vindas do MS Access (YYYY-MM-DD ou DD/MM/YYYY)
CREATE OR REPLACE FUNCTION public.fn_parse_access_date(
    p_val text,
    p_ignore_1980 boolean DEFAULT false
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
    v_clean text;
    v_date date;
BEGIN
    IF p_val IS NULL THEN
        RETURN NULL;
    END IF;

    -- Remover parte horária se existir (ex: '2026-10-29 00:00:00' ou '2026-10-29T00:00:00')
    v_clean := TRIM(split_part(split_part(TRIM(p_val), ' ', 1), 'T', 1));

    IF v_clean = '' OR LOWER(v_clean) = 'null' THEN
        RETURN NULL;
    END IF;

    BEGIN
        IF v_clean ~ '^\d{4}-\d{2}-\d{2}$' THEN
            v_date := to_date(v_clean, 'YYYY-MM-DD');
        ELSIF v_clean ~ '^\d{2}/\d{2}/\d{4}$' THEN
            v_date := to_date(v_clean, 'DD/MM/YYYY');
        ELSIF v_clean ~ '^\d{2}-\d{2}-\d{4}$' THEN
            v_date := to_date(v_clean, 'DD-MM-YYYY');
        ELSIF v_clean ~ '^\d{4}/\d{2}/\d{2}$' THEN
            v_date := to_date(v_clean, 'YYYY/MM/DD');
        ELSE
            v_date := v_clean::date;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;

    -- Ignorar datas sentinela do Access / Primavera (1899-12-30 ou 1980-01-01 para data_fabrico)
    IF v_date <= '1900-01-01'::date THEN
        RETURN NULL;
    END IF;

    IF p_ignore_1980 AND v_date = '1980-01-01'::date THEN
        RETURN NULL;
    END IF;

    RETURN v_date;
END;
$function$;

-- 2. Função RPC principal para atualizar public.stock a partir do MS Access (em lote JSONB)
CREATE OR REPLACE FUNCTION public.sync_stock_from_access(
    p_rows jsonb,
    p_limpar_tudo boolean DEFAULT false,
    p_limpar_clientes boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $function$
DECLARE
    v_deleted_count integer := 0;
    v_inserted_count integer := 0;
    v_clientes text[];
BEGIN
    IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Nenhum registo enviado no array JSON (p_rows).'
        );
    END IF;

    DROP TABLE IF EXISTS tmp_access_stock_sync;

    -- Criar tabela temporária da transação com os dados normalizados da query do MS Access
    CREATE TEMP TABLE tmp_access_stock_sync ON COMMIT DROP AS
    WITH raw_items AS (
        SELECT
            NULLIF(TRIM(COALESCE(
                r->>'cliente_ser', r->>'Cliente_Ser', r->>'CLIENTE_SER',
                r->>'sigla', r->>'Sigla', r->>'SIGLA'
            )), '') AS raw_sigla,
            NULLIF(TRIM(COALESCE(
                r->>'entidade', r->>'Entidade', r->>'ENTIDADE',
                r->>'cli_primavera', r->>'Cli_Primavera', r->>'CLI_PRIMAVERA'
            )), '') AS raw_entidade,
            NULLIF(TRIM(COALESCE(
                r->>'artigo_id', r->>'Artigo_Id', r->>'ARTIGO_ID',
                r->>'artigo', r->>'Artigo', r->>'ARTIGO'
            )), '') AS raw_artigo,
            NULLIF(TRIM(COALESCE(
                r->>'descricao', r->>'Descricao', r->>'DESCRICAO'
            )), '') AS raw_descricao,
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
            COALESCE(
                NULLIF(REPLACE(TRIM(COALESCE(
                    r->>'stock', r->>'Stock', r->>'STOCK',
                    r->>'quantidade', r->>'Quantidade', r->>'QUANTIDADE'
                )), ',', '.'), '')::numeric,
                0
            ) AS raw_stock,
            public.fn_parse_access_date(COALESCE(
                r->>'data_stock', r->>'Data_Stock', r->>'DATA_STOCK',
                r->>'DataStock', r->>'datastock'
            ), false) AS raw_data_stock,
            public.fn_parse_access_date(COALESCE(
                r->>'data_fabrico', r->>'Data_Fabrico', r->>'DATA_FABRICO',
                r->>'DataFabrico', r->>'datafabrico'
            ), true) AS raw_data_fabrico,
            public.fn_parse_access_date(COALESCE(
                r->>'validade', r->>'Validade', r->>'VALIDADE'
            ), false) AS raw_validade
        FROM jsonb_array_elements(p_rows) AS r
    )
    SELECT
        UPPER(COALESCE(c.sigla, ri.raw_sigla, LEFT(ri.raw_armazem, 3))) AS cliente_ser,
        COALESCE(ri.raw_entidade, c.cli_primavera) AS entidade,
        UPPER(COALESCE(c.sigla, ri.raw_sigla, LEFT(ri.raw_armazem, 3))) AS sigla,
        ri.raw_artigo AS artigo_id,
        ri.raw_descricao AS descricao,
        ri.raw_armazem AS armazem,
        ri.raw_localizacao AS localizacao,
        ri.raw_lote AS lote,
        ri.raw_stock AS stock,
        COALESCE(ri.raw_data_stock, CURRENT_DATE) AS data_stock,
        ri.raw_data_fabrico AS data_fabrico,
        ri.raw_validade AS validade
    FROM raw_items ri
    LEFT JOIN LATERAL (
        SELECT c1.sigla, c1.cli_primavera
        FROM public.clientes c1
        WHERE (ri.raw_sigla IS NOT NULL AND UPPER(TRIM(c1.sigla)) = UPPER(ri.raw_sigla))
           OR (ri.raw_entidade IS NOT NULL AND TRIM(c1.cli_primavera) = ri.raw_entidade)
           OR (ri.raw_sigla IS NULL AND ri.raw_entidade IS NULL AND ri.raw_armazem IS NOT NULL AND UPPER(TRIM(c1.sigla)) = UPPER(LEFT(ri.raw_armazem, 3)))
        ORDER BY
            CASE
                WHEN ri.raw_sigla IS NOT NULL AND UPPER(TRIM(c1.sigla)) = UPPER(ri.raw_sigla) THEN 1
                WHEN ri.raw_entidade IS NOT NULL AND TRIM(c1.cli_primavera) = ri.raw_entidade THEN 2
                ELSE 3
            END
        LIMIT 1
    ) c ON true
    WHERE ri.raw_artigo IS NOT NULL
      AND ri.raw_armazem IS NOT NULL
      AND COALESCE(c.sigla, ri.raw_sigla, LEFT(ri.raw_armazem, 3)) IS NOT NULL;

    -- Obter lista de clientes presentes no lote enviado
    SELECT array_agg(DISTINCT UPPER(TRIM(cliente_ser)))
    INTO v_clientes
    FROM tmp_access_stock_sync
    WHERE cliente_ser IS NOT NULL;

    IF v_clientes IS NULL OR array_length(v_clientes, 1) IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Nenhum registo válido encontrado (verifique se a query contém artigo, armazem e sigla/entidade).'
        );
    END IF;

    -- 1º Passo: Limpar stock anterior (total ou apenas dos clientes enviados)
    -- Nota: WHERE id IS NOT NULL respeita a proteção safeupdate do Supabase
    IF COALESCE(p_limpar_tudo, false) THEN
        DELETE FROM public.stock
        WHERE id IS NOT NULL;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    ELSIF COALESCE(p_limpar_clientes, true) THEN
        DELETE FROM public.stock
        WHERE id IS NOT NULL
          AND UPPER(TRIM(cliente_ser)) = ANY(v_clientes);
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    END IF;

    -- 2º Passo: Inserir o novo snapshot de stock
    INSERT INTO public.stock (
        cliente_ser,
        entidade,
        sigla,
        artigo_id,
        descricao,
        armazem,
        localizacao,
        lote,
        stock,
        data_stock,
        data_fabrico,
        validade
    )
    SELECT
        t.cliente_ser,
        t.entidade,
        t.sigla,
        t.artigo_id,
        t.descricao,
        t.armazem,
        t.localizacao,
        t.lote,
        t.stock,
        t.data_stock,
        t.data_fabrico,
        t.validade
    FROM tmp_access_stock_sync t;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'deleted', v_deleted_count,
        'inserted', v_inserted_count,
        'clientes', to_jsonb(v_clientes)
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_parse_access_date(text, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_stock_from_access(jsonb, boolean, boolean) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
