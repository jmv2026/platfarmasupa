import ExcelJS from 'exceljs';

function parseNum(v: any): number | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') {
    return isNaN(v) ? null : v;
  }
  let s = String(v).trim().replace(/\s/g, '');
  if (s === '' || s.toLowerCase() === 'null') return null;
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
  return isNaN(num) ? null : num;
}

function parseDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    const year = v.getFullYear();
    const month = String(v.getMonth() + 1).padStart(2, '0');
    const day = String(v.getDate()).padStart(2, '0');
    const hours = String(v.getHours()).padStart(2, '0');
    const mins = String(v.getMinutes()).padStart(2, '0');
    const secs = String(v.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
  }
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    // Excel serial number
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().replace('T', ' ').substring(0, 19);
  }
  const str = String(v).trim();
  const parts = str.split(' ');
  const dateParts = parts[0].split(/[\/\-]/);
  if (dateParts.length === 3) {
    if (dateParts[0].length === 4) {
      // YYYY-MM-DD ou YYYY/MM/DD
      const year = dateParts[0];
      const month = dateParts[1].padStart(2, '0');
      const day = dateParts[2].padStart(2, '0');
      const time = parts[1] || '00:00:00';
      return `${year}-${month}-${day} ${time}`;
    } else {
      // DD-MM-YYYY ou DD/MM/YYYY
      const day = dateParts[0].padStart(2, '0');
      const month = dateParts[1].padStart(2, '0');
      const year = dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2];
      const time = parts[1] || '00:00:00';
      return `${year}-${month}-${day} ${time}`;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.replace('T', ' ').substring(0, 19);
  }
  return null;
}

function parseDateOnly(v: any): string | null {
  const d = parseDate(v);
  if (!d) return null;
  return d.substring(0, 10);
}

