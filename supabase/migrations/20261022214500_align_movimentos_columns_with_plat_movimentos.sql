-- ==============================================================================
-- Migration: 20261022214500_align_movimentos_columns_with_plat_movimentos.sql
-- Descrição: Ajustar as colunas da tabela public.movimentos de forma a coincidir
--            exatamente com os campos de cabeçalho da tabela plat_movimentos:
--            data; cli_primavera; cliente_ser; tipomovimento; documento;
--            chave1; chave2; entidade; totaliva; totalmerc; totaloutros;
--            totaldesc; requisicao; numcontribuinte; nome; morada; localidade;
--            codpostal; codpostallocalidade; pais; nomeentrega; entidadeentrega;
--            moradaentrega; localidadeentrega; codpostalentrega
-- ==============================================================================

-- 1. Adicionar as colunas na tabela public.movimentos
ALTER TABLE public.movimentos
    ADD COLUMN IF NOT EXISTS data DATE,
    ADD COLUMN IF NOT EXISTS cli_primavera TEXT,
    ADD COLUMN IF NOT EXISTS cliente_ser TEXT,
    ADD COLUMN IF NOT EXISTS tipomovimento TEXT,
    ADD COLUMN IF NOT EXISTS totaliva NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS totalmerc NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS totaloutros NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS totaldesc NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS numcontribuinte TEXT,
    ADD COLUMN IF NOT EXISTS codpostal TEXT,
    ADD COLUMN IF NOT EXISTS codpostallocalidade TEXT,
    ADD COLUMN IF NOT EXISTS nomeentrega TEXT,
    ADD COLUMN IF NOT EXISTS entidadeentrega TEXT,
    ADD COLUMN IF NOT EXISTS moradaentrega TEXT,
    ADD COLUMN IF NOT EXISTS localidadeentrega TEXT,
    ADD COLUMN IF NOT EXISTS codpostalentrega TEXT;

-- 2. Comentários para clarificação do alinhamento com plat_movimentos
COMMENT ON COLUMN public.movimentos.data IS 'Data do movimento (coincide com plat_movimentos.data)';
COMMENT ON COLUMN public.movimentos.cli_primavera IS 'Código de cliente no ERP Primavera (coincide com plat_movimentos.cli_primavera)';
COMMENT ON COLUMN public.movimentos.cliente_ser IS 'Identificador do cliente SER (coincide com plat_movimentos.cliente_ser)';
COMMENT ON COLUMN public.movimentos.tipomovimento IS 'Tipo de movimento ERP (coincide com plat_movimentos.tipomovimento)';
COMMENT ON COLUMN public.movimentos.documento IS 'Número de documento (coincide com plat_movimentos.documento)';
COMMENT ON COLUMN public.movimentos.totaliva IS 'Total IVA do documento (coincide com plat_movimentos.totaliva)';
COMMENT ON COLUMN public.movimentos.totalmerc IS 'Total mercadoria do documento (coincide com plat_movimentos.totalmerc)';
COMMENT ON COLUMN public.movimentos.totaloutros IS 'Total outros valores (coincide com plat_movimentos.totaloutros)';
COMMENT ON COLUMN public.movimentos.totaldesc IS 'Total descontos (coincide com plat_movimentos.totaldesc)';
COMMENT ON COLUMN public.movimentos.numcontribuinte IS 'NIF / Nº Contribuinte (coincide com plat_movimentos.numcontribuinte)';
COMMENT ON COLUMN public.movimentos.codpostal IS 'Código Postal (coincide com plat_movimentos.codpostal)';
COMMENT ON COLUMN public.movimentos.codpostallocalidade IS 'Localidade do Código Postal (coincide com plat_movimentos.codpostallocalidade)';
COMMENT ON COLUMN public.movimentos.nomeentrega IS 'Nome do destinatário de entrega (coincide com plat_movimentos.nomeentrega)';
COMMENT ON COLUMN public.movimentos.entidadeentrega IS 'Entidade de entrega (coincide com plat_movimentos.entidadeentrega)';
COMMENT ON COLUMN public.movimentos.moradaentrega IS 'Morada de entrega (coincide com plat_movimentos.moradaentrega)';
COMMENT ON COLUMN public.movimentos.localidadeentrega IS 'Localidade de entrega (coincide com plat_movimentos.localidadeentrega)';
COMMENT ON COLUMN public.movimentos.codpostalentrega IS 'Código Postal de entrega (coincide com plat_movimentos.codpostalentrega)';

