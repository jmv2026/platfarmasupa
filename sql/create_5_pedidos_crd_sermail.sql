-- ==============================================================================
-- CRIAÇÃO DE 5 PEDIDOS COM DESTINO SERMAIL (DATA ENTREGA: 24-09-2026) - CLIENTE CRD
-- ==============================================================================
-- Regras aplicadas:
-- 1. Cliente: CRD (Cardiolink Portugal, Unipessoal, Lda)
-- 2. Destino: Sermail, Logística Integrada Lda (Cacém Park, Armazém 15, São Marcos)
-- 3. Data de Pedido: 23-09-2026 | Data de Entrega: 24-09-2026
-- 4. 2 linhas por pedido selecionadas do stock disponível com critério FEFO
-- 5. Movimentos transacionais de Saída de Stock (ss) registados em public.movimentos
-- ==============================================================================

DO $$
DECLARE
    v_client_id UUID := 'f65af07a-04a3-46e5-acb0-138008fb9b98';
    v_admin_id UUID := 'cdd4b712-dccb-4913-8675-985410427df1';
    v_pedido1_id UUID := gen_random_uuid();
    v_pedido2_id UUID := gen_random_uuid();
    v_pedido3_id UUID := gen_random_uuid();
    v_pedido4_id UUID := gen_random_uuid();
    v_pedido5_id UUID := gen_random_uuid();
