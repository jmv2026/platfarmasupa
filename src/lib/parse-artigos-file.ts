import ExcelJS from 'exceljs';
import { TipoArtigo, TipoArmazenamento } from './supabase/types';

export interface ArtigoImportInput {
  artigo_id: string;
  descricao: string;
  tratamento_serie?: boolean;
  tratamento_lote?: boolean;
  tipo_artigo?: TipoArtigo;
  tipo_armazenamento?: TipoArmazenamento;
  ativo?: boolean;
}

/**
 * Normaliza os nomes de cabeçalhos de ficheiros TXT/CSV/Excel para os campos de Artigo.
 */
export function normalizeArtigoHeaderKey(key: string): string {
  if (!key) return '';

  const clean = key
    .replace(/^\uFEFF/, '') // Remover UTF-8 BOM
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  // 1. Tratamento Série (antes de 'serie')
  if (
    clean.includes('tratamentoserie') ||
    clean.includes('tratamentoseries') ||
    clean.includes('tratserie') ||
    clean.includes('tratseries') ||
    clean.includes('controloserie') ||
    clean.includes('controloseries') ||
    clean === 'serie' ||
    clean === 'series' ||
    clean === 'serial' ||
    clean === 'nrserie' ||
    clean === 'numserie'
  ) {
    return 'tratamento_serie';
  }

  // 2. Tratamento Lote (antes de 'lote')
  if (
    clean.includes('tratamentolote') ||
    clean.includes('tratamentolotes') ||
    clean.includes('tratlote') ||
    clean.includes('tratlotes') ||
    clean.includes('contrololote') ||
    clean.includes('contrololotes') ||
    clean === 'lote' ||
    clean === 'lotes' ||
    clean === 'batch'
  ) {
    return 'tratamento_lote';
  }

  // 3. Tipo de Artigo
  if (
    clean.includes('tipoartigo') ||
    clean.includes('tipodeartigo') ||
    clean === 'tipoart' ||
    clean === 'tipo'
  ) {
    return 'tipo_artigo';
  }

  // 4. Tipo de Armazenamento / Conservação
  if (
    clean.includes('tipoarmazenamento') ||
    clean.includes('armazenamento') ||
    clean.includes('conservacao') ||
    clean.includes('temperatura') ||
    clean === 'armaz'
  ) {
    return 'tipo_armazenamento';
  }

  // 5. Artigo ID / Código
  if (
    clean === 'artigo' ||
    clean === 'art' ||
    clean === 'artid' ||
    clean === 'artigo_id' ||
    clean === 'artigoid' ||
    clean === 'codartigo' ||
    clean === 'codigo' ||
    clean === 'cod' ||
    clean === 'sku' ||
    clean.includes('artigo')
  ) {
    return 'artigo_id';
  }

  // 6. Descrição / Designação Comercial
  if (
    clean.includes('desc') ||
    clean.includes('designacao') ||
    clean.includes('nome') ||
    clean.includes('produto')
  ) {
    return 'descricao';
  }

  // 7. Ativo / Estado
  if (
    clean === 'ativo' ||
    clean === 'active' ||
    clean === 'estado' ||
    clean === 'status'
  ) {
    return 'ativo';
  }

  return clean;
}

/**
 * Normaliza valores de boolean (0/1, true/false, sim/nao)
 * 0 -> false, 1 -> true
 */
export function parseArtigoBoolean(val: unknown, defaultValue = false): boolean {
  if (val === undefined || val === null || val === '') return defaultValue;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'object' && val !== null) {
    if ('result' in val) return parseArtigoBoolean((val as { result: unknown }).result, defaultValue);
    if ('text' in val) return parseArtigoBoolean((val as { text: unknown }).text, defaultValue);
  }
  const clean = String(val).trim().toLowerCase();
  if (clean === '1' || clean === 'true' || clean === 't' || clean === 'sim' || clean === 's' || clean === 'yes' || clean === 'y') {
    return true;
  }
  if (clean === '0' || clean === 'false' || clean === 'f' || clean === 'nao' || clean === 'não' || clean === 'n' || clean === 'no') {
    return false;
  }
  return defaultValue;
}

