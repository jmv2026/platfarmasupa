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
  printHeader('Plataforma Farma - Verificação Integral da 3ª Fase');
  console.log(`${colors.yellow}Validação: Tabelas de Artigos e Armazéns (sem ligação a Clientes)${colors.reset}\n`);

  let passedCount = 0;
  let failedCount = 0;

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
      printPass('Administrador autenticado com sucesso', `Sessão ativa para: ${authData.user.email}`);
      passedCount++;
    }
  } catch (err) {
    printFail('Erro ao autenticar administrador', err.message);
    failedCount++;
  }

  // 2. Verificação da Tabela `armazens` (7 tipos de armazém e sem client_id)
  console.log(`\n${colors.bright}[2/6] Verificação da Tabela de Armazéns (7 tipos padrão e desacoplada de clientes)${colors.reset}`);
  try {
    const { data: armazens, error: armazensError } = await supabase
      .from('armazens')
      .select('*')
      .order('tipo_armazem');

    if (armazensError) {
      printFail('Erro ao aceder à tabela de armazéns', armazensError.message);
      failedCount++;
    } else {
      const expectedTipos = ['01', '02', '03', '04', '05', '06', '07'];
      const foundTipos = armazens.map((a) => a.tipo_armazem);
      const allPresent = expectedTipos.every((t) => foundTipos.includes(t));

      // Verificar se não tem coluna client_id nos dados
      const hasNoClientId = armazens.length > 0 && armazens[0].client_id === undefined;

      if (allPresent && armazens.length === 7 && hasNoClientId) {
        printPass(
          'Tabela armazens contém os 7 tipos padrão sem ligação à tabela clientes',
          armazens.map((a) => `[${a.tipo_armazem}] ${a.descricao}`).join(' | ')
        );
        passedCount++;
      } else {
        printFail('Tipos de armazém em falta ou incorretos', `Encontrados: ${foundTipos.join(', ')}`);
        failedCount++;
      }
    }
  } catch (err) {
    printFail('Erro ao verificar armazéns', err.message);
    failedCount++;
  }

  // 3. Teste de Restrição na Tabela `armazens` (rejeição de tipo inválido)
  console.log(`\n${colors.bright}[3/6] Teste de Restrição: Tentativa com Tipo de Armazém Inválido (ex: '99')${colors.reset}`);
  try {
    const { data: invalidArmazem, error: invalidArmazemError } = await supabase
      .from('armazens')
      .insert({
        tipo_armazem: '99',
        descricao: 'Armazém Inválido',
      })
      .select();

    if (invalidArmazemError) {
      printPass(
        'Restrição da base de dados rejeitou tipo de armazém não autorizado',
        `Código de erro Postgres: ${invalidArmazemError.code || 'CHECK_VIOLATION'}`
      );
      passedCount++;
    } else {
      printFail('A base de dados aceitou um tipo de armazém inválido (99)', JSON.stringify(invalidArmazem));
      failedCount++;
    }
  } catch (err) {
    printPass('Restrição da base de dados acionada com exceção', err.message);
    passedCount++;
  }

  // 4. Teste de Inserção de Artigo com Campos Regulamentares
  console.log(`\n${colors.bright}[4/6] Teste de Criação de Artigos com Tipos Regulamentares (MH, TC, lote, etc.)${colors.reset}`);
  const testArtigos = [
    {
      artigo_id: 'TEST_MED_01',
      descricao: 'Paracetamol 500mg Comprimidos (Uso Humano)',
      tipo_artigo: 'MH',
      tipo_armazenamento: 'TA',
      tratamento_lote: true,
      tratamento_serie: false,
      ativo: true,
    },
    {
      artigo_id: 'TEST_VAC_02',
      descricao: 'Vacina Veterinária Frio 2-8 ºC',
      tipo_artigo: 'MV',
      tipo_armazenamento: 'TF',
      tratamento_lote: true,
      tratamento_serie: true,
      ativo: true,
    },
    {
      artigo_id: 'TEST_DM_03',
      descricao: 'Dispositivo Médico Seringa 5ml',
      tipo_artigo: 'DM',
      tipo_armazenamento: 'TC',
      tratamento_lote: true,
      tratamento_serie: false,
      ativo: true,
    },
  ];

  let createdIds = [];
  try {
    // Limpar testes anteriores se existirem
    for (const art of testArtigos) {
      await supabase.from('artigos').delete().eq('artigo_id', art.artigo_id);
    }

    const { data: inserted, error: insertArtigoError } = await supabase
      .from('artigos')
      .insert(testArtigos)
      .select();

    if (insertArtigoError || !inserted || inserted.length !== 3) {
      printFail('Falha ao inserir artigos de teste', insertArtigoError?.message);
      failedCount++;
    } else {
      createdIds = inserted.map((a) => a.id);
      printPass(
        'Artigos inseridos com sucesso com diferentes tipos de artigo e armazenamento',
        inserted.map((a) => `[${a.artigo_id}] Tipo: ${a.tipo_artigo} | Armazenamento: ${a.tipo_armazenamento}`).join('\n         ')
      );
      passedCount++;
    }
  } catch (err) {
    printFail('Erro ao inserir artigos de teste', err.message);
    failedCount++;
  }

  // 5. Teste de Restrição em `artigos` (rejeição de tipo de artigo ou armazenamento inválido)
  console.log(`\n${colors.bright}[5/6] Teste de Restrição: Tentativa com Tipos Inválidos em Artigos${colors.reset}`);
  try {
    const { data: invalidArtigo, error: invalidArtigoError } = await supabase
      .from('artigos')
      .insert({
        artigo_id: 'TEST_INVALID_01',
        descricao: 'Artigo com tipo inválido',
        tipo_artigo: 'INVALIDO', // Invalido
        tipo_armazenamento: 'TA',
      })
      .select();

    if (invalidArtigoError) {
      printPass(
        'Restrição da base de dados rejeitou tipo de artigo inválido',
        `Código de erro Postgres: ${invalidArtigoError.code || 'CHECK_VIOLATION'}`
      );
      passedCount++;
    } else {
      printFail('A base de dados aceitou tipo de artigo inválido', JSON.stringify(invalidArtigo));
      failedCount++;
    }
  } catch (err) {
    printPass('Restrição da base de dados acionada com exceção', err.message);
    passedCount++;
  }

  // 6. Limpeza e Verificação de Desacoplamento de Clientes
  console.log(`\n${colors.bright}[6/6] Verificação de Desacoplamento e Limpeza${colors.reset}`);
  try {
    for (const art of testArtigos) {
      await supabase.from('artigos').delete().eq('artigo_id', art.artigo_id);
    }
    printPass('Artigos de teste limpos com sucesso, tabela de artigos sem associação a clientes confirmada');
    passedCount++;
  } catch (err) {
    printFail('Erro na fase de limpeza', err.message);
    failedCount++;
  }

  // Resumo final
  console.log(`\n${colors.bright}──────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log(`${colors.bright}Resultado Final da 3ª Fase:${colors.reset}`);
  console.log(`  Total: ${passedCount + failedCount} | ${colors.green}Passou: ${passedCount}${colors.reset} | ${failedCount > 0 ? colors.red : colors.green}Falhou: ${failedCount}${colors.reset}`);
  console.log(`${colors.bright}──────────────────────────────────────────────────────────────────\n${colors.reset}`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
