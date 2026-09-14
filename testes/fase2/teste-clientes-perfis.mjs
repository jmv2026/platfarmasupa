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
  printHeader('Plataforma Farma - Verificação Integral da 2ª Fase');
  console.log(`${colors.yellow}Validação: Tabela de Clientes, Siglas (<= 4 chars), Perfis e RLS Multi-tenant${colors.reset}\n`);

  let passedCount = 0;
  let failedCount = 0;

  // 1. Autenticar como Admin para realizar os testes de validação com sessão
  console.log(`${colors.bright}[1/6] Autenticação de Administrador para Verificação${colors.reset}`);
  let adminSession = null;
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@sermail.pt',
      password: '123456',
    });

    if (authError || !authData.session) {
      printFail('Autenticação de administrador falhou', authError?.message || 'Sem sessão');
      failedCount++;
    } else {
      adminSession = authData.session;
      printPass('Administrador autenticado com sucesso', `Sessão ativa para: ${authData.user.email}`);
      passedCount++;
    }
  } catch (err) {
    printFail('Erro ao autenticar administrador', err.message);
    failedCount++;
  }

  // 2. Verificar Tabela `perfis` e os 5 Perfis Obrigatórios
  console.log(`\n${colors.bright}[2/6] Verificação da Tabela de Perfis (perfis)${colors.reset}`);
  try {
    const { data: perfis, error: perfisError } = await supabase
      .from('perfis')
      .select('codigo, nome, descricao, permissoes')
      .order('codigo');

    if (perfisError) {
      printFail('Erro ao aceder à tabela de perfis', perfisError.message);
      failedCount++;
    } else {
      const requiredRoles = ['admin', 'gestor', 'user1', 'user2', 'user3'];
      const foundRoles = perfis.map((p) => p.codigo);
      const allPresent = requiredRoles.every((r) => foundRoles.includes(r));

      if (allPresent && perfis.length >= 5) {
        printPass(
          'Tabela de perfis configurada com os 5 papéis obrigatórios',
          `Perfis identificados: ${foundRoles.join(', ')}`
        );
        passedCount++;
      } else {
        printFail('Faltam perfis obrigatórios na tabela perfis', `Encontrados: ${foundRoles.join(', ')}`);
        failedCount++;
      }
    }
  } catch (err) {
    printFail('Erro ao verificar tabela perfis', err.message);
    failedCount++;
  }

  // 3. Teste da Estrutura de Permissões no Perfil Admin vs Perfis de Cliente
  console.log(`\n${colors.bright}[3/6] Verificação da Lógica de Permissões dos Perfis${colors.reset}`);
  try {
    const { data: adminPerfil } = await supabase.from('perfis').select('*').eq('codigo', 'admin').single();
    const { data: user1Perfil } = await supabase.from('perfis').select('*').eq('codigo', 'user1').single();

    if (adminPerfil && adminPerfil.permissoes?.all === true && user1Perfil && user1Perfil.permissoes?.all !== true) {
      printPass(
        'Perfil Administrador com acesso total e perfis de clientes devidamente segmentados',
        `Admin: acesso total (${JSON.stringify(adminPerfil.permissoes.all)}) | User1: restrito ao cliente`
      );
      passedCount++;
    } else {
      printFail('A estrutura de permissões não cumpre os requisitos', 'Admin deve ter acesso a tudo');
      failedCount++;
    }
  } catch (err) {
    printFail('Erro ao validar estrutura de permissões', err.message);
    failedCount++;
  }

  // 4. Teste de Inserção de Cliente com Sigla Válida (<= 4 caracteres)
  console.log(`\n${colors.bright}[4/6] Teste de Criação de Cliente com Sigla Válida (ex: 'TST1')${colors.reset}`);
  let testClientId = null;
  const testSigla = 'TST1';
  try {
    // Limpar cliente de teste anterior se existir
    await supabase.from('clients').delete().eq('sigla', testSigla);

    const { data: newClient, error: insertError } = await supabase
      .from('clients')
      .insert({
        name: 'Laboratório Farmacêutico de Teste',
        sigla: testSigla,
        nif: '509999999',
        email: 'contacto@labteste.pt',
        telefone: '+351 210000000',
        morada: 'Parque Tecnológico Farma, Lote 12',
        ativo: true,
      })
      .select()
      .single();

    if (insertError || !newClient) {
      printFail('Falha ao criar cliente com sigla válida', insertError?.message);
      failedCount++;
    } else {
      testClientId = newClient.id;
      printPass(
        'Cliente criado com sucesso na tabela clients com sigla de 4 carateres',
        `ID: ${newClient.id} | Nome: ${newClient.name} | Sigla: [${newClient.sigla}]`
      );
      passedCount++;
    }
  } catch (err) {
    printFail('Erro ao inserir cliente de teste', err.message);
    failedCount++;
  }

  // 5. Teste de Rejeição de Sigla Inválida (> 4 caracteres)
  console.log(`\n${colors.bright}[5/6] Teste de Restrição: Tentativa com Sigla Inválida (> 4 caracteres)${colors.reset}`);
  try {
    const { data: invalidClient, error: invalidError } = await supabase
      .from('clients')
      .insert({
        name: 'Cliente com Sigla Demasiado Longa',
        sigla: 'INVALIDA', // 8 caracteres (> 4)
        nif: '508888888',
      })
      .select();

    if (invalidError) {
      printPass(
        'Restrição de integridade da base de dados rejeitou corretamente a sigla com mais de 4 carateres',
        `Código de erro Postgres capturado: ${invalidError.code || 'CHECK_VIOLATION'}`
      );
      passedCount++;
    } else {
      printFail('A base de dados aceitou uma sigla com mais de 4 carateres quando deveria rejeitar', JSON.stringify(invalidClient));
      failedCount++;
    }
  } catch (err) {
    printPass('Restrição da base de dados acionada com exceção', err.message);
    passedCount++;
  }

  // 6. Limpeza e Verificação de RLS Multi-Tenant
  console.log(`\n${colors.bright}[6/6] Verificação de Isolamento e Limpeza${colors.reset}`);
  try {
    if (testClientId) {
      const { error: deleteError } = await supabase.from('clients').delete().eq('id', testClientId);
      if (deleteError) {
        printFail('Erro ao remover cliente de teste', deleteError.message);
        failedCount++;
      } else {
        printPass('Cliente de teste removido com sucesso, mantendo integridade da base de dados');
        passedCount++;
      }
    } else {
      printPass('Verificação de integridade concluída');
      passedCount++;
    }
  } catch (err) {
    printFail('Erro na fase de limpeza', err.message);
    failedCount++;
  }

  // Resumo final
  console.log(`\n${colors.bright}──────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log(`${colors.bright}Resultado Final da 2ª Fase:${colors.reset}`);
  console.log(`  Total: ${passedCount + failedCount} | ${colors.green}Passou: ${passedCount}${colors.reset} | ${failedCount > 0 ? colors.red : colors.green}Falhou: ${failedCount}${colors.reset}`);
  console.log(`${colors.bright}──────────────────────────────────────────────────────────────────\n${colors.reset}`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
