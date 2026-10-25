-- Migration: 20261025114500_align_movimentos_and_linhas_with_plat_movimentos.sql
-- Alinhamento dos nomes de campos das tabelas movimentos e movimentos_linhas
-- de acordo com o padrão snake_case da tabela plat_movimentos (43 campos do perfil ERP)
-- e atualização do esquema de importação e sincronização (transferir_plat_movimentos_para_movimentos).

-- =====================================================================================
-- 1. ADICIONAR COLUNAS EM movimentos (Cabeçalhos de Documento)
-- =====================================================================================
ALTER TABLE public.movimentos ADD COLUMN IF NOT EXISTS num_doc text;
ALTER TABLE public.movimentos ADD COLUMN IF NOT EXISTS localidade_entrega text;

-- Sincronizar dados existentes em movimentos
UPDATE public.movimentos
SET localidade_entrega = COALESCE(localidade_entrega, localidadeentrega, "LocalidadeEntrega")
WHERE localidade_entrega IS NULL;

-- =====================================================================================
-- 2. ADICIONAR COLUNAS EM movimentos_linhas (Linhas de Detalhe)
-- =====================================================================================
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS artigo_id text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS data date;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS cliente_ser text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS cli_primavera text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS documento text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS tipo_doc text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS num_doc text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS chave1 text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS chave2 text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS entidade text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS total_iva numeric;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS total_merc numeric;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS total_outros numeric;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS totaldesc numeric;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS total_desc numeric;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS requisicao text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS num_contribuinte text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS morada text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS localidade text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS cod_postal text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS cod_postal_localidade text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS pais text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS nome_entrega text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS entidade_entrega text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS morada_entrega text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS localidade_entrega text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS cod_postal_entrega text;
ALTER TABLE public.movimentos_linhas ADD COLUMN IF NOT EXISTS observacoes text;

-- Sincronizar dados existentes em movimentos_linhas
UPDATE public.movimentos_linhas
SET 
    artigo_id = COALESCE(artigo_id, artigo),
    data = COALESCE(data, data_movimento::date),
    cliente_ser = COALESCE(cliente_ser, sigla),
    observacoes = COALESCE(observacoes, observacoes_linha)
WHERE artigo_id IS NULL OR data IS NULL OR cliente_ser IS NULL OR observacoes IS NULL;

-- =====================================================================================
-- 3. TRIGGERS DE SINCRONIZAÇÃO AUTOMÁTICA
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.fn_sync_movimento_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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
    IF NEW.nome_entrega IS NOT NULL THEN
        NEW.nomeentrega := NEW.nome_entrega;
        NEW."NomeEntrega" := NEW.nome_entrega;
    ELSIF NEW.nomeentrega IS NOT NULL THEN
        NEW.nome_entrega := NEW.nomeentrega;
        NEW."NomeEntrega" := NEW.nomeentrega;
    ELSIF NEW."NomeEntrega" IS NOT NULL THEN
        NEW.nome_entrega := NEW."NomeEntrega";
        NEW.nomeentrega := NEW."NomeEntrega";
    END IF;

    IF NEW.entidade_entrega IS NOT NULL THEN
        NEW.entidadeentrega := NEW.entidade_entrega;
        NEW."EntidadeEntrega" := NEW.entidade_entrega;
    ELSIF NEW.entidadeentrega IS NOT NULL THEN
        NEW.entidade_entrega := NEW.entidadeentrega;
        NEW."EntidadeEntrega" := NEW.entidadeentrega;
    ELSIF NEW."EntidadeEntrega" IS NOT NULL THEN
        NEW.entidade_entrega := NEW."EntidadeEntrega";
        NEW.entidadeentrega := NEW."EntidadeEntrega";
    END IF;

    IF NEW.morada_entrega IS NOT NULL THEN
        NEW.moradaentrega := NEW.morada_entrega;
        NEW."MoradaEntrega" := NEW.morada_entrega;
    ELSIF NEW.moradaentrega IS NOT NULL THEN
        NEW.morada_entrega := NEW.moradaentrega;
        NEW."MoradaEntrega" := NEW.moradaentrega;
    ELSIF NEW."MoradaEntrega" IS NOT NULL THEN
        NEW.morada_entrega := NEW."MoradaEntrega";
        NEW.moradaentrega := NEW."MoradaEntrega";
    END IF;

    IF NEW.localidade_entrega IS NOT NULL THEN
        NEW.localidadeentrega := NEW.localidade_entrega;
        NEW."LocalidadeEntrega" := NEW.localidade_entrega;
        NEW.cod_postal_localidade_entrega := NEW.localidade_entrega;
        NEW."CodPostalLocalidadeEntrega" := NEW.localidade_entrega;
    ELSIF NEW.localidadeentrega IS NOT NULL THEN
        NEW.localidade_entrega := NEW.localidadeentrega;
        NEW."LocalidadeEntrega" := NEW.localidadeentrega;
        NEW.cod_postal_localidade_entrega := NEW.localidadeentrega;
        NEW."CodPostalLocalidadeEntrega" := NEW.localidadeentrega;
    ELSIF NEW."LocalidadeEntrega" IS NOT NULL THEN
        NEW.localidade_entrega := NEW."LocalidadeEntrega";
        NEW.localidadeentrega := NEW."LocalidadeEntrega";
        NEW.cod_postal_localidade_entrega := NEW."LocalidadeEntrega";
        NEW."CodPostalLocalidadeEntrega" := NEW."LocalidadeEntrega";
    END IF;

    IF NEW.cod_postal_entrega IS NOT NULL THEN
        NEW.codpostalentrega := NEW.cod_postal_entrega;
        NEW."CodPostalEntrega" := NEW.cod_postal_entrega;
    ELSIF NEW.codpostalentrega IS NOT NULL THEN
        NEW.cod_postal_entrega := NEW.codpostalentrega;
        NEW."CodPostalEntrega" := NEW.codpostalentrega;
    ELSIF NEW."CodPostalEntrega" IS NOT NULL THEN
        NEW.cod_postal_entrega := NEW."CodPostalEntrega";
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
$function$;

