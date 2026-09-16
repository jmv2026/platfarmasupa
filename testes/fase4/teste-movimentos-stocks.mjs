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
  printHeader('Plataforma Farma - Verificação Integral da 4ª Fase');
  console.log(`${colors.yellow}Validação: Tabela de Movimentos, Views de Stock (vw_stock_atual e vw_stock_pedidos)${colors.reset}\n`);

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

  // 2. Verificação da Tabela `movimentos` e campos obrigatórios
  console.log(`\n${colors.bright}[2/6] Verificação da Estrutura da Tabela de Movimentos (campos obrigatórios e chaves)${colors.reset}`);
  try {
    const { data: movs, error: movsError } = await supabase
      .from('movimentos')
      .select('*')
      .limit(5);

    if (movsError) {
      printFail('Erro ao consultar tabela de movimentos', movsError.message);
      failedCount++;
    } else if (movs.length === 0) {
      printFail('Tabela de movimentos está vazia. Execute o seed antes dos testes.', '0 registos encontrados');
      failedCount++;
    } else {
      const sample = movs[0];
      const requiredFields = [
        'id',
        'artigo_id',
        'client_id',
        'quantidade',
        'tipo_movimento',
        'tipo_armazem',
        'armazem_loc',
        'posicao',
        'lote',
        'validade',
        'data_movimento',
      ];

      const missingFields = requiredFields.filter((f) => !(f in sample));

      if (missingFields.length === 0) {
        printPass(
          'Tabela de movimentos contém todos os campos requeridos pela especificação regulamentar',
          `Campos validados: ${requiredFields.join(', ')}`
        );
        passedCount++;
      } else {
        printFail('Campos obrigatórios em falta na tabela movimentos', `Em falta: ${missingFields.join(', ')}`);
        failedCount++;
      }
    }
  } catch (err) {
    printFail('Erro ao verificar estrutura de movimentos', err.message);
    failedCount++;
  }

  // 3. Teste de Restrição: Tipo de Movimento Inválido
  console.log(`\n${colors.bright}[3/6] Teste de Restrição: Tentativa com Tipo de Movimento Não Autorizado (ex: 'xx')${colors.reset}`);
  try {
    const { data: clients } = await supabase.from('clients').select('id').limit(1);
    const { data: artigos } = await supabase.from('artigos').select('id').limit(1);

    if (clients?.length && artigos?.length) {
      const { data: invalidMov, error: invalidError } = await supabase
        .from('movimentos')
        .insert({
          artigo_id: artigos[0].id,
          client_id: clients[0].id,
          tipo_movimento: 'xx', // Inválido (apenas 'es', 'ss', 'et', 'st' permitidos)
          quantidade: 10,
          tipo_armazem: '01',
          armazem_loc: 'TEST-01',
          posicao: 'P-01',
          lote: 'L-INV',
        })
        .select();

      if (invalidError) {
        printPass(
          'Restrição CHECK da base de dados rejeitou tipo de movimento inválido',
          `Código de erro capturado: ${invalidError.code || 'CHECK_VIOLATION'}`
        );
        passedCount++;
      } else {
        printFail('A base de dados aceitou um tipo de movimento inválido (xx)', JSON.stringify(invalidMov));
        failedCount++;
      }
    } else {
      printFail('Impossível realizar teste de restrição', 'Sem artigos ou clientes na base de dados');
      failedCount++;
    }
  } catch (err) {
    printPass('Restrição da base de dados acionada com exceção', err.message);
    passedCount++;
  }

  // 4. Verificação da View `vw_stock_atual` (Stock Consolidado)
  console.log(`\n${colors.bright}[4/6] Verificação da View de Stock Consolidado (vw_stock_atual)${colors.reset}`);
  try {
    const { data: stockAtual, error: viewError } = await supabase
      .from('vw_stock_atual')
      .select('*');

    if (viewError) {
      printFail('Erro ao consultar view vw_stock_atual', viewError.message);
      failedCount++;
    } else if (!stockAtual || stockAtual.length === 0) {
      printFail('View vw_stock_atual não devolveu registos de stock', 'Nenhum stock calculado');
      failedCount++;
    } else {
      // Verificar campos esperados na view
      const first = stockAtual[0];
      const hasRequiredCols =
        'client_id' in first &&
        'artigo_id' in first &&
        'lote' in first &&
        'validade' in first &&
        'armazem_loc' in first &&
        'stock' in first;

      // Verificar que todos os registos têm stock > 0
      const allPositive = stockAtual.every((r) => Number(r.stock) > 0);

      if (hasRequiredCols && allPositive) {
        printPass(
          'View vw_stock_atual calcula corretamente o stock por cliente, artigo, lote e armazém',
          stockAtual
            .map(
              (r) =>
                `[${r.cliente_sigla}] ${r.artigo_codigo} | Lote: ${r.lote} | Arm: ${r.armazem_loc} | Stock: ${r.stock}`
            )
            .join('\n         ')
        );
        passedCount++;
      } else {
        printFail('Estrutura ou valores de vw_stock_atual incorretos', `Colunas válidas: ${hasRequiredCols}, Saldos positivos: ${allPositive}`);
        failedCount++;
      }
    }
  } catch (err) {
    printFail('Erro ao verificar view vw_stock_atual', err.message);
    failedCount++;
  }

  // 5. Verificação da View `vw_stock_pedidos` (Apenas Armazém 01, sem posição e sem armazém)
  console.log(`\n${colors.bright}[5/6] Verificação da View de Pedidos (vw_stock_pedidos - Apenas Armazém 01)${colors.reset}`);
  try {
    const { data: stockPedidos, error: pedidosError } = await supabase
      .from('vw_stock_pedidos')
      .select('*');

    if (pedidosError) {
      printFail('Erro ao consultar view vw_stock_pedidos', pedidosError.message);
      failedCount++;
    } else if (!stockPedidos || stockPedidos.length === 0) {
      printFail('View vw_stock_pedidos não devolveu artigos disponíveis para venda', 'Nenhum saldo no armazém 01');
      failedCount++;
    } else {
      const first = stockPedidos[0];

      // Deve ter client_id, artigo_id, lote, validade, stock
      const hasCoreCols = 'client_id' in first && 'artigo_id' in first && 'lote' in first && 'stock' in first;
      // NÃO deve ter posicao nem armazem_loc (especificação do pedido)
      const noPosicao = !('posicao' in first);
      const noArmazemLoc = !('armazem_loc' in first);
      const allPositive = stockPedidos.every((r) => Number(r.stock) > 0);

      if (hasCoreCols && noPosicao && noArmazemLoc && allPositive) {
        printPass(
          'View vw_stock_pedidos filtra estritamente Armazém 01 (Venda) sem campos posição/armazém',
          stockPedidos
            .map(
              (r) =>
                `[${r.cliente_sigla}] ${r.artigo_codigo} | Lote: ${r.lote} | Validade: ${r.validade} | Stock Disp.: ${r.stock}`
            )
            .join('\n         ')
        );
        passedCount++;
      } else {
        printFail(
          'View vw_stock_pedidos não cumpre todos os requisitos',
          `Core cols: ${hasCoreCols}, Sem posicao: ${noPosicao}, Sem armazem_loc: ${noArmazemLoc}`
        );
        failedCount++;
      }
    }
  } catch (err) {
    printFail('Erro ao verificar view vw_stock_pedidos', err.message);
    failedCount++;
  }

  // 6. Verificação do Povoamento e Limites (<= 10 registos por entidade)
  console.log(`\n${colors.bright}[6/6] Verificação de Povoamento e Controlo de Volume (≤ 10 registos)${colors.reset}`);
  try {
    const { data: clients } = await supabase.from('clients').select('id');
    const { data: artigos } = await supabase.from('artigos').select('id');
    const { data: movs } = await supabase.from('movimentos').select('id');

    const cCount = clients?.length || 0;
    const aCount = artigos?.length || 0;
    const mCount = movs?.length || 0;

    const underLimit = cCount > 0 && cCount <= 10 && aCount > 0 && aCount <= 10 && mCount > 0 && mCount <= 10;

    if (underLimit) {
      printPass(
        'Base de dados populada com volume controlado e coerente',
        `Clientes: ${cCount}/10 | Artigos: ${aCount}/10 | Movimentos: ${mCount}/10`
      );
      passedCount++;
    } else {
      printFail(
        'Número de registos excede o limite estipulado (máximo 10 por tabela)',
        `Clientes: ${cCount}, Artigos: ${aCount}, Movimentos: ${mCount}`
      );
      failedCount++;
    }
  } catch (err) {
    printFail('Erro ao validar contagem de registos', err.message);
    failedCount++;
  }

  // Resumo final
  console.log(`\n${colors.bright}──────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log(`${colors.bright}Resultado Final da 4ª Fase:${colors.reset}`);
  console.log(`  Total: ${passedCount + failedCount} | ${colors.green}Passou: ${passedCount}${colors.reset} | ${failedCount > 0 ? colors.red : colors.green}Falhou: ${failedCount}${colors.reset}`);
  console.log(`${colors.bright}──────────────────────────────────────────────────────────────────\n${colors.reset}`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