function parseDataFabrico(v: any): string | null {
  const d = parseDateOnly(v);
  if (!d || d === '1980-01-01' || d.startsWith('1980-01-01')) return null;
  return d;
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

export interface PlatMovimentoRow {
  data: string | null; // YYYY-MM-DD
  cli_primavera: string | null;
  cliente_ser: string | null;
  tipomovimento: string | null;
  documento: string | null;
  numlinha: number | null;
  doc_linha: string; // PRIMARY KEY
  chave1: string | null;
  chave2: string | null;
  valorunitario: number | null;
  valoradicional: number | null;
  valorabater: number | null;
  artigo_id: string | null;
  artigo_cli: string | null;
  descricao: string | null;
  tipoartigo: string | null;
  armazem: string | null;
  localizacao: string | null;
  lote: string | null;
  quantidade: number | null;
  familia: string | null;
  subfamilia: string | null;
  datafabrico: string | null; // YYYY-MM-DD
  validade: string | null; // YYYY-MM-DD
  entidade: string | null;
  totaliva: number | null;
  totalmerc: number | null;
  totaloutros: number | null;
  totaldesc: number | null;
  requisicao: string | null;
  numcontribuinte: string | null;
  nome: string | null;
  morada: string | null;
  localidade: string | null;
  codpostal: string | null;
  codpostallocalidade: string | null;
  pais: string | null;
  nomeentrega: string | null;
  entidadeentrega: string | null;
  moradaentrega: string | null;
  localidadeentrega: string | null;
  codpostalentrega: string | null;
  created_at?: string;
  // Propriedades auxiliares / compatibilidade
  artigo?: string | null;
  sigla?: string | null;
  num_linha?: number | null;
  tipo_movimento?: string | null;
  tipo_artigo?: string | null;
  documento_ref?: string | null;
  sub_familia?: string | null;
  valor_unitario?: number | null;
  valor_adicional?: number | null;
  valor_abater?: number | null;
  total_iva?: number | null;
  total_merc?: number | null;
  total_outros?: number | null;
  total_desc?: number | null;
  data_movimento?: string | null;
  cod_postal?: string | null;
  cod_postal_localidade?: string | null;
  num_contribuinte?: string | null;
  nome_entrega?: string | null;
  morada_entrega?: string | null;
  localidade_entrega?: string | null;
  cod_postal_entrega?: string | null;
  cod_postal_localidade_entrega?: string | null;
  entidade_entrega?: string | null;
}

function cleanCell(val: any): string {
  if (val === undefined || val === null) return '';
  let s = String(val).trim();
  if ((s.startsWith('"') && s.endsWith('"') && s.length >= 2) || (s.startsWith("'") && s.endsWith("'") && s.length >= 2)) {
    s = s.slice(1, -1).trim();
  }
  return s;
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

function mapRawRowToPlatMovimento(r: Record<string, any>): PlatMovimentoRow {
  const dataOnly = parseDateOnly(r['data'] || r['data_movimento'] || r['datamovimento']);
  const cliPrimavera = r['cli_primavera'] || r['cliprimavera'] ? String(r['cli_primavera'] || r['cliprimavera']).trim() : null;
  const clienteSer = r['cliente_ser'] || r['clienteser'] || r['sigla'] || r['sigla_cliente'] ? String(r['cliente_ser'] || r['clienteser'] || r['sigla'] || r['sigla_cliente']).trim() : null;
  const tipoMov = r['tipomovimento'] || r['tipo_movimento'] ? String(r['tipomovimento'] || r['tipo_movimento']).trim() : null;
  const doc = r['documento'] ? String(r['documento']).trim() : null;
  const numLinha = parseNum(r['numlinha'] || r['num_linha']);

  let docLinha = r['doc_linha'] || r['doclinha'] ? String(r['doc_linha'] || r['doclinha']).trim() : '';
  if (!docLinha && doc && numLinha != null) {
    docLinha = `${doc}-${numLinha}`;
  }

  const artId = r['artigo_id'] || r['artigoid'] || r['artigo'] ? String(r['artigo_id'] || r['artigoid'] || r['artigo']).trim() : null;
  let artCli = r['artigo_cli'] || r['artigocli'] ? String(r['artigo_cli'] || r['artigocli']).trim() : null;
  if (!artCli && artId) {
    if (cliPrimavera) {
      artCli = `${cliPrimavera}-${artId}`;
    } else if (clienteSer) {
      artCli = `${clienteSer}-${artId}`;
    } else {
      artCli = artId;
    }
  }

  const valUnitario = parseNum(r['valorunitario'] || r['valor_unitario']);
  const valAdicional = parseNum(r['valoradicional'] || r['valor_adicional']);
  const valAbater = parseNum(r['valorabater'] || r['valor_abater']);
  const qtd = parseNum(r['quantidade']);
  const totIva = parseNum(r['totaliva'] || r['total_iva']);
  const totMerc = parseNum(r['totalmerc'] || r['total_merc']);
  const totOutros = parseNum(r['totaloutros'] || r['total_outros']);
  const totDesc = parseNum(r['totaldesc'] || r['total_desc']);

  const subFam = r['subfamilia'] || r['sub_familia'] ? String(r['subfamilia'] || r['sub_familia']).trim() : null;
  const fabDate = parseDataFabrico(r['datafabrico'] || r['data_fabrico']);
  const valDate = parseDateOnly(r['validade']);

  const codPostal = r['codpostal'] || r['cod_postal'] ? String(r['codpostal'] || r['cod_postal']).trim() : null;
  const codPostalLoc = r['codpostallocalidade'] || r['cod_postal_localidade'] ? String(r['codpostallocalidade'] || r['cod_postal_localidade']).trim() : null;
  const locEntrega = r['localidadeentrega'] || r['localidade_entrega'] || r['cod_postal_localidade_entrega'] ? String(r['localidadeentrega'] || r['localidade_entrega'] || r['cod_postal_localidade_entrega']).trim() : null;
  const codPostalEntrega = r['codpostalentrega'] || r['cod_postal_entrega'] ? String(r['codpostalentrega'] || r['cod_postal_entrega']).trim() : null;

  return {
    data: dataOnly,
    cli_primavera: cliPrimavera,
    cliente_ser: clienteSer,
    tipomovimento: tipoMov,
    documento: doc,
    numlinha: numLinha,
    doc_linha: docLinha,
    chave1: r['chave1'] ? String(r['chave1']).trim() : null,
    chave2: r['chave2'] ? String(r['chave2']).trim() : null,
    valorunitario: valUnitario,
    valoradicional: valAdicional,
    valorabater: valAbater,
    artigo_id: artId,
    artigo_cli: artCli,
    descricao: r['descricao'] ? String(r['descricao']).trim() : null,
    tipoartigo: r['tipoartigo'] || r['tipo_artigo'] ? String(r['tipoartigo'] || r['tipo_artigo']).trim() : null,
    armazem: r['armazem'] ? String(r['armazem']).trim() : null,
    localizacao: r['localizacao'] ? String(r['localizacao']).trim() : null,
    lote: r['lote'] ? String(r['lote']).trim() : null,
    quantidade: qtd,
    familia: r['familia'] ? String(r['familia']).trim() : null,
    subfamilia: subFam,
    datafabrico: fabDate,
    validade: valDate,
    entidade: r['entidade'] ? String(r['entidade']).trim() : null,
    totaliva: totIva,
    totalmerc: totMerc,
    totaloutros: totOutros,
    totaldesc: totDesc,
    requisicao: r['requisicao'] ? String(r['requisicao']).trim() : null,
    numcontribuinte: r['numcontribuinte'] || r['num_contribuinte'] ? String(r['numcontribuinte'] || r['num_contribuinte']).trim() : null,
    nome: r['nome'] ? String(r['nome']).trim() : null,
    morada: r['morada'] ? String(r['morada']).trim() : null,
    localidade: r['localidade'] ? String(r['localidade']).trim() : null,
    codpostal: codPostal,
    codpostallocalidade: codPostalLoc,
    pais: r['pais'] ? String(r['pais']).trim() : null,
    nomeentrega: r['nomeentrega'] || r['nome_entrega'] ? String(r['nomeentrega'] || r['nome_entrega']).trim() : null,
    entidadeentrega: r['entidadeentrega'] || r['entidade_entrega'] ? String(r['entidadeentrega'] || r['entidade_entrega']).trim() : null,
    moradaentrega: r['moradaentrega'] || r['morada_entrega'] ? String(r['moradaentrega'] || r['morada_entrega']).trim() : null,
    localidadeentrega: locEntrega,
    codpostalentrega: codPostalEntrega,

    // Aliases
    artigo: artId,
    sigla: clienteSer,
    num_linha: numLinha,
    tipo_movimento: tipoMov,
    sub_familia: subFam,
    total_iva: totIva,
    total_merc: totMerc,
    total_desc: totDesc,
    cod_postal: codPostal,
    cod_postal_localidade: codPostalLoc,
    nome_entrega: r['nomeentrega'] || r['nome_entrega'] ? String(r['nomeentrega'] || r['nome_entrega']).trim() : null,
    morada_entrega: r['moradaentrega'] || r['morada_entrega'] ? String(r['moradaentrega'] || r['morada_entrega']).trim() : null,
    cod_postal_entrega: codPostalEntrega,
    entidade_entrega: r['entidadeentrega'] || r['entidade_entrega'] ? String(r['entidadeentrega'] || r['entidade_entrega']).trim() : null,
  };
}

export function parseCsvTextToPlatMovimentos(text: string): PlatMovimentoRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  let delimiter = ';';
  if (lines[0].includes(';')) delimiter = ';';
  else if (lines[0].includes('\t')) delimiter = '\t';
  else if (lines[0].includes(',')) delimiter = ',';

  const rawHeaders = splitCsvLine(lines[0], delimiter);
  const header = rawHeaders.map((c) => normalizeHeader(c));
  const rows: PlatMovimentoRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    const r: Record<string, string> = {};
    header.forEach((h, idx) => {
      r[h] = cols[idx] !== undefined ? cleanCell(cols[idx]) : '';
    });

    const isRowEmpty = Object.values(r).every((v) => !v);
    if (isRowEmpty) continue;

    const mapped = mapRawRowToPlatMovimento(r);
    if (mapped.doc_linha || mapped.documento) {
      rows.push(mapped);
    }
  }

  return rows;
}

