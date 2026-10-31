-- =====================================================================================
-- MIGRAÇÃO: Preenchimento automático de movimentos e movimentos_linhas ao concluir pedido
-- =====================================================================================

-- 1. Função que sincroniza um pedido concluído para as tabelas movimentos e movimentos_linhas
CREATE OR REPLACE FUNCTION public.sincronizar_pedido_para_movimentos(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_pedido record;
    v_cliente record;
    v_doc_ref text;
    v_sigla text;
    v_tipo_mov text;
    v_doc_mov text;
    v_linhas_count integer := 0;
BEGIN
    -- Obter os dados do pedido
    SELECT * INTO v_pedido
    FROM public.pedidos
    WHERE id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
    END IF;

    -- Obter os dados do cliente
    SELECT * INTO v_cliente
    FROM public.clientes
    WHERE id = v_pedido.cliente_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente do pedido não encontrado');
    END IF;

    v_sigla := UPPER(TRIM(v_cliente.sigla));
    v_tipo_mov := UPPER(TRIM(COALESCE(v_pedido.tipo_movimento, 'SS')));
    v_doc_mov := COALESCE(NULLIF(TRIM(v_pedido.doc_primavera), ''), v_pedido.nr_pedido);

    -- Definir documento_ref baseado em sigla_pedido ou compor [SIGLA]-[nr_pedido]
    v_doc_ref := COALESCE(
        NULLIF(TRIM(v_pedido.sigla_pedido), ''),
        v_sigla || '-' || TRIM(v_pedido.nr_pedido),
        TRIM(v_pedido.nr_pedido)
    );

    -- 1. Inserir ou atualizar cabeçalho em public.movimentos
    INSERT INTO public.movimentos (
        documento_ref,
        cliente_id,
        sigla,
        cliente_ser,
        cli_primavera,
        entidade,
        tipo_doc,
        num_doc,
        documento,
        chave1,
        tipo_movimento,
        tipomovimento,
        data,
        data_movimento,
        requisicao,
        nome,
        morada,
        localidade,
        cod_postal,
        cod_postal_localidade,
        pais,
        nome_entrega,
        morada_entrega,
        localidade_entrega,
        cod_postal_entrega,
        cod_postal_localidade_entrega,
        "NomeEntrega",
        "MoradaEntrega",
        "LocalidadeEntrega",
        "CodPostalEntrega",
        "CodPostalLocalidadeEntrega",
        total_merc,
        totalmerc,
        total_iva,
        totaliva,
        total_outros,
        totaloutros,
        total_desc,
        totaldesc,
        observacoes,
        created_by,
        updated_at
    ) VALUES (
        v_doc_ref,
        v_pedido.cliente_id,
        v_sigla,
        v_sigla,
        v_cliente.cli_primavera,
        COALESCE(v_cliente.cli_primavera, v_sigla),
        'ECL',
        v_pedido.nr_pedido,
        v_doc_mov,
        v_pedido.doc_primavera,
        v_tipo_mov,
        v_tipo_mov,
        v_pedido.data_pedido,
        COALESCE(v_pedido.data_pedido::timestamp with time zone, now()),
        v_pedido.ref_documento,
        v_pedido.nome_destinatario,
        v_pedido.morada,
        v_pedido.localidade,
        v_pedido.codigo_postal,
        v_pedido.localidade,
        COALESCE(v_pedido.pais, 'Portugal'),
        v_pedido.nome_destinatario,
        v_pedido.morada,
        v_pedido.localidade,
        v_pedido.codigo_postal,
        v_pedido.localidade,
        v_pedido.nome_destinatario,
        v_pedido.morada,
        v_pedido.localidade,
        v_pedido.codigo_postal,
        v_pedido.localidade,
        0, 0, 0, 0, 0, 0, 0, 0,
        v_pedido.observacoes,
        v_pedido.created_by,
        now()
    )
    ON CONFLICT (documento_ref) DO UPDATE SET
        cliente_id = EXCLUDED.cliente_id,
        sigla = EXCLUDED.sigla,
        cliente_ser = EXCLUDED.cliente_ser,
        cli_primavera = EXCLUDED.cli_primavera,
        entidade = EXCLUDED.entidade,
        documento = EXCLUDED.documento,
        chave1 = EXCLUDED.chave1,
        tipo_movimento = EXCLUDED.tipo_movimento,
        tipomovimento = EXCLUDED.tipomovimento,
        data = EXCLUDED.data,
        data_movimento = EXCLUDED.data_movimento,
        requisicao = EXCLUDED.requisicao,
        nome = EXCLUDED.nome,
        morada = EXCLUDED.morada,
        localidade = EXCLUDED.localidade,
        cod_postal = EXCLUDED.cod_postal,
        cod_postal_localidade = EXCLUDED.cod_postal_localidade,
        pais = EXCLUDED.pais,
        nome_entrega = EXCLUDED.nome_entrega,
        morada_entrega = EXCLUDED.morada_entrega,
        localidade_entrega = EXCLUDED.localidade_entrega,
        cod_postal_entrega = EXCLUDED.cod_postal_entrega,
        cod_postal_localidade_entrega = EXCLUDED.cod_postal_localidade_entrega,
        "NomeEntrega" = EXCLUDED."NomeEntrega",
        "MoradaEntrega" = EXCLUDED."MoradaEntrega",
        "LocalidadeEntrega" = EXCLUDED."LocalidadeEntrega",
        "CodPostalEntrega" = EXCLUDED."CodPostalEntrega",
        "CodPostalLocalidadeEntrega" = EXCLUDED."CodPostalLocalidadeEntrega",
        observacoes = EXCLUDED.observacoes,
        updated_at = now();

    -- 2. Limpar linhas anteriores associadas a este documento
    DELETE FROM public.movimentos_linhas
    WHERE documento_ref = v_doc_ref;

    -- 3. Inserir linhas em public.movimentos_linhas a partir de pedido_linhas
    WITH numbered_lines AS (
        SELECT 
            pl.*,
            ROW_NUMBER() OVER (ORDER BY pl.created_at, pl.id) AS seq_linha
        FROM public.pedido_linhas pl
        WHERE pl.pedido_id = p_pedido_id
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
        chave1,
        tipo_doc,
        num_doc,
        requisicao,
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
        validade,
        tipo_movimento,
        tipo_armazem,
        armazem_loc,
        entidade,
        nome,
        morada,
        localidade,
        cod_postal,
        cod_postal_localidade,
        pais,
        nome_entrega,
        morada_entrega,
        localidade_entrega,
        cod_postal_entrega,
        observacoes,
        observacoes_linha,
        updated_at
    )
    SELECT
        v_doc_ref || '-' || nl.seq_linha AS doc_linha,
        v_doc_ref AS documento_ref,
        nl.seq_linha::integer AS num_linha,
        v_pedido.data_pedido AS data,
        COALESCE(v_pedido.data_pedido::timestamp with time zone, now()) AS data_movimento,
        v_sigla AS cliente_ser,
        v_cliente.cli_primavera AS cli_primavera,
        v_sigla AS sigla,
        v_doc_mov AS documento,
        v_pedido.doc_primavera AS chave1,
        'ECL' AS tipo_doc,
        v_pedido.nr_pedido AS num_doc,
        v_pedido.ref_documento AS requisicao,
        nl.artigo_id AS artigo,
        nl.artigo_id AS artigo_id,
        nl.artigo_cli AS artigo_cli,
        nl.descricao AS descricao,
        a.id_tipo_artigo AS tipo_artigo,
        COALESCE(st.armazem, v_sigla || '01') AS armazem,
        st.localizacao AS localizacao,
        st.localizacao AS posicao,
        nl.lote AS lote,
        nl.quantidade AS quantidade,
        a.familia AS familia,
        a.subfamilia AS sub_familia,
        nl.validade AS validade,
        v_tipo_mov AS tipo_movimento,
        COALESCE(
            SUBSTRING(COALESCE(st.armazem, v_sigla || '01') FROM '[0-9]{2}$'),
            '01'
        ) AS tipo_armazem,
        v_sigla || '-' || COALESCE(
            SUBSTRING(COALESCE(st.armazem, v_sigla || '01') FROM '[0-9]{2}$'),
            '01'
        ) AS armazem_loc,
        COALESCE(v_cliente.cli_primavera, v_sigla) AS entidade,
        v_pedido.nome_destinatario AS nome,
        v_pedido.morada AS morada,
        v_pedido.localidade AS localidade,
        v_pedido.codigo_postal AS cod_postal,
        v_pedido.localidade AS cod_postal_localidade,
        COALESCE(v_pedido.pais, 'Portugal') AS pais,
        v_pedido.nome_destinatario AS nome_entrega,
        v_pedido.morada AS morada_entrega,
        v_pedido.localidade AS localidade_entrega,
        v_pedido.codigo_postal AS cod_postal_entrega,
        v_pedido.observacoes AS observacoes,
        v_pedido.observacoes AS observacoes_linha,
        now() AS updated_at
    FROM numbered_lines nl
    LEFT JOIN public.artigos a ON (a.artigo_cli = nl.artigo_cli OR a.artigo_id = nl.artigo_id)
    LEFT JOIN LATERAL (
        SELECT s.armazem, s.localizacao
        FROM public.stock s
        WHERE s.artigo_id = nl.artigo_id
          AND (s.lote = nl.lote OR nl.lote IS NULL OR s.lote IS NULL)
          AND (s.sigla = v_sigla OR s.cliente_ser = v_sigla)
        ORDER BY 
            CASE WHEN s.lote = nl.lote THEN 1 ELSE 2 END,
            s.stock DESC
        LIMIT 1
    ) st ON true;

    GET DIAGNOSTICS v_linhas_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'documento_ref', v_doc_ref,
        'linhas_inseridas', v_linhas_count
    );