BEGIN
    -- --------------------------------------------------------------------------
    -- 1. PEDIDO 1 (PED-2026-1001)
    -- --------------------------------------------------------------------------
    INSERT INTO public.pedidos (
        id, nr_pedido, ref_documento, client_id,
        nome_destinatario, morada, codigo_postal, localidade, pais,
        data_pedido, data_entrega, status, observacoes, created_by
    ) VALUES (
        v_pedido1_id, 'PED-2026-1001', 'REQ-CRD-SER-001', v_client_id,
        'Sermail, Logística Integrada Lda', 'Estrada de Paço de Arcos, 88 - Cacém Park, Armazém 15', '2735-336', 'São Marcos', 'Portugal',
        '2026-09-23', '2026-09-24', 'pendente', 'Entrega urgente Sermail - Encomenda CRD Lote 1', v_admin_id
    );

    -- Linhas Pedido 1
    INSERT INTO public.pedido_linhas (pedido_id, client_id, artigo_id, artigo_codigo, descricao, lote, validade, quantidade)
    VALUES 
        (v_pedido1_id, v_client_id, 'LNW2408DA', 'LNW2408DA', 'FIO SINTÉTICO ABSORVÍVEL MULTIFIL SOLUS 5/0 2AG ESPT 8MM 1/4 45CM Violeta (CDM91778590)', '250865AA', '2026-05-27', 2.00),
        (v_pedido1_id, v_client_id, 'LNW2735RB', 'LNW2735RB', 'FIO SINTÉTICO ABSORÇÃO RÁPIDA MULTIF SOLUS SWIFT-910 3/0 AG CL 22MM 1/2 70CM N Tingida (CDM91779634)', '250231AD', '2026-03-18', 3.00);

    -- Movimentos SS Pedido 1
    INSERT INTO public.movimentos (artigo_id, client_id, sigla, tipo_movimento, quantidade, tipo_armazem, armazem_loc, posicao, lote, validade, documento_ref, observacoes, created_by, data_movimento)
    VALUES 
        ('LNW2408DA', v_client_id, 'CRD', 'ss', 2.00, '01', 'CRD01', '01A01', '250865AA', '2026-05-27', 'PED-2026-1001', 'Expedição para Sermail, Logística Integrada Lda (São Marcos) - Pedido PED-2026-1001', v_admin_id, '2026-09-23 16:30:00+01'),
        ('LNW2735RB', v_client_id, 'CRD', 'ss', 3.00, '01', 'CRD01', '01A01', '250231AD', '2026-03-18', 'PED-2026-1001', 'Expedição para Sermail, Logística Integrada Lda (São Marcos) - Pedido PED-2026-1001', v_admin_id, '2026-09-23 16:30:00+01');

    -- --------------------------------------------------------------------------
    -- 2. PEDIDO 2 (PED-2026-1002)
    -- --------------------------------------------------------------------------
    INSERT INTO public.pedidos (
        id, nr_pedido, ref_documento, client_id,
        nome_destinatario, morada, codigo_postal, localidade, pais,
        data_pedido, data_entrega, status, observacoes, created_by
    ) VALUES (
        v_pedido2_id, 'PED-2026-1002', 'REQ-CRD-SER-002', v_client_id,
        'Sermail, Logística Integrada Lda', 'Estrada de Paço de Arcos, 88 - Cacém Park, Armazém 15', '2735-336', 'São Marcos', 'Portugal',
        '2026-09-23', '2026-09-24', 'pendente', 'Entrega urgente Sermail - Encomenda CRD Lote 2', v_admin_id
    );

    -- Linhas Pedido 2
    INSERT INTO public.pedido_linhas (pedido_id, client_id, artigo_id, artigo_codigo, descricao, lote, validade, quantidade)
    VALUES 
        (v_pedido2_id, v_client_id, 'WN2050', 'WN2050', 'FIO SINTÉTICO ABSORVÍVEL MULTIFIL SOLUS 2/0 SEM AG 150CM Violeta (CDM91778174)', '250767AA', '2026-03-18', 4.00),
        (v_pedido2_id, v_client_id, '05ANOEKM', '05ANOEKM', 'ANUSCÓPIO COM LUZ M', '20250302', '2026-03-26', 1.00);

    -- Movimentos SS Pedido 2
    INSERT INTO public.movimentos (artigo_id, client_id, sigla, tipo_movimento, quantidade, tipo_armazem, armazem_loc, posicao, lote, validade, documento_ref, observacoes, created_by, data_movimento)
    VALUES 
        ('WN2050', v_client_id, 'CRD', 'ss', 4.00, '01', 'CRD01', '01A01', '250767AA', '2026-03-18', 'PED-2026-1002', 'Expedição para Sermail, Logística Integrada Lda (São Marcos) - Pedido PED-2026-1002', v_admin_id, '2026-09-23 16:30:00+01'),
        ('05ANOEKM', v_client_id, 'CRD', 'ss', 1.00, '01', 'CRD01', '01A01', '20250302', '2026-03-26', 'PED-2026-1002', 'Expedição para Sermail, Logística Integrada Lda (São Marcos) - Pedido PED-2026-1002', v_admin_id, '2026-09-23 16:30:00+01');

    -- --------------------------------------------------------------------------
    -- 3. PEDIDO 3 (PED-2026-1003)
    -- --------------------------------------------------------------------------
    INSERT INTO public.pedidos (
        id, nr_pedido, ref_documento, client_id,
        nome_destinatario, morada, codigo_postal, localidade, pais,
        data_pedido, data_entrega, status, observacoes, created_by
    ) VALUES (
        v_pedido3_id, 'PED-2026-1003', 'REQ-CRD-SER-003', v_client_id,
        'Sermail, Logística Integrada Lda', 'Estrada de Paço de Arcos, 88 - Cacém Park, Armazém 15', '2735-336', 'São Marcos', 'Portugal',
        '2026-09-23', '2026-09-24', 'pendente', 'Entrega urgente Sermail - Encomenda CRD Lote 3', v_admin_id
    );

    -- Linhas Pedido 3
    INSERT INTO public.pedido_linhas (pedido_id, client_id, artigo_id, artigo_codigo, descricao, lote, validade, quantidade)
    VALUES 
        (v_pedido3_id, v_client_id, 'WN2681L', 'WN2681L', 'FIO SINTÉTICO ABSORVÍVEL MULTIFIL SOLUS 3/0 SEM AG 200CM Violeta (CDM91778310)', '250805AA', '2026-03-18', 2.00),
        (v_pedido3_id, v_client_id, 'LNW3493', 'LNW3493', 'FIO SINTÉTICO N/ABSORVÍVEL MONOFIL NYLUS 7/0 2AG CL 11MM 3/8 70CM Preto (CDM91779278)', '251084BB', '2026-03-18', 5.00);

    -- Movimentos SS Pedido 3
    INSERT INTO public.movimentos (artigo_id, client_id, sigla, tipo_movimento, quantidade, tipo_armazem, armazem_loc, posicao, lote, validade, documento_ref, observacoes, created_by, data_movimento)
    VALUES 
        ('WN2681L', v_client_id, 'CRD', 'ss', 2.00, '01', 'CRD01', '01A01', '250805AA', '2026-03-18', 'PED-2026-1003', 'Expedição para Sermail, Logística Integrada Lda (São Marcos) - Pedido PED-2026-1003', v_admin_id, '2026-09-23 16:30:00+01'),
        ('LNW3493', v_client_id, 'CRD', 'ss', 5.00, '01', 'CRD01', '01A01', '251084BB', '2026-03-18', 'PED-2026-1003', 'Expedição para Sermail, Logística Integrada Lda (São Marcos) - Pedido PED-2026-1003', v_admin_id, '2026-09-23 16:30:00+01');

    -- --------------------------------------------------------------------------
    -- 4. PEDIDO 4 (PED-2026-1004)
    -- --------------------------------------------------------------------------
    INSERT INTO public.pedidos (
        id, nr_pedido, ref_documento, client_id,
        nome_destinatario, morada, codigo_postal, localidade, pais,
        data_pedido, data_entrega, status, observacoes, created_by
    ) VALUES (
        v_pedido4_id, 'PED-2026-1004', 'REQ-CRD-SER-004', v_client_id,
        'Sermail, Logística Integrada Lda', 'Estrada de Paço de Arcos, 88 - Cacém Park, Armazém 15', '2735-336', 'São Marcos', 'Portugal',
        '2026-09-23', '2026-09-24', 'pendente', 'Entrega urgente Sermail - Encomenda CRD Lote 4', v_admin_id
    );

    -- Linhas Pedido 4
    INSERT INTO public.pedido_linhas (pedido_id, client_id, artigo_id, artigo_codigo, descricao, lote, validade, quantidade)
    VALUES 
        (v_pedido4_id, v_client_id, 'LNW2160SBP', 'LNW2160SBP', 'FIO SINTÉTICO ABSORVÍVEL MULTIFIL SOLUS 1 AG CL ROMBA 35MM 1/2 70CM Violeta (CDM91778395)', '250883AA', '2026-03-18', 2.00),
        (v_pedido4_id, v_client_id, 'LNW2500', 'LNW2500', 'FIO SINTÉTICO ABSORVÍVEL MULTIFIL SOLUS 5/0 AG LC 19MM 3/8 45CM Violeta (CDM91778670)', '250849AA', '2026-03-18', 3.00);

    -- Movimentos SS Pedido 4
    INSERT INTO public.movimentos (artigo_id, client_id, sigla, tipo_movimento, quantidade, tipo_armazem, armazem_loc, posicao, lote, validade, documento_ref, observacoes, created_by, data_movimento)
    VALUES 
        ('LNW2160SBP', v_client_id, 'CRD', 'ss', 2.00, '01', 'CRD01', '01A01', '250883AA', '2026-03-18', 'PED-2026-1004', 'Expedição para Sermail, Logística Integrada Lda (São Marcos) - Pedido PED-2026-1004', v_admin_id, '2026-09-23 16:30:00+01'),
        ('LNW2500', v_client_id, 'CRD', 'ss', 3.00, '01', 'CRD01', '01A01', '250849AA', '2026-03-18', 'PED-2026-1004', 'Expedição para Sermail, Logística Integrada Lda (São Marcos) - Pedido PED-2026-1004', v_admin_id, '2026-09-23 16:30:00+01');

    -- --------------------------------------------------------------------------
    -- 5. PEDIDO 5 (PED-2026-1005)
    -- --------------------------------------------------------------------------
    INSERT INTO public.pedidos (
        id, nr_pedido, ref_documento, client_id,
        nome_destinatario, morada, codigo_postal, localidade, pais,
        data_pedido, data_entrega, status, observacoes, created_by
    ) VALUES (
        v_pedido5_id, 'PED-2026-1005', 'REQ-CRD-SER-005', v_client_id,
        'Sermail, Logística Integrada Lda', 'Estrada de Paço de Arcos, 88 - Cacém Park, Armazém 15', '2735-336', 'São Marcos', 'Portugal',
        '2026-09-23', '2026-09-24', 'pendente', 'Entrega urgente Sermail - Encomenda CRD Lote 5', v_admin_id
    );

    -- Linhas Pedido 5
    INSERT INTO public.pedido_linhas (pedido_id, client_id, artigo_id, artigo_codigo, descricao, lote, validade, quantidade)
    VALUES 
        (v_pedido5_id, v_client_id, 'LNW2797ML', 'LNW2797ML', 'FIO SINTÉTICO ABSORÇÃO RÁPIDA MULTIF SOLUS SWIFT-910 2/0 AG LC 35MM 3/8 70CM N Tingida (CDM91779685)', '250357AD', '2026-03-18', 6.00),
        (v_pedido5_id, v_client_id, 'SUV-2C-B', 'SUV-2C-B', 'URETEROSCOPIO SCI DE 7,5FR ( NO DAMPING )', '2026020619', '2026-04-28', 1.00);

    -- Movimentos SS Pedido 5
    INSERT INTO public.movimentos (artigo_id, client_id, sigla, tipo_movimento, quantidade, tipo_armazem, armazem_loc, posicao, lote, validade, documento_ref, observacoes, created_by, data_movimento)
    VALUES 
        ('LNW2797ML', v_client_id, 'CRD', 'ss', 6.00, '01', 'CRD01', '01A01', '250357AD', '2026-03-18', 'PED-2026-1005', 'Expedição para Sermail, Logística Integrada Lda (São Marcos) - Pedido PED-2026-1005', v_admin_id, '2026-09-23 16:30:00+01'),
        ('SUV-2C-B', v_client_id, 'CRD', 'ss', 1.00, '01', 'CRD01', '01A01', '2026020619', '2026-04-28', 'PED-2026-1005', 'Expedição para Sermail, Logística Integrada Lda (São Marcos) - Pedido PED-2026-1005', v_admin_id, '2026-09-23 16:30:00+01');

END $$;
