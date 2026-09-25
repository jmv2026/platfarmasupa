import ExcelJS from 'exceljs';

export interface MovimentoImportInput {
  artigo_id: string;
  client_id?: string;
  sigla?: string;
  tipo_movimento: 'es' | 'ss' | 'et' | 'st';
  quantidade: number;
  tipo_armazem?: string;
  armazem_loc?: string;
  posicao?: string | null;
  lote?: string | null;
  nr_serie?: string | null;
  validade?: string | null;
  data_fabrico?: string | null;
  data_movimento?: string | null;
  documento_ref?: string | null;
  observacoes?: string | null;
}

/**
 * Normaliza os nomes de cabeçalhos de ficheiros TXT/CSV/Excel para os campos de Movimentos.
 */
export function normalizeMovimentoHeaderKey(key: string): string {
  if (!key) return '';

  const clean = key
    .replace(/^\uFEFF/, '') // Remover UTF-8 BOM
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  // 1. Tipo de Movimento (verificar antes de tipo_armazem)
  if (
    clean.includes('tipomov') ||
    clean.includes('tipodemov') ||
    clean.includes('tipomovimento') ||
    clean === 'movimento' ||
    clean === 'mov' ||
    clean === 'operacao' ||
    clean === 'sentido' ||
    clean === 'tipomov'
  ) {
    return 'tipo_movimento';
  }

  // 2. Tipo de Armazém / Armazém Tipo
  if (
    clean.includes('tipoarmazem') ||
    clean.includes('tipodearmazem') ||
    clean.includes('codarmazem') ||
    clean.includes('tipoarm')
  ) {
    return 'tipo_armazem';
  }

  // 3. Localização do Armazém (armazem_loc)
  if (
    clean.includes('armazemloc') ||
    clean.includes('armloc') ||
    clean.includes('localizacao') ||
    clean.includes('armazemlocal') ||
    clean === 'loc'
  ) {
    return 'armazem_loc';
  }

  // 4. Armazém (pode ser tipo ou armazem_loc)
  if (clean === 'armazem' || clean === 'arm' || clean === 'warehouse') {
    return 'tipo_armazem';
  }

  // 5. Quantidade / Volume
  if (
    clean === 'quantidade' ||
    clean === 'qtd' ||
    clean === 'quant' ||
    clean === 'qty' ||
    clean === 'qtde' ||
    clean === 'volume' ||
    clean === 'unidades' ||
    clean === 'stk' ||
    clean === 'stock'
  ) {
    return 'quantidade';
  }

  // 6. Data de Fabrico (antes de data / validade)
  if (
    clean.includes('datafabrico') ||
    clean.includes('dtfabrico') ||
    clean.includes('fabrico') ||
    clean.includes('mfgdate') ||
    clean.includes('manufacture')
  ) {
    return 'data_fabrico';
  }

  // 7. Data de Validade / Expiração (antes de data_movimento)
  if (
    clean.includes('validade') ||
    clean.includes('dtvalidade') ||
    clean.includes('expiracao') ||
    clean.includes('expdate') ||
    clean.includes('datavalidade')
  ) {
    return 'validade';
  }

  // 8. Data do Movimento
  if (
    clean.includes('datamov') ||
    clean.includes('dtmov') ||
    clean.includes('datamovimento') ||
    clean.includes('dataregisto') ||
    clean === 'data' ||
    clean === 'date' ||
    clean === 'datetime' ||
    clean === 'timestamp'
  ) {
    return 'data_movimento';
  }

  // 9. Documento de Referência
  if (
    clean.includes('documento') ||
    clean.includes('docref') ||
    clean.includes('documentoref') ||
    clean.includes('refdocumento') ||
    clean.includes('guia') ||
    clean.includes('fatura') ||
    clean.includes('nrdoc') ||
    clean.includes('numdoc') ||
    clean === 'doc' ||
    clean === 'guiaremessa'
  ) {
    return 'documento_ref';
  }

  // 10. Posição / Rack / Prateleira
  if (
    clean.includes('posicao') ||
    clean.includes('posic') ||
    clean.includes('prateleira') ||
    clean.includes('rack') ||
    clean === 'pos'
  ) {
    return 'posicao';
  }

  // 11. Número de Série (antes de lote)
  if (
    clean.includes('serie') ||
    clean.includes('serial') ||
    clean.includes('nrserie') ||
    clean.includes('numserie') ||
    clean === 'sn'
  ) {
    return 'nr_serie';
  }

  // 12. Lote / Batch
  if (
    clean.includes('lote') ||
    clean.includes('nrlote') ||
    clean.includes('numlote') ||
    clean.includes('batch') ||
    clean === 'lot'
  ) {
    return 'lote';
  }

  // 13. Sigla do Cliente / Cliente
  if (
    clean.includes('sigla') ||
    clean.includes('client_sigla') ||
    clean.includes('siglacliente') ||
    clean === 'cliente' ||
    clean === 'client' ||
    clean === 'clientid' ||
    clean === 'empresa'
  ) {
    return 'sigla';
  }

  // 14. Artigo ID / Código do Artigo
  if (
    clean === 'artigo' ||
    clean === 'art' ||
    clean === 'artigo_id' ||
    clean === 'artigoid' ||
    clean === 'codigo' ||
    clean === 'cod' ||
    clean === 'sku' ||
    clean === 'codartigo' ||
    clean.includes('artigo')
  ) {
    return 'artigo_id';
  }

  // 15. Observações / Notas
  if (
    clean.includes('obs') ||
    clean.includes('observacao') ||
    clean.includes('observacoes') ||
    clean.includes('nota') ||
    clean.includes('notas') ||
    clean.includes('comentario') ||
    clean.includes('descricao')
  ) {
    return 'observacoes';
  }

  return clean;
}

