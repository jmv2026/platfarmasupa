import ExcelJS from 'exceljs';
import { ImpStkInput } from './supabase/types';

/**
 * Normaliza os nomes de cabeçalhos de ficheiros TXT/CSV/Excel para os campos de imp_stk.
 * As verificações são estritas e ordenadas para evitar colisões entre palavras compostas
 * (ex: 'tipo_artigo' não deve colidir com 'artigo', e 'datastock'/'estadostock' não devem colidir com 'stk').
 */
export function normalizeHeaderKey(key: string): string {
  if (!key) return '';

  const clean = key
    .replace(/^\uFEFF/, '') // Remover UTF-8 BOM
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  // 1. Tipo de Artigo (Verificar antes de 'artigo')
  if (
    clean.includes('tipoartigo') ||
    clean.includes('tipodeartigo') ||
    clean === 'tipo' ||
    clean === 'tipoart'
  ) {
    return 'tipo_artigo';
  }

  // 2. Data de Stock (Verificar antes de 'stk' / 'stock')
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

  // 3. Estado do Stock (Verificar antes de 'stk' / 'stock')
  if (
    clean.includes('estadostock') ||
    clean.includes('estadostk') ||
    clean.includes('estado') ||
    clean.includes('status')
  ) {
    return 'estado_stock';
  }

  // 4. Sub-Família (Verificar antes de 'familia')
  if (
    clean.includes('subfamilia') ||
    clean.includes('subfam') ||
    clean === 'subf'
  ) {
    return 'sub_familia';
  }

  // 5. Família
  if (clean.includes('familia') || clean.includes('fam')) {
    return 'familia';
  }

  // 6. Artigo / Código do Produto
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

  // 7. Quantidade / Stock
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

  // 8. Descrição / Designação
  if (
    clean.includes('desc') ||
    clean.includes('designacao') ||
    clean.includes('produto') ||
    clean.includes('nome')
  ) {
    return 'descricao';
  }

  // 9. Armazém
  if (
    clean.includes('armazem') ||
    clean.includes('armaz') ||
    clean.includes('wh') ||
    clean.includes('deposito') ||
    clean === 'arm'
  ) {
    return 'armazem';
  }

  // 10. Lote
  if (
    clean.includes('lote') ||
    clean.includes('batch') ||
    clean.includes('lot')
  ) {
    return 'lote';
  }

  // 11. Bloqueado
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

/**
 * Converte strings de data/hora (ex: "11/12/2025 17:14:32" ou "18/9/2026 17:36:14") para formato ISO compatível com timestamptz
 */
export function parseDateStockToISO(val: string | null | undefined): string | null {
  if (!val) return null;
  const trimmed = String(val).replace(/^["']|["']$/g, '').trim();
  if (!trimmed) return null;

  // Formato DD/MM/YYYY HH:mm:ss ou D/M/YYYY HH:mm:ss
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

  // Formato YYYY-MM-DD ou já ISO
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString();
  }

  return trimmed;
}

/**
 * Converte valores de bloqueado (ex: "0", "1", "true", "false", "sim", "nao") para boolean (default false)
 */
export function parseBloqueadoToBoolean(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (!val) return false;
  const clean = String(val).trim().toLowerCase();
  return clean === '1' || clean === 'true' || clean === 't' || clean === 'sim' || clean === 's';
}

/**
 * Faz o parsing de um ficheiro de texto (.txt ou .csv) delimitado por ponto-e-vírgula, vírgula ou tab
 */
export function parseTextStockFile(textContent: string, filename?: string): ImpStkInput[] {
  const cleanContent = textContent.replace(/^\uFEFF/, ''); // Remover BOM inicial
  const lines = cleanContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  // Detetar delimitador da primeira linha
  const firstLine = lines[0];
  let delimiter = ';';
  if (firstLine.includes(';')) {
    delimiter = ';';
  } else if (firstLine.includes('\t')) {
    delimiter = '\t';
  } else if (firstLine.includes(',')) {
    delimiter = ',';
  }

  // Obter e normalizar cabeçalhos
  const rawHeaders = firstLine.split(delimiter).map((h) => h.replace(/^["']|["']$/g, '').trim());
  const headerKeys = rawHeaders.map(normalizeHeaderKey);

  const results: ImpStkInput[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const values = line.split(delimiter).map((v) => v.replace(/^["']|["']$/g, '').trim());
    const row: Record<string, string> = {};

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
      bloqueado: parseBloqueadoToBoolean(row['bloqueado']),
      familia: row['familia'] || '',
      tipo_artigo: row['tipo_artigo'] || '',
      sub_familia: row['sub_familia'] || '',
    });
  }

  return results;
}

/**
 * Faz o parsing de um ficheiro Excel (.xlsx / .xls)
 */
export async function parseExcelStockFile(arrayBuffer: ArrayBuffer, filename?: string): Promise<ImpStkInput[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const results: ImpStkInput[] = [];
  const headerKeys: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // Linha de cabeçalho
      row.eachCell((cell, colNumber) => {
        const headerText = String(cell.value || '').trim();
        headerKeys[colNumber] = normalizeHeaderKey(headerText);
      });
    } else {
      // Linha de dados
      const rowData: Record<string, string> = {};

      row.eachCell((cell, colNumber) => {
        const key = headerKeys[colNumber];
        if (key) {
          let val = '';
          if (cell.value instanceof Date) {
            val = cell.value.toISOString();
          } else if (typeof cell.value === 'object' && cell.value !== null) {
            // Textos ricos ou fórmulas
            val = 'text' in cell.value ? String((cell.value as { text: string }).text) : String(cell.value);
          } else if (cell.value !== null && cell.value !== undefined) {
            val = String(cell.value).trim();
          }
          rowData[key] = val;
        }
      });

      const parsedStk = parseFloat((rowData['stk'] || '0').replace(',', '.'));
      const rawDateStock = rowData['datastock'] || rowData['data_stock'] || '';
      const formattedDateStock = parseDateStockToISO(rawDateStock) || rawDateStock;

      results.push({
        artigo: rowData['artigo'] || '',
        descricao: rowData['descricao'] || '',
        armazem: rowData['armazem'] || '',
        lote: rowData['lote'] || '',
        estado_stock: rowData['estado_stock'] || 'DISP',
        stk: isNaN(parsedStk) ? 0 : parsedStk,
        datastock: formattedDateStock,
        bloqueado: parseBloqueadoToBoolean(rowData['bloqueado']),
        familia: rowData['familia'] || '',
        tipo_artigo: rowData['tipo_artigo'] || '',
        sub_familia: rowData['sub_familia'] || '',
      });
    }
  });

  return results;
}
