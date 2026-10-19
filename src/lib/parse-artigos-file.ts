import ExcelJS from 'exceljs';
import type { TipoArtigo, TipoArmazenamento } from './supabase/types';

export interface ArtigoImportInput {
  artigo_id: string;
  artigo_cli?: string;
  descricao: string;
  familia?: string;
  sub_familia?: string;
  subfamilia?: string;
  cli_primavera?: string;
  tratamento_serie?: boolean;
  tratamento_lote?: boolean;
  id_tipo_artigo?: string;
  tipo_armazenamento?: TipoArmazenamento;
  pva?: number;
  pvp?: number;
  ativo?: boolean;
}

/**
 * Normaliza os nomes de cabeçalhos de ficheiros TXT/CSV/Excel para os campos de Artigo.
 * Ordem estrita: descrições, códigos específicos e famílias são avaliados ANTES de 'artigo'
 * para não haver colisões de prefixo/sufixo.
 */
export function normalizeArtigoHeaderKey(key: string): string {
  if (!key) return '';

  const clean = key
    .replace(/^\uFEFF/, '') // Remover UTF-8 BOM
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  // 1. Cliente Primavera / Cli Primavera
  if (
    clean === 'cliprimavera' ||
    clean === 'clienteprimavera' ||
    clean === 'codcliprimavera' ||
    clean === 'codprimavera' ||
    clean === 'primavera' ||
    clean === 'codcliente' ||
    clean === 'idcliente' ||
    clean === 'cliente'
  ) {
    return 'cli_primavera';
  }

  // 2. Artigo Cliente / Artigo CLI (AVALIAR ANTES de 'artigo' para não colidir com includes('artigo'))
  if (
    clean === 'artigocli' ||
    clean === 'artcli' ||
    clean === 'artigocliente' ||
    clean === 'codartcli' ||
    clean === 'codigoartigocli' ||
    clean === 'artclient' ||
    clean.includes('artigocli') ||
    clean.includes('artigocliente')
  ) {
    return 'artigo_cli';
  }

  // 3. SubFamília (AVALIAR ANTES de 'familia')
  if (
    clean === 'subfamilia' ||
    clean === 'subfam' ||
    clean === 'subfamily' ||
    clean.includes('subfamilia') ||
    clean.includes('subfam')
  ) {
    return 'sub_familia';
  }

  // 4. Família
  if (
    clean === 'familia' ||
    clean === 'fam' ||
    clean === 'family' ||
    clean.includes('familia')
  ) {
    return 'familia';
  }

  // 5. Descrição / Designação / Nome do Artigo (AVALIAR ANTES de 'artigo')
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

  // 6. Tratamento Série
  if (
    clean.includes('tratamentoserie') ||
    clean.includes('tratseries') ||
    clean.includes('controloserie') ||
    clean.includes('controleserie') ||
    clean.includes('series') ||
    clean.includes('serie') ||
    clean === 'serial' ||
    clean === 'nrserie' ||
    clean === 'numserie' ||
    clean === 'sn'
  ) {
    return 'tratamento_serie';
  }

  // 7. Tratamento Lote
  if (
    clean.includes('tratamentolote') ||
    clean.includes('tratlotes') ||
    clean.includes('tratlote') ||
    clean.includes('contrololote') ||
    clean.includes('controlelote') ||
    clean.includes('lotes') ||
    clean.includes('lote') ||
    clean === 'batch'
  ) {
    return 'tratamento_lote';
  }

  // 8. Tipo de Artigo / Classificação Regulamentar (80 a 85 / MH, MV, DM, DC, SA, SC)
  if (
    clean.includes('tipoartigo') ||
    clean.includes('tipodeartigo') ||
    clean.includes('idtipoartigo') ||
    clean === 'tipoart' ||
    clean === 'tipo' ||
    clean === 'classificacao' ||
    clean === 'categoria'
  ) {
    return 'id_tipo_artigo';
  }

  // 9. Tipo de Armazenamento / Condição de Conservação Térmica
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

  // 10. PVA / PVP / Preço de Venda
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

  // 11. Ativo / Estado
  if (
    clean === 'ativo' ||
    clean === 'active' ||
    clean === 'estado' ||
    clean === 'status' ||
    clean === 'habilitado'
  ) {
    return 'ativo';
  }

  // 12. Artigo ID / Código Único do Produto (avaliado por último)
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
 * Normaliza valores booleanos (0/1, true/false, verdadeiro/falso, sim/nao)
 */
export function parseArtigoBoolean(val: unknown, defaultValue = false): boolean {
  if (val === undefined || val === null || val === '') return defaultValue;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;

  const clean = extractExcelCellValue(val).toLowerCase().trim();
  if (
    clean === '1' ||
    clean === 'true' ||
    clean === 'verdadeiro' ||
    clean === 't' ||
    clean === 'v' ||
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
    clean === 'falso' ||
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
 * Normaliza o Tipo de Artigo para IDs válidos na tabela tipos_artigo ('80' a '85')
 * 80: MH (Medicamento de uso humano)
 * 81: MV (Medicamento de uso veterinário)
 * 82: DM (Dispositivo médico)
 * 83: DC (Dermo-Cosmético)
 * 84: SA (Suplemento alimentar)
 * 85: SC (Substância controlada)
 */
export function normalizeTipoArtigo(val: unknown): string {
  if (!val) return '80'; // MH
  const clean = extractExcelCellValue(val).toUpperCase().trim();

  if (
    clean === '80' ||
    clean === 'MH' ||
    clean.includes('HUMAN') ||
    clean.includes('MEDICAMENTO')
  ) {
    return '80';
  }
  if (clean === '81' || clean === 'MV' || clean.includes('VET')) {
    return '81';
  }
  if (clean === '82' || clean === 'DM' || clean.includes('DISP') || clean.includes('DISPOSITIVO')) {
    return '82';
  }
  if (
    clean === '83' ||
    clean === 'DC' ||
    clean.includes('DERMO') ||
    clean.includes('COSM') ||
    clean.includes('HIGIENE')
  ) {
    return '83';
  }
  if (
    clean === '84' ||
    clean === 'SA' ||
    clean.includes('SUPL') ||
    clean.includes('ALIMENTAR')
  ) {
    return '84';
  }
  if (
    clean === '85' ||
    clean === 'SC' ||
    clean.includes('CONTROL') ||
    clean.includes('ESTUPEFACIENTE') ||
    clean.includes('PSICO')
  ) {
    return '85';
  }

  return '80';
}

/**
 * Normaliza o Tipo de Armazenamento para valores válidos ('TA' | 'TC' | 'TF')
 */
export function normalizeTipoArmazenamento(val: unknown): TipoArmazenamento {
  if (!val) return 'TA';
  const clean = extractExcelCellValue(val).toUpperCase().trim();

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
 * Parser para ficheiros TXT/CSV de catálogo de artigos.
 * Suporta delimitadores ; , ou tabulação e extrai automaticamente colunas padrão ou estendidas.
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

    // Se o ficheiro tiver exatamente 6 colunas padrão clássicas e parts exceder 6 colunas por ponto-e-vírgula na descrição
    if (hasStandardColumns && rawHeaders.length === 6 && parts.length > 6) {
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
          id_tipo_artigo: normalizeTipoArtigo(tipo_artigo),
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

    const cli_primavera = (rowObj.cli_primavera || '').trim() || undefined;
    let artigo_cli = (rowObj.artigo_cli || '').trim() || undefined;
    if (!artigo_cli && cli_primavera) {
      artigo_cli = `${cli_primavera}-${artigo_id}`;
    }

    rows.push({
      artigo_id,
      artigo_cli,
      descricao: descricao || artigo_id,
      familia: rowObj.familia?.trim() || undefined,
      sub_familia: (rowObj.sub_familia || rowObj.subfamilia)?.trim() || undefined,
      cli_primavera,
      tratamento_serie: parseArtigoBoolean(rowObj.tratamento_serie, false),
      tratamento_lote: parseArtigoBoolean(rowObj.tratamento_lote, true),
      id_tipo_artigo: normalizeTipoArtigo(rowObj.id_tipo_artigo),
      tipo_armazenamento: normalizeTipoArmazenamento(rowObj.tipo_armazenamento),
      pva: parseArtigoNumeric(rowObj.pva ?? rowObj.pvp, 0),
      ativo: parseArtigoBoolean(rowObj.ativo, true),
    });
  }

  // Deduplicar preferencialmente por artigo_cli ou artigo_id
  const uniqueMap = new Map<string, ArtigoImportInput>();
  for (const r of rows) {
    const key = r.artigo_cli || r.artigo_id;
    if (key) {
      uniqueMap.set(key, r);
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
    const hasArtigo = mappedKeys.includes('artigo_id') || mappedKeys.includes('artigo_cli');
    const hasDesc = mappedKeys.includes('descricao');

    // Se a linha tiver pelo menos identificador de artigo e descrição, é a linha de cabeçalhos
    if (hasArtigo && hasDesc) {
      headerRowIndex = rowNumber;
      headers = mappedKeys;
    }
  });

  // Se não encontrou linha com artigo_id/artigo_cli e descricao, tentar a linha 1 como fallback
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
    if (!headers.includes('artigo_id') && !headers.includes('artigo_cli')) headers[0] = 'artigo_id';
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

    const cli_primavera = String(rowObj.cli_primavera || '').trim() || undefined;
    let artigo_cli = String(rowObj.artigo_cli || '').trim() || undefined;
    if (!artigo_cli && cli_primavera) {
      artigo_cli = `${cli_primavera}-${artigo_id}`;
    }

    rows.push({
      artigo_id,
      artigo_cli,
      descricao: descricao || artigo_id,
      familia: rowObj.familia ? String(rowObj.familia).trim() : undefined,
      sub_familia: (rowObj.sub_familia || rowObj.subfamilia) ? String(rowObj.sub_familia || rowObj.subfamilia).trim() : undefined,
      cli_primavera,
      tratamento_serie: parseArtigoBoolean(rowObj.tratamento_serie, false),
      tratamento_lote: parseArtigoBoolean(rowObj.tratamento_lote, true),
      id_tipo_artigo: normalizeTipoArtigo(rowObj.id_tipo_artigo),
      tipo_armazenamento: normalizeTipoArmazenamento(rowObj.tipo_armazenamento),
      pva: parseArtigoNumeric(rowObj.pva ?? rowObj.pvp, 0),
      ativo: parseArtigoBoolean(rowObj.ativo, true),
    });
  });

  // 3. Deduplicar preferencialmente por artigo_cli ou artigo_id
  const uniqueMap = new Map<string, ArtigoImportInput>();
  for (const r of rows) {
    const key = r.artigo_cli || r.artigo_id;
    if (key) {
      uniqueMap.set(key, r);
    }
  }

  return Array.from(uniqueMap.values());
}

/**
 * Gera um ficheiro CSV de exemplo/modelo para catálogo de artigos correspondente à máscara solicitada.
 */
export function generateArtigosSampleCSV(): string {
  const headers = [
    'artigo_cli',
    'artigo_id',
    'descricao',
    'familia',
    'id_tipo_artigo',
    'subfamilia',
    'tratamento_serie',
    'tratamento_lote',
    'cli_primavera',
    'tipo_armazenamento',
  ];

  const sampleRows = [
    [
      '6373-202604AV5008',
      '202604AV5008',
      'FRESENIUS AV SET 5008 CORDIAX POST-R',
      'MED',
      '80',
      'VAR',
      'FALSO',
      'VERDADEIRO',
      '6373',
      'TA',
    ],
    [
      '6509-10495L',
      '10495L',
      'BATA DE PROTEÇÃO REUTILIZÁVEL CAT III',
      'MED',
      '82',
      'PHM',
      'FALSO',
      'VERDADEIRO',
      '6509',
      'TC',
    ],
    [
      '482-7774273',
      '7774273',
      'AUDIOVIT PLUS 60 CAPS.',
      'MED',
      '84',
      'SER',
      'FALSO',
      'VERDADEIRO',
      '482',
      'TF',
    ],
  ];

  const lines = [
    headers.join(';'),
    ...sampleRows.map((r) => r.join(';')),
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
    { header: 'artigo_cli', key: 'artigo_cli', width: 22 },
    { header: 'artigo_id', key: 'artigo_id', width: 18 },
    { header: 'descricao', key: 'descricao', width: 40 },
    { header: 'familia', key: 'familia', width: 14 },
    { header: 'id_tipo_artigo', key: 'id_tipo_artigo', width: 16 },
    { header: 'subfamilia', key: 'subfamilia', width: 14 },
    { header: 'tratamento_serie', key: 'tratamento_serie', width: 18 },
    { header: 'tratamento_lote', key: 'tratamento_lote', width: 18 },
    { header: 'cli_primavera', key: 'cli_primavera', width: 16 },
    { header: 'tipo_armazenamento', key: 'tipo_armazenamento', width: 20 },
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
    artigo_cli: '6373-202604AV5008',
    artigo_id: '202604AV5008',
    descricao: 'FRESENIUS AV SET 5008 CORDIAX POST-R',
    familia: 'MED',
    id_tipo_artigo: '80',
    subfamilia: 'VAR',
    tratamento_serie: 'FALSO',
    tratamento_lote: 'VERDADEIRO',
    cli_primavera: '6373',
    tipo_armazenamento: 'TA',
  });

  worksheet.addRow({
    artigo_cli: '6509-10495L',
    artigo_id: '10495L',
    descricao: 'BATA DE PROTEÇÃO REUTILIZÁVEL CAT III',
    familia: 'MED',
    id_tipo_artigo: '82',
    subfamilia: 'PHM',
    tratamento_serie: 'FALSO',
    tratamento_lote: 'VERDADEIRO',
    cli_primavera: '6509',
    tipo_armazenamento: 'TC',
  });

  worksheet.addRow({
    artigo_cli: '482-7774273',
    artigo_id: '7774273',
    descricao: 'AUDIOVIT PLUS 60 CAPS.',
    familia: 'MED',
    id_tipo_artigo: '84',
    subfamilia: 'SER',
    tratamento_serie: 'FALSO',
    tratamento_lote: 'VERDADEIRO',
    cli_primavera: '482',
    tipo_armazenamento: 'TF',
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