/**
 * Normaliza o tipo de movimento para 'es' | 'ss' | 'et' | 'st'.
 */
export function normalizeTipoMovimento(val: unknown): 'es' | 'ss' | 'et' | 'st' {
  if (!val) return 'es';
  const s = String(val).trim().toLowerCase();

  if (s === 'es' || s.startsWith('entrada de stock') || s.startsWith('entrada stock') || s === 'e' || s === 'entrada') {
    return 'es';
  }
  if (s === 'ss' || s.startsWith('saida de stock') || s.startsWith('saída de stock') || s === 'saida' || s === 'saída' || s === 's') {
    return 'ss';
  }
  if (s === 'et' || s.includes('entrada transf') || s.includes('transf entrada') || s.includes('entrada por transf')) {
    return 'et';
  }
  if (s === 'st' || s.includes('saida transf') || s.includes('saída transf') || s.includes('transf saida') || s.includes('saída por transf')) {
    return 'st';
  }

  return 'es';
}

/**
 * Normaliza o código de tipo de armazém ('01' a '07', '10').
 */
export function normalizeTipoArmazem(val: unknown): string {
  if (!val) return '01';
  const s = String(val).trim().toLowerCase();

  if (s === '01' || s === '1' || s.includes('venda')) return '01';
  if (s === '02' || s === '2' || s.includes('expirad')) return '02';
  if (s === '03' || s === '3' || s.includes('danific')) return '03';
  if (s === '04' || s === '4' || s.includes('devoluc') || s.includes('devoluç')) return '04';
  if (s === '05' || s === '5' || s.includes('quarent')) return '05';
  if (s === '06' || s === '6' || s.includes('destrui') || s.includes('destruição')) return '06';
  if (s === '07' || s === '7' || s.includes('farmaco') || s.includes('farmacoteca')) return '07';
  if (s === '10' || s.includes('mia')) return '10';

  // Se for algo como 'MDZ01' ou 'PFIZ-10', extrai os dígitos finais
  const match = s.match(/(0[1-7]|10)$/);
  if (match) return match[0];

  return '01';
}

/**
 * Converte valor numérico com suporte a vírgula/ponto decimal.
 */
