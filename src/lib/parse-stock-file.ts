import ExcelJS from 'exceljs';

export interface StockImportRow {
  id?: string;
  cliente_ser: string;
  entidade?: string | null;
  sigla?: string | null;
  artigo: string;
  armazem: string;
  localizacao?: string | null;
  lote?: string | null;
  stock: number;
  data_stock?: string | null; // YYYY-MM-DD
}

/**
 * Valida e normaliza um UUID (remove chavetas {} se presentes e converte para minúsculas).
 * Se não for um UUID válido, gera um novo UUID.
 */
function cleanOrGenerateUuid(val: any): string {
  if (val !== undefined && val !== null) {
    let s = String(val).trim();
    if (s.startsWith('{') && s.endsWith('}') && s.length >= 36) {
      s = s.slice(1, -1).trim();
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(s)) {
      return s.toLowerCase();
    }
  }
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
}

/**
 * Converte valor numérico (suporta vírgulas e pontos decimais)
 */
function parseNum(v: any, defaultVal = 0): number {
  if (v === undefined || v === null || v === '') return defaultVal;
  if (typeof v === 'number') {
    return isNaN(v) ? defaultVal : v;
  }
  let s = String(v).trim().replace(/\s/g, '');
  if (s === '' || s.toLowerCase() === 'null') return defaultVal;
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
  return isNaN(num) ? defaultVal : num;
}

/**
 * Converte data para string YYYY-MM-DD
 */
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
    if (!isNaN(d.getTime())) {
      return d.toISOString().substring(0, 10);
    }
  }
  const str = String(v).trim();
  if (!str || str.toLowerCase() === 'null') return null;

  // DD/MM/YYYY ou DD-MM-YYYY
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

function cleanCell(val: any): string {
  if (val === undefined || val === null) return '';
  let s = String(val).trim();
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function normalizeHeader(key: string): string {
  if (!key) return '';
  const clean = key
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  if (clean === 'id' || clean === 'guid' || clean === 'uuid') return 'id';
  if (
    clean === 'clienteser' ||
    clean === 'clientser' ||
    clean === 'cliente' ||
    clean === 'serie' ||
    clean === 'codcliente'
  )
    return 'cliente_ser';
  if (clean === 'entidade' || clean === 'codentidade' || clean === 'identidade')
    return 'entidade';
  if (clean === 'sigla' || clean === 'siglacliente') return 'sigla';
  if (
    clean === 'artigo' ||
    clean === 'codartigo' ||
    clean === 'artigo_id' ||
    clean === 'codigoartigo' ||
    clean === 'ref'
  )
    return 'artigo';
  if (
    clean === 'armazem' ||
    clean === 'codarmazem' ||
    clean === 'tipoarmazem' ||
    clean === 'armazemid'
  )
    return 'armazem';
  if (
    clean === 'localizacao' ||
    clean === 'loc' ||
    clean === 'posicao' ||
    clean === 'local'
  )
    return 'localizacao';
  if (clean === 'lote' || clean === 'numlote' || clean === 'lot') return 'lote';
  if (
    clean === 'stock' ||
    clean === 'quantidade' ||
    clean === 'qtd' ||
    clean === 'saldo' ||
    clean === 'quant'
  )
    return 'stock';
  if (
    clean === 'datastock' ||
    clean === 'data' ||
    clean === 'datasaldo' ||
    clean === 'datacontagem'
  )
    return 'data_stock';
  if (clean === 'estadostock' || clean === 'estado') return 'estado_stock'; // ignorado com segurança

  return clean;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(cleanCell(current));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(cleanCell(current));
  return result;
}

/**
 * Lê e analisa o conteúdo de texto de ficheiros CSV ou TXT
 */
export function parseStockTextFile(text: string, defaultCliente?: string): StockImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  let delimiter = ';';
  if (lines[0].includes(';')) delimiter = ';';
  else if (lines[0].includes('\t')) delimiter = '\t';
  else if (lines[0].includes(',')) delimiter = ',';
  else if (lines[0].includes('|')) delimiter = '|';

  const rawHeaders = splitCsvLine(lines[0], delimiter);
  const headers = rawHeaders.map((c) => normalizeHeader(c));
  const rows: StockImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    const r: Record<string, string> = {};
    headers.forEach((h, idx) => {
      r[h] = cols[idx] !== undefined ? cleanCell(cols[idx]) : '';
    });

    const isEmpty = Object.values(r).every((v) => !v);
    if (isEmpty) continue;

    const sigla = r['sigla'] ? r['sigla'].trim() : null;
    const clienteSer = r['cliente_ser'] || sigla || defaultCliente || '';
    const entidade = r['entidade'] ? r['entidade'].trim() : null;
    const artigo = r['artigo'] || '';
    const armazem = r['armazem'] || '';

    // Artigo e armazém são essenciais para uma linha de stock
    if (!artigo && !armazem && !clienteSer) continue;

    rows.push({
      id: cleanOrGenerateUuid(r['id']),
      cliente_ser: clienteSer.trim(),
      entidade,
      sigla: sigla || (clienteSer ? clienteSer.trim() : null),
      artigo: artigo.trim(),
      armazem: armazem.trim(),
      localizacao: r['localizacao'] ? r['localizacao'].trim() : null,
      lote: r['lote'] ? r['lote'].trim() : null,
      stock: parseNum(r['stock'], 0),
      data_stock: parseDateOnly(r['data_stock']),
    });
  }

  return rows;
}

/**
 * Lê e analisa ficheiros Excel (.xlsx ou .xls)
 */
