function normalizeHeaderKey(key) {
  if (!key) return '';

  const clean = key
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  if (
    clean.includes('tipoartigo') ||
    clean.includes('tipodeartigo') ||
    clean === 'tipo' ||
    clean === 'tipoart'
  ) {
    return 'tipo_artigo';
  }

  if (
    clean.includes('datastock') ||
    clean.includes('dtstock') ||
    clean.includes('datastk') ||
    clean.includes('dtstk') ||
    clean === 'data' ||
    clean === 'date' ||
    clean === 'datetime' ||
    clean === 'validade'
  ) {
    return 'datastock';
  }

  if (
    clean.includes('estadostock') ||
    clean.includes('estadostk') ||
    clean.includes('estado') ||
    clean.includes('status')
  ) {
    return 'estado_stock';
  }

  if (
    clean.includes('subfamilia') ||
    clean.includes('subfam') ||
    clean === 'subf'
  ) {
    return 'sub_familia';
  }

  if (clean.includes('familia') || clean.includes('fam')) {
    return 'familia';
  }

  if (
    clean === 'artigo' ||
    clean === 'art' ||
    clean === 'codigo' ||
    clean === 'cod' ||
    clean === 'sku' ||
    clean === 'codartigo' ||
    clean.includes('artigo')
  ) {
    return 'artigo';
  }

  if (
    clean === 'stk' ||
    clean === 'stock' ||
    clean === 'qtd' ||
    clean === 'quantidade' ||
    clean === 'qty' ||
    clean === 'qtde' ||
    clean.includes('stk') ||
    clean.includes('stock')
  ) {
    return 'stk';
  }

  if (
    clean.includes('desc') ||
    clean.includes('designacao') ||
    clean.includes('produto') ||
    clean.includes('nome')
  ) {
    return 'descricao';
  }

  if (
    clean.includes('armazem') ||
    clean.includes('armaz') ||
    clean.includes('wh') ||
    clean.includes('deposito') ||
    clean === 'arm'
  ) {
    return 'armazem';
  }

  if (
    clean.includes('lote') ||
    clean.includes('batch') ||
    clean.includes('lot')
  ) {
    return 'lote';
  }

  if (
    clean.includes('bloqueado') ||
    clean.includes('bloq') ||
    clean.includes('blocked') ||
    clean.includes('lock')
  ) {
    return 'bloqueado';
  }

  return clean;
}

function parseDateStockToISO(val) {
  if (!val) return null;
  const trimmed = String(val).replace(/^["']|["']$/g, '').trim();
  if (!trimmed) return null;

  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    const hour = (dmyMatch[4] || '00').padStart(2, '0');
    const min = (dmyMatch[5] || '00').padStart(2, '0');
    const sec = (dmyMatch[6] || '00').padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${min}:${sec}`;
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString();
  }

  return trimmed;
}

const textContent = `Artigo;Descricao;Armazem;Lote;EstadoStock;Stk;DataStock;Bloqueado;Familia;tipo_artigo;SubFamilia
0118904180215768;FALCI CARE 60 MG;MDZ01;2125328C;DISP;4140;11/12/2025 17:14:32;0;MED;;MEDSZO
0118904180215768;FALCI CARE 60 MG;MDZ01;2125328C;DISP;1177;18/9/2026 17:36:14;0;MED;;MEDSZO
06CR45IPACK;CR45i Pack;CRD01;SP202623/15;DISP;20;7/8/2026 17:13:45;0;MED;DM;CARDIOLINK
300-300-141;Dick III "Lightweight" tc 05mm / 330mm;CRD01;01642246;DISP;1;11/8/2026 21:53:12;0;MED;DM;CARDIOLINK`;

function parseTextStockFile(textContent, filename) {
  const cleanContent = textContent.replace(/^\uFEFF/, '');
  const lines = cleanContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return [];

  const delimiter = ';';
  const rawHeaders = lines[0].split(delimiter).map(h => h.replace(/^["']|["']$/g, '').trim());
  const headerKeys = rawHeaders.map(normalizeHeaderKey);

  console.log('Mapeamento dos Cabeçalhos:');
  rawHeaders.forEach((h, i) => console.log(`  ${h} -> ${headerKeys[i]}`));

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const values = line.split(delimiter).map(v => v.replace(/^["']|["']$/g, '').trim());
    const row = {};

    headerKeys.forEach((key, index) => {
      if (key && values[index] !== undefined) {
        row[key] = values[index];
      }
    });

    const parsedStk = parseFloat((row['stk'] || '0').replace(',', '.'));
    const rawDateStock = row['datastock'] || row['data_stock'] || '';
    const formattedDateStock = parseDateStockToISO(rawDateStock) || rawDateStock;

    results.push({
      artigo: row['artigo'] || '',
      descricao: row['descricao'] || '',
      armazem: row['armazem'] || '',
      lote: row['lote'] || '',
      estado_stock: row['estado_stock'] || 'DISP',
      stk: isNaN(parsedStk) ? 0 : parsedStk,
      datastock: formattedDateStock,
      bloqueado: row['bloqueado'] || '0',
      familia: row['familia'] || '',
      tipo_artigo: row['tipo_artigo'] || '',
      sub_familia: row['sub_familia'] || '',
      filename: filename,
    });
  }

  return results;
}

const parsed = parseTextStockFile(textContent, 'stock_teste.txt');
console.log('\nResultados do Parsing (Total:', parsed.length, '):');
console.log(JSON.stringify(parsed, null, 2));

let errors = 0;
parsed.forEach((item, idx) => {
  if (!item.artigo) {
    console.error(`ERRO: Linha ${idx + 1} com artigo vazio!`);
    errors++;
  }
  if (!item.datastock) {
    console.error(`ERRO: Linha ${idx + 1} com datastock vazio!`);
    errors++;
  }
  if (typeof item.stk !== 'number' || isNaN(item.stk)) {
    console.error(`ERRO: Linha ${idx + 1} com stk inválido!`);
    errors++;
  }
});

if (errors === 0) {
  console.log('\n>>> TODAS AS VALIDAÇÕES PASSARAM COM SUCESSO! <<<');
} else {
  console.error(`\n>>> FALHARAM ${errors} VALIDAÇÕES! <<<`);
  process.exit(1);
}
