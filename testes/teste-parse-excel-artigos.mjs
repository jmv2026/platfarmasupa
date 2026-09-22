import ExcelJS from 'exceljs';

function normalizeArtigoHeaderKey(key) {
  if (!key) return '';

  const clean = key
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  // 1. Descrição / Designação / Nome do Artigo (VERIFICAR ANTES DE 'artigo')
  if (
    clean.includes('desc') ||
    clean.includes('designacao') ||
    clean.includes('nome') ||
    clean.includes('produto') ||
    clean.includes('denominacao') ||
    clean.includes('titulo')
  ) {
    return 'descricao';
  }

  // 2. Tratamento Série
  if (
    clean.includes('tratamentoserie') ||
    clean.includes('tratserie') ||
    clean.includes('controloserie') ||
    clean === 'serie' ||
    clean === 'series' ||
    clean === 'serial' ||
    clean === 'nrserie' ||
    clean === 'numserie'
  ) {
    return 'tratamento_serie';
  }

  // 3. Tratamento Lote
  if (
    clean.includes('tratamentolote') ||
    clean.includes('tratlote') ||
    clean.includes('contrololote') ||
    clean === 'lote' ||
    clean === 'lotes' ||
    clean === 'batch'
  ) {
    return 'tratamento_lote';
  }

  // 4. Tipo de Artigo
  if (
    clean.includes('tipoartigo') ||
    clean.includes('tipodeartigo') ||
    clean === 'tipoart' ||
    clean === 'tipo' ||
    clean === 'classificacao' ||
    clean === 'categoria' ||
    clean === 'familia'
  ) {
    return 'tipo_artigo';
  }

  // 5. Tipo de Armazenamento / Conservação
  if (
    clean.includes('tipoarmazenamento') ||
    clean.includes('armazenamento') ||
    clean.includes('conservacao') ||
    clean.includes('temperatura') ||
    clean.includes('condicao') ||
    clean === 'armaz' ||
    clean === 'temp'
  ) {
    return 'tipo_armazenamento';
  }

  // 6. PVP / Preço
  if (
    clean === 'pvp' ||
    clean.includes('pvp') ||
    clean === 'preco' ||
    clean === 'precovenda' ||
    clean === 'precopvp' ||
    clean === 'valorpvp' ||
    clean === 'pvpunitario' ||
    clean === 'price' ||
    clean === 'valor'
  ) {
    return 'pvp';
  }

  // 7. Ativo / Estado
  if (
    clean === 'ativo' ||
    clean === 'active' ||
    clean === 'estado' ||
    clean === 'status' ||
    clean === 'habilitado'
  ) {
    return 'ativo';
  }

  // 8. Artigo ID / Código (verificado por último para não engolir descrição ou tipo)
  if (
    clean === 'artigo' ||
    clean === 'art' ||
    clean === 'artid' ||
    clean === 'artigo_id' ||
    clean === 'artigoid' ||
    clean === 'codartigo' ||
    clean === 'codigoartigo' ||
    clean === 'codart' ||
    clean === 'codigo' ||
    clean === 'cod' ||
    clean === 'sku' ||
    clean === 'ref' ||
    clean === 'referencia' ||
    clean === 'cnpv' ||
    clean === 'ean' ||
    clean.includes('artigo') ||
    clean.includes('codigo')
  ) {
    return 'artigo_id';
  }

  return clean;
}

function extractCellValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (val instanceof Date) return val.toISOString();

  if (typeof val === 'object') {
    // RichText
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText.map((t) => t.text || '').join('').trim();
    }
    // Formula result
    if ('result' in val) {
      const res = val.result;
      if (res === null || res === undefined) return '';
      if (typeof res === 'object') return extractCellValue(res);
      return String(res).trim();
    }
    // Hyperlink
    if ('text' in val) {
      return String(val.text || '').trim();
    }
    // Shared string
    if ('sharedString' in val) {
      return String(val.sharedString || '').trim();
    }
  }

  return String(val).trim();
}

async function testExcelParsing() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Artigos');

  // Simular Linha 1: Título / Banner
  worksheet.addRow(['Plataforma Farma - Catálogo Oficial de Artigos', '', '', '', '']);

  // Linha 2: Cabeçalhos com nomes reais em PT
  worksheet.addRow([
    'Código do Artigo',
    'Descrição do Artigo',
    'Tratamento Lote',
    'Tratamento Série',
    'Tipo Artigo',
    'Condição Conservação',
    'PVP (€)',
  ]);

  // Linha 3: Dados com RichText e números
  const richDesc = {
    richText: [
      { text: 'Luvion ' },
      { font: { bold: true }, text: '200mg/2ml' },
    ],
  };

  worksheet.addRow([
    24273070, // número
    richDesc, // richtext
    'Sim',
    'Não',
    'Medicamento Uso Humano',
    'Temperatura Ambiente',
    12.50,
  ]);

  // Linha 4: Dados com código alfanumérico
  worksheet.addRow([
    'PF-001',
    'Vacina Frio 2-8 ºC',
    1,
    0,
    'MH',
    'TF',
    25.00,
  ]);

  const buffer = await workbook.xlsx.writeBuffer();

  // Testar leitura com o algoritmo aprimorado
  const readWb = new ExcelJS.Workbook();
  await readWb.xlsx.load(buffer);
  const sheet = readWb.worksheets[0];

  let headerRowIndex = -1;
  let headers = [];

  // Encontrar linha de cabeçalho por pontuação
  sheet.eachRow((row, rowNumber) => {
    if (headerRowIndex !== -1 && rowNumber > 10) return;
    const cellCount = row.cellCount || 0;
    const rowHeaders = [];
    for (let c = 1; c <= Math.max(cellCount, 15); c++) {
      const raw = extractCellValue(row.getCell(c).value);
      rowHeaders.push(raw);
    }

    const mappedKeys = rowHeaders.map((h) => normalizeArtigoHeaderKey(h));
    const hasArtigo = mappedKeys.includes('artigo_id');
    const hasDesc = mappedKeys.includes('descricao');

    if (hasArtigo && hasDesc) {
      headerRowIndex = rowNumber;
      headers = mappedKeys;
    }
  });

  console.log('Linha de Cabeçalho detetada:', headerRowIndex);
  console.log('Cabeçalhos mapeados:', headers.filter(Boolean));

  const parsedItems = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return;

    const rowObj = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (key) {
        const val = extractCellValue(row.getCell(c + 1).value);
        rowObj[key] = val;
      }
    }

    if (rowObj.artigo_id && rowObj.descricao) {
      parsedItems.push(rowObj);
    }
  });

  console.log('\nArtigos analisados do Excel:');
  console.log(JSON.stringify(parsedItems, null, 2));
}

testExcelParsing();
