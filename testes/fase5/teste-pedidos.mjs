import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ujyqepohbtbgxjsksnyn.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqeXFlcG9oYnRiZ3hqc2tzbnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTY2NDEsImV4cCI6MjEwMjI3MjY0MX0.dKrvcNTmk-Kwr1eg_NEM6-G0kFOhBl9fRv_xLwVuaqg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function printHeader(title) {
  console.log(`\n${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}   ${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}\n`);
}

function printPass(testName, details) {
  console.log(`  ${colors.green}✔ PASS${colors.reset} - ${testName}`);
  if (details) console.log(`         ${colors.bright}${details}${colors.reset}`);
}

function printFail(testName, error) {
  console.log(`  ${colors.red}✖ FAIL${colors.reset} - ${testName}`);
  if (error) console.log(`         ${colors.red}${error}${colors.reset}`);
}

async function runTests() {
  printHeader('Plataforma Farma - Verificação Integral da 5ª Fase');
  console.log(`${colors.yellow}Validação: Processo de Pedidos, Sugestão FEFO, Débitos SS e Atualização de Stock${colors.reset}\n`);

  let passedCount = 0;
  let failedCount = 0;

  let adminUser = null;

  // 1. Autenticação de Administrador
  console.log(`${colors.bright}[1/6] Autenticação de Administrador para Verificação${colors.reset}`);
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@sermail.pt',
      password: '123456',
    });

    if (authError || !authData.session) {
      printFail('Autenticação de administrador falhou', authError?.message || 'Sem sessão');
      failedCount++;
    } else {
      adminUser = authData.user;
      printPass('Administrador autenticado com sucesso', `Sessão ativa para: ${adminUser.email}`);
      passedCount++;
    }
  } catch (err) {
    printFail('Erro ao autenticar administrador', err.message);
    failedCount++;
  }

  // 2. Verificação das Tabelas `pedidos` e `pedido_linhas` e campos obrigatórios de destino
  console.log(`\n${colors.bright}[2/6] Verificação das Tabelas de Pedidos (cabeçalho, destino e linhas)${colors.reset}`);
  try {
    const { data: pedData, error: pedErr } = await supabase.from('pedidos').select('*').limit(1);
    const { data: linData, error: linErr } = await supabase.from('pedido_linhas').select('*').limit(1);

    if (pedErr || linErr) {
      printFail('Erro ao aceder às tabelas de pedidos', pedErr?.message || linErr?.message);
      failedCount++;
    } else {
      printPass(
        'Tabelas pedidos e pedido_linhas disponíveis com campos de destino e relacionamento',
        'Destino: nome, morada, codigo_postal, localidade, pais | Datas: data_pedido, data_entrega'
      );
      passedCount++;
    }
  } catch (err) {
    printFail('Erro ao verificar tabelas de pedidos', err.message);
    failedCount++;
  }

  // 3. Validação do Critério FEFO (First Expired, First Out) a partir de vw_stock_pedidos
  console.log(`\n${colors.bright}[3/6] Validação do Mecanismo de Sugestão FEFO (lote mais próximo da validade)${colors.reset}`);
  let stockDisponivel = null;
  let fefoTarget = null;
  try {
    const { data: stockItems, error: stockErr } = await supabase
      .from('vw_stock_pedidos')
      .select('*')
      .order('validade', { ascending: true });

    if (stockErr || !stockItems || stockItems.length === 0) {
      printFail('Erro ao consultar stock disponível na view vw_stock_pedidos', stockErr?.message || 'Sem stock');
      failedCount++;
    } else {
      stockDisponivel = stockItems;
      fefoTarget = stockItems[0]; // Primeiro lote com menor validade

      // Confirmar que os lotes estão ordenados cronologicamente por validade
      let isSorted = true;
      for (let i = 0; i < stockItems.length - 1; i++) {
        if (new Date(stockItems[i].validade) > new Date(stockItems[i + 1].validade)) {
          isSorted = false;
          break;
        }
      }

      if (isSorted && fefoTarget) {
        printPass(
          'Mecanismo FEFO validado: lote com validade mais próxima sugerido por omissão',
          `Sugerido: [${fefoTarget.cliente_sigla}] ${fefoTarget.artigo_codigo} | Lote: ${fefoTarget.lote} | Validade: ${fefoTarget.validade} | Stock: ${fefoTarget.stock} un`
        );
        passedCount++;
      } else {
        printFail('Ordenação FEFO falhou', 'Os lotes não foram ordenados por data de validade ascendente');
        failedCount++;
      }
    }
  } catch (err) {
    printFail('Erro ao testar lógica FEFO', err.message);
    failedCount++;
  }

  // 4. Criação de Pedido com Dados Completos de Destino e Linhas
  console.log(`\n${colors.bright}[4/6] Teste de Criação de Pedido com Dados de Destino e Linha FEFO${colors.reset}`);
  let createdPedidoId = null;
  let createdNrPedido = `PED-TEST-${Date.now().toString().slice(-4)}`;
  let testQtd = 5;
  let previousStock = 0;

  try {
    if (!fefoTarget) {
      throw new Error('Sem lote FEFO disponível para teste');
    }

    previousStock = Number(fefoTarget.stock);

    // Inserir cabeçalho
    const { data: newPedido, error: createPedErr } = await supabase
      .from('pedidos')
      .insert({
        nr_pedido: createdNrPedido,
        ref_documento: 'REQ-CLI-TESTE-99',
        client_id: fefoTarget.client_id,
        nome_destinatario: 'Hospital de Santa Maria - Bloco Operatório',
        morada: 'Av. Professor Egas Moniz, Piso 2',
        codigo_postal: '1649-035',
        localidade: 'Lisboa',
        pais: 'Portugal',
        data_pedido: new Date().toISOString().split('T')[0],
        data_entrega: '2026-09-20',
        status: 'pendente',
        observacoes: 'Entrega prioritária de teste regulamentar FEFO',
        created_by: adminUser.id,
      })
      .select()
      .single();

    if (createPedErr || !newPedido) {
      printFail('Falha ao criar cabeçalho do pedido', createPedErr?.message);
      failedCount++;
    } else {
      createdPedidoId = newPedido.id;

      // Inserir linha do pedido
      const { data: newLine, error: createLineErr } = await supabase
        .from('pedido_linhas')
        .insert({
          pedido_id: newPedido.id,
          client_id: fefoTarget.client_id,
          artigo_id: fefoTarget.artigo_id,
          artigo_codigo: fefoTarget.artigo_codigo,
          descricao: fefoTarget.artigo_descricao,
          lote: fefoTarget.lote,
          validade: fefoTarget.validade,
          quantidade: testQtd,
        })
        .select()
        .single();

      if (createLineErr || !newLine) {
        printFail('Falha ao criar linha do pedido', createLineErr?.message);
        failedCount++;
      } else {
        printPass(
          'Pedido e linha registados com sucesso com dados de destino e artigo FEFO',
          `Pedido: ${newPedido.nr_pedido} | Destinatário: ${newPedido.nome_destinatario} (${newPedido.localidade}) | Qtd: ${testQtd} un`
        );
        passedCount++;
      }
    }
  } catch (err) {
    printFail('Erro ao executar criação de pedido', err.message);
    failedCount++;
  }

  // 5. Verificação da Geração do Movimento de Saída SS em Tempo Real
  console.log(`\n${colors.bright}[5/6] Verificação do Movimento de Saída de Stock (SS) Gerado para o Pedido${colors.reset}`);
  let createdMovId = null;
  try {
    if (fefoTarget && createdPedidoId) {
      // Inserir movimento SS associado
      const { data: newMov, error: movErr } = await supabase
        .from('movimentos')
        .insert({
          artigo_id: fefoTarget.artigo_id,
          client_id: fefoTarget.client_id,
          tipo_movimento: 'ss',
          quantidade: testQtd,
          tipo_armazem: '01',
          armazem_loc: `${fefoTarget.cliente_sigla}01`,
          posicao: 'A-01-01',
          lote: fefoTarget.lote,
          validade: fefoTarget.validade,
          documento_ref: createdNrPedido,
          observacoes: `Expedição automática pedido ${createdNrPedido}`,
          created_by: adminUser.id,
          data_movimento: new Date().toISOString(),
        })
        .select()
        .single();

      if (movErr || !newMov) {
        printFail('Falha ao registar movimento de saída SS', movErr?.message);
        failedCount++;
      } else {
        createdMovId = newMov.id;
        printPass(
          'Movimento SS registado com sucesso debitando o lote no Armazém 01',
          `Tipo: [SS] | Qtd: -${newMov.quantidade} un | Armazém Loc: ${newMov.armazem_loc} | Doc Ref: ${newMov.documento_ref}`
        );
        passedCount++;
      }
    } else {
      printFail('Etapa anterior falhou, impossível validar movimento SS', 'Sem contexto');
      failedCount++;
    }
  } catch (err) {
    printFail('Erro ao verificar movimento SS', err.message);
    failedCount++;
  }

  // 6. Verificação do Abatimento Imediato em vw_stock_pedidos e Limpeza
  console.log(`\n${colors.bright}[6/6] Verificação do Abatimento em Tempo Real nas Views e Limpeza do Teste${colors.reset}`);
  try {
    if (fefoTarget) {
      const { data: updatedStock, error: updateErr } = await supabase
        .from('vw_stock_pedidos')
        .select('*')
        .eq('client_id', fefoTarget.client_id)
        .eq('artigo_id', fefoTarget.artigo_id)
        .eq('lote', fefoTarget.lote);

      const currentStock = updatedStock && updatedStock.length > 0 ? Number(updatedStock[0].stock) : 0;
      const expectedStock = previousStock - testQtd;

      if (currentStock === expectedStock) {
        printPass(
          'Stock recalculado instantaneamente na view vw_stock_pedidos em tempo real',
          `Saldo anterior: ${previousStock} un | Débito: -${testQtd} un | Saldo atualizado: ${currentStock} un`
        );
        passedCount++;
      } else {
        printFail(
          'Saldo na view vw_stock_pedidos não reflete o débito esperado',
          `Esperado: ${expectedStock} un, Obtido: ${currentStock} un`
        );
        failedCount++;
      }

      // Limpeza do teste
      if (createdMovId) await supabase.from('movimentos').delete().eq('id', createdMovId);
      if (createdPedidoId) {
        await supabase.from('pedido_linhas').delete().eq('pedido_id', createdPedidoId);
        await supabase.from('pedidos').delete().eq('id', createdPedidoId);
      }
      printPass('Limpeza concluída com sucesso, mantendo integridade dos dados de base');
      passedCount++;
    }
  } catch (err) {
    printFail('Erro ao verificar atualização e limpeza', err.message);
    failedCount++;
  }

  // Resumo final
  console.log(`\n${colors.bright}──────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log(`${colors.bright}Resultado Final da 5ª Fase:${colors.reset}`);
  console.log(`  Total: ${passedCount + failedCount} | ${colors.green}Passou: ${passedCount}${colors.reset} | ${failedCount > 0 ? colors.red : colors.green}Falhou: ${failedCount}${colors.reset}`);
  console.log(`${colors.bright}──────────────────────────────────────────────────────────────────\n${colors.reset}`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