/**
 * Normaliza o Tipo de Artigo para valores válidos na base de dados ('MH' | 'MV' | 'DM' | 'DC' | 'SC')
 */
export function normalizeTipoArtigo(val: unknown): TipoArtigo {
  if (!val) return 'MH';
  const clean = String(val).trim().toUpperCase();
  if (clean === 'MH' || clean === 'MED' || clean === 'M' || clean === 'HUMANO' || clean === 'MEDICAMENTO') {
    return 'MH';
  }
  if (clean === 'MV' || clean === 'VET' || clean === 'VETERINARIO') {
    return 'MV';
  }
  if (clean === 'DM' || clean === 'DISPOSITIVO') {
    return 'DM';
  }
  if (clean === 'DC' || clean === 'DERMO' || clean === 'COSMETICO' || clean === 'SA' || clean === 'SUPLEMENTO') {
    return 'DC';
  }
  if (clean === 'SC' || clean === 'CONTROLADA' || clean === 'ESTUPEFACIENTE') {
    return 'SC';
  }
  return 'MH';
}

/**
 * Normaliza o Tipo de Armazenamento para valores válidos ('TA' | 'TC' | 'TF')
 */
export function normalizeTipoArmazenamento(val: unknown): TipoArmazenamento {
  if (!val) return 'TA';
  const clean = String(val).trim().toUpperCase();
  if (clean === 'TA' || clean === 'AMBIENTE' || clean === 'AMB') {
    return 'TA';
  }
  if (clean === 'TC' || clean.includes('CONTROL') || clean.includes('15-25')) {
    return 'TC';
  }
  if (clean === 'TF' || clean.includes('FRIO') || clean.includes('2-8') || clean.includes('REFRIG')) {
    return 'TF';
  }
  return 'TA';
}

/**
 * Parser para ficheiros TXT/CSV de catálogo de artigos
 */
