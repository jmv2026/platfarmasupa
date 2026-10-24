import ExcelJS from 'exceljs';

export interface FaturaRow {
  documento_ref: string;
  data: string | null;
  entidade: string | null;
  tipo_doc: string | null;
  num_doc: string | null;
  documento: string | null;
  requisicao: string | null;
  num_contribuinte: string | null;
  total_iva: number;
  total_merc: number;
  total_outros: number;
  total_desc: number;
  nome: string | null;
  morada: string | null;
  localidade: string | null;
  cod_postal: string | null;
  cod_postal_localidade: string | null;
  pais: string | null;
  nome_entrega: string | null;
  morada_entrega: string | null;
  cod_postal_localidade_entrega: string | null;
  cod_postal_entrega: string | null;
  localidade_entrega: string | null;
  entidade_entrega: string | null;
  cli_primavera: string | null;
  sigla: string | null;
  cliente_ser: string | null;
}

function parseNum(v: any): number {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') {
    return isNaN(v) ? 0 : v;
  }
  let s = String(v).trim().replace(/\s/g, '');
  if (s === '' || s.toLowerCase() === 'null') return 0;
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const num = Number(s);
  return isNaN(num) ? 0 : num;
}

function parseDateOnly(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    const year = v.getFullYear();
    const month = String(v.getMonth() + 1).padStart(2, '0');
    const day = String(v.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    // Excel serial number
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().substring(0, 10);
  }
  const str = String(v).trim();
  if (!str) return null;

  // DD/MM/YYYY or DD-MM-YYYY
  const parts = str.split(' ')[0].split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    } else {
      // DD-MM-YYYY
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${year}-${month}-${day}`;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  return null;
}

function normalizeHeader(key: string): string {
  if (!key) return '';
  return key
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '');
}

function cleanCell(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str.startsWith('"') && str.endsWith('"') && str.length >= 2) {
    str = str.slice(1, -1).trim();
  }
  return str;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function mapRawRowToFatura(r: Record<string, any>): FaturaRow | null {
  const docRef = cleanCell(
    r['documento_ref'] ??
    r['documentoref'] ??
    r['doc_ref'] ??
    r['docref'] ??
    r['documento'] ??
    ''
  );

  if (!docRef) return null;

  const dataVal = r['data'] ?? r['datadocumento'] ?? r['data_doc'] ?? r['data_movimento'] ?? null;
  const data = parseDateOnly(dataVal);

  const entidade = cleanCell(r['entidade'] ?? r['cod_entidade'] ?? '') || null;
  const tipoDoc = cleanCell(r['tipo_doc'] ?? r['tipodoc'] ?? r['tipo_documento'] ?? '') || null;
  const numDoc = cleanCell(r['num_doc'] ?? r['numdoc'] ?? r['numero_doc'] ?? '') || null;
  const documento = cleanCell(r['documento'] ?? r['doc'] ?? '') || null;
  const requisicao = cleanCell(r['requisicao'] ?? r['req'] ?? '') || null;
  const numContribuinte = cleanCell(r['num_contribuinte'] ?? r['numcontribuinte'] ?? r['nif'] ?? r['cif'] ?? '') || null;

  const totalIva = parseNum(r['total_iva'] ?? r['totaliva'] ?? r['iva']);
  const totalMerc = parseNum(r['total_merc'] ?? r['totalmerc'] ?? r['mercadoria'] ?? r['total_mercadoria']);
  const totalOutros = parseNum(r['total_outros'] ?? r['totaloutros'] ?? r['outros']);
  const totalDesc = parseNum(r['total_desc'] ?? r['totaldesc'] ?? r['desconto'] ?? r['total_desconto']);

  // Documentos de crédito (NC e NCE) são importados com valores negativos nos campos de faturação
  const isCredit =
    (tipoDoc || '').toUpperCase() === 'NC' ||
    (tipoDoc || '').toUpperCase() === 'NCE' ||
    docRef.toUpperCase().includes('-NC ') ||
    docRef.toUpperCase().includes('-NCE ') ||
    (documento || '').toUpperCase().startsWith('NC ') ||
    (documento || '').toUpperCase().startsWith('NCE ');

  const totalMercFinal = isCredit ? (totalMerc > 0 ? -totalMerc : totalMerc) : Math.abs(totalMerc);
  const totalIvaFinal = isCredit ? (totalIva > 0 ? -totalIva : totalIva) : Math.abs(totalIva);
  const totalDescFinal = isCredit ? (totalDesc > 0 ? -totalDesc : totalDesc) : Math.abs(totalDesc);
  const totalOutrosFinal = isCredit ? (totalOutros > 0 ? -totalOutros : totalOutros) : Math.abs(totalOutros);

  const nome = cleanCell(r['nome'] ?? r['cliente_nome'] ?? r['nome_cliente'] ?? '') || null;
  const morada = cleanCell(r['morada'] ?? r['endereco'] ?? '') || null;
  const localidade = cleanCell(r['localidade'] ?? r['cidade'] ?? '') || null;
  const codPostal = cleanCell(r['cod_postal'] ?? r['codpostal'] ?? r['codigo_postal'] ?? r['cp'] ?? '') || null;
  const codPostalLoc = cleanCell(r['cod_postal_localidade'] ?? r['codpostallocalidade'] ?? r['cp_localidade'] ?? '') || null;
  const pais = cleanCell(r['pais'] ?? r['country'] ?? '') || null;

  const nomeEntrega = cleanCell(r['nome_entrega'] ?? r['nomeentrega'] ?? '') || null;
  const moradaEntrega = cleanCell(r['morada_entrega'] ?? r['moradaentrega'] ?? '') || null;
  const codPostalLocEntrega = cleanCell(r['cod_postal_localidade_entrega'] ?? r['codpostallocalidadeentrega'] ?? '') || null;
  const codPostalEntrega = cleanCell(r['cod_postal_entrega'] ?? r['codpostalentrega'] ?? '') || null;
  const localidadeEntrega = cleanCell(r['localidade_entrega'] ?? r['localidadeentrega'] ?? '') || null;
  const entidadeEntrega = cleanCell(r['entidade_entrega'] ?? r['entidadeentrega'] ?? '') || null;

  const cliPrimavera = cleanCell(r['cli_primavera'] ?? r['cliprimavera'] ?? r['cod_primavera'] ?? '') || null;
  const sigla = cleanCell(r['sigla'] ?? r['sigla_cliente'] ?? '') || null;
  const clienteSer = cleanCell(r['cliente_ser'] ?? r['clienteser'] ?? r['cliente'] ?? '') || null;

  return {
    documento_ref: docRef,
    data,
    entidade,
    tipo_doc: tipoDoc,
    num_doc: numDoc,
    documento,
    requisicao,
    num_contribuinte: numContribuinte,
    total_iva: totalIvaFinal,
    total_merc: totalMercFinal,
    total_outros: totalOutrosFinal,
    total_desc: totalDescFinal,
    nome,
    morada,
    localidade,
    cod_postal: codPostal,
    cod_postal_localidade: codPostalLoc,
    pais,
    nome_entrega: nomeEntrega,
    morada_entrega: moradaEntrega,
    cod_postal_localidade_entrega: codPostalLocEntrega,
    cod_postal_entrega: codPostalEntrega,
    localidade_entrega: localidadeEntrega,
    entidade_entrega: entidadeEntrega,
    cli_primavera: cliPrimavera,
    sigla,
    cliente_ser: clienteSer,
  };
}

export function parseCsvTextToFaturas(text: string): FaturaRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Detect delimiter
  let delimiter = ';';
  const firstLine = lines[0];
  const countSemi = (firstLine.match(/;/g) || []).length;
  const countTab = (firstLine.match(/\t/g) || []).length;
  const countComma = (firstLine.match(/,/g) || []).length;

  if (countTab > countSemi && countTab > countComma) delimiter = '\t';
  else if (countComma > countSemi) delimiter = ',';
  else delimiter = ';';

  const rawHeaders = splitCsvLine(firstLine, delimiter);
  const headers = rawHeaders.map((c) => normalizeHeader(c));
  const rows: FaturaRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    const r: Record<string, string> = {};
    headers.forEach((h, idx) => {
      r[h] = cols[idx] !== undefined ? cleanCell(cols[idx]) : '';
    });

    const isRowEmpty = Object.values(r).every((v) => !v);
    if (isRowEmpty) continue;

    const mapped = mapRawRowToFatura(r);
    if (mapped) {
      rows.push(mapped);
    }
  }

  return rows;
}

export async function parseExcelToFaturas(arrayBuffer: ArrayBuffer): Promise<FaturaRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers: string[] = [];
  const rows: FaturaRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber] = normalizeHeader(cell.text || String(cell.value || ''));
      });
    } else {
      const r: Record<string, any> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const h = headers[colNumber];
        if (h) {
          let val = cell.value;
          if (val && typeof val === 'object') {
            if (val instanceof Date) {
              // keep date
            } else if ('text' in val) {
              val = (val as any).text;
            } else if ('result' in val) {
              val = (val as any).result;
            }
          }
          if (typeof val === 'string') {
            val = cleanCell(val);
          }
          r[h] = val;
        }
      });

      const isEmpty = Object.values(r).every((v) => v === null || v === undefined || v === '');
      if (isEmpty) return;

      const mapped = mapRawRowToFatura(r);
      if (mapped) {
        rows.push(mapped);
      }
    }
  });

  return rows;
}

export async function parseFaturasFile(file: File): Promise<FaturaRow[]> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith('.xlsx')) {
      const buffer = await file.arrayBuffer();
      return await parseExcelToFaturas(buffer);
    } else if (name.endsWith('.xls')) {
      try {
        const buffer = await file.arrayBuffer();
        return await parseExcelToFaturas(buffer);
      } catch {
        const text = await file.text();
        const rows = parseCsvTextToFaturas(text);
        if (rows.length > 0) return rows;
        throw new Error('Formato .xls legado incompatível. Por favor guarde o ficheiro no Excel como .xlsx ou .csv.');
      }
    } else {
      // .csv, .txt, .tsv
      const text = await file.text();
      return parseCsvTextToFaturas(text);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(msg);
  }
}

export function generateFaturasSampleCSV(): string {
  const headers = [
    'documento_ref',
    'data',
    'entidade',
    'tipo_doc',
    'num_doc',
    'documento',
    'requisicao',
    'num_contribuinte',
    'total_iva',
    'total_merc',
    'total_outros',
    'total_desc',
    'nome',
    'morada',
    'localidade',
    'cod_postal',
    'cod_postal_localidade',
    'pais',
    'nome_entrega',
    'morada_entrega',
    'cod_postal_localidade_entrega',
    'cod_postal_entrega',
    'localidade_entrega',
    'entidade_entrega',
    'cli_primavera',
    'sigla',
    'cliente_ser',
  ].join(';');

  const sampleRows = [
    'MAX-FA 26MAX/1;10/08/2026;10423;FA;1;FA 26MAX/1;LC040826/1;500123456;13,28;298,22;0;76,96;HONESTMOLECULE UNIPESSOAL LDA;ELOSPARK II- ESTRADA DE S.MARCOS 33;AGUALVA;2735-521;AGUALVA CACEM;PT;;ELOSPARK II- ESTRADA DE S.MARCOS 33;AGUALVA CACEM;2735-521;AGUALVA;10423;482;Max;Maxifar',
    'PHM-FA 2026/1;22/05/2026;0002;FA;1;FA 2026/1;P00194;B19582097;0;203500;0;0;BIOPHARMED;C/La Cora nº4, Local 1;;18006;Granada;ES;;C/La Cora nº4, Local 1;Granada;18006;;0002;6509;PHM;Pharmed',
    'VAR-FA 2026/1;04/02/2026;C001;FA;1;FA 2026/1;2026/1;503705420;92,06;2305,5;0;771,23;SERMAIL - LOGISTICA INTEGRADA, LDA;PARQUE EMPRESARIAL VIALONGA GRANJA, 25;GRANJA DE ALPRIATE;2625-607;VIALONGA;PT;;PARQUE EMPRESARIAL VIALONGA GRANJA, 25;VIALONGA;2625-607;GRANJA DE ALPRIATE;C001;6373;VAR;Varimpulse',
    'PHM-NC 2026/1;23/06/2026;0002;NC;1;NC 2026/1;FA.2026/1;B19582097;0;-203500;0;0;BIOPHARMED;C/La Cora nº4, Local 1;;18006;Granada;ES;;Parque Empresarial Vialonga-Granja;Vialonga;2625-607;Casal do Bagulho;0002;6509;PHM;Pharmed',
  ];

  return headers + '\n' + sampleRows.join('\n');
}

export async function generateFaturasSampleExcel(): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Faturas');

  worksheet.columns = [
    { header: 'documento_ref', key: 'documento_ref', width: 20 },
    { header: 'data', key: 'data', width: 14 },
    { header: 'entidade', key: 'entidade', width: 12 },
    { header: 'tipo_doc', key: 'tipo_doc', width: 10 },
    { header: 'num_doc', key: 'num_doc', width: 10 },
    { header: 'documento', key: 'documento', width: 18 },
    { header: 'requisicao', key: 'requisicao', width: 18 },
    { header: 'num_contribuinte', key: 'num_contribuinte', width: 18 },
    { header: 'total_iva', key: 'total_iva', width: 12 },
    { header: 'total_merc', key: 'total_merc', width: 14 },
    { header: 'total_outros', key: 'total_outros', width: 12 },
    { header: 'total_desc', key: 'total_desc', width: 12 },
    { header: 'nome', key: 'nome', width: 30 },
    { header: 'morada', key: 'morada', width: 32 },
    { header: 'localidade', key: 'localidade', width: 20 },
    { header: 'cod_postal', key: 'cod_postal', width: 14 },
    { header: 'cod_postal_localidade', key: 'cod_postal_localidade', width: 22 },
    { header: 'pais', key: 'pais', width: 8 },
    { header: 'nome_entrega', key: 'nome_entrega', width: 26 },
    { header: 'morada_entrega', key: 'morada_entrega', width: 32 },
    { header: 'cod_postal_localidade_entrega', key: 'cod_postal_localidade_entrega', width: 22 },
    { header: 'cod_postal_entrega', key: 'cod_postal_entrega', width: 14 },
    { header: 'localidade_entrega', key: 'localidade_entrega', width: 20 },
    { header: 'entidade_entrega', key: 'entidade_entrega', width: 14 },
    { header: 'cli_primavera', key: 'cli_primavera', width: 14 },
    { header: 'sigla', key: 'sigla', width: 10 },
    { header: 'cliente_ser', key: 'cliente_ser', width: 16 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Dark Slate
  };

  worksheet.addRow({
    documento_ref: 'MAX-FA 26MAX/1',
    data: '2026-08-10',
    entidade: '10423',
    tipo_doc: 'FA',
    num_doc: '1',
    documento: 'FA 26MAX/1',
    requisicao: 'LC040826/1',
    num_contribuinte: '500123456',
    total_iva: 13.28,
    total_merc: 298.22,
    total_outros: 0,
    total_desc: 76.96,
    nome: 'HONESTMOLECULE UNIPESSOAL LDA',
    morada: 'ELOSPARK II- ESTRADA DE S.MARCOS 33',
    localidade: 'AGUALVA',
    cod_postal: '2735-521',
    cod_postal_localidade: 'AGUALVA CACEM',
    pais: 'PT',
    nome_entrega: '',
    morada_entrega: 'ELOSPARK II- ESTRADA DE S.MARCOS 33',
    cod_postal_localidade_entrega: 'AGUALVA CACEM',
    cod_postal_entrega: '2735-521',
    localidade_entrega: 'AGUALVA',
    entidade_entrega: '10423',
    cli_primavera: '482',
    sigla: 'Max',
    cliente_ser: 'Maxifar',
  });

  worksheet.addRow({
    documento_ref: 'PHM-FA 2026/1',
    data: '2026-05-22',
    entidade: '0002',
    tipo_doc: 'FA',
    num_doc: '1',
    documento: 'FA 2026/1',
    requisicao: 'P00194',
    num_contribuinte: 'B19582097',
    total_iva: 0,
    total_merc: 203500,
    total_outros: 0,
    total_desc: 0,
    nome: 'BIOPHARMED',
    morada: 'C/La Cora nº4, Local 1',
    localidade: 'Granada',
    cod_postal: '18006',
    cod_postal_localidade: 'Granada',
    pais: 'ES',
    nome_entrega: '',
    morada_entrega: 'C/La Cora nº4, Local 1',
    cod_postal_localidade_entrega: 'Granada',
    cod_postal_entrega: '18006',
    localidade_entrega: '',
    entidade_entrega: '0002',
    cli_primavera: '6509',
    sigla: 'PHM',
    cliente_ser: 'Pharmed',
  });

  worksheet.addRow({
    documento_ref: 'VAR-FA 2026/1',
    data: '2026-02-04',
    entidade: 'C001',
    tipo_doc: 'FA',
    num_doc: '1',
    documento: 'FA 2026/1',
    requisicao: '2026/1',
    num_contribuinte: '503705420',
    total_iva: 92.06,
    total_merc: 2305.5,
    total_outros: 0,
    total_desc: 771.23,
    nome: 'SERMAIL - LOGISTICA INTEGRADA, LDA',
    morada: 'PARQUE EMPRESARIAL VIALONGA GRANJA, 25',
    localidade: 'GRANJA DE ALPRIATE',
    cod_postal: '2625-607',
    cod_postal_localidade: 'VIALONGA',
    pais: 'PT',
    nome_entrega: '',
    morada_entrega: 'PARQUE EMPRESARIAL VIALONGA GRANJA, 25',
    cod_postal_localidade_entrega: 'VIALONGA',
    cod_postal_entrega: '2625-607',
    localidade_entrega: 'GRANJA DE ALPRIATE',
    entidade_entrega: 'C001',
    cli_primavera: '6373',
    sigla: 'VAR',
    cliente_ser: 'Varimpulse',
  });

  worksheet.addRow({
    documento_ref: 'PHM-NC 2026/1',
    data: '2026-06-23',
    entidade: '0002',
    tipo_doc: 'NC',
    num_doc: '1',
    documento: 'NC 2026/1',
    requisicao: 'FA.2026/1',
    num_contribuinte: 'B19582097',
    total_iva: 0,
    total_merc: -203500,
    total_outros: 0,
    total_desc: 0,
    nome: 'BIOPHARMED',
    morada: 'C/La Cora nº4, Local 1',
    localidade: 'Granada',
    cod_postal: '18006',
    cod_postal_localidade: 'Granada',
    pais: 'ES',
    nome_entrega: '',
    morada_entrega: 'Parque Empresarial Vialonga-Granja',
    cod_postal_localidade_entrega: 'Vialonga',
    cod_postal_entrega: '2625-607',
    localidade_entrega: 'Casal do Bagulho',
    entidade_entrega: '0002',
    cli_primavera: '6509',
    sigla: 'PHM',
    cliente_ser: 'Pharmed',
  });

  worksheet.addRow({
    documento_ref: 'PHM-NCE 2026/1',
    data: '2026-10-22',
    entidade: '0002',
    tipo_doc: 'NCE',
    num_doc: '1',
    documento: 'NCE 2026/1',
    requisicao: 'FA.2026/82',
    num_contribuinte: 'B19582097',
    total_iva: -144,
    total_merc: -2400,
    total_outros: 0,
    total_desc: 0,
    nome: 'BIOPHARMED',
    morada: 'C/La Cora nº4, Local 1',
    localidade: 'Granada',
    cod_postal: '18006',
    cod_postal_localidade: 'Granada',
    pais: 'ES',
    nome_entrega: '',
    morada_entrega: 'C/La Cora nº4, Local 1',
    cod_postal_localidade_entrega: 'Granada',
    cod_postal_entrega: '18006',
    localidade_entrega: '',
    entidade_entrega: '0002',
    cli_primavera: '6509',
    sigla: 'PHM',
    cliente_ser: 'Pharmed',
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