END;
$function$;

-- 2. Trigger em public.pedidos que dispara quando o status passa a concluído
CREATE OR REPLACE FUNCTION public.fn_trg_pedidos_concluidos_sync_movimentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_old_status text;
    v_new_status text;
    v_doc_ref text;
BEGIN
    v_new_status := LOWER(TRIM(COALESCE(NEW.status, '')));
    v_old_status := CASE WHEN TG_OP = 'UPDATE' THEN LOWER(TRIM(COALESCE(OLD.status, ''))) ELSE '' END;

    -- Se o status for ou passar a ser 'concluido' ou 'concluído'
    IF v_new_status IN ('concluido', 'concluído') THEN
        -- Sincronizar para movimentos e movimentos_linhas
        PERFORM public.sincronizar_pedido_para_movimentos(NEW.id);
    ELSIF TG_OP = 'UPDATE' AND v_old_status IN ('concluido', 'concluído') AND v_new_status NOT IN ('concluido', 'concluído') THEN
        -- Se deixou de ser concluído, remover movimento correspondente
        v_doc_ref := COALESCE(OLD.sigla_pedido, NEW.sigla_pedido);
        IF v_doc_ref IS NOT NULL AND v_doc_ref <> '' THEN
            DELETE FROM public.movimentos WHERE documento_ref = v_doc_ref;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pedidos_concluidos_sync_movimentos ON public.pedidos;

CREATE TRIGGER trg_pedidos_concluidos_sync_movimentos
AFTER INSERT OR UPDATE OF status, sigla_pedido ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_pedidos_concluidos_sync_movimentos();

GRANT EXECUTE ON FUNCTION public.sincronizar_pedido_para_movimentos(uuid) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

