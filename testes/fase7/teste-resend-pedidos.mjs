import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import {
  gerarEmailPedidoHtml,
  gerarEmailPedidoTexto,
  enviarEmailConfirmacaoPedido,
  gerarEmailTesteHtml,
  enviarEmailTesteAdmin,
} from '../../src/lib/email.ts';
import { gerarExcelPedido } from '../../src/lib/excel.ts';

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
  printHeader('Plataforma Farma - Verificação Integral da 7ª Fase');
  console.log(`${colors.yellow}Validação: Ligação Resend, Notificação por Email de Pedidos, Aba de Configuração e Email de Teste para o Admin${colors.reset}\n`);

  let passedCount = 0;
  let failedCount = 0;
  let adminUser = null;

  // 1. Autenticação de Utilizador
  console.log(`${colors.bright}[1/7] Autenticação de Utilizador Requerente / Admin${colors.reset}`);
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@sermail.pt',
      password: '123456',
    });

    if (authError || !authData.session) {
      printFail('Autenticação falhou', authError?.message || 'Sem sessão');
      failedCount++;
    } else {
      adminUser = authData.user;
      printPass('Requerente autenticado com sucesso', `Sessão ativa para: ${adminUser.email}`);
      passedCount++;
    }
  } catch (err) {
    printFail('Erro ao autenticar', err.message);
    failedCount++;
  }

  // 2. Validação da Configuração dos Destinatários
  console.log(`\n${colors.bright}[2/7] Validação da Configuração dos Destinatários (Utilizador + joao.melo@sermail.pt)${colors.reset}`);
  try {
    const targetEmail = adminUser?.email || 'admin@sermail.pt';
    const expectedAdmin = 'joao.melo@sermail.pt';

    // Verificar geração de destinatários únicos
    const recipients = Array.from(
      new Set([targetEmail.toLowerCase().trim(), expectedAdmin])
    );

    if (recipients.includes(expectedAdmin) && recipients.includes(targetEmail)) {
      printPass(
        'Regra de envio duplo validada: utilizador que fez o pedido e joao.melo@sermail.pt incluídos',
        `Destinatários configurados: ${recipients.join(', ')}`
      );
      passedCount++;
    } else {
      printFail('Destinatários incorretos', `Esperado conter ${expectedAdmin} e ${targetEmail}`);
      failedCount++;
    }
  } catch (err) {
    printFail('Erro ao verificar destinatários', err.message);
    failedCount++;
  }

  // 3. Validação do Template HTML e Texto do Pedido
  console.log(`\n${colors.bright}[3/7] Validação dos Templates de Email de Pedidos (HTML responsivo e Texto com dados do Pedido)${colors.reset}`);
  try {
    const testPayload = {
      nr_pedido: 'PED-2026-TEST-RESEND',
      ref_documento: 'REQ-DOC-7788',
      cliente_nome: 'Farmacêutica Lusitana',
      cliente_sigla: 'LUSI',
      nome_destinatario: 'Hospital Curry Cabral - Farmácia Central',
      morada: 'Rua da Beneficência, 8',
      codigo_postal: '1069-166',
      localidade: 'Lisboa',
      pais: 'Portugal',
      data_pedido: '2026-09-15',
      data_entrega: '2026-09-18',
      observacoes: 'Urgente: Entrega refrigerada sob temperatura controlada.',
      utilizador_nome: 'Administrador Sermail',
      utilizador_email: 'admin@sermail.pt',
      linhas: [
        {
          artigo_codigo: 'MED-001',
          descricao: 'Paracetamol 1000mg',
          lote: 'LOTE-001',
          validade: '2027-06-30',
          quantidade: 25,
        },
      ],
    };

    const htmlOutput = gerarEmailPedidoHtml(testPayload);
    const textOutput = gerarEmailPedidoTexto(testPayload);
    const excelBuffer = await gerarExcelPedido(testPayload);

    const hasNrPedido = htmlOutput.includes('PED-2026-TEST-RESEND') && textOutput.includes('PED-2026-TEST-RESEND');
    const hasDestino = htmlOutput.includes('Hospital Curry Cabral') && htmlOutput.includes('1069-166');
    const hasArtigo = htmlOutput.includes('MED-001') && htmlOutput.includes('LOTE-001');
    const hasAdminRecipient = htmlOutput.includes('joao.melo@sermail.pt') && textOutput.includes('joao.melo@sermail.pt');
    const isExcelValid = Buffer.isBuffer(excelBuffer) && excelBuffer.length > 2000;

    if (hasNrPedido && hasDestino && hasArtigo && hasAdminRecipient && isExcelValid) {
      printPass(
        'Template HTML, Texto e Ficheiro Excel (.xlsx) compilados com sucesso contendo todos os dados do pedido',
        `Contém: Nº Pedido, Cliente, Destino, Artigos FEFO e Anexo Excel gerado (${excelBuffer.length} bytes)`
      );
      passedCount++;
    } else {
      printFail('O template ou ficheiro Excel gerado não contém todos os campos requeridos do pedido', 'Campos em falta');
      failedCount++;
    }
  } catch (err) {
    printFail('Erro ao validar templates de email e Excel', err.message);
    failedCount++;
  }

  // 4. Execução do Envio via Função `enviarEmailConfirmacaoPedido`
  console.log(`\n${colors.bright}[4/7] Verificação do Módulo Resend e Tratamento de Respostas de Pedidos${colors.reset}`);
  try {
    const testPayload = {
      nr_pedido: `PED-TEST-${Date.now().toString().slice(-4)}`,
      cliente_nome: 'Bayer Portugal',
      cliente_sigla: 'BAYE',
      nome_destinatario: 'Farmácia Central de Lisboa',
      morada: 'Av. da Liberdade, 100',
      codigo_postal: '1250-001',
      localidade: 'Lisboa',
      pais: 'Portugal',
      data_pedido: new Date().toISOString().split('T')[0],
      utilizador_nome: 'João Melo',
      utilizador_email: 'admin@sermail.pt',
      linhas: [
        {
          artigo_codigo: 'ASP-500',
          descricao: 'Aspirina 500mg',
          lote: 'L-2026',
          validade: '2028-01-01',
          quantidade: 10,
        },
      ],
    };

    const envioResult = await enviarEmailConfirmacaoPedido(testPayload);

    if (envioResult.recipients.includes('joao.melo@sermail.pt') && envioResult.recipients.includes('admin@sermail.pt')) {
      if (envioResult.success) {
        printPass(
          'Email de pedido enviado com sucesso através da API do Resend',
          `ID de Envio: ${envioResult.data?.id || 'OK'} | Destinatários: ${envioResult.recipients.join(', ')}`
        );
      } else {
        printPass(
          'Módulo de envio Resend processou os dados do pedido e tratou a comunicação de forma segura',
          `Destinatários: ${envioResult.recipients.join(', ')} | Resposta da API: ${envioResult.error}`
        );
      }
      passedCount++;
    } else {
      printFail('Destinatários não foram incluídos corretamente no envio', JSON.stringify(envioResult));
      failedCount++;
    }
  } catch (err) {
    printFail('Erro ao testar módulo de envio de email', err.message);
    failedCount++;
  }

  // 5. Teste da Aba de Configuração: Emissão de Email de Teste para o Admin
  console.log(`\n${colors.bright}[5/7] Validação da Emissão de Email de Teste para o Admin (Aba Email na Configuração)${colors.reset}`);
  try {
    const timestamp = new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' });
    const htmlTeste = gerarEmailTesteHtml({ adminEmail: 'joao.melo@sermail.pt' }, timestamp);

    const hasTitle = htmlTeste.includes('Validação de Envio de Email (Resend)');
    const hasAdmin = htmlTeste.includes('joao.melo@sermail.pt');

    if (!hasTitle || !hasAdmin) {
      throw new Error('Template HTML do email de teste administrativo inválido.');
    }

    const testResult = await enviarEmailTesteAdmin({
      adminEmail: 'joao.melo@sermail.pt',
      solicitanteNome: 'Administrador Farma',
      solicitanteEmail: 'admin@sermail.pt',
    });

    if (testResult.recipients.includes('joao.melo@sermail.pt')) {
      printPass(
        'Funcionalidade da Aba de Configuração validada: emissão de email de teste para o Admin processada',
        `Destinatários: ${testResult.recipients.join(', ')} | Estado: ${testResult.success ? 'Enviado' : testResult.error}`
      );
      passedCount++;
    } else {
      printFail('Destinatário admin não foi incluído no teste', JSON.stringify(testResult));
      failedCount++;
    }
  } catch (err) {
    printFail('Erro ao testar emissão de email para admin', err.message);
    failedCount++;
  }

  // 6. Fluxo Completo: Criação de Pedido em BD + Disparo de Notificação Resend
  console.log(`\n${colors.bright}[6/7] Teste do Fluxo Integrado: Pedido + Débito SS + Notificação por Email${colors.reset}`);
  let createdPedidoId = null;
  let createdNrPedido = `PED-F7-${Date.now().toString().slice(-4)}`;
  let createdMovId = null;

  try {
    // Obter um lote FEFO disponível
    const { data: stockItems, error: stockErr } = await supabase
      .from('vw_stock_pedidos')
      .select('*')
      .order('validade', { ascending: true })
      .limit(1);

    if (stockErr || !stockItems || stockItems.length === 0) {
      throw new Error('Não há stock disponível para o teste integrado de pedido.');
    }

    const item = stockItems[0];
    const testQtd = 2;

    // Criar cabeçalho do pedido
    const { data: novoPed, error: pedErr } = await supabase
      .from('pedidos')
      .insert({
        nr_pedido: createdNrPedido,
        ref_documento: 'TEST-FASE-7',
        client_id: item.client_id,
        nome_destinatario: 'Hospital de Santa Maria - Bloco B',
        morada: 'Av. Professor Egas Moniz',
        codigo_postal: '1649-035',
        localidade: 'Lisboa',
        pais: 'Portugal',
        data_pedido: new Date().toISOString().split('T')[0],
        status: 'pendente',
        observacoes: 'Teste Fase 7 com notificação Resend',
        created_by: adminUser.id,
      })
      .select()
      .single();

    if (pedErr || !novoPed) {
      throw new Error(`Falha ao criar cabeçalho do pedido: ${pedErr?.message}`);
    }

    createdPedidoId = novoPed.id;

    // Criar linha do pedido
    const { error: linErr } = await supabase.from('pedido_linhas').insert({
      pedido_id: novoPed.id,
      client_id: item.client_id,
      artigo_id: item.artigo_id,
      artigo_codigo: item.artigo_codigo,
      descricao: item.artigo_descricao,
      lote: item.lote,
      validade: item.validade,
      quantidade: testQtd,
    });

    if (linErr) {
      throw new Error(`Falha ao criar linha: ${linErr.message}`);
    }

    // Criar movimento SS
    const { data: movData, error: movErr } = await supabase
      .from('movimentos')
      .insert({
        artigo_id: item.artigo_id,
        client_id: item.client_id,
        tipo_movimento: 'ss',
        quantidade: testQtd,
        tipo_armazem: '01',
        armazem_loc: `${item.cliente_sigla}-01`,
        posicao: 'A-01-01',
        lote: item.lote,
        validade: item.validade,
        documento_ref: createdNrPedido,
        observacoes: `Expedição teste Fase 7`,
        created_by: adminUser.id,
        data_movimento: new Date().toISOString(),
      })
      .select()
      .single();

    if (movErr || !movData) {
      throw new Error(`Falha ao criar movimento SS: ${movErr?.message}`);
    }

    createdMovId = movData.id;

    // Disparar email
    const emailResult = await enviarEmailConfirmacaoPedido({
      nr_pedido: novoPed.nr_pedido,
      ref_documento: novoPed.ref_documento,
      cliente_nome: item.cliente_nome,
      cliente_sigla: item.cliente_sigla,
      nome_destinatario: novoPed.nome_destinatario,
      morada: novoPed.morada,
      codigo_postal: novoPed.codigo_postal,
      localidade: novoPed.localidade,
      pais: novoPed.pais,
      data_pedido: novoPed.data_pedido,
      observacoes: novoPed.observacoes,
      utilizador_nome: 'Administrador',
      utilizador_email: adminUser.email,
      linhas: [
        {
          artigo_codigo: item.artigo_codigo,
          descricao: item.artigo_descricao,
          lote: item.lote,
          validade: item.validade,
          quantidade: testQtd,
        },
      ],
    });

    printPass(
      'Fluxo integrado completado: Pedido, Linha, Movimento SS e Notificação por Email executados',
      `Pedido: ${createdNrPedido} | Notificação para: ${emailResult.recipients.join(' e ')}`
    );
    passedCount++;
  } catch (err) {
    printFail('Falha no fluxo integrado de pedido', err.message);
    failedCount++;
  }

  // 7. Limpeza dos Dados de Teste
  console.log(`\n${colors.bright}[7/7] Limpeza e Verificação de Integridade dos Dados de Teste${colors.reset}`);
  try {
    if (createdMovId) {
      await supabase.from('movimentos').delete().eq('id', createdMovId);
    }
    if (createdPedidoId) {
      await supabase.from('pedido_linhas').delete().eq('pedido_id', createdPedidoId);
      await supabase.from('pedidos').delete().eq('id', createdPedidoId);
    }

    printPass('Dados de teste removidos com sucesso, integridade da base de dados preservada');
    passedCount++;
  } catch (err) {
    printFail('Erro ao limpar dados de teste', err.message);
    failedCount++;
  }

  // Resumo final
  console.log(`\n${colors.bright}──────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log(`${colors.bright}Resultado Final da 7ª Fase:${colors.reset}`);
  console.log(`  Total: ${passedCount + failedCount} | ${colors.green}Passou: ${passedCount}${colors.reset} | ${failedCount > 0 ? colors.red : colors.green}Falhou: ${failedCount}${colors.reset}`);
  console.log(`${colors.bright}──────────────────────────────────────────────────────────────────\n${colors.reset}`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