CREATE OR REPLACE FUNCTION public.fn_sync_movimentos_linhas_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- 1. Sincronização artigo <-> artigo_id
    IF NEW.artigo_id IS NOT NULL AND NEW.artigo IS NULL THEN
        NEW.artigo := NEW.artigo_id;
    ELSIF NEW.artigo IS NOT NULL AND NEW.artigo_id IS NULL THEN
        NEW.artigo_id := NEW.artigo;
    END IF;

    -- 2. Sincronização data <-> data_movimento
    IF NEW.data IS NOT NULL AND NEW.data_movimento IS NULL THEN
        NEW.data_movimento := NEW.data::timestamp with time zone;
    ELSIF NEW.data_movimento IS NOT NULL AND NEW.data IS NULL THEN
        NEW.data := NEW.data_movimento::date;
    END IF;

    -- 3. Sincronização observacoes <-> observacoes_linha
    IF NEW.observacoes IS NOT NULL AND NEW.observacoes_linha IS NULL THEN
        NEW.observacoes_linha := NEW.observacoes;
    ELSIF NEW.observacoes_linha IS NOT NULL AND NEW.observacoes IS NULL THEN
        NEW.observacoes := NEW.observacoes_linha;
    END IF;

    -- 4. Sincronização totaldesc <-> total_desc
    IF NEW.totaldesc IS NOT NULL AND NEW.total_desc IS NULL THEN
        NEW.total_desc := NEW.totaldesc;
    ELSIF NEW.total_desc IS NOT NULL AND NEW.totaldesc IS NULL THEN
        NEW.totaldesc := NEW.total_desc;
    END IF;

    -- 5. Sincronização sigla <-> cliente_ser
    IF NEW.cliente_ser IS NOT NULL AND NEW.sigla IS NULL THEN
        NEW.sigla := NEW.cliente_ser;
    ELSIF NEW.sigla IS NOT NULL AND NEW.cliente_ser IS NULL THEN
        NEW.cliente_ser := NEW.sigla;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_movimentos_linhas_columns ON public.movimentos_linhas;
CREATE TRIGGER trg_sync_movimentos_linhas_columns
BEFORE INSERT OR UPDATE ON public.movimentos_linhas
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_movimentos_linhas_columns();

-- =====================================================================================
-- 4. ATUALIZAR VIEW vw_movimentos_detalhe
-- =====================================================================================
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
    a.descricao AS artigo_descricao,
    -- Novas colunas alinhadas com plat_movimentos
    COALESCE(ml.data, m.data) AS data,
    COALESCE(ml.artigo_id, ml.artigo) AS artigo_id,
    ml.artigo,
    COALESCE(ml.descricao, a.descricao) AS descricao,
    ml.armazem,
    ml.localizacao,
    ml.familia,
    ml.sub_familia,
    COALESCE(m.num_doc, ml.num_doc) AS num_doc,
    COALESCE(m.totaldesc, ml.totaldesc, m.total_desc) AS totaldesc,
    COALESCE(m.nome_entrega, ml.nome_entrega) AS nome_entrega,
    COALESCE(m.entidade_entrega, ml.entidade_entrega) AS entidade_entrega,
    COALESCE(m.morada_entrega, ml.morada_entrega) AS morada_entrega,
    COALESCE(m.localidade_entrega, ml.localidade_entrega, m.localidadeentrega, m."LocalidadeEntrega") AS localidade_entrega,
    COALESCE(m.cod_postal_entrega, ml.cod_postal_entrega) AS cod_postal_entrega,
    COALESCE(m.cliente_ser, ml.cliente_ser, m.sigla) AS cliente_ser,
    COALESCE(m.cli_primavera, ml.cli_primavera) AS cli_primavera,
    COALESCE(m.documento, ml.documento) AS documento
