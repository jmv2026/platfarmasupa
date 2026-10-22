-- ==============================================================================
-- Migration: 20261022211500_update_plat_movimentos_table_structure.sql
-- Descrição: Modificar a tabela plat_movimentos para acolher a estrutura dos ficheiros
--            ERP (42 campos) mantendo doc_linha como Primary Key.
-- ==============================================================================

-- 1. Recriação da tabela public.plat_movimentos com a nova estrutura de 42 campos
DROP TABLE IF EXISTS public.plat_movimentos CASCADE;

CREATE TABLE public.plat_movimentos (
    doc_linha TEXT PRIMARY KEY,
    data DATE,
    cli_primavera TEXT,
    cliente_ser TEXT,
    tipomovimento TEXT,
    documento TEXT,
    numlinha INTEGER,
    chave1 TEXT,
    chave2 TEXT,
    valorunitario NUMERIC DEFAULT 0,
    valoradicional NUMERIC DEFAULT 0,
    valorabater NUMERIC DEFAULT 0,
    artigo_id TEXT,
    artigo_cli TEXT,
    descricao TEXT,
    tipoartigo TEXT,
    armazem TEXT,
    localizacao TEXT,
    lote TEXT,
    quantidade NUMERIC DEFAULT 0,
    familia TEXT,
    subfamilia TEXT,
    datafabrico DATE,
    validade DATE,
    entidade TEXT,
    totaliva NUMERIC DEFAULT 0,
    totalmerc NUMERIC DEFAULT 0,
    totaloutros NUMERIC DEFAULT 0,
    totaldesc NUMERIC DEFAULT 0,
    requisicao TEXT,
    numcontribuinte TEXT,
    nome TEXT,
    morada TEXT,
    localidade TEXT,
    codpostal TEXT,
    codpostallocalidade TEXT,
    pais TEXT,
    nomeentrega TEXT,
    entidadeentrega TEXT,
    moradaentrega TEXT,
    localidadeentrega TEXT,
    codpostalentrega TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Comentários das colunas
COMMENT ON TABLE public.plat_movimentos IS 'Tabela staging de importação de movimentos do ERP (42 campos)';
COMMENT ON COLUMN public.plat_movimentos.doc_linha IS 'Chave primária única da linha de documento (ex: SSF 26MAX/173-6)';
COMMENT ON COLUMN public.plat_movimentos.data IS 'Data do movimento';
COMMENT ON COLUMN public.plat_movimentos.cli_primavera IS 'Código de cliente no Primavera / ERP (ex: 482)';
COMMENT ON COLUMN public.plat_movimentos.cliente_ser IS 'Série ou identificador do cliente (ex: Maxifar)';
COMMENT ON COLUMN public.plat_movimentos.tipomovimento IS 'Tipo de movimento (ex: S, E, SS, ES)';
COMMENT ON COLUMN public.plat_movimentos.documento IS 'Identificador do documento (ex: SSF 26MAX/173)';
COMMENT ON COLUMN public.plat_movimentos.numlinha IS 'Número da linha no documento';
COMMENT ON COLUMN public.plat_movimentos.artigo_id IS 'Código base do artigo';
COMMENT ON COLUMN public.plat_movimentos.artigo_cli IS 'Código completo do artigo com cliente (ex: 482-5738679)';

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_artigo_cli ON public.plat_movimentos(artigo_cli);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_artigo_id ON public.plat_movimentos(artigo_id);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_documento ON public.plat_movimentos(documento);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_cli_primavera ON public.plat_movimentos(cli_primavera);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_cliente_ser ON public.plat_movimentos(cliente_ser);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_data ON public.plat_movimentos(data);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_armazem ON public.plat_movimentos(armazem);
CREATE INDEX IF NOT EXISTS idx_plat_movimentos_lote ON public.plat_movimentos(lote);

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
                COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento,
                p.documento
            )
        )
            COALESCE(c.id, '00000000-0000-0000-0000-000000000000'::uuid) AS cliente_id,
            COALESCE(p.data::timestamp with time zone, now()) AS data_movimento,
            COALESCE(c.sigla, p.cliente_ser, 'UNK') AS sigla,
            CASE 
                WHEN LOWER(TRIM(p.tipomovimento)) IN ('e', 'es') THEN 'es'
                WHEN LOWER(TRIM(p.tipomovimento)) IN ('s', 'ss') THEN 'ss'
                WHEN LOWER(TRIM(p.tipomovimento)) = 'et' THEN 'et'
                WHEN LOWER(TRIM(p.tipomovimento)) = 'st' THEN 'st'
                ELSE LOWER(TRIM(COALESCE(p.tipomovimento, 'es')))
            END AS tipo_movimento,
            p.documento,
            COALESCE(
                COALESCE(c.sigla, p.cliente_ser, 'UNK') || '-' || p.documento,
                p.documento
            ) AS documento_ref,
            COALESCE(p.chave1, split_part(p.documento, ' ', 1)) AS tipo_doc,
            p.chave1,
            p.chave2,
            p.entidade,
            COALESCE(p.totaliva, 0) AS total_iva,
            COALESCE(p.totalmerc, 0) AS total_merc,
            COALESCE(p.totaloutros, 0) AS total_outros,
            COALESCE(p.totaldesc, 0) AS total_desc,
            p.requisicao,
            p.numcontribuinte AS num_contribuinte,
            p.morada,
            p.nome,
            p.localidade,
            p.codpostal AS cod_postal,
            p.codpostallocalidade AS cod_postal_localidade,
            p.pais,
            p.nomeentrega AS nome_entrega,
            p.moradaentrega AS morada_entrega,
            p.codpostalentrega AS cod_postal_entrega,
            p.localidadeentrega AS cod_postal_localidade_entrega,
            p.entidadeentrega AS entidade_entrega,
            p.nomeentrega AS "NomeEntrega",
            p.moradaentrega AS "MoradaEntrega",
            p.codpostalentrega AS "CodPostalEntrega",
            p.localidadeentrega AS "CodPostalLocalidadeEntrega",
            p.localidadeentrega AS "LocalidadeEntrega",
            p.entidadeentrega AS "EntidadeEntrega",
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
        "LocalidadeEntrega",
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
        "LocalidadeEntrega",
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
        "LocalidadeEntrega" = EXCLUDED."LocalidadeEntrega",
        "EntidadeEntrega" = EXCLUDED."EntidadeEntrega",
        updated_at = now();

    GET DIAGNOSTICS v_doc_count = ROW_COUNT;

    -- 2º PASSO: Transferência para movimentos_linhas com artigo_cli usando p.artigo_cli
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
