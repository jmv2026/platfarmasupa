-- Migration: add_documento_ref_to_plat_movimentos
-- Adiciona o campo documento_ref (tipo texto) à tabela plat_movimentos e atualiza a função de transferência

ALTER TABLE public.plat_movimentos 
    ADD COLUMN IF NOT EXISTS documento_ref text;

CREATE INDEX IF NOT EXISTS idx_plat_movimentos_documento_ref 
    ON public.plat_movimentos USING btree (documento_ref);

-- Atualiza a função transferir_plat_movimentos_para_movimentos para suportar documento_ref
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
    v_documento_ref text;
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
            FROM public.movimentos_linhas ml 
            WHERE ml.doc_linha = COALESCE(p.doc_linha, COALESCE(p.documento_ref, p.documento) || '-' || p.num_linha)
        )
        ORDER BY p.id ASC
    LOOP
        v_documento_ref := COALESCE(r.documento_ref, r.documento);
        v_doc_linha := COALESCE(r.doc_linha, v_documento_ref || '-' || r.num_linha);
        v_artigo_cli := COALESCE(UPPER(TRIM(r.sigla)), 'UNK') || '-' || UPPER(TRIM(r.artigo));
        v_tipo_movimento := LOWER(TRIM(r.tipo_movimento));

        -- 1. Validar cliente
        IF r.cliente_id IS NULL THEN
            RAISE EXCEPTION 'Erro na Linha % (Doc: "%", Artigo: "%"): Cliente com a sigla "%" não existe na tabela de clientes.',
                COALESCE(r.num_linha::text, r.id::text),
                COALESCE(v_documento_ref, 'N/D'),
                COALESCE(r.artigo, 'N/D'),
                COALESCE(r.sigla, 'N/D');
        END IF;

        -- 2. Validar artigo na tabela artigos
        SELECT EXISTS (
            SELECT 1 FROM public.artigos a WHERE a.artigo_cli = v_artigo_cli
        ) INTO v_artigo_existe;

        IF NOT v_artigo_existe THEN
            RAISE EXCEPTION 'Erro na Linha % (Doc: "%"): O artigo "%" (código completo: "%") não está registado na tabela de artigos. Por favor crie o artigo primeiro ou use a opção "Criar Artigos".',
                COALESCE(r.num_linha::text, r.id::text),
                COALESCE(v_documento_ref, 'N/D'),
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
                COALESCE(v_documento_ref, 'N/D'),
                COALESCE(r.artigo, 'N/D'),
                v_tipo_armazem;
        END IF;

        -- 4. Validar quantidade
        IF r.quantidade IS NULL OR r.quantidade <= 0 THEN
            RAISE EXCEPTION 'Erro na Linha % (Doc: "%", Artigo: "%"): Quantidade inválida (%). A quantidade deve ser superior a zero.',
                COALESCE(r.num_linha::text, r.id::text),
                COALESCE(v_documento_ref, 'N/D'),
                COALESCE(r.artigo, 'N/D'),
                COALESCE(r.quantidade::text, 'NULA');
        END IF;

        -- 5. Validar tipo de movimento
        IF v_tipo_movimento NOT IN ('es', 'ss', 'et', 'st') THEN
            RAISE EXCEPTION 'Erro na Linha % (Doc: "%", Artigo: "%"): Tipo de movimento "%" inválido. Tipos aceites: es, ss, et, st.',
                COALESCE(r.num_linha::text, r.id::text),
                COALESCE(v_documento_ref, 'N/D'),
                COALESCE(r.artigo, 'N/D'),
                COALESCE(r.tipo_movimento, 'NULO');
        END IF;

        v_armazem_loc := COALESCE(r.sigla, 'UNK') || '-' || v_tipo_armazem;

        -- 6. Executar o INSERT do Cabeçalho e Linha
        BEGIN
            -- 6.1 Cabeçalho em movimentos (se ainda não existir para este documento)
            INSERT INTO public.movimentos (
                cliente_id,
                sigla,
                data_movimento,
                documento_ref,
                total_iva,
                total_merc,
                total_outros,
                total_desc,
                entidade,
                requisicao,
                num_contribuinte,
                morada,
                nome,
                localidade,
                cod_postal,
                cod_postal_localidade,
                observacoes
            ) VALUES (
                r.cliente_id,
                r.sigla,
                COALESCE(r.data, r.created_at::date),
                v_documento_ref,
                COALESCE(r.total_iva, 0),
                COALESCE(r.total_merc, 0),
                COALESCE(r.total_outros, 0),
                COALESCE(r.total_desc, 0),
                r.entidade,
                r.requisicao,
                r.num_contribuinte,
                r.morada,
                r.nome,
                r.localidade,
                r.cod_postal,
                r.cod_postal_localidade,
                'Importado via plat_movimentos'
            )
            ON CONFLICT (documento_ref) DO UPDATE SET
                total_merc = EXCLUDED.total_merc,
                total_iva = EXCLUDED.total_iva,
                total_outros = EXCLUDED.total_outros,
                total_desc = EXCLUDED.total_desc;

            -- 6.2 Linha em movimentos_linhas
            INSERT INTO public.movimentos_linhas (
                artigo_cli,
                artigo_id,
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
                valor_unitario,
                valor_adicional,
                valor_abater,
                estado_stock,
                tipo_artigo,
                observacoes_linha
            ) VALUES (
                v_artigo_cli,
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
                v_documento_ref,
                r.num_linha,
                v_doc_linha,
                COALESCE(r.valor_unitario, 0),
                COALESCE(r.valor_adicional, 0),
                COALESCE(r.valor_abater, 0),
                r.estado_stock,
                r.tipo_artigo,
                'Importado via plat_movimentos'
            );

            inserted_count := inserted_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Erro na Linha % (Doc: "%", Artigo: "%"): %',
                COALESCE(r.num_linha::text, r.id::text),
                COALESCE(v_documento_ref, 'N/D'),
                COALESCE(r.artigo, 'N/D'),
                SQLERRM;
        END;
    END LOOP;

    RETURN inserted_count;
END;
$function$;
