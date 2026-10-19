-- Migration: 20261019205500_step1_transfer_plat_movimentos_to_movimentos.sql
-- 1º Passo da transferência: Copia diretamente os 26 campos de plat_movimentos para movimentos

-- 1. Assegurar colunas na tabela movimentos
ALTER TABLE public.movimentos ADD COLUMN IF NOT EXISTS documento text;
ALTER TABLE public.movimentos ADD COLUMN IF NOT EXISTS tipo_movimento text;
ALTER TABLE public.movimentos ADD COLUMN IF NOT EXISTS nome_entrega text;
ALTER TABLE public.movimentos ADD COLUMN IF NOT EXISTS morada_entrega text;
ALTER TABLE public.movimentos ADD COLUMN IF NOT EXISTS cod_postal_entrega text;
ALTER TABLE public.movimentos ADD COLUMN IF NOT EXISTS cod_postal_localidade_entrega text;
ALTER TABLE public.movimentos ADD COLUMN IF NOT EXISTS entidade_entrega text;

-- 2. Criar a nova função de transferência direta para movimentos (1º Passo)
CREATE OR REPLACE FUNCTION public.transferir_plat_movimentos_para_movimentos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_count integer := 0;
BEGIN
    -- Inserção / Atualização dos 26 campos de plat_movimentos para movimentos
    WITH headers_distinct AS (
        SELECT DISTINCT ON (COALESCE(p.documento_ref, UPPER(TRIM(p.sigla)) || '-' || p.documento))
            COALESCE(c.id, '00000000-0000-0000-0000-000000000000'::uuid) AS cliente_id,
            COALESCE(p.data_movimento, p.data::timestamp with time zone, now()) AS data_movimento,
            p.sigla,
            p.tipo_movimento,
            p.documento,
            COALESCE(p.documento_ref, UPPER(TRIM(p.sigla)) || '-' || p.documento) AS documento_ref,
            p.tipo_doc,
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

    GET DIAGNOSTICS v_total_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'count', v_total_count,
        'documentos', v_total_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transferir_plat_movimentos_para_movimentos() TO authenticated, service_role, anon;
