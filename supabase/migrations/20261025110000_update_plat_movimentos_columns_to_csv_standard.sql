-- ==============================================================================
-- Migration: 20261025110000_update_plat_movimentos_columns_to_csv_standard.sql
-- Descrição: Alinhar os nomes dos campos da tabela public.plat_movimentos de acordo
--            com o ficheiro modelo ERP anexo (43 campos):
--            documento_ref; data; cliente_ser; tipo_movimento; documento;
--            num_linha; doc_linha; chave1; chave2; valor_unitario; valor_adicional;
--            valor_abater; descricao; tipo_artigo; armazem; localizacao; lote;
--            quantidade; familia; sub_Familia; data_fabrico; validade; entidade;
--            total_iva; total_merc; total_outros; totaldesc; requisicao;
--            num_contribuinte; nome; morada; localidade; cod_postal;
--            cod_postal_localidade; pais; nome_entrega; entidade_entrega;
--            morada_entrega; localidade_entrega; cod_postal_entrega; observacoes;
--            tipo_doc; num_doc
-- ==============================================================================

-- 1. Recriação da tabela public.plat_movimentos com a estrutura exata do ficheiro ERP
DROP TABLE IF EXISTS public.plat_movimentos CASCADE;

CREATE TABLE public.plat_movimentos (
    documento_ref TEXT,
    data DATE,
    cliente_ser TEXT,
    tipo_movimento TEXT,
    documento TEXT,
    num_linha INTEGER,
    doc_linha TEXT PRIMARY KEY,
    chave1 TEXT,
    chave2 TEXT,
    valor_unitario NUMERIC DEFAULT 0,
    valor_adicional NUMERIC DEFAULT 0,
    valor_abater NUMERIC DEFAULT 0,
    descricao TEXT,
    tipo_artigo TEXT,
    armazem TEXT,
    localizacao TEXT,
    lote TEXT,
    quantidade NUMERIC DEFAULT 0,
    familia TEXT,
    sub_familia TEXT,
    data_fabrico DATE,
    validade DATE,
    entidade TEXT,
    total_iva NUMERIC DEFAULT 0,
    total_merc NUMERIC DEFAULT 0,
    total_outros NUMERIC DEFAULT 0,
    totaldesc NUMERIC DEFAULT 0,
    requisicao TEXT,
    num_contribuinte TEXT,
    nome TEXT,
    morada TEXT,
    localidade TEXT,
    cod_postal TEXT,
    cod_postal_localidade TEXT,
    pais TEXT,
    nome_entrega TEXT,
    entidade_entrega TEXT,
    morada_entrega TEXT,
    localidade_entrega TEXT,
    cod_postal_entrega TEXT,
    observacoes TEXT,
    tipo_doc TEXT,
    num_doc TEXT,
    -- Campos opcionais para integração/auditoria
    cli_primavera TEXT,
    artigo_id TEXT,
    artigo_cli TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Comentários das colunas
COMMENT ON TABLE public.plat_movimentos IS 'Tabela staging de importação de movimentos do ERP (43 campos)';
COMMENT ON COLUMN public.plat_movimentos.doc_linha IS 'Chave primária única da linha de documento (ex: FA 24AOP/35-2)';
COMMENT ON COLUMN public.plat_movimentos.documento_ref IS 'Referência global do documento (ex: SER-FA 24AOP/35)';
COMMENT ON COLUMN public.plat_movimentos.data IS 'Data do movimento';
COMMENT ON COLUMN public.plat_movimentos.cliente_ser IS 'Série ou identificador do cliente (ex: AOP, Seacross)';
COMMENT ON COLUMN public.plat_movimentos.tipo_movimento IS 'Tipo de movimento (ex: S, E, SS, ES)';
COMMENT ON COLUMN public.plat_movimentos.documento IS 'Identificador do documento (ex: FA 24AOP/35)';
COMMENT ON COLUMN public.plat_movimentos.num_linha IS 'Número da linha no documento';
COMMENT ON COLUMN public.plat_movimentos.tipo_doc IS 'Tipo de documento (ex: FA, SSF, FS)';
COMMENT ON COLUMN public.plat_movimentos.num_doc IS 'Número do documento (ex: 35, 4)';

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_doc_ref ON public.plat_movimentos(documento_ref);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_documento ON public.plat_movimentos(documento);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_cliente_ser ON public.plat_movimentos(cliente_ser);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_data ON public.plat_movimentos(data);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_armazem ON public.plat_movimentos(armazem);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_lote ON public.plat_movimentos(lote);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_artigo_cli ON public.plat_movimentos(artigo_cli);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_artigo_id ON public.plat_movimentos(artigo_id);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_cli_primavera ON public.plat_movimentos(cli_primavera);

-- Ativação de RLS (Row Level Security)
ALTER TABLE public.plat_movimentos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Acesso total a plat_movimentos para autenticados"
ON public.plat_movimentos
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Acesso total a plat_movimentos para anon"
ON public.plat_movimentos
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Permissões
GRANT ALL ON public.plat_movimentos TO authenticated;
GRANT ALL ON public.plat_movimentos TO anon;
GRANT ALL ON public.plat_movimentos TO service_role;

-- 2. Atualização da função transferir_plat_movimentos_para_movimentos()
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
            COALESCE(c.id, '00000000-0000-0000-0000-000000000000'::uuid) AS cliente_id,
            COALESCE(c.sigla, p.cliente_ser, 'UNK') AS sigla,
            COALESCE(NULLIF(TRIM(p.tipo_doc), ''), p.chave1, split_part(p.documento, ' ', 1)) AS tipo_doc,

            -- Campos alinhados com plat_movimentos
            p.data,
            p.cli_primavera,
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
            NULLIF(TRIM(p.documento_ref), ''),
            COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento,
            p.documento
        ) AS documento_ref,
        p.num_linha AS num_linha,
        COALESCE(
            p.doc_linha, 
            COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento || '-' || p.num_linha
        ) AS doc_linha,
        COALESCE(p.valor_unitario, 0) AS valor_unitario,
        COALESCE(p.valor_adicional, 0) AS valor_adicional,
        COALESCE(p.valor_abater, 0) AS valor_abater,
        COALESCE(p.artigo_id, p.descricao) AS artigo,
        p.descricao,
        p.tipo_artigo,
        p.armazem,
        p.localizacao,
        p.lote,
        COALESCE(p.quantidade, 0) AS quantidade,
        p.familia,
        p.sub_familia,
        CASE WHEN p.data_fabrico = '1980-01-01'::date THEN NULL ELSE p.data_fabrico END AS data_fabrico,
        p.validade,
        COALESCE(
            p.artigo_cli,
            CASE 
                WHEN p.artigo_id IS NOT NULL THEN COALESCE(c.cli_primavera, p.cli_primavera, UPPER(TRIM(c.sigla)), 'UNK') || '-' || UPPER(TRIM(p.artigo_id))
                ELSE NULL
            END
        ) AS artigo_cli,
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