FROM public.movimentos_linhas ml
  JOIN public.movimentos m ON m.documento_ref = ml.documento_ref
  LEFT JOIN public.clientes c ON c.id = m.cliente_id
  LEFT JOIN public.artigos a ON a.artigo_cli = ml.artigo_cli;

-- =====================================================================================
-- 5. ATUALIZAR A FUNÇÃO transferir_plat_movimentos_para_movimentos()
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.transferir_plat_movimentos_para_movimentos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_doc_count integer := 0;
    v_linhas_count integer := 0;
    v_default_cliente_id uuid;
BEGIN
    -- Obter cliente padrão para fallback caso algum registo não tenha mapeamento
    SELECT id INTO v_default_cliente_id FROM public.clientes ORDER BY id LIMIT 1;

    -- 1º PASSO: Transferência para movimentos (Cabeçalhos)
    WITH headers_distinct AS (
        SELECT DISTINCT ON (
            COALESCE(
                NULLIF(TRIM(p.documento_ref), ''),
                COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento,
                p.documento
            )
        )
            -- Identificadores estruturais
            COALESCE(
                NULLIF(TRIM(p.documento_ref), ''),
                COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento,
                p.documento
            ) AS documento_ref,
            COALESCE(c.id, v_default_cliente_id) AS cliente_id,
            COALESCE(c.sigla, p.cliente_ser, 'UNK') AS sigla,
            COALESCE(NULLIF(TRIM(p.tipo_doc), ''), p.chave1, split_part(p.documento, ' ', 1)) AS tipo_doc,
            p.num_doc,

            -- Campos alinhados com plat_movimentos
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

            -- Campos legado / compatibilidade em movimentos
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
        FROM public.plat_movimentos p
        LEFT JOIN public.clientes c ON (
            (c.cli_primavera IS NOT NULL AND TRIM(c.cli_primavera) = TRIM(p.cli_primavera))
            OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(p.cliente_ser))
            OR UPPER(TRIM(c.name)) = UPPER(TRIM(p.cliente_ser))
            OR c.name ILIKE ('%' || TRIM(p.cliente_ser) || '%')
        )
        WHERE p.documento IS NOT NULL AND TRIM(p.documento) <> ''
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
    FROM headers_distinct
    ON CONFLICT (documento_ref) DO UPDATE SET
        cliente_id = EXCLUDED.cliente_id,
        sigla = EXCLUDED.sigla,
        tipo_doc = EXCLUDED.tipo_doc,
        num_doc = EXCLUDED.num_doc,
        data = EXCLUDED.data,
        cli_primavera = EXCLUDED.cli_primavera,
        cliente_ser = EXCLUDED.cliente_ser,
        tipo_movimento = EXCLUDED.tipo_movimento,
        tipomovimento = EXCLUDED.tipomovimento,
        documento = EXCLUDED.documento,
        chave1 = EXCLUDED.chave1,
        chave2 = EXCLUDED.chave2,
        entidade = EXCLUDED.entidade,
        total_iva = EXCLUDED.total_iva,
        totaliva = EXCLUDED.totaliva,
        total_merc = EXCLUDED.total_merc,
        totalmerc = EXCLUDED.totalmerc,
        total_outros = EXCLUDED.total_outros,
        totaloutros = EXCLUDED.totaloutros,
        totaldesc = EXCLUDED.totaldesc,
        total_desc = EXCLUDED.total_desc,
        requisicao = EXCLUDED.requisicao,
        num_contribuinte = EXCLUDED.num_contribuinte,
        numcontribuinte = EXCLUDED.numcontribuinte,
        nome = EXCLUDED.nome,
        morada = EXCLUDED.morada,
        localidade = EXCLUDED.localidade,
        cod_postal = EXCLUDED.cod_postal,
        codpostal = EXCLUDED.codpostal,
        cod_postal_localidade = EXCLUDED.cod_postal_localidade,
        codpostallocalidade = EXCLUDED.codpostallocalidade,
        pais = EXCLUDED.pais,
        nome_entrega = EXCLUDED.nome_entrega,
        nomeentrega = EXCLUDED.nomeentrega,
        "NomeEntrega" = EXCLUDED."NomeEntrega",
        entidade_entrega = EXCLUDED.entidade_entrega,
        entidadeentrega = EXCLUDED.entidadeentrega,
        "EntidadeEntrega" = EXCLUDED."EntidadeEntrega",
        morada_entrega = EXCLUDED.morada_entrega,
        moradaentrega = EXCLUDED.moradaentrega,
        "MoradaEntrega" = EXCLUDED."MoradaEntrega",
        localidade_entrega = EXCLUDED.localidade_entrega,
        localidadeentrega = EXCLUDED.localidadeentrega,
        "LocalidadeEntrega" = EXCLUDED."LocalidadeEntrega",
        "CodPostalLocalidadeEntrega" = EXCLUDED."CodPostalLocalidadeEntrega",
        cod_postal_entrega = EXCLUDED.cod_postal_entrega,
        codpostalentrega = EXCLUDED.codpostalentrega,
        "CodPostalEntrega" = EXCLUDED."CodPostalEntrega",
        observacoes = EXCLUDED.observacoes,
        data_movimento = EXCLUDED.data_movimento,
        updated_at = now();

    GET DIAGNOSTICS v_doc_count = ROW_COUNT;

    -- 2º PASSO: Transferência para movimentos_linhas
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
        COALESCE(
            p.doc_linha, 
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
    FROM public.plat_movimentos p
    LEFT JOIN public.clientes c ON (
        (c.cli_primavera IS NOT NULL AND TRIM(c.cli_primavera) = TRIM(p.cli_primavera))
        OR UPPER(TRIM(c.sigla)) = UPPER(TRIM(p.cliente_ser))
        OR UPPER(TRIM(c.name)) = UPPER(TRIM(p.cliente_ser))
        OR c.name ILIKE ('%' || TRIM(p.cliente_ser) || '%')
    )
    WHERE (p.doc_linha IS NOT NULL AND TRIM(p.doc_linha) <> '')
       OR (p.num_linha IS NOT NULL)
    ON CONFLICT (doc_linha) DO UPDATE SET
        documento_ref = EXCLUDED.documento_ref,
        num_linha = EXCLUDED.num_linha,
        data = EXCLUDED.data,
        data_movimento = EXCLUDED.data_movimento,
        cliente_ser = EXCLUDED.cliente_ser,
        cli_primavera = EXCLUDED.cli_primavera,
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
        descricao = EXCLUDED.descricao,
        tipo_artigo = EXCLUDED.tipo_artigo,
        armazem = EXCLUDED.armazem,
        localizacao = EXCLUDED.localizacao,
        posicao = EXCLUDED.posicao,
        lote = EXCLUDED.lote,
        quantidade = EXCLUDED.quantidade,
        familia = EXCLUDED.familia,
        sub_familia = EXCLUDED.sub_familia,
        data_fabrico = EXCLUDED.data_fabrico,
        validade = EXCLUDED.validade,
        tipo_movimento = EXCLUDED.tipo_movimento,
        tipo_armazem = EXCLUDED.tipo_armazem,
        armazem_loc = EXCLUDED.armazem_loc,
        entidade = EXCLUDED.entidade,
        total_iva = EXCLUDED.total_iva,
        total_merc = EXCLUDED.total_merc,
        total_outros = EXCLUDED.total_outros,
        totaldesc = EXCLUDED.totaldesc,
        total_desc = EXCLUDED.total_desc,
        requisicao = EXCLUDED.requisicao,
        num_contribuinte = EXCLUDED.num_contribuinte,
        nome = EXCLUDED.nome,
        morada = EXCLUDED.morada,
        localidade = EXCLUDED.localidade,
        cod_postal = EXCLUDED.cod_postal,
        cod_postal_localidade = EXCLUDED.cod_postal_localidade,
        pais = EXCLUDED.pais,
        nome_entrega = EXCLUDED.nome_entrega,
        entidade_entrega = EXCLUDED.entidade_entrega,
        morada_entrega = EXCLUDED.morada_entrega,
        localidade_entrega = EXCLUDED.localidade_entrega,
        cod_postal_entrega = EXCLUDED.cod_postal_entrega,
        observacoes = EXCLUDED.observacoes,
        observacoes_linha = EXCLUDED.observacoes_linha,
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