export function parseMovimentoQuantidade(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Math.abs(val);

  const clean = String(val)
    .trim()
    .replace(/\s+/g, '')
    .replace(/€/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : Math.abs(parsed);
}

/**
 * Normaliza datas provenientes de ficheiros (dia-mês-ano: DD-MM-YYYY, DD/MM/YYYY, Excel serial, ISO, etc.).
 * Retorna no formato ISO 'YYYY-MM-DD' para gravação correta no Postgres.
 */
export function parseMovimentoDate(val: unknown): string | null {
  if (val === null || val === undefined) return null;

  // 1. Se for uma instância Date (ex: ExcelJS)
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const year = val.getFullYear();
      const month = String(val.getMonth() + 1).padStart(2, '0');
      const day = String(val.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return null;
  }

  // 2. Se for número serial do Excel (dias desde 1899-12-30)
  if (typeof val === 'number') {
    try {
      const utcDays = Math.floor(val - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      if (!isNaN(dateInfo.getTime())) {
        const year = dateInfo.getUTCFullYear();
        const month = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateInfo.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch {
      // fallback
    }
  }

  const str = String(val).trim();
  if (!str || str === 'NULL' || str === 'N/A' || str === '-') return null;

  // 3. Formato Prioritário Português/Europeu: DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY (com ou sem hora)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[\sT].*)?$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) {
      year = parseInt(year, 10) > 50 ? `19${year}` : `20${year}`;
    }
    const numDay = parseInt(day, 10);
    const numMonth = parseInt(month, 10);
    if (numDay >= 1 && numDay <= 31 && numMonth >= 1 && numMonth <= 12) {
      return `${year}-${month}-${day}`;
    }
  }

  // 4. Formato ISO: YYYY-MM-DD ou YYYY/MM/DD (com ou sem hora)
  const isoMatch = str.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[\sT].*)?$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    const numDay = parseInt(day, 10);
    const numMonth = parseInt(month, 10);
    if (numDay >= 1 && numDay <= 31 && numMonth >= 1 && numMonth <= 12) {
      return `${year}-${month}-${day}`;
    }
  }

  // 5. Tentativa com Date.parse
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Normaliza a posição de armazém para o formato estrito de dois dígitos, uma letra e dois dígitos (ex: '01A01').
 * Não existem espaços ou caracteres especiais entre eles.
 */
export function normalizeMovimentoPosicao(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim().toUpperCase();
  if (!str || str === 'NULL' || str === 'N/A' || str === '-') return null;

  // 1. Já no formato correto de 2 dígitos + 1 letra + 2 dígitos (ex: 01A01, 02B03)
  if (/^\d{2}[A-Z]\d{2}$/.test(str)) {
    return str;
  }

  // 2. Formato Dígitos - Letra - Dígitos (ex: 01-A-01, 01 A 01, 1-A-1)
  const matchDLD = str.match(/^(\d{1,2})[-_.\s]*([A-Z])[-_.\s]*(\d{1,2})$/);
  if (matchDLD) {
    const d1 = matchDLD[1].padStart(2, '0');
    const letra = matchDLD[2];
    const d2 = matchDLD[3].padStart(2, '0');
    return `${d1}${letra}${d2}`;
  }

  // 3. Formato Letra - Dígitos - Dígitos (ex: A-01-01, A 01 01, A0101)
  const matchLDD = str.match(/^([A-Z])[-_.\s]*(\d{1,2})[-_.\s]*(\d{1,2})$/);
  if (matchLDD) {
    const letra = matchLDD[1];
    const d1 = matchLDD[2].padStart(2, '0');
    const d2 = matchLDD[3].padStart(2, '0');
    return `${d1}${letra}${d2}`;
  }

  // 4. Limpeza de caracteres não alfanuméricos
  const clean = str.replace(/[^A-Z0-9]/g, '');
  if (/^\d{2}[A-Z]\d{2}$/.test(clean)) {
    return clean;
  }

  return clean || null;
}

/**
 * Analisa um ficheiro Excel (.xlsx / .xls) e extrai movimentos.
 */
export async function parseExcelMovimentosFile(
  arrayBuffer: ArrayBuffer,
  fileName: string = 'movimentos.xlsx'
): Promise<MovimentoImportInput[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error(`O ficheiro Excel "${fileName}" não contém folhas de cálculo.`);
  }

  const headers: string[] = [];
  const rows: MovimentoImportInput[] = [];

  worksheet.eachRow((row, rowNumber) => {
    const values = row.values as unknown[];

    if (rowNumber === 1) {
      // Linha de cabeçalho
      for (let i = 1; i < values.length; i++) {
        const val = values[i];
        const strVal = val !== null && val !== undefined ? String(val).trim() : '';
        headers.push(normalizeMovimentoHeaderKey(strVal));
      }
      return;
    }

    // Linha de dados
    const rowObj: Record<string, unknown> = {};
    for (let i = 1; i < values.length; i++) {
      const headerKey = headers[i - 1];
      if (headerKey) {
        let cellVal = values[i];
        if (cellVal && typeof cellVal === 'object' && 'text' in cellVal) {
          cellVal = (cellVal as { text: string }).text;
        } else if (cellVal && typeof cellVal === 'object' && 'result' in cellVal) {
          cellVal = (cellVal as { result: unknown }).result;
        }
        rowObj[headerKey] = cellVal;
      }
    }

    const rawArtigo = rowObj['artigo_id'] || rowObj['artigo'];
    const artigoId = rawArtigo ? String(rawArtigo).trim() : '';

    const quantidade = parseMovimentoQuantidade(rowObj['quantidade']);

    if (artigoId && quantidade > 0) {
      const tipoMovimento = normalizeTipoMovimento(rowObj['tipo_movimento']);
      const tipoArmazem = normalizeTipoArmazem(rowObj['tipo_armazem']);
      const sigla = rowObj['sigla'] ? String(rowObj['sigla']).trim().toUpperCase() : undefined;
      const armazemLoc = rowObj['armazem_loc']
        ? String(rowObj['armazem_loc']).trim().replace(/[-_ ]/g, '')
        : sigla
        ? `${sigla}${tipoArmazem}`
        : `ARM${tipoArmazem}`;

      rows.push({
        artigo_id: artigoId,
        sigla: sigla,
        tipo_movimento: tipoMovimento,
        quantidade: quantidade,
        tipo_armazem: tipoArmazem,
        armazem_loc: armazemLoc,
        posicao: normalizeMovimentoPosicao(rowObj['posicao']),
        lote: rowObj['lote'] ? String(rowObj['lote']).trim() : null,
        nr_serie: rowObj['nr_serie'] ? String(rowObj['nr_serie']).trim() : null,
        validade: parseMovimentoDate(rowObj['validade']),
        data_fabrico: parseMovimentoDate(rowObj['data_fabrico']),
        data_movimento: parseMovimentoDate(rowObj['data_movimento']) || new Date().toISOString(),
        documento_ref: rowObj['documento_ref'] ? String(rowObj['documento_ref']).trim() : null,
        observacoes: rowObj['observacoes'] ? String(rowObj['observacoes']).trim() : null,
      });
    }
  });

  return rows;
}