export async function parseExcelToPlatMovimentos(arrayBuffer: ArrayBuffer): Promise<PlatMovimentoRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers: string[] = [];
  const rows: PlatMovimentoRow[] = [];

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
              // keep as Date
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

      const mapped = mapRawRowToPlatMovimento(r);
      if (mapped.doc_linha || mapped.documento) {
        rows.push(mapped);
      }
    }
  });

  return rows;
}

export async function parsePlatMovimentosFile(file: File): Promise<PlatMovimentoRow[]> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith('.xlsx')) {
      const buffer = await file.arrayBuffer();
      return await parseExcelToPlatMovimentos(buffer);
    } else if (name.endsWith('.xls')) {
      try {
        const buffer = await file.arrayBuffer();
        return await parseExcelToPlatMovimentos(buffer);
      } catch {
        const text = await file.text();
        const rows = parseCsvTextToPlatMovimentos(text);
        if (rows.length > 0) return rows;
        throw new Error('Formato .xls legado incompatível. Por favor guarde o ficheiro no Excel como .xlsx ou .csv.');
      }
    } else {
      // .csv, .txt, .tsv
      const text = await file.text();
      return parseCsvTextToPlatMovimentos(text);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao processar ficheiro';
    throw new Error(`Falha ao ler ficheiro de movimentos ERP: ${msg}`);
  }
}