-- 3. Índices nas novas colunas para aceleração de filtros e agregações
CREATE INDEX IF NOT EXISTS idx_movimentos_data ON public.movimentos(data);
CREATE INDEX IF NOT EXISTS idx_movimentos_cli_primavera ON public.movimentos(cli_primavera);
CREATE INDEX IF NOT EXISTS idx_movimentos_cliente_ser ON public.movimentos(cliente_ser);
CREATE INDEX IF NOT EXISTS idx_movimentos_tipomovimento ON public.movimentos(tipomovimento);

-- 4. Função e Trigger para manter sincronização bidirecional entre as novas colunas e as colunas legado
CREATE OR REPLACE FUNCTION public.fn_sync_movimento_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- 1. Sincronização de Data
    IF NEW.data IS NOT NULL AND NEW.data_movimento IS NULL THEN
        NEW.data_movimento := NEW.data::timestamp with time zone;
    ELSIF NEW.data_movimento IS NOT NULL AND NEW.data IS NULL THEN
        NEW.data := NEW.data_movimento::date;
    END IF;

    -- 2. Sincronização de Tipo de Movimento
    IF NEW.tipomovimento IS NOT NULL AND NEW.tipo_movimento IS NULL THEN
        NEW.tipo_movimento := LOWER(TRIM(NEW.tipomovimento));
    ELSIF NEW.tipo_movimento IS NOT NULL AND NEW.tipomovimento IS NULL THEN
        NEW.tipomovimento := UPPER(TRIM(NEW.tipo_movimento));
    END IF;

    -- 3. Sincronização de Totais
    IF NEW.totaliva IS NOT NULL THEN
        NEW.total_iva := NEW.totaliva;
    ELSIF NEW.total_iva IS NOT NULL THEN
        NEW.totaliva := NEW.total_iva;
    END IF;

    IF NEW.totalmerc IS NOT NULL THEN
        NEW.total_merc := NEW.totalmerc;
    ELSIF NEW.total_merc IS NOT NULL THEN
        NEW.totalmerc := NEW.total_merc;
    END IF;

    IF NEW.totaloutros IS NOT NULL THEN
        NEW.total_outros := NEW.totaloutros;
    ELSIF NEW.total_outros IS NOT NULL THEN
        NEW.totaloutros := NEW.total_outros;
    END IF;

    IF NEW.totaldesc IS NOT NULL THEN
        NEW.total_desc := NEW.totaldesc;
    ELSIF NEW.total_desc IS NOT NULL THEN
        NEW.totaldesc := NEW.total_desc;
    END IF;

    -- 4. Sincronização de Entidade e Morada
    IF NEW.numcontribuinte IS NOT NULL THEN
        NEW.num_contribuinte := NEW.numcontribuinte;
    ELSIF NEW.num_contribuinte IS NOT NULL THEN
        NEW.numcontribuinte := NEW.num_contribuinte;
    END IF;

    IF NEW.codpostal IS NOT NULL THEN
        NEW.cod_postal := NEW.codpostal;
    ELSIF NEW.cod_postal IS NOT NULL THEN
        NEW.codpostal := NEW.cod_postal;
    END IF;

    IF NEW.codpostallocalidade IS NOT NULL THEN
        NEW.cod_postal_localidade := NEW.codpostallocalidade;
    ELSIF NEW.cod_postal_localidade IS NOT NULL THEN
        NEW.codpostallocalidade := NEW.cod_postal_localidade;
    END IF;

    -- 5. Sincronização de Entrega
    IF NEW.nomeentrega IS NOT NULL THEN
        NEW.nome_entrega := NEW.nomeentrega;
        NEW."NomeEntrega" := NEW.nomeentrega;
    ELSIF NEW.nome_entrega IS NOT NULL THEN
        NEW.nomeentrega := NEW.nome_entrega;
    ELSIF NEW."NomeEntrega" IS NOT NULL THEN
        NEW.nomeentrega := NEW."NomeEntrega";
    END IF;

    IF NEW.entidadeentrega IS NOT NULL THEN
        NEW.entidade_entrega := NEW.entidadeentrega;
        NEW."EntidadeEntrega" := NEW.entidadeentrega;
    ELSIF NEW.entidade_entrega IS NOT NULL THEN
        NEW.entidadeentrega := NEW.entidade_entrega;
    ELSIF NEW."EntidadeEntrega" IS NOT NULL THEN
        NEW.entidadeentrega := NEW."EntidadeEntrega";
    END IF;

    IF NEW.moradaentrega IS NOT NULL THEN
        NEW.morada_entrega := NEW.moradaentrega;
        NEW."MoradaEntrega" := NEW.moradaentrega;
    ELSIF NEW.morada_entrega IS NOT NULL THEN
        NEW.moradaentrega := NEW.morada_entrega;
    ELSIF NEW."MoradaEntrega" IS NOT NULL THEN
        NEW.moradaentrega := NEW."MoradaEntrega";
    END IF;

    IF NEW.localidadeentrega IS NOT NULL THEN
        NEW.localidade_entrega := NEW.localidadeentrega;
        NEW."LocalidadeEntrega" := NEW.localidadeentrega;
        NEW.cod_postal_localidade_entrega := NEW.localidadeentrega;
        NEW."CodPostalLocalidadeEntrega" := NEW.localidadeentrega;
    ELSIF NEW."LocalidadeEntrega" IS NOT NULL THEN
        NEW.localidadeentrega := NEW."LocalidadeEntrega";
    ELSIF NEW.localidade_entrega IS NOT NULL THEN
        NEW.localidadeentrega := NEW.localidade_entrega;
    END IF;

    IF NEW.codpostalentrega IS NOT NULL THEN
        NEW.cod_postal_entrega := NEW.codpostalentrega;
        NEW."CodPostalEntrega" := NEW.codpostalentrega;
    ELSIF NEW.cod_postal_entrega IS NOT NULL THEN
        NEW.codpostalentrega := NEW.cod_postal_entrega;
    ELSIF NEW."CodPostalEntrega" IS NOT NULL THEN
        NEW.codpostalentrega := NEW."CodPostalEntrega";
    END IF;

    -- 6. Sincronização de Sigla e Cliente
    IF NEW.cliente_id IS NOT NULL AND NEW.sigla IS NULL THEN
        SELECT sigla INTO NEW.sigla FROM public.clientes WHERE id = NEW.cliente_id;
    END IF;
    IF NEW.sigla IS NOT NULL AND NEW.cliente_ser IS NULL THEN
        NEW.cliente_ser := NEW.sigla;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_movimento_columns ON public.movimentos;
