import { spawn } from 'child_process';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
};

const args = process.argv.slice(2);
let selectedFase = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--fase' && args[i + 1]) {
    selectedFase = args[i + 1];
    break;
  }
}

function runFase(fase) {
  let scriptPath = '';
  if (fase === '1') {
    scriptPath = path.join(__dirname, 'fase1', 'teste-login.mjs');
  } else if (fase === '2') {
    scriptPath = path.join(__dirname, 'fase2', 'teste-clientes-perfis.mjs');
  } else if (fase === '3') {
    scriptPath = path.join(__dirname, 'fase3', 'teste-artigos-armazens.mjs');
  } else if (fase === '4') {
    scriptPath = path.join(__dirname, 'fase4', 'teste-movimentos-stocks.mjs');
  } else if (fase === '5') {
    scriptPath = path.join(__dirname, 'fase5', 'teste-pedidos.mjs');
  } else if (fase === '6') {
    scriptPath = path.join(__dirname, 'fase6', 'teste-configuracao.mjs');
  } else if (fase === '7') {
    scriptPath = path.join(__dirname, 'fase7', 'teste-resend-pedidos.mjs');
  } else {
    console.log(`\n${colors.yellow}A fase ${fase} ainda não tem testes implementados nesta etapa.${colors.reset}\n`);
    process.exit(0);
  }

  console.log(`\n${colors.bright}${colors.cyan}A executar testes da Fase ${fase}...${colors.reset}\n`);

  const nodeArgs = ['--env-file=.env.local', scriptPath];
  const child = spawn('node', nodeArgs, { stdio: 'inherit' });

  child.on('close', (code) => {
    process.exit(code || 0);
  });
}

if (selectedFase) {
  runFase(selectedFase);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`\n${colors.bright}══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}   PLATAFORMA FARMA - EXECUTOR DE TESTES POR FASE   ${colors.reset}`);
  console.log(`${colors.bright}══════════════════════════════════════════════════════${colors.reset}`);
  console.log('Escolha a fase que deseja testar:');
  console.log('  1) 1ª Fase - Autenticação & Login (admin@sermail.pt)');
  console.log('  2) 2ª Fase - Clientes, Siglas (<=4 carateres) & Perfis de Acesso');
  console.log('  3) 3ª Fase - Gestão de Artigos & Armazéns');
  console.log('  4) 4ª Fase - Movimentos de Artigos & Views de Stock');
  console.log('  5) 5ª Fase - Processo de Pedidos, Sugestão FEFO & Débitos SS');
  console.log('  6) 6ª Fase - Painel de Configuração & Administração (Admin)');
  console.log('  7) 7ª Fase - Integração Resend & Notificação por Email de Pedidos');
  console.log('  0) Sair');

  rl.question('\nIntroduza o número da fase [1]: ', (answer) => {
    rl.close();
    const choice = answer.trim() || '1';
    if (choice === '0') {
      console.log('Operação cancelada.');
      process.exit(0);
    }
    runFase(choice);
  });
}