/**
 * Analisa um ficheiro de texto ou CSV (.csv / .txt) e extrai movimentos.
 */
export function parseTextMovimentosFile(
  textContent: string,
  fileName: string = 'movimentos.csv'
): MovimentoImportInput[] {
  const lines = textContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return [];
  }

  // Detetar delimitador (, ; \t |)
  const headerLine = lines[0];
  let delimiter = ';';
  const counts = {
    ';': (headerLine.match(/;/g) || []).length,
    ',': (headerLine.match(/,/g) || []).length,
    '\t': (headerLine.match(/\t/g) || []).length,
    '|': (headerLine.match(/\|/g) || []).length,
  };

  if (counts[','] > counts[';'] && counts[','] > counts['\t'] && counts[','] > counts['|']) {
    delimiter = ',';
  } else if (counts['\t'] > counts[';']) {
    delimiter = '\t';
  } else if (counts['|'] > counts[';']) {
    delimiter = '|';
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

  const headers = parseCsvLine(headerLine).map(normalizeMovimentoHeaderKey);
  const rows: MovimentoImportInput[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawTokens = parseCsvLine(lines[i]);
    const rowObj: Record<string, string> = {};

    headers.forEach((h, idx) => {
      if (h && rawTokens[idx] !== undefined) {
        rowObj[h] = rawTokens[idx];
      }
    });

    const rawArtigo = rowObj['artigo_id'] || rowObj['artigo'];
    const artigoId = rawArtigo ? rawArtigo.trim() : '';
    const quantidade = parseMovimentoQuantidade(rowObj['quantidade']);

    if (artigoId && quantidade > 0) {
      const tipoMovimento = normalizeTipoMovimento(rowObj['tipo_movimento']);
      const tipoArmazem = normalizeTipoArmazem(rowObj['tipo_armazem']);
      const sigla = rowObj['sigla'] ? rowObj['sigla'].trim().toUpperCase() : undefined;
      const armazemLoc = rowObj['armazem_loc']
        ? rowObj['armazem_loc'].trim().replace(/[-_ ]/g, '')
        : sigla
        ? `${sigla}${tipoArmazem}`
        : `ARM${tipoArmazem}`;

      rows.push({
        artigo_id: artigoId,
        sigla: sigla,
        tipo_movimento: tipoMovimento,
        quantidade: quantidade,
        tipo_armazem: tipoArmazem,
        armazem_loc: armazemLoc,
        posicao: normalizeMovimentoPosicao(rowObj['posicao']),
        lote: rowObj['lote'] ? rowObj['lote'].trim() : null,
        nr_serie: rowObj['nr_serie'] ? rowObj['nr_serie'].trim() : null,
        validade: parseMovimentoDate(rowObj['validade']),
        data_fabrico: parseMovimentoDate(rowObj['data_fabrico']),
        data_movimento: parseMovimentoDate(rowObj['data_movimento']) || new Date().toISOString(),
        documento_ref: rowObj['documento_ref'] ? rowObj['documento_ref'].trim() : null,
        observacoes: rowObj['observacoes'] ? rowObj['observacoes'].trim() : null,
      });
    }
  }

  return rows;
}