CREATE TRIGGER trg_sync_movimento_columns
BEFORE INSERT OR UPDATE ON public.movimentos
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_movimento_columns();

-- 5. Atualizar a função transferir_plat_movimentos_para_movimentos() para gravar
--    diretamente nas 25 colunas alinhadas com plat_movimentos
CREATE OR REPLACE FUNCTION public.transferir_plat_movimentos_para_movimentos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_doc_count integer := 0;
    v_linhas_count integer := 0;
BEGIN
    -- 1º PASSO: Transferência para movimentos (Cabeçalhos - 25 campos alinhados)
    WITH headers_distinct AS (
        SELECT DISTINCT ON (
            COALESCE(
                COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento,
                p.documento
            )
        )
            -- Identificadores estruturais
            COALESCE(
                COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento,
                p.documento
            ) AS documento_ref,
            COALESCE(c.id, '00000000-0000-0000-0000-000000000000'::uuid) AS cliente_id,
            COALESCE(c.sigla, p.cliente_ser, 'UNK') AS sigla,
            COALESCE(p.chave1, split_part(p.documento, ' ', 1)) AS tipo_doc,

            -- 25 Campos alinhados com plat_movimentos
            p.data,
            p.cli_primavera,
            COALESCE(c.sigla, p.cliente_ser, 'UNK') AS cliente_ser,
            p.tipomovimento,
            p.documento,
            p.chave1,
            p.chave2,
            p.entidade,
            COALESCE(p.totaliva, 0) AS totaliva,
            COALESCE(p.totalmerc, 0) AS totalmerc,
            COALESCE(p.totaloutros, 0) AS totaloutros,
            COALESCE(p.totaldesc, 0) AS totaldesc,
            p.requisicao,
            p.numcontribuinte,
            p.nome,
            p.morada,
            p.localidade,
            p.codpostal,
            p.codpostallocalidade,
            p.pais,
            p.nomeentrega,
            p.entidadeentrega,
            p.moradaentrega,
            p.localidadeentrega,
            p.codpostalentrega,

            -- Campos legado para compatibilidade total
            COALESCE(p.data::timestamp with time zone, now()) AS data_movimento,
            CASE 
                WHEN LOWER(TRIM(p.tipomovimento)) IN ('e', 'es') THEN 'es'
                WHEN LOWER(TRIM(p.tipomovimento)) IN ('s', 'ss') THEN 'ss'
                WHEN LOWER(TRIM(p.tipomovimento)) = 'et' THEN 'et'
                WHEN LOWER(TRIM(p.tipomovimento)) = 'st' THEN 'st'
                ELSE LOWER(TRIM(COALESCE(p.tipomovimento, 'es')))
            END AS tipo_movimento,
            COALESCE(p.totaliva, 0) AS total_iva,
            COALESCE(p.totalmerc, 0) AS total_merc,
            COALESCE(p.totaloutros, 0) AS total_outros,
            COALESCE(p.totaldesc, 0) AS total_desc,
            p.numcontribuinte AS num_contribuinte,
            p.codpostal AS cod_postal,
            p.codpostallocalidade AS cod_postal_localidade,
            p.nomeentrega AS nome_entrega,
            p.entidadeentrega AS entidade_entrega,
            p.moradaentrega AS morada_entrega,
            p.localidadeentrega AS localidade_entrega,
            p.localidadeentrega AS cod_postal_localidade_entrega,
            p.codpostalentrega AS cod_postal_entrega,
            p.nomeentrega AS "NomeEntrega",
            p.entidadeentrega AS "EntidadeEntrega",
            p.moradaentrega AS "MoradaEntrega",
            p.localidadeentrega AS "LocalidadeEntrega",
            p.localidadeentrega AS "CodPostalLocalidadeEntrega",
            p.codpostalentrega AS "CodPostalEntrega",
            now() AS updated_at
        FROM public.plat_movimentos p
        LEFT JOIN public.clientes c ON (
            (c.cli_primavera IS NOT NULL AND TRIM(c.cli_primavera) = TRIM(p.cli_primavera))
            OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(p.cliente_ser))
            OR UPPER(TRIM(c.name)) = UPPER(TRIM(p.cliente_ser))
        )
        WHERE p.documento IS NOT NULL AND TRIM(p.documento) <> ''
        ORDER BY 
            COALESCE(
                COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento,
                p.documento
            ), 
            p.numlinha ASC
    )
    INSERT INTO public.movimentos (
        documento_ref,
        cliente_id,
        sigla,
        tipo_doc,
        -- 25 campos alinhados
        data,
        cli_primavera,
        cliente_ser,
        tipomovimento,
        documento,
        chave1,
        chave2,
        entidade,
        totaliva,
        totalmerc,
        totaloutros,
        totaldesc,
        requisicao,
        numcontribuinte,
        nome,
        morada,
        localidade,
        codpostal,
        codpostallocalidade,
        pais,
        nomeentrega,
        entidadeentrega,
        moradaentrega,
        localidadeentrega,
        codpostalentrega,
        -- campos legado
        data_movimento,
        tipo_movimento,
        total_iva,
        total_merc,
        total_outros,
        total_desc,
        num_contribuinte,
        cod_postal,
        cod_postal_localidade,
        nome_entrega,
        entidade_entrega,
        morada_entrega,
        localidade_entrega,
        cod_postal_localidade_entrega,
        cod_postal_entrega,
        "NomeEntrega",
        "EntidadeEntrega",
        "MoradaEntrega",
        "LocalidadeEntrega",
        "CodPostalLocalidadeEntrega",
        "CodPostalEntrega",
        updated_at
    )
    SELECT 
        documento_ref,
        cliente_id,
        sigla,
        tipo_doc,
        -- 25 campos alinhados
        data,
        cli_primavera,
        cliente_ser,
        tipomovimento,
        documento,
        chave1,
        chave2,
        entidade,
        totaliva,
        totalmerc,
        totaloutros,
        totaldesc,
        requisicao,
        numcontribuinte,
        nome,
        morada,
        localidade,
        codpostal,
        codpostallocalidade,
        pais,
        nomeentrega,
        entidadeentrega,
        moradaentrega,
        localidadeentrega,
        codpostalentrega,
        -- campos legado
        data_movimento,
        tipo_movimento,
        total_iva,
        total_merc,
        total_outros,
        total_desc,
        num_contribuinte,
        cod_postal,
        cod_postal_localidade,
        nome_entrega,
        entidade_entrega,
        morada_entrega,
        localidade_entrega,
        cod_postal_localidade_entrega,
        cod_postal_entrega,
        "NomeEntrega",
        "EntidadeEntrega",
        "MoradaEntrega",
        "LocalidadeEntrega",
        "CodPostalLocalidadeEntrega",
        "CodPostalEntrega",
        updated_at
    FROM headers_distinct
    ON CONFLICT (documento_ref) DO UPDATE SET
        cliente_id = EXCLUDED.cliente_id,
        sigla = EXCLUDED.sigla,
        tipo_doc = EXCLUDED.tipo_doc,
        -- 25 campos alinhados
        data = EXCLUDED.data,
        cli_primavera = EXCLUDED.cli_primavera,
        cliente_ser = EXCLUDED.cliente_ser,
        tipomovimento = EXCLUDED.tipomovimento,
        documento = EXCLUDED.documento,
        chave1 = EXCLUDED.chave1,
        chave2 = EXCLUDED.chave2,
        entidade = EXCLUDED.entidade,
        totaliva = EXCLUDED.totaliva,
        totalmerc = EXCLUDED.totalmerc,
        totaloutros = EXCLUDED.totaloutros,
        totaldesc = EXCLUDED.totaldesc,
        requisicao = EXCLUDED.requisicao,
        numcontribuinte = EXCLUDED.numcontribuinte,
        nome = EXCLUDED.nome,
        morada = EXCLUDED.morada,
        localidade = EXCLUDED.localidade,
        codpostal = EXCLUDED.codpostal,
        codpostallocalidade = EXCLUDED.codpostallocalidade,
        pais = EXCLUDED.pais,
        nomeentrega = EXCLUDED.nomeentrega,
        entidadeentrega = EXCLUDED.entidadeentrega,
        moradaentrega = EXCLUDED.moradaentrega,
        localidadeentrega = EXCLUDED.localidadeentrega,
        codpostalentrega = EXCLUDED.codpostalentrega,
        -- campos legado
        data_movimento = EXCLUDED.data_movimento,
        tipo_movimento = EXCLUDED.tipo_movimento,
        total_iva = EXCLUDED.total_iva,
        total_merc = EXCLUDED.total_merc,
        total_outros = EXCLUDED.total_outros,
        total_desc = EXCLUDED.total_desc,
        num_contribuinte = EXCLUDED.num_contribuinte,
        cod_postal = EXCLUDED.cod_postal,
        cod_postal_localidade = EXCLUDED.cod_postal_localidade,
        nome_entrega = EXCLUDED.nome_entrega,
        entidade_entrega = EXCLUDED.entidade_entrega,
        morada_entrega = EXCLUDED.morada_entrega,
        localidade_entrega = EXCLUDED.localidade_entrega,
        cod_postal_localidade_entrega = EXCLUDED.cod_postal_localidade_entrega,
        cod_postal_entrega = EXCLUDED.cod_postal_entrega,
        "NomeEntrega" = EXCLUDED."NomeEntrega",
        "EntidadeEntrega" = EXCLUDED."EntidadeEntrega",
        "MoradaEntrega" = EXCLUDED."MoradaEntrega",
        "LocalidadeEntrega" = EXCLUDED."LocalidadeEntrega",
        "CodPostalLocalidadeEntrega" = EXCLUDED."CodPostalLocalidadeEntrega",
        "CodPostalEntrega" = EXCLUDED."CodPostalEntrega",
        updated_at = now();

    GET DIAGNOSTICS v_doc_count = ROW_COUNT;

    -- 2º PASSO: Transferência para movimentos_linhas
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
        artigo_cli,
        tipo_movimento,
        tipo_armazem,
        armazem_loc,
        posicao,
        sigla,
        updated_at
    )
    SELECT
        COALESCE(p.data::timestamp with time zone, now()) AS data_movimento,
        COALESCE(
            COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento,
            p.documento
        ) AS documento_ref,
        p.numlinha AS num_linha,
        COALESCE(p.doc_linha, COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento || '-' || p.numlinha) AS doc_linha,
        COALESCE(p.valorunitario, 0) AS valor_unitario,
        COALESCE(p.valoradicional, 0) AS valor_adicional,
        COALESCE(p.valorabater, 0) AS valor_abater,
        p.artigo_id AS artigo,
        p.descricao,
        p.tipoartigo AS tipo_artigo,
        p.armazem,
        p.localizacao,
        p.lote,
        COALESCE(p.quantidade, 0) AS quantidade,
        p.familia,
        p.subfamilia AS sub_familia,
        CASE WHEN p.datafabrico = '1980-01-01'::date THEN NULL ELSE p.datafabrico END AS data_fabrico,
        p.validade,
        COALESCE(
            p.artigo_cli,
            COALESCE(c.cli_primavera, p.cli_primavera, UPPER(TRIM(c.sigla)), 'UNK') || '-' || UPPER(TRIM(p.artigo_id)),
            UPPER(TRIM(p.artigo_id))
        ) AS artigo_cli,
        CASE 
            WHEN LOWER(TRIM(p.tipomovimento)) IN ('e', 'es') THEN 'es'
            WHEN LOWER(TRIM(p.tipomovimento)) IN ('s', 'ss') THEN 'ss'
            WHEN LOWER(TRIM(p.tipomovimento)) = 'et' THEN 'et'
            WHEN LOWER(TRIM(p.tipomovimento)) = 'st' THEN 'st'
            ELSE LOWER(TRIM(COALESCE(p.tipomovimento, 'es')))
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
        p.localizacao AS posicao,
        COALESCE(c.sigla, p.cliente_ser, 'UNK') AS sigla,
        now() AS updated_at
    FROM public.plat_movimentos p
    LEFT JOIN public.clientes c ON (
        (c.cli_primavera IS NOT NULL AND TRIM(c.cli_primavera) = TRIM(p.cli_primavera))
        OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(p.cliente_ser))
        OR UPPER(TRIM(c.name)) = UPPER(TRIM(p.cliente_ser))
    )
    WHERE (p.doc_linha IS NOT NULL AND TRIM(p.doc_linha) <> '')
       OR (p.numlinha IS NOT NULL)
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
