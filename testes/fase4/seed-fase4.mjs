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

export async function seedDatabase() {
  console.log(`\n${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}   PLATAFORMA FARMA - POVOAMENTO DE DADOS (FASE 4)${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}\n`);

  // 1. Autenticar Admin
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@sermail.pt',
    password: '123456',
  });
  if (authErr) {
    console.error(`${colors.red}Erro ao autenticar admin: ${authErr.message}${colors.reset}`);
    process.exit(1);
  }
  console.log(`${colors.green}✔ Admin autenticado com sucesso${colors.reset}`);

  // 2. Limpar dados anteriores de movimentos, artigos e clientes mantendo integridade
  console.log(`\n${colors.yellow}A sincronizar dados demonstrativos da Fase 4...${colors.reset}`);
  await supabase.from('movimentos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('artigos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 3. Inserir Clientes (3 clientes)
  const seedClients = [
    {
      name: 'Pfizer Portugal Lda',
      sigla: 'PFIZ',
      nif: '501234567',
      email: 'contacto@pfizer.pt',
      telefone: '+351 214235555',
      morada: 'Lagoas Park, Edifício 7, 2740-244 Porto Salvo',
      ativo: true,
    },
    {
      name: 'Novartis Farma SA',
      sigla: 'NOVA',
      nif: '502345678',
      email: 'info@novartis.pt',
      telefone: '+351 210008600',
      morada: 'Taguspark, Edifício Inovação II, 2740-255 Porto Salvo',
      ativo: true,
    },
    {
      name: 'Bayer Portugal SA',
      sigla: 'BAYR',
      nif: '503456789',
      email: 'apoio@bayer.pt',
      telefone: '+351 214167500',
      morada: 'Rua Quinta do Pinheiro, 5, 2794-003 Carnaxide',
      ativo: true,
    },
  ];

  const { data: clientsInserted, error: cErr } = await supabase
    .from('clients')
    .insert(seedClients)
    .select();

  if (cErr) {
    console.error(`${colors.red}Erro ao inserir clientes: ${cErr.message}${colors.reset}`);
    process.exit(1);
  }
  console.log(`  ${colors.green}✔ ${clientsInserted.length} Clientes inseridos:${colors.reset} ${clientsInserted.map(c => `[${c.sigla}] ${c.name}`).join(' | ')}`);

  const clientMap = {};
  clientsInserted.forEach((c) => {
    clientMap[c.sigla] = c.id;
  });

  // 4. Inserir Artigos (4 artigos regulamentares)
  const seedArtigos = [
    {
      artigo_id: 'PF-001',
      descricao: 'Comirnaty 30mcg Dispersão Injetável',
      tipo_artigo: 'MH',
      tipo_armazenamento: 'TF',
      tratamento_lote: true,
      tratamento_serie: false,
      ativo: true,
    },
    {
      artigo_id: 'NV-001',
      descricao: 'Entresto 49mg/51mg Comprimidos Revestidos',
      tipo_artigo: 'MH',
      tipo_armazenamento: 'TC',
      tratamento_lote: true,
      tratamento_serie: false,
      ativo: true,
    },
    {
      artigo_id: 'BY-001',
      descricao: 'Bepanthene Plus Creme Cicatrizante 30g',
      tipo_artigo: 'DC',
      tipo_armazenamento: 'TA',
      tratamento_lote: true,
      tratamento_serie: false,
      ativo: true,
    },
    {
      artigo_id: 'BY-002',
      descricao: 'Kit Solução Estéril c/ Seringa e Filtro',
      tipo_artigo: 'DM',
      tipo_armazenamento: 'TC',
      tratamento_lote: true,
      tratamento_serie: true,
      ativo: true,
    },
  ];

  const { data: artigosInserted, error: aErr } = await supabase
    .from('artigos')
    .insert(seedArtigos)
    .select();

  if (aErr) {
    console.error(`${colors.red}Erro ao inserir artigos: ${aErr.message}${colors.reset}`);
    process.exit(1);
  }
  console.log(`  ${colors.green}✔ ${artigosInserted.length} Artigos inseridos:${colors.reset} ${artigosInserted.map(a => `[${a.artigo_id}] ${a.descricao}`).join(' | ')}`);

  const artigoMap = {};
  artigosInserted.forEach((a) => {
    artigoMap[a.artigo_id] = a.id;
  });

  // 5. Inserir Movimentos (8 movimentos estruturados)
  const seedMovimentos = [
    // Pfizer: Entrada 120 un no armazém 01 (Venda)
    {
      artigo_id: artigoMap['PF-001'],
      client_id: clientMap['PFIZ'],
      tipo_movimento: 'es',
      quantidade: 120,
      tipo_armazem: '01',
      armazem_loc: 'PFIZ-01',
      posicao: 'A-01-01',
      lote: 'PF2601',
      validade: '2027-12-31',
      data_fabrico: '2026-01-10',
      documento_ref: 'GUIA-REC-101',
      observacoes: 'Entrada de stock inicial do lote PF2601',
      data_movimento: '2026-09-10T09:00:00Z',
    },
    // Pfizer: Transferência de 20 un de 01 (Venda) para 05 (Quarentena)
    {
      artigo_id: artigoMap['PF-001'],
      client_id: clientMap['PFIZ'],
      tipo_movimento: 'st',
      quantidade: 20,
      tipo_armazem: '01',
      armazem_loc: 'PFIZ-01',
      posicao: 'A-01-01',
      lote: 'PF2601',
      validade: '2027-12-31',
      data_fabrico: '2026-01-10',
      documento_ref: 'TRF-INT-001',
      observacoes: 'Saída por transferência para quarentena técnica',
      data_movimento: '2026-09-11T14:00:00Z',
    },
    {
      artigo_id: artigoMap['PF-001'],
      client_id: clientMap['PFIZ'],
      tipo_movimento: 'et',
      quantidade: 20,
      tipo_armazem: '05',
      armazem_loc: 'PFIZ-05',
      posicao: 'Q-01-02',
      lote: 'PF2601',
      validade: '2027-12-31',
      data_fabrico: '2026-01-10',
      documento_ref: 'TRF-INT-001',
      observacoes: 'Entrada por transferência no armazém de quarentena',
      data_movimento: '2026-09-11T14:05:00Z',
    },
    // Novartis: Entrada 250 un no armazém 01
    {
      artigo_id: artigoMap['NV-001'],
      client_id: clientMap['NOVA'],
      tipo_movimento: 'es',
      quantidade: 250,
      tipo_armazem: '01',
      armazem_loc: 'NOVA-01',
      posicao: 'B-02-01',
      lote: 'NV8891',
      validade: '2028-06-30',
      data_fabrico: '2025-11-20',
      documento_ref: 'GUIA-REC-102',
      observacoes: 'Receção direta de fábrica Suíça',
      data_movimento: '2026-09-12T10:30:00Z',
    },
    // Novartis: Saída de stock (expedição de 50 un)
    {
      artigo_id: artigoMap['NV-001'],
      client_id: clientMap['NOVA'],
      tipo_movimento: 'ss',
      quantidade: 50,
      tipo_armazem: '01',
      armazem_loc: 'NOVA-01',
      posicao: 'B-02-01',
      lote: 'NV8891',
      validade: '2028-06-30',
      data_fabrico: '2025-11-20',
      documento_ref: 'PED-2026-001',
      observacoes: 'Expedição para Hospitais de Coimbra',
      data_movimento: '2026-09-13T16:00:00Z',
    },
    // Bayer: Entrada 180 un Bepanthene Plus no armazém 01
    {
      artigo_id: artigoMap['BY-001'],
      client_id: clientMap['BAYR'],
      tipo_movimento: 'es',
      quantidade: 180,
      tipo_armazem: '01',
      armazem_loc: 'BAYR-01',
      posicao: 'C-01-04',
      lote: 'BY2090',
      validade: '2029-01-15',
      data_fabrico: '2026-01-05',
      documento_ref: 'GUIA-REC-103',
      observacoes: 'Entrada de lote cosmético em temperatura ambiente',
      data_movimento: '2026-09-14T08:45:00Z',
    },
    // Bayer: Entrada 40 un Kit Solução Estéril c/ série
    {
      artigo_id: artigoMap['BY-002'],
      client_id: clientMap['BAYR'],
      tipo_movimento: 'es',
      quantidade: 40,
      tipo_armazem: '01',
      armazem_loc: 'BAYR-01',
      posicao: 'C-02-01',
      lote: 'BY-DM01',
      nr_serie: 'SN-2026-0091',
      validade: '2028-10-31',
      data_fabrico: '2025-10-15',
      documento_ref: 'GUIA-REC-104',
      observacoes: 'Dispositivo médico com controlo de série unitária',
      data_movimento: '2026-09-14T11:20:00Z',
    },
    // Bayer: Entrada 15 un no armazém 02 (Expirados)
    {
      artigo_id: artigoMap['BY-001'],
      client_id: clientMap['BAYR'],
      tipo_movimento: 'es',
      quantidade: 15,
      tipo_armazem: '02',
      armazem_loc: 'BAYR-02',
      posicao: 'EXP-01',
      lote: 'BY-EXP1',
      validade: '2025-08-31',
      data_fabrico: '2023-08-01',
      documento_ref: 'DEV-CADUCADOS',
      observacoes: 'Artigos devolvidos da farmácia já expirados',
      data_movimento: '2026-09-15T08:00:00Z',
    },
  ];

  const { data: movsInserted, error: mErr } = await supabase
    .from('movimentos')
    .insert(seedMovimentos)
    .select();

  if (mErr) {
    console.error(`${colors.red}Erro ao inserir movimentos: ${mErr.message}${colors.reset}`);
    process.exit(1);
  }
  console.log(`  ${colors.green}✔ ${movsInserted.length} Movimentos registados com sucesso${colors.reset}`);

  // 6. Testar Views
  const { data: vwAtual } = await supabase.from('vw_stock_atual').select('*');
  const { data: vwPedidos } = await supabase.from('vw_stock_pedidos').select('*');

  console.log(`\n${colors.bright}Resultados das Views:${colors.reset}`);
  console.log(`  • ${colors.cyan}vw_stock_atual:${colors.reset} ${vwAtual?.length || 0} lotes/armazéns em stock consolidado`);
  vwAtual?.forEach((r) => {
    console.log(`     - [${r.cliente_sigla}] ${r.artigo_codigo} (${r.artigo_descricao.substring(0, 30)}...) | Lote: ${r.lote} | Arm: ${r.armazem_loc} | Stock: ${r.stock}`);
  });

  console.log(`  • ${colors.cyan}vw_stock_pedidos (Apenas Armazém 01):${colors.reset} ${vwPedidos?.length || 0} registos prontos para pedidos`);
  vwPedidos?.forEach((r) => {
    console.log(`     - [${r.cliente_sigla}] ${r.artigo_codigo} | Lote: ${r.lote} | Validade: ${r.validade} | Stock Disp.: ${r.stock}`);
  });

  console.log(`\n${colors.green}${colors.bright}Povoamento concluído com sucesso! (Clientes: ${clientsInserted.length}, Artigos: ${artigosInserted.length}, Movimentos: ${movsInserted.length})${colors.reset}\n`);
}

if (process.argv[1] === new URL(import.meta.url).pathname || process.argv[1].endsWith('seed-fase4.mjs')) {
  seedDatabase().catch((err) => {
    console.error('Erro na execução do seed:', err);
    process.exit(1);
  });
}
