import ExcelJS from 'exceljs';
import { TipoArtigo, TipoArmazenamento } from './supabase/types';

export interface ArtigoImportInput {
  artigo_id: string;
  descricao: string;
  tratamento_serie?: boolean;
  tratamento_lote?: boolean;
  tipo_artigo?: TipoArtigo;
  tipo_armazenamento?: TipoArmazenamento;
  pva?: number;
  pvp?: number;
  ativo?: boolean;
}

/**
 * Normaliza os nomes de cabeçalhos de ficheiros TXT/CSV/Excel para os campos de Artigo.
 * Ordem estrita: descrições e nomes são avaliados ANTES de 'artigo' para não haver colisões
 * (ex: 'Descrição do Artigo' deve ser 'descricao' e 'Código do Artigo' deve ser 'artigo_id').
 */
export function normalizeArtigoHeaderKey(key: string): string {
  if (!key) return '';

  const clean = key
    .replace(/^\uFEFF/, '') // Remover UTF-8 BOM
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  // 1. Descrição / Designação / Nome do Artigo (AVALIAR PRIMEIRO para evitar que 'artigo' capture 'descrição do artigo')
  if (
    clean.includes('desc') ||
    clean.includes('designacao') ||
    clean.includes('nome') ||
    clean.includes('produto') ||
    clean.includes('denominacao') ||
    clean.includes('titulo') ||
    clean.includes('rotulo')
  ) {
    return 'descricao';
  }

  // 2. Tratamento Série (antes de 'serie')
  if (
    clean.includes('tratamentoserie') ||
    clean.includes('tratserie') ||
    clean.includes('controloserie') ||
    clean.includes('controleserie') ||
    clean.includes('serie') ||
    clean === 'series' ||
    clean === 'serial' ||
    clean === 'nrserie' ||
    clean === 'numserie' ||
    clean === 'sn'
  ) {
    return 'tratamento_serie';
  }

  // 3. Tratamento Lote (antes de 'lote')
  if (
    clean.includes('tratamentolote') ||
    clean.includes('tratlote') ||
    clean.includes('contrololote') ||
    clean.includes('controlelote') ||
    clean.includes('lote') ||
    clean === 'lotes' ||
    clean === 'batch'
  ) {
    return 'tratamento_lote';
  }

  // 4. Tipo de Artigo / Classificação Regulamentar
  if (
    clean.includes('tipoartigo') ||
    clean.includes('tipodeartigo') ||
    clean === 'tipoart' ||
    clean === 'tipo' ||
    clean === 'classificacao' ||
    clean === 'categoria' ||
    clean === 'familia' ||
    clean === 'subfamilia'
  ) {
    return 'tipo_artigo';
  }

  // 5. Tipo de Armazenamento / Condição de Conservação Térmica
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

  // 6. PVA / PVP / Preço de Venda
  if (
    clean === 'pva' ||
    clean.includes('pva') ||
    clean === 'pvp' ||
    clean.includes('pvp') ||
    clean === 'preco' ||
    clean === 'precovenda' ||
    clean === 'precopva' ||
    clean === 'precopvp' ||
    clean === 'valorpva' ||
    clean === 'valorpvp' ||
    clean === 'pvaunitario' ||
    clean === 'pvpunitario' ||
    clean === 'price' ||
    clean === 'valor'
  ) {
    return 'pva';
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

  // 8. Artigo ID / Código Único do Produto (avaliado por último)
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

/**
 * Extrai texto limpo de uma célula do ExcelJS (suporta RichText, fórmulas, hyperlinks, números, etc.)
 */
export function extractExcelCellValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (val instanceof Date) return val.toISOString();

  if (typeof val === 'object') {
    // RichText: { richText: [ { text: '...' } ] }
    if ('richText' in val && Array.isArray((val as { richText: unknown[] }).richText)) {
      return (val as { richText: { text?: string }[] }).richText
        .map((t) => t.text || '')
        .join('')
        .trim();
    }
    // Formula result: { formula: '...', result: '...' }
    if ('result' in val) {
      const res = (val as { result: unknown }).result;
      if (res === null || res === undefined) return '';
      if (typeof res === 'object') return extractExcelCellValue(res);
      return String(res).trim();
    }
    // Hyperlink: { text: '...', hyperlink: '...' }
    if ('text' in val) {
      return String((val as { text: unknown }).text || '').trim();
    }
    // Shared string
    if ('sharedString' in val) {
      return String((val as { sharedString: unknown }).sharedString || '').trim();
    }
  }

  return String(val).trim();
}

/**
 * Normaliza valores numéricos/decimais (ex: '12,50', '12.50', '12.50 €', 12.5)
 */
export function parseArtigoNumeric(val: unknown, defaultValue = 0): number {
  if (val === undefined || val === null || val === '') return defaultValue;
  if (typeof val === 'number') return isNaN(val) ? defaultValue : val;

  const rawStr = extractExcelCellValue(val);
  const clean = rawStr
    .replace(/\s/g, '')
    .replace(/€/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const num = parseFloat(clean);
  return isNaN(num) ? defaultValue : Math.round(num * 100) / 100;
}

/**
 * Normaliza valores de boolean (0/1, true/false, sim/nao)
 * 0 -> false, 1 -> true
 */
export function parseArtigoBoolean(val: unknown, defaultValue = false): boolean {
  if (val === undefined || val === null || val === '') return defaultValue;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;

  const clean = extractExcelCellValue(val).toLowerCase();
  if (
    clean === '1' ||
    clean === 'true' ||
    clean === 't' ||
    clean === 'sim' ||
    clean === 's' ||
    clean === 'yes' ||
    clean === 'y'
  ) {
    return true;
  }
  if (
    clean === '0' ||
    clean === 'false' ||
    clean === 'f' ||
    clean === 'nao' ||
    clean === 'não' ||
    clean === 'n' ||
    clean === 'no'
  ) {
    return false;
  }
  return defaultValue;
}

/**
 * Normaliza o Tipo de Artigo para valores válidos na base de dados ('MH' | 'MV' | 'DM' | 'DC' | 'SC')
 */
export function normalizeTipoArtigo(val: unknown): TipoArtigo {
  if (!val) return 'MH';
  const clean = extractExcelCellValue(val).toUpperCase();

  if (
    clean === 'MH' ||
    clean.includes('HUMAN') ||
    clean.includes('MEDICAMENTO') ||
    clean === 'MED' ||
    clean === 'M'
  ) {
    return 'MH';
  }
  if (clean === 'MV' || clean.includes('VET')) {
    return 'MV';
  }
  if (clean === 'DM' || clean.includes('DISP') || clean.includes('DISPOSITIVO')) {
    return 'DM';
  }
  if (
    clean === 'DC' ||
    clean.includes('DERMO') ||
    clean.includes('COSM') ||
    clean.includes('HIGIENE') ||
    clean.includes('SUPL') ||
    clean === 'SA'
  ) {
    return 'DC';
  }
  if (
    clean === 'SC' ||
    clean.includes('CONTROL') ||
    clean.includes('ESTUPEFACIENTE') ||
    clean.includes('PSICO')
  ) {
    return 'SC';
  }

  return 'MH';
}

/**
 * Normaliza o Tipo de Armazenamento para valores válidos ('TA' | 'TC' | 'TF')
 */
export function normalizeTipoArmazenamento(val: unknown): TipoArmazenamento {
  if (!val) return 'TA';
  const clean = extractExcelCellValue(val).toUpperCase();

  if (clean === 'TA' || clean.includes('AMB') || clean.includes('NORMAL')) {
    return 'TA';
  }
  if (clean === 'TC' || clean.includes('CONTROL') || clean.includes('15-25')) {
    return 'TC';
  }
  if (
    clean === 'TF' ||
    clean.includes('FRIO') ||
    clean.includes('2-8') ||
    clean.includes('REFRIG') ||
    clean.includes('FRIGOR')
  ) {
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

  const parseCsvLine = (line: string): string[] => {
    const res: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        res.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    res.push(current.trim());
    return res;
  };

  const rawHeaders = parseCsvLine(firstLine).map((h) => h.replace(/^["']|["']$/g, '').trim());
  const headerKeys = rawHeaders.map((h) => normalizeArtigoHeaderKey(h));

  const hasStandardColumns = headerKeys.includes('artigo_id') && headerKeys.includes('descricao');
  const rows: ArtigoImportInput[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;

    const parts = parseCsvLine(rawLine).map((p) => p.replace(/^["']|["']$/g, '').trim());

    if (hasStandardColumns && rawHeaders.length === 6 && parts.length > 6) {
      // Formato clássico com ponto-e-vírgula na descrição
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
      pva: parseArtigoNumeric(rowObj.pva ?? rowObj.pvp, 0),
      ativo: parseArtigoBoolean(rowObj.ativo, true),
    });
  }

  // Deduplicar por artigo_id
  const uniqueMap = new Map<string, ArtigoImportInput>();
  for (const r of rows) {
    if (r.artigo_id) {
      uniqueMap.set(r.artigo_id, r);
    }
  }

  return Array.from(uniqueMap.values());
}

/**
 * Parser para ficheiros Excel (.xlsx/.xls) de catálogo de artigos via ExcelJS.
 * Suporta múltiplas folhas, deteção inteligente da linha de cabeçalho e extração de RichText/números.
 */
export async function parseExcelArtigosFile(arrayBuffer: ArrayBuffer): Promise<ArtigoImportInput[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  // Encontrar a primeira folha que tenha linhas
  const worksheet =
    workbook.worksheets.find((ws) => ws.rowCount > 0) || workbook.worksheets[0];

  if (!worksheet) return [];

  let headerRowIndex = -1;
  let headers: string[] = [];

  // 1. Procurar a linha de cabeçalhos mais provável nas primeiras 15 linhas
  worksheet.eachRow((row, rowNumber) => {
    if (headerRowIndex !== -1 || rowNumber > 15) return;

    const cellCount = Math.max(row.cellCount || 0, 15);
    const rowHeaders: string[] = [];

    for (let c = 1; c <= cellCount; c++) {
      const cellVal = extractExcelCellValue(row.getCell(c).value);
      rowHeaders.push(cellVal);
    }

    const mappedKeys = rowHeaders.map((h) => normalizeArtigoHeaderKey(h));
    const hasArtigo = mappedKeys.includes('artigo_id');
    const hasDesc = mappedKeys.includes('descricao');

    // Se a linha tiver pelo menos 'artigo_id' e 'descricao', é a linha de cabeçalhos
    if (hasArtigo && hasDesc) {
      headerRowIndex = rowNumber;
      headers = mappedKeys;
    }
  });

  // Se não encontrou linha com 'artigo_id' e 'descricao', tentar a linha 1 como fallback
  if (headerRowIndex === -1) {
    const firstRow = worksheet.getRow(1);
    const cellCount = Math.max(firstRow.cellCount || 0, 10);
    const rowHeaders: string[] = [];

    for (let c = 1; c <= cellCount; c++) {
      rowHeaders.push(extractExcelCellValue(firstRow.getCell(c).value));
    }

    headers = rowHeaders.map((h) => normalizeArtigoHeaderKey(h));
    headerRowIndex = 1;

    // Se nem assim tiver artigo_id e descricao, assume mapeamento padrão por posição (Col 1: Artigo, Col 2: Descrição)
    if (!headers.includes('artigo_id')) headers[0] = 'artigo_id';
    if (!headers.includes('descricao')) headers[1] = 'descricao';
  }

  const rows: ArtigoImportInput[] = [];

  // 2. Extrair os dados a partir da linha seguinte aos cabeçalhos
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return;

    const rowObj: Record<string, string> = {};

    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (key) {
        const cellVal = extractExcelCellValue(row.getCell(c + 1).value);
        rowObj[key] = cellVal;
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
      pva: parseArtigoNumeric(rowObj.pva ?? rowObj.pvp, 0),
      ativo: parseArtigoBoolean(rowObj.ativo, true),
    });
  });

  // 3. Deduplicar por artigo_id (mantém a última ocorrência)
  const uniqueMap = new Map<string, ArtigoImportInput>();
  for (const r of rows) {
    if (r.artigo_id) {
      uniqueMap.set(r.artigo_id, r);
    }
  }

  return Array.from(uniqueMap.values());
}

/**
 * Gera um ficheiro CSV de exemplo/modelo para catálogo de artigos.
 */
export function generateArtigosSampleCSV(): string {
  const headers = [
    'artigo_id',
    'Descricao',
    'tratamento_serie',
    'tratamento_lote',
    'tipo_artigo',
    'tipo_armazenamento',
    'pva',
    'ativo',
  ];

  const sampleRows = [
    ['024273070', 'LUVION 200MG + 6F 2ML', '0', '1', 'MH', 'TA', '12.50', '1'],
    ['00 1275627', 'SELOKEN 1MG/ML SOL INJ', '0', '1', 'MH', 'TC', '8.90', '1'],
    ['023616055', 'VACINA VETERINÁRIA 2-8 ºC', '1', '1', 'MV', 'TF', '34.20', '1'],
    ['000155152', 'MULTICATH 16 CM (DISPOSITIVO)', '0', '1', 'DM', 'TA', '4.50', '1'],
  ];

  const lines = [
    headers.join(';'),
    ...sampleRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')),
  ];

  return lines.join('\n');
}

/**
 * Gera um ficheiro Excel (.xlsx) de exemplo/modelo para catálogo de artigos.
 */
export async function generateArtigosSampleExcel(): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Catálogo de Artigos');

  worksheet.columns = [
    { header: 'Código do Artigo', key: 'artigo_id', width: 18 },
    { header: 'Descrição Comercial', key: 'descricao', width: 35 },
    { header: 'Tratamento Lote', key: 'tratamento_lote', width: 16 },
    { header: 'Tratamento Série', key: 'tratamento_serie', width: 16 },
    { header: 'Tipo Artigo', key: 'tipo_artigo', width: 22 },
    { header: 'Condição Conservação', key: 'tipo_armazenamento', width: 22 },
    { header: 'PVA (€)', key: 'pva', width: 14 },
    { header: 'Ativo', key: 'ativo', width: 10 },
  ];

  // Estilo de cabeçalho
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' }, // Teal PlatFarma
  };

  worksheet.addRow({
    artigo_id: '024273070',
    descricao: 'LUVION 200MG + 6F 2ML',
    tratamento_lote: 'Sim',
    tratamento_serie: 'Não',
    tipo_artigo: 'Medicamento Uso Humano (MH)',
    tipo_armazenamento: 'Temperatura Ambiente (TA)',
    pva: 12.50,
    ativo: 'Sim',
  });

  worksheet.addRow({
    artigo_id: '00 1275627',
    descricao: 'SELOKEN 1MG/ML SOL INJ 5ML',
    tratamento_lote: 'Sim',
    tratamento_serie: 'Não',
    tipo_artigo: 'Medicamento Uso Humano (MH)',
    tipo_armazenamento: 'Temperatura Controlada (TC 15-25ºC)',
    pva: 8.90,
    ativo: 'Sim',
  });

  worksheet.addRow({
    artigo_id: '023616055',
    descricao: 'VACINA VETERINÁRIA FRASCO 10ML',
    tratamento_lote: 'Sim',
    tratamento_serie: 'Sim',
    tipo_artigo: 'Medicamento Veterinário (MV)',
    tipo_armazenamento: 'Frio (TF 2-8ºC)',
    pva: 34.20,
    ativo: 'Sim',
  });

  worksheet.addRow({
    artigo_id: '000155152',
    descricao: 'MULTICATH 16 CM CATETER',
    tratamento_lote: 'Sim',
    tratamento_serie: 'Não',
    tipo_artigo: 'Dispositivo Médico (DM)',
    tipo_armazenamento: 'Temperatura Ambiente (TA)',
    pva: 4.50,
    ativo: 'Sim',
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