export const PLAT_MOVIMENTOS_ERP_HEADERS = [
  'data',
  'cli_primavera',
  'cliente_ser',
  'tipomovimento',
  'documento',
  'numlinha',
  'doc_linha',
  'chave1',
  'chave2',
  'valorunitario',
  'valoradicional',
  'valorabater',
  'artigo_id',
  'artigo_cli',
  'descricao',
  'tipoartigo',
  'armazem',
  'localizacao',
  'lote',
  'quantidade',
  'familia',
  'subFamilia',
  'datafabrico',
  'validade',
  'entidade',
  'totaliva',
  'totalmerc',
  'totaloutros',
  'totaldesc',
  'requisicao',
  'numcontribuinte',
  'nome',
  'morada',
  'localidade',
  'codpostal',
  'codpostallocalidade',
  'pais',
  'nomeentrega',
  'entidadeentrega',
  'moradaentrega',
  'localidadeentrega',
  'codpostalentrega',
] as const;

export const PLAT_MOVIMENTOS_SAMPLE_DATA: Record<string, any>[] = [
  {
    data: '24/09/2026',
    cli_primavera: '482',
    cliente_ser: 'Maxifar',
    tipomovimento: 'S',
    documento: 'SSF 26MAX/173',
    numlinha: 6,
    doc_linha: 'SSF 26MAX/173-6',
    chave1: 'SSF',
    chave2: '26MAX',
    valorunitario: '9,67',
    valoradicional: '0',
    valorabater: '0',
    artigo_id: '5738679',
    artigo_cli: '482-5738679',
    descricao: 'EKZEM 0.1 MG/0.4 ML GOTAS AUR. 30 UNID.',
    tipoartigo: '80',
    armazem: 'MAX01',
    localizacao: 'MAX01.22A24',
    lote: '26004',
    quantidade: 30,
    familia: 'MED',
    subFamilia: 'SALVAT',
    datafabrico: '',
    validade: '01/03/2028',
    entidade: '4552',
    totaliva: '503,97',
    totalmerc: '5927,77',
    totaloutros: '0',
    totaldesc: '1410,72',
    requisicao: 'COOPP3693',
    numcontribuinte: '513745653',
    nome: 'FIRSTPHARMA, S.A.',
    morada: 'RUA DO VALE, 786',
    localidade: 'FOLGOSA',
    codpostal: '4425-399',
    codpostallocalidade: 'FOLGOSA-MAIA',
    pais: 'PT',
    nomeentrega: '',
    entidadeentrega: '4552',
    moradaentrega: 'COOPROFAR',
    localidadeentrega: 'GONDOMAR',
    codpostalentrega: '4420-612',
  },
  {
    data: '24/09/2026',
    cli_primavera: '482',
    cliente_ser: 'Maxifar',
    tipomovimento: 'S',
    documento: 'SSF 26MAX/173',
    numlinha: 9,
    doc_linha: 'SSF 26MAX/173-9',
    chave1: 'SSF',
    chave2: '26MAX',
    valorunitario: '9,75',
    valoradicional: '0',
    valorabater: '0',
    artigo_id: '6630939',
    artigo_cli: '482-6630939',
    descricao: 'MEGALEVURE MORANGO 10 STICKS',
    tipoartigo: '84',
    armazem: 'MAX01',
    localizacao: 'MAX01.22C11',
    lote: 'K05302',
    quantidade: 9,
    familia: 'MED',
    subFamilia: 'SALVAT',
    datafabrico: '01/01/1980',
    validade: '31/05/2028',
    entidade: '4552',
    totaliva: '503,97',
    totalmerc: '5927,77',
    totaloutros: '0',
    totaldesc: '1410,72',
    requisicao: 'COOPP3693',
    numcontribuinte: '513745653',
    nome: 'FIRSTPHARMA, S.A.',
    morada: 'RUA DO VALE, 786',
    localidade: 'FOLGOSA',
    codpostal: '4425-399',
    codpostallocalidade: 'FOLGOSA-MAIA',
    pais: 'PT',
    nomeentrega: '',
    entidadeentrega: '4552',
    moradaentrega: 'COOPROFAR',
    localidadeentrega: 'GONDOMAR',
    codpostalentrega: '4420-612',
  },
  {
    data: '24/09/2026',
    cli_primavera: '482',
    cliente_ser: 'Maxifar',
    tipomovimento: 'S',
    documento: 'SSF 26MAX/173',
    numlinha: 18,
    doc_linha: 'SSF 26MAX/173-18',
    chave1: 'SSF',
    chave2: '26MAX',
    valorunitario: '0',
    valoradicional: '0',
    valorabater: '9,4',
    artigo_id: '5868401',
    artigo_cli: '482-5868401',
    descricao: 'CRISTALMINA 10 MG/ML 25 ML SOL. P/ PULV. CUT. FRSC.',
    tipoartigo: '80',
    armazem: 'MAX01',
    localizacao: 'MAX01.23A23',
    lote: 'V713',
    quantidade: 2,
    familia: 'MED',
    subFamilia: 'SALVAT',
    datafabrico: '01/01/1980',
    validade: '01/05/2027',
    entidade: '4552',
    totaliva: '503,97',
    totalmerc: '5927,77',
    totaloutros: '0',
    totaldesc: '1410,72',
    requisicao: 'COOPP3693',
    numcontribuinte: '513745653',
    nome: 'FIRSTPHARMA, S.A.',
    morada: 'RUA DO VALE, 786',
    localidade: 'FOLGOSA',
    codpostal: '4425-399',
    codpostallocalidade: 'FOLGOSA-MAIA',
    pais: 'PT',
    nomeentrega: '',
    entidadeentrega: '4552',
    moradaentrega: 'COOPROFAR',
    localidadeentrega: 'GONDOMAR',
    codpostalentrega: '4420-612',
  },
];