/**
 * Gera um ficheiro CSV de exemplo/modelo para descarregar.
 */
export function generateMovimentosSampleCSV(): string {
  const headers = [
    'Artigo',
    'Sigla',
    'TipoMovimento',
    'Quantidade',
    'TipoArmazem',
    'ArmazemLoc',
    'Posicao',
    'Lote',
    'NrSerie',
    'Validade',
    'DataFabrico',
    'DataMovimento',
    'DocumentoRef',
    'Observacoes',
  ];

  const sampleRows = [
    [
      '024273070',
      'PFIZ',
      'ES',
      '100',
      '01',
      'PFIZ01',
      '01A01',
      'LOT-2026-01',
      '',
      '31-12-2028',
      '15-01-2026',
      '20-09-2026',
      'REC-2026-001',
      'Entrada inicial por rececao de fabrica',
    ],
    [
      '024273070',
      'PFIZ',
      'SS',
      '15',
      '01',
      'PFIZ01',
      '01A01',
      'LOT-2026-01',
      '',
      '31-12-2028',
      '15-01-2026',
      '21-09-2026',
      'EXP-2026-001',
      'Saida para expedicao de encomenda',
    ],
    [
      '024273070',
      'PFIZ',
      'ST',
      '10',
      '01',
      'PFIZ01',
      '01A01',
      'LOT-2026-01',
      '',
      '31-12-2028',
      '15-01-2026',
      '22-09-2026',
      'TRF-2026-001',
      'Saida por transferencia para quarentena',
    ],
    [
      '024273070',
      'PFIZ',
      'ET',
      '10',
      '05',
      'PFIZ05',
      '01Q01',
      'LOT-2026-01',
      '',
      '31-12-2028',
      '15-01-2026',
      '22-09-2026',
      'TRF-2026-001',
      'Entrada por transferencia em quarentena',
    ],
  ];

  const lines = [
    headers.join(';'),
    ...sampleRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')),
  ];

  return lines.join('\n');
}