export async function parseStockExcelFile(
  arrayBuffer: ArrayBuffer,
  defaultCliente?: string
): Promise<StockImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers: string[] = [];
  const rows: StockImportRow[] = [];

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
              // manusear Date
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

      const isEmpty = Object.values(r).every(
        (v) => v === null || v === undefined || v === ''
      );
      if (isEmpty) return;

      const sigla = r['sigla'] ? String(r['sigla']).trim() : null;
      const clienteSer = r['cliente_ser'] || sigla || defaultCliente || '';
      const entidade = r['entidade'] ? String(r['entidade']).trim() : null;
      const artigo = r['artigo'] || '';
      const armazem = r['armazem'] || '';

      if (!artigo && !armazem && !clienteSer) return;

      rows.push({
        id: cleanOrGenerateUuid(r['id']),
        cliente_ser: String(clienteSer).trim(),
        entidade,
        sigla: sigla || (clienteSer ? String(clienteSer).trim() : null),
        artigo: String(artigo).trim(),
        armazem: String(armazem).trim(),
        localizacao: r['localizacao'] ? String(r['localizacao']).trim() : null,
        lote: r['lote'] ? String(r['lote']).trim() : null,
        stock: parseNum(r['stock'], 0),
        data_stock: parseDateOnly(r['data_stock']),
      });
    }
  });

  return rows;
}

/**
 * Lê qualquer ficheiro suportado (.xlsx, .xls, .csv, .txt)
 */
export async function parseStockFile(
  file: File,
  defaultCliente?: string
): Promise<StockImportRow[]> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith('.xlsx')) {
      const buffer = await file.arrayBuffer();
      return await parseStockExcelFile(buffer, defaultCliente);
    } else if (name.endsWith('.xls')) {
      try {
        const buffer = await file.arrayBuffer();
        return await parseStockExcelFile(buffer, defaultCliente);
      } catch {
        const text = await file.text();
        const rows = parseStockTextFile(text, defaultCliente);
        if (rows.length > 0) return rows;
        throw new Error(
          'Formato .xls legado incompatível. Por favor guarde o ficheiro no Excel como .xlsx ou .csv.'
        );
      }
    } else {
      // .csv ou .txt
      const text = await file.text();
      return parseStockTextFile(text, defaultCliente);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao processar ficheiro';
    throw new Error(`Falha ao ler ficheiro de stock: ${msg}`);
  }
}

export const STOCK_HEADERS = [
  'id',
  'cliente_ser',
  'Entidade',
  'Sigla',
  'artigo',
  'armazem',
  'localizacao',
  'lote',
  'stock',
  'datastock',
] as const;

export const STOCK_SAMPLE_DATA: Record<string, any>[] = [
  {
    id: '{7EFAE629-C8C2-490B-BF1D-03A60392FC2C}',
    cliente_ser: 'AOP',
    Entidade: '6159',
    Sigla: 'AOP',
    artigo: '5781331',
    armazem: 'AOP01',
    localizacao: 'AOP01',
    lote: '<L01>',
    stock: 0,
    datastock: '',
  },
  {
    id: '{4813C4C5-409F-43BF-A597-1F0A2D38EDEB}',
    cliente_ser: 'AOP',
    Entidade: '6159',
    Sigla: 'AOP',
    artigo: '5856216',
    armazem: 'AOP05',
    localizacao: 'AOP05.12B56',
    lote: '<L01>',
    stock: 0,
    datastock: '',
  },
  {
    id: '{90D88731-AE2C-421F-B3C7-1199C66E4988}',
    cliente_ser: 'AOP',
    Entidade: '6159',
    Sigla: 'AOP',
    artigo: '5831235',
    armazem: 'AOP05',
    localizacao: 'AOP05.16C12',
    lote: 'TREC0186',
    stock: 0,
    datastock: '27/11/2023',
  },
  {
    id: '{13FA3B08-8E5A-4E78-9DAE-0004C198333D}',
    cliente_ser: 'AOP',
    Entidade: '6159',
    Sigla: 'AOP',
    artigo: '5781349',
    armazem: 'AOP01',
    localizacao: 'AOP01.14B34',
    lote: 'TREP1812',
    stock: 0,
    datastock: '03/06/2026',
  },
  {
    id: '{E7F324D4-2224-4D19-8BEE-02C12CB19C8D}',
    cliente_ser: 'AOP',
    Entidade: '6159',
    Sigla: 'AOP',
    artigo: '5781323',
    armazem: 'AOP06',
    localizacao: 'AOP06.01R01',
    lote: 'TREP1394',
    stock: 97,
    datastock: '14/09/2026',
  },
];

/**
 * Gera modelo CSV delimitado por ponto e vírgula (;)
 */
export function generateStockSampleCSV(): string {
  const headerLine = STOCK_HEADERS.join(';');
  const rowLines = STOCK_SAMPLE_DATA.map((row) => {
    return STOCK_HEADERS.map((key) => {
      const val = row[key];
      if (val === undefined || val === null || val === '') return '';
      const str = String(val).trim();
      if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(';');
  });

  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Gera modelo Excel (.xlsx) estilizado
 */
export async function generateStockSampleExcel(): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Stock');

  const columnWidths: Record<string, number> = {
    id: 40,
    cliente_ser: 14,
    Entidade: 14,
    Sigla: 12,
    artigo: 16,
    armazem: 14,
    localizacao: 18,
    lote: 18,
    stock: 14,
    datastock: 16,
  };

  worksheet.columns = STOCK_HEADERS.map((h) => ({
    header: h,
    key: h,
    width: columnWidths[h] || 16,
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4338CA' }, // Indigo
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  STOCK_SAMPLE_DATA.forEach((row) => {
    worksheet.addRow(row);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
