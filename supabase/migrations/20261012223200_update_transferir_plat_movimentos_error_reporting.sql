-- Migration: update_transferir_plat_movimentos_error_reporting
-- Indica detalhadamente a linha (num_linha/id), documento e artigo em questão caso ocorra algum erro durante a transferência de plat_movimentos para movimentos

CREATE OR REPLACE FUNCTION public.transferir_plat_movimentos_para_movimentos()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    r RECORD;
    v_cliente_id uuid;
    v_artigo_cli text;
    v_tipo_armazem text;
    v_armazem_loc text;
    v_doc_linha text;
    v_tipo_movimento text;
    inserted_count integer := 0;
    v_artigo_existe boolean;
BEGIN
    FOR r IN 
        SELECT 
            p.*,
            c.id AS cliente_id
        FROM public.plat_movimentos p
        LEFT JOIN public.clientes c ON UPPER(TRIM(c.sigla)) = UPPER(TRIM(p.sigla))
        WHERE NOT EXISTS (
            SELECT 1 
            FROM public.movimentos m 
            WHERE m.doc_linha = COALESCE(p.doc_linha, p.documento || '-' || p.num_linha)
        )
        ORDER BY p.id ASC
    LOOP
        v_doc_linha := COALESCE(r.doc_linha, r.documento || '-' || r.num_linha);
        v_artigo_cli := COALESCE(UPPER(TRIM(r.sigla)), 'UNK') || '-' || UPPER(TRIM(r.artigo));
        v_tipo_movimento := LOWER(TRIM(r.tipo_movimento));

        -- 1. Validar existência do cliente
        IF r.cliente_id IS NULL THEN
            RAISE EXCEPTION 'Erro na Linha % (Doc: "%", Artigo: "%"): Cliente com a sigla "%" não existe na tabela de clientes.',
                COALESCE(r.num_linha::text, r.id::text),
                COALESCE(r.documento, 'N/D'),
                COALESCE(r.artigo, 'N/D'),
                COALESCE(r.sigla, 'N/D');
        END IF;

        -- 2. Validar existência do artigo no catálogo de artigos
        SELECT EXISTS (
            SELECT 1 FROM public.artigos a WHERE a.artigo_cli = v_artigo_cli
        ) INTO v_artigo_existe;

        IF NOT v_artigo_existe THEN
            RAISE EXCEPTION 'Erro na Linha % (Doc: "%"): O artigo "%" (código completo: "%") não está registado na tabela de artigos. Por favor crie o artigo primeiro ou use a opção "Criar Artigos".',
                COALESCE(r.num_linha::text, r.id::text),
                COALESCE(r.documento, 'N/D'),
                COALESCE(r.artigo, 'N/D'),
                v_artigo_cli;
        END IF;

        -- 3. Mapear e validar tipo de armazém
        v_tipo_armazem := CASE 
            WHEN r.armazem LIKE '%01' THEN '01'
            WHEN r.armazem LIKE '%02' THEN '02'
            WHEN r.armazem LIKE '%03' THEN '03'
            WHEN r.armazem LIKE '%04' THEN '04'
            WHEN r.armazem LIKE '%05' THEN '05'
            WHEN r.armazem LIKE '%06' THEN '06'
            WHEN r.armazem LIKE '%07' THEN '07'
            ELSE '01' 
        END;

        IF NOT EXISTS (SELECT 1 FROM public.armazens arm WHERE arm.tipo_armazem = v_tipo_armazem) THEN
            RAISE EXCEPTION 'Erro na Linha % (Doc: "%", Artigo: "%"): Tipo de armazém "%" não existe na tabela armazens.',
                COALESCE(r.num_linha::text, r.id::text),
                COALESCE(r.documento, 'N/D'),
                COALESCE(r.artigo, 'N/D'),
                v_tipo_armazem;
        END IF;

        -- 4. Validar quantidade
        IF r.quantidade IS NULL OR r.quantidade <= 0 THEN
            RAISE EXCEPTION 'Erro na Linha % (Doc: "%", Artigo: "%"): Quantidade inválida (%). A quantidade deve ser estritamente superior a zero.',
                COALESCE(r.num_linha::text, r.id::text),
                COALESCE(r.documento, 'N/D'),
                COALESCE(r.artigo, 'N/D'),
                COALESCE(r.quantidade::text, 'NULA');
        END IF;

        -- 5. Validar tipo de movimento
        IF v_tipo_movimento NOT IN ('es', 'ss', 'et', 'st') THEN
            RAISE EXCEPTION 'Erro na Linha % (Doc: "%", Artigo: "%"): Tipo de movimento "%" inválido. Tipos aceites: es, ss, et, st.',
                COALESCE(r.num_linha::text, r.id::text),
                COALESCE(r.documento, 'N/D'),
                COALESCE(r.artigo, 'N/D'),
                COALESCE(r.tipo_movimento, 'NULO');
        END IF;

        v_armazem_loc := COALESCE(r.sigla, 'UNK') || '-' || v_tipo_armazem;

        -- 6. Inserir movimento com captura de qualquer erro adicional
        BEGIN
            INSERT INTO public.movimentos (
                cliente_id,
                sigla,
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
                documento_ref,
                num_linha,
                doc_linha,
                num_registo,
                chave1,
                chave2,
                num_chave1,
                num_chave2,
                valor_unitario,
                valor_adicional,
                valor_abater,
                total_iva,
                total_merc,
                total_outros,
                total_desc,
                estado_stock,
                familia,
                sub_familia,
                tipo_artigo,
                sistema,
                entidade,
                requisicao,
                num_contribuinte,
                morada,
                nome,
                localidade,
                cod_postal,
                cod_postal_localidade,
                ativa,
                chave_ativa,
                observacoes
            ) VALUES (
                r.cliente_id,
                r.sigla,
                v_artigo_cli,
                v_tipo_movimento,
                r.quantidade,
                v_tipo_armazem,
                v_armazem_loc,
                r.localizacao,
                r.lote,
                r.validade,
                r.datafabrico,
                COALESCE(r.data, r.created_at::date),
                r.documento,
                r.num_linha,
                v_doc_linha,
                r.num_registo,
                r.chave1,
                r.chave2,
                r.num_chave1,
                r.num_chave2,
                COALESCE(r.valor_unitario, 0),
                COALESCE(r.valor_adicional, 0),
                COALESCE(r.valor_abater, 0),
                COALESCE(r.total_iva, 0),
                COALESCE(r.total_merc, 0),
                COALESCE(r.total_outros, 0),
                COALESCE(r.total_desc, 0),
                r.estado_stock,
                r.familia,
                r.sub_familia,
                r.tipo_artigo,
                COALESCE(r.sistema, false),
                r.entidade,
                r.requisicao,
                r.num_contribuinte,
                r.morada,
                r.nome,
                r.localidade,
                r.cod_postal,
                r.cod_postal_localidade,
                COALESCE(r.ativa, true),
                COALESCE(r.chave_ativa, true),
                'Importado via plat_movimentos'
            );

            inserted_count := inserted_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Erro na Linha % (Doc: "%", Artigo: "%"): %',
                COALESCE(r.num_linha::text, r.id::text),
                COALESCE(r.documento, 'N/D'),
                COALESCE(r.artigo, 'N/D'),
                SQLERRM;
        END;
    END LOOP;

    RETURN inserted_count;
END;
$function$;