export function generatePlatMovimentosSampleCSV(): string {
  const headerLine = PLAT_MOVIMENTOS_ERP_HEADERS.join(';');
  const rowLines = PLAT_MOVIMENTOS_SAMPLE_DATA.map((row) => {
    return PLAT_MOVIMENTOS_ERP_HEADERS.map((key) => {
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

export async function generatePlatMovimentosSampleExcel(): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Movimentos ERP');

  const columnWidths: Record<string, number> = {
    data: 14,
    cli_primavera: 14,
    cliente_ser: 16,
    tipomovimento: 14,
    documento: 18,
    numlinha: 10,
    doc_linha: 24,
    chave1: 10,
    chave2: 12,
    valorunitario: 14,
    valoradicional: 14,
    valorabater: 14,
    artigo_id: 14,
    artigo_cli: 18,
    descricao: 45,
    tipoartigo: 12,
    armazem: 12,
    localizacao: 16,
    lote: 14,
    quantidade: 12,
    familia: 10,
    subFamilia: 14,
    datafabrico: 14,
    validade: 14,
    entidade: 12,
    totaliva: 12,
    totalmerc: 12,
    totaloutros: 12,
    totaldesc: 12,
    requisicao: 18,
    numcontribuinte: 16,
    nome: 35,
    morada: 35,
    localidade: 20,
    codpostal: 12,
    codpostallocalidade: 22,
    pais: 8,
    nomeentrega: 25,
    entidadeentrega: 16,
    moradaentrega: 35,
    localidadeentrega: 20,
    codpostalentrega: 16,
  };

  worksheet.columns = PLAT_MOVIMENTOS_ERP_HEADERS.map((h) => ({
    header: h,
    key: h,
    width: columnWidths[h] || 16,
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4338CA' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  PLAT_MOVIMENTOS_SAMPLE_DATA.forEach((row) => {
    worksheet.addRow(row);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Normaliza e prepara uma linha de movimento ERP para persistência na tabela public.plat_movimentos (42 colunas)
 */
export function preparePlatMovimentoForDb(
  r: PlatMovimentoRow,
  defaultCliente?: string,
  clientMapBySigla?: Map<string, string>,
  clientMapById?: Map<string, string>
) {
  let resolvedClientId: string | null = null;
  let inferredSigla = r.cliente_ser || r.sigla || r.subfamilia || r.sub_familia || null;

  if (!inferredSigla && r.chave2) {
    inferredSigla = r.chave2.replace(/[0-9]/g, '');
  }
  if (!inferredSigla && r.armazem) {
    inferredSigla = r.armazem.replace(/[0-9]/g, '');
  }

  if (inferredSigla && clientMapBySigla && clientMapBySigla.has(inferredSigla.toUpperCase())) {
    resolvedClientId = clientMapBySigla.get(inferredSigla.toUpperCase())!;
  }

  const resolvedClienteSer =
    r.cliente_ser ||
    r.sigla ||
    (resolvedClientId && clientMapById && clientMapById.get(resolvedClientId)) ||
    defaultCliente ||
    inferredSigla ||
    null;

  const resolvedNumLinha =
    r.numlinha != null ? Number(r.numlinha) : r.num_linha != null ? Number(r.num_linha) : null;
  const resolvedDoc = r.documento ? String(r.documento).trim() : null;

  let resolvedDocLinha = r.doc_linha ? String(r.doc_linha).trim() : '';
  if (!resolvedDocLinha && resolvedDoc && resolvedNumLinha != null) {
    resolvedDocLinha = `${resolvedDoc}-${resolvedNumLinha}`;
  }
  if (!resolvedDocLinha) {
    const art = r.artigo_id || r.artigo || 'ART';
    const lot = r.lote || 'LOT';
    resolvedDocLinha = `${resolvedDoc || 'DOC'}-${art}-${lot}-${Math.random().toString(36).substring(2, 8)}`;
  }

  const resolvedArtigoId = r.artigo_id || r.artigo ? String(r.artigo_id || r.artigo).trim() : null;
  let resolvedArtigoCli = r.artigo_cli ? String(r.artigo_cli).trim() : null;
  if (!resolvedArtigoCli && resolvedArtigoId) {
    if (r.cli_primavera) {
      resolvedArtigoCli = `${r.cli_primavera}-${resolvedArtigoId}`;
    } else if (resolvedClienteSer) {
      resolvedArtigoCli = `${resolvedClienteSer}-${resolvedArtigoId}`;
    } else {
      resolvedArtigoCli = resolvedArtigoId;
    }
  }

  const cleanData = r.data ? r.data.split(' ')[0] : null;
  const cleanDataFab =
    !r.datafabrico || r.datafabrico === '1980-01-01' || r.datafabrico.startsWith('1980-01-01')
      ? null
      : r.datafabrico.split(' ')[0];
  const cleanValidade = r.validade ? r.validade.split(' ')[0] : null;

  return {
    doc_linha: resolvedDocLinha,
    data: cleanData,
    cli_primavera: r.cli_primavera ? String(r.cli_primavera).trim() : null,
    cliente_ser: resolvedClienteSer,
    tipomovimento: r.tipomovimento || r.tipo_movimento || null,
    documento: resolvedDoc,
    numlinha: resolvedNumLinha,
    chave1: r.chave1 ? String(r.chave1).trim() : null,
    chave2: r.chave2 ? String(r.chave2).trim() : null,
    valorunitario: Number(r.valorunitario ?? r.valor_unitario ?? 0),
    valoradicional: Number(r.valoradicional ?? r.valor_adicional ?? 0),
    valorabater: Number(r.valorabater ?? r.valor_abater ?? 0),
    artigo_id: resolvedArtigoId,
    artigo_cli: resolvedArtigoCli,
    descricao: r.descricao ? String(r.descricao).trim() : null,
    tipoartigo: r.tipoartigo || r.tipo_artigo ? String(r.tipoartigo || r.tipo_artigo).trim() : null,
    armazem: r.armazem ? String(r.armazem).trim() : null,
    localizacao: r.localizacao ? String(r.localizacao).trim() : null,
    lote: r.lote ? String(r.lote).trim() : null,
    quantidade: Number(r.quantidade ?? 0),
    familia: r.familia ? String(r.familia).trim() : null,
    subfamilia: r.subfamilia || r.sub_familia ? String(r.subfamilia || r.sub_familia).trim() : null,
    datafabrico: cleanDataFab,
    validade: cleanValidade,
    entidade: r.entidade ? String(r.entidade).trim() : null,
    totaliva: Number(r.totaliva ?? r.total_iva ?? 0),
    totalmerc: Number(r.totalmerc ?? r.total_merc ?? 0),
    totaloutros: Number(r.totaloutros ?? r.total_outros ?? 0),
    totaldesc: Number(r.totaldesc ?? r.total_desc ?? 0),
    requisicao: r.requisicao ? String(r.requisicao).trim() : null,
    numcontribuinte:
      r.numcontribuinte || r.num_contribuinte
        ? String(r.numcontribuinte || r.num_contribuinte).trim()
        : null,
    nome: r.nome ? String(r.nome).trim() : null,
    morada: r.morada ? String(r.morada).trim() : null,
    localidade: r.localidade ? String(r.localidade).trim() : null,
    codpostal: r.codpostal || r.cod_postal ? String(r.codpostal || r.cod_postal).trim() : null,
    codpostallocalidade:
      r.codpostallocalidade || r.cod_postal_localidade
        ? String(r.codpostallocalidade || r.cod_postal_localidade).trim()
        : null,
    pais: r.pais ? String(r.pais).trim() : null,
    nomeentrega:
      r.nomeentrega || r.nome_entrega ? String(r.nomeentrega || r.nome_entrega).trim() : null,
    entidadeentrega:
      r.entidadeentrega || r.entidade_entrega
        ? String(r.entidadeentrega || r.entidade_entrega).trim()
        : null,
    moradaentrega:
      r.moradaentrega || r.morada_entrega ? String(r.moradaentrega || r.morada_entrega).trim() : null,
    localidadeentrega:
      r.localidadeentrega || r.cod_postal_localidade_entrega || r.localidade_entrega
        ? String(r.localidadeentrega || r.cod_postal_localidade_entrega || r.localidade_entrega).trim()
        : null,
    codpostalentrega:
      r.codpostalentrega || r.cod_postal_entrega
        ? String(r.codpostalentrega || r.cod_postal_entrega).trim()
        : null,
  };
}