export function parseTextArtigosFile(textContent: string): ArtigoImportInput[] {
  const cleanContent = textContent.replace(/^\uFEFF/, '');
  const lines = cleanContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  // Detetar delimitador
  const firstLine = lines[0];
  let delimiter = ';';
  if (firstLine.includes(';')) {
    delimiter = ';';
  } else if (firstLine.includes('\t')) {
    delimiter = '\t';
  } else if (firstLine.includes(',')) {
    delimiter = ',';
  }

  const rawHeaders = firstLine.split(delimiter).map((h) => h.replace(/^["']|["']$/g, '').trim());
  const headerKeys = rawHeaders.map((h) => normalizeArtigoHeaderKey(h));

  const hasStandardColumns = headerKeys.includes('artigo_id') && headerKeys.includes('descricao');

  const rows: ArtigoImportInput[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;

    // Se tiver delimitador ';' e houver semicolons extras na descrição
    const parts = rawLine.split(delimiter).map((p) => p.replace(/^["']|["']$/g, '').trim());

    if (hasStandardColumns && rawHeaders.length === 6 && parts.length > 6) {
      // Formato clássico: artigo_id;Descricao;tratamento_serie;tratamento_lote;tipo_artigo;tipo_armazenamento
      const artigo_id = parts[0];
      const tipo_armazenamento = parts[parts.length - 1];
      const tipo_artigo = parts[parts.length - 2];
      const tratamento_lote = parts[parts.length - 3];
      const tratamento_serie = parts[parts.length - 4];
      const descricao = parts.slice(1, parts.length - 4).join(';').trim();

      if (artigo_id && descricao) {
        rows.push({
          artigo_id: artigo_id.trim().toUpperCase(),
          descricao,
          tratamento_serie: parseArtigoBoolean(tratamento_serie, false),
          tratamento_lote: parseArtigoBoolean(tratamento_lote, true),
          tipo_artigo: normalizeTipoArtigo(tipo_artigo),
          tipo_armazenamento: normalizeTipoArmazenamento(tipo_armazenamento),
          ativo: true,
        });
      }
      continue;
    }

    const rowObj: Record<string, string> = {};
    for (let j = 0; j < headerKeys.length; j++) {
      const key = headerKeys[j];
      if (key && j < parts.length) {
        rowObj[key] = parts[j] || '';
      }
    }

    const artigo_id = (rowObj.artigo_id || '').trim().toUpperCase();
    const descricao = (rowObj.descricao || '').trim();

    if (!artigo_id && !descricao) continue;
    if (!artigo_id) continue;

    rows.push({
      artigo_id,
      descricao: descricao || artigo_id,
      tratamento_serie: parseArtigoBoolean(rowObj.tratamento_serie, false),
      tratamento_lote: parseArtigoBoolean(rowObj.tratamento_lote, true),
      tipo_artigo: normalizeTipoArtigo(rowObj.tipo_artigo),
      tipo_armazenamento: normalizeTipoArmazenamento(rowObj.tipo_armazenamento),
      ativo: parseArtigoBoolean(rowObj.ativo, true),
    });
  }

  // Deduplicar por artigo_id (mantém a última ocorrência no ficheiro)
  const uniqueMap = new Map<string, ArtigoImportInput>();
  for (const r of rows) {
    if (r.artigo_id) {
      uniqueMap.set(r.artigo_id, r);
    }
  }

  return Array.from(uniqueMap.values());
}

/**
 * Parser para ficheiros Excel (.xlsx/.xls) de catálogo de artigos via ExcelJS
 */
export async function parseExcelArtigosFile(arrayBuffer: ArrayBuffer): Promise<ArtigoImportInput[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rawHeaders: string[] = [];
  let headerRowIndex = 1;

  worksheet.eachRow((row, rowNumber) => {
    if (rawHeaders.length > 0) return;
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    const strValues = values.map((v) => (v ? String(v).trim() : ''));
    const matches = strValues.some(
      (v) =>
        normalizeArtigoHeaderKey(v) === 'artigo_id' ||
        normalizeArtigoHeaderKey(v) === 'descricao' ||
        normalizeArtigoHeaderKey(v) === 'tipo_artigo'
    );
    if (matches) {
      headerRowIndex = rowNumber;
      rawHeaders.push(...strValues);
    }
  });

  if (rawHeaders.length === 0) {
    const firstRow = worksheet.getRow(1);
    const values = Array.isArray(firstRow.values) ? firstRow.values.slice(1) : [];
    rawHeaders.push(...values.map((v) => (v ? String(v).trim() : '')));
  }

  const headerKeys = rawHeaders.map((h) => normalizeArtigoHeaderKey(h));
  const rows: ArtigoImportInput[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return;

    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    const rowObj: Record<string, unknown> = {};

    for (let c = 0; c < headerKeys.length; c++) {
      const key = headerKeys[c];
      if (key && c < values.length) {
        const rawCell = values[c];
        let cellStr = '';
        if (rawCell !== null && rawCell !== undefined) {
          if (typeof rawCell === 'object') {
            if ('text' in rawCell) {
              cellStr = String((rawCell as { text: unknown }).text ?? '');
            } else if ('result' in rawCell) {
              cellStr = String((rawCell as { result: unknown }).result ?? '');
            } else {
              cellStr = String(rawCell);
            }
          } else {
            cellStr = String(rawCell).trim();
          }
        }
        rowObj[key] = cellStr;
      }
    }

    const artigo_id = String(rowObj.artigo_id || '').trim().toUpperCase();
    const descricao = String(rowObj.descricao || '').trim();

    if (!artigo_id && !descricao) return;
    if (!artigo_id) return;

    rows.push({
      artigo_id,
      descricao: descricao || artigo_id,
      tratamento_serie: parseArtigoBoolean(rowObj.tratamento_serie, false),
      tratamento_lote: parseArtigoBoolean(rowObj.tratamento_lote, true),
      tipo_artigo: normalizeTipoArtigo(rowObj.tipo_artigo),
      tipo_armazenamento: normalizeTipoArmazenamento(rowObj.tipo_armazenamento),
      ativo: parseArtigoBoolean(rowObj.ativo, true),
    });
  });

  // Deduplicar por artigo_id
  const uniqueMap = new Map<string, ArtigoImportInput>();
  for (const r of rows) {
    if (r.artigo_id) {
      uniqueMap.set(r.artigo_id, r);
    }
  }

  return Array.from(uniqueMap.values());
}
