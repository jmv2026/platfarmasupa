import ExcelJS from 'exceljs';
import { ImpStkInput } from './supabase/types';

/**
 * Normaliza os nomes de cabeçalhos de ficheiros TXT/CSV/Excel para os campos de imp_stk
 */
export function normalizeHeaderKey(key: string): string {
  const clean = key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  if (clean.includes('artigo') || clean.includes('codigo') || clean === 'cod' || clean === 'sku') return 'artigo';
  if (clean.includes('desc') || clean.includes('designacao') || clean.includes('produto') || clean.includes('nome')) return 'descricao';
  if (clean.includes('armazem') || clean.includes('armaz') || clean.includes('wh') || clean.includes('deposito')) return 'armazem';
  if (clean.includes('lote') || clean.includes('batch') || clean.includes('lot')) return 'lote';
  if (clean.includes('estadostock') || clean.includes('estado') || clean.includes('status')) return 'estado_stock';
  if (clean.includes('stk') || clean.includes('stock') || clean.includes('qtd') || clean.includes('quantidade') || clean.includes('qty')) return 'stk';
  if (clean.includes('datastock') || clean.includes('data') || clean.includes('date') || clean.includes('validade')) return 'data_stock';
  if (clean.includes('bloqueado') || clean.includes('bloq') || clean.includes('blocked') || clean.includes('lock')) return 'bloqueado';
  if (clean.includes('subfamilia') || clean.includes('subfam')) return 'sub_familia';
  if (clean.includes('familia') || clean.includes('fam')) return 'familia';
  if (clean.includes('tipoartigo') || clean.includes('tipo')) return 'tipo_artigo';

  return clean;
}

/**
 * Faz o parsing de um ficheiro de texto (.txt ou .csv) delimitado por ponto-e-vírgula, vírgula ou tab
 */
export function parseTextStockFile(textContent: string, filename: string): ImpStkInput[] {
  const lines = textContent
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

    results.push({
      artigo: row['artigo'] || '',
      descricao: row['descricao'] || '',
      armazem: row['armazem'] || '',
      lote: row['lote'] || '',
      estado_stock: row['estado_stock'] || 'DISP',
      stk: isNaN(parsedStk) ? 0 : parsedStk,
      data_stock: row['data_stock'] || '',
      bloqueado: row['bloqueado'] || '0',
      familia: row['familia'] || '',
      tipo_artigo: row['tipo_artigo'] || '',
      sub_familia: row['sub_familia'] || '',
      filename: filename,
    });
  }

  return results;
}

/**
 * Faz o parsing de um ficheiro Excel (.xlsx / .xls)
 */
export async function parseExcelStockFile(arrayBuffer: ArrayBuffer, filename: string): Promise<ImpStkInput[]> {
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
            val = cell.value.toLocaleString('pt-PT');
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

      results.push({
        artigo: rowData['artigo'] || '',
        descricao: rowData['descricao'] || '',
        armazem: rowData['armazem'] || '',
        lote: rowData['lote'] || '',
        estado_stock: rowData['estado_stock'] || 'DISP',
        stk: isNaN(parsedStk) ? 0 : parsedStk,
        data_stock: rowData['data_stock'] || '',
        bloqueado: rowData['bloqueado'] || '0',
        familia: rowData['familia'] || '',
        tipo_artigo: rowData['tipo_artigo'] || '',
        sub_familia: rowData['sub_familia'] || '',
        filename: filename,
      });
    }
  });

  return results;
}
