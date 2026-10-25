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
  // 43 Campos Oficiais do Perfil ERP
  documento_ref?: string | null;
  data: string | null; // YYYY-MM-DD
  cliente_ser: string | null;
  tipo_movimento: string | null;
  documento: string | null;
  num_linha: number | null;
  doc_linha: string; // PRIMARY KEY
  chave1: string | null;
  chave2: string | null;
  valor_unitario: number | null;
  valor_adicional: number | null;
  valor_abater: number | null;
  descricao: string | null;
  tipo_artigo: string | null;
  armazem: string | null;
  localizacao: string | null;
  lote: string | null;
  quantidade: number | null;
  familia: string | null;
  sub_familia: string | null;
  sub_Familia?: string | null;
  data_fabrico: string | null; // YYYY-MM-DD
  validade: string | null; // YYYY-MM-DD
  entidade: string | null;
  total_iva: number | null;
  total_merc: number | null;
  total_outros: number | null;
  totaldesc: number | null;
  requisicao: string | null;
  num_contribuinte: string | null;
  nome: string | null;
  morada: string | null;
  localidade: string | null;
  cod_postal: string | null;
  cod_postal_localidade: string | null;
  pais: string | null;
  nome_entrega: string | null;
  entidade_entrega: string | null;
  morada_entrega: string | null;
  localidade_entrega: string | null;
  cod_postal_entrega: string | null;
  observacoes?: string | null;
  tipo_doc?: string | null;
  num_doc?: string | null;

  // Propriedades auxiliares / integração / compatibilidade
  cli_primavera?: string | null;
  artigo_id?: string | null;
  artigo_cli?: string | null;
  created_at?: string;
  tipomovimento?: string | null;
  numlinha?: number | null;
  valorunitario?: number | null;
  valoradicional?: number | null;
  valorabater?: number | null;
  tipoartigo?: string | null;
  subfamilia?: string | null;
  datafabrico?: string | null;
  totaliva?: number | null;
  totalmerc?: number | null;
  totaloutros?: number | null;
  total_desc?: number | null;
  numcontribuinte?: string | null;
  codpostal?: string | null;
  codpostallocalidade?: string | null;
  nomeentrega?: string | null;
  entidadeentrega?: string | null;
  moradaentrega?: string | null;
  localidadeentrega?: string | null;
  codpostalentrega?: string | null;
  cod_postal_localidade_entrega?: string | null;
  artigo?: string | null;
  sigla?: string | null;
  data_movimento?: string | null;
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
  const tipoMov = r['tipo_movimento'] || r['tipomovimento'] ? String(r['tipo_movimento'] || r['tipomovimento']).trim() : null;
  const doc = r['documento'] ? String(r['documento']).trim() : null;
  const numLinha = parseNum(r['num_linha'] || r['numlinha']);

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

  const valUnitario = parseNum(r['valor_unitario'] || r['valorunitario']);
  const valAdicional = parseNum(r['valor_adicional'] || r['valoradicional']);
  const valAbater = parseNum(r['valor_abater'] || r['valorabater']);
  const qtd = parseNum(r['quantidade']);
  const totIva = parseNum(r['total_iva'] || r['totaliva']);
  const totMerc = parseNum(r['total_merc'] || r['totalmerc']);
  const totOutros = parseNum(r['total_outros'] || r['totaloutros']);
  const totDesc = parseNum(r['totaldesc'] || r['total_desc']);

  const subFam = r['sub_familia'] || r['sub_Familia'] || r['subfamilia'] ? String(r['sub_familia'] || r['sub_Familia'] || r['subfamilia']).trim() : null;
  const fabDate = parseDataFabrico(r['data_fabrico'] || r['datafabrico']);
  const valDate = parseDateOnly(r['validade']);

  const codPostal = r['cod_postal'] || r['codpostal'] ? String(r['cod_postal'] || r['codpostal']).trim() : null;
  const codPostalLoc = r['cod_postal_localidade'] || r['codpostallocalidade'] ? String(r['cod_postal_localidade'] || r['codpostallocalidade']).trim() : null;
  const locEntrega = r['localidade_entrega'] || r['localidadeentrega'] || r['cod_postal_localidade_entrega'] ? String(r['localidade_entrega'] || r['localidadeentrega'] || r['cod_postal_localidade_entrega']).trim() : null;
  const codPostalEntrega = r['cod_postal_entrega'] || r['codpostalentrega'] ? String(r['cod_postal_entrega'] || r['codpostalentrega']).trim() : null;
  const nomeEntrega = r['nome_entrega'] || r['nomeentrega'] ? String(r['nome_entrega'] || r['nomeentrega']).trim() : null;
  const entidadeEntrega = r['entidade_entrega'] || r['entidadeentrega'] ? String(r['entidade_entrega'] || r['entidadeentrega']).trim() : null;
  const moradaEntrega = r['morada_entrega'] || r['moradaentrega'] ? String(r['morada_entrega'] || r['moradaentrega']).trim() : null;
  const docRef = r['documento_ref'] || r['documentoref'] ? String(r['documento_ref'] || r['documentoref']).trim() : (clienteSer && doc ? `${clienteSer}-${doc}` : doc);
  const tipoDoc = r['tipo_doc'] || r['tipodoc'] || r['chave1'] ? String(r['tipo_doc'] || r['tipodoc'] || r['chave1']).trim() : null;
  const numDoc = r['num_doc'] || r['numdoc'] ? String(r['num_doc'] || r['numdoc']).trim() : null;
  const obs = r['observacoes'] ? String(r['observacoes']).trim() : null;

  return {
    documento_ref: docRef,
    data: dataOnly,
    cliente_ser: clienteSer,
    tipo_movimento: tipoMov,
    documento: doc,
    num_linha: numLinha,
    doc_linha: docLinha,
    chave1: r['chave1'] ? String(r['chave1']).trim() : null,
    chave2: r['chave2'] ? String(r['chave2']).trim() : null,
    valor_unitario: valUnitario,
    valor_adicional: valAdicional,
    valor_abater: valAbater,
    descricao: r['descricao'] ? String(r['descricao']).trim() : null,
    tipo_artigo: r['tipo_artigo'] || r['tipoartigo'] ? String(r['tipo_artigo'] || r['tipoartigo']).trim() : null,
    armazem: r['armazem'] ? String(r['armazem']).trim() : null,
    localizacao: r['localizacao'] ? String(r['localizacao']).trim() : null,
    lote: r['lote'] ? String(r['lote']).trim() : null,
    quantidade: qtd,
    familia: r['familia'] ? String(r['familia']).trim() : null,
    sub_familia: subFam,
    sub_Familia: subFam,
    data_fabrico: fabDate,
    validade: valDate,
    entidade: r['entidade'] ? String(r['entidade']).trim() : null,
    total_iva: totIva,
    total_merc: totMerc,
    total_outros: totOutros,
    totaldesc: totDesc,
    requisicao: r['requisicao'] ? String(r['requisicao']).trim() : null,
    num_contribuinte: r['num_contribuinte'] || r['numcontribuinte'] ? String(r['num_contribuinte'] || r['numcontribuinte']).trim() : null,
    nome: r['nome'] ? String(r['nome']).trim() : null,
    morada: r['morada'] ? String(r['morada']).trim() : null,
    localidade: r['localidade'] ? String(r['localidade']).trim() : null,
    cod_postal: codPostal,
    cod_postal_localidade: codPostalLoc,
    pais: r['pais'] ? String(r['pais']).trim() : null,
    nome_entrega: nomeEntrega,
    entidade_entrega: entidadeEntrega,
    morada_entrega: moradaEntrega,
    localidade_entrega: locEntrega,
    cod_postal_entrega: codPostalEntrega,
    observacoes: obs,
    tipo_doc: tipoDoc,
    num_doc: numDoc,

    // Suporte adicional / integração
    cli_primavera: cliPrimavera,
    artigo_id: artId,
    artigo_cli: artCli,

    // Aliases legado para compatibilidade total
    tipomovimento: tipoMov,
    numlinha: numLinha,
    valorunitario: valUnitario,
    valoradicional: valAdicional,
    valorabater: valAbater,
    tipoartigo: r['tipo_artigo'] || r['tipoartigo'] ? String(r['tipo_artigo'] || r['tipoartigo']).trim() : null,
    subfamilia: subFam,
    datafabrico: fabDate,
    totaliva: totIva,
    totalmerc: totMerc,
    totaloutros: totOutros,
    total_desc: totDesc,
    numcontribuinte: r['num_contribuinte'] || r['numcontribuinte'] ? String(r['num_contribuinte'] || r['numcontribuinte']).trim() : null,
    codpostal: codPostal,
    codpostallocalidade: codPostalLoc,
    nomeentrega: nomeEntrega,
    entidadeentrega: entidadeEntrega,
    moradaentrega: moradaEntrega,
    localidadeentrega: locEntrega,
    codpostalentrega: codPostalEntrega,
    cod_postal_localidade_entrega: locEntrega,
    artigo: artId,
    sigla: clienteSer,
    data_movimento: dataOnly,
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
  'documento_ref',
  'data',
  'cliente_ser',
  'tipo_movimento',
  'documento',
  'num_linha',
  'doc_linha',
  'chave1',
  'chave2',
  'valor_unitario',
  'valor_adicional',
  'valor_abater',
  'descricao',
  'tipo_artigo',
  'armazem',
  'localizacao',
  'lote',
  'quantidade',
  'familia',
  'sub_Familia',
  'data_fabrico',
  'validade',
  'entidade',
  'total_iva',
  'total_merc',
  'total_outros',
  'totaldesc',
  'requisicao',
  'num_contribuinte',
  'nome',
  'morada',
  'localidade',
  'cod_postal',
  'cod_postal_localidade',
  'pais',
  'nome_entrega',
  'entidade_entrega',
  'morada_entrega',
  'localidade_entrega',
  'cod_postal_entrega',
  'observacoes',
  'tipo_doc',
  'num_doc',
] as const;

export const PLAT_MOVIMENTOS_SAMPLE_DATA: Record<string, any>[] = [
  {
    documento_ref: 'SER-FA 24AOP/35',
    data: '06/02/2024',
    cliente_ser: 'AOP',
    tipo_movimento: 'S',
    documento: 'FA 24AOP/35',
    num_linha: 2,
    doc_linha: 'FA 24AOP/35-2',
    chave1: 'FA',
    chave2: '24AOP',
    valor_unitario: '599,85',
    valor_adicional: '0',
    valor_abater: '0',
    descricao: 'EMPRESSIN 40 IU/2 ml 10 AMP (PT)',
    tipo_artigo: '52',
    armazem: 'AOP01',
    localizacao: 'AOP01.12B57',
    lote: '019307',
    quantidade: 1,
    familia: 'MED',
    sub_Familia: 'AOP',
    data_fabrico: '20/04/2023',
    validade: '28/02/2025',
    entidade: '3382',
    total_iva: '35,99',
    total_merc: '599,85',
    total_outros: '0',
    totaldesc: '0',
    requisicao: '4500201126',
    num_contribuinte: '505962403',
    nome: 'HPP LUSÍADAS, S.A.',
    morada: 'RUA ABÍLIO MENDES, 3',
    localidade: 'LISBOA',
    cod_postal: '1500-458',
    cod_postal_localidade: 'LISBOA',
    pais: 'PT',
    nome_entrega: '',
    entidade_entrega: '3382',
    morada_entrega: 'HOSP. LUSIADAS PORTO',
    localidade_entrega: 'PORTO',
    cod_postal_entrega: '4050-115',
    observacoes: '',
    tipo_doc: 'FA',
    num_doc: '35',
  },
  {
    documento_ref: 'SER-FA 24AOP/36',
    data: '06/02/2024',
    cliente_ser: 'AOP',
    tipo_movimento: 'S',
    documento: 'FA 24AOP/36',
    num_linha: 2,
    doc_linha: 'FA 24AOP/36-2',
    chave1: 'FA',
    chave2: '24AOP',
    valor_unitario: '599,85',
    valor_adicional: '0',
    valor_abater: '0',
    descricao: 'EMPRESSIN 40 IU/2 ml 10 AMP (PT)',
    tipo_artigo: '52',
    armazem: 'AOP01',
    localizacao: 'AOP01.12B57',
    lote: '019307',
    quantidade: 1,
    familia: 'MED',
    sub_Familia: 'AOP',
    data_fabrico: '20/04/2023',
    validade: '28/02/2025',
    entidade: '498',
    total_iva: '35,99',
    total_merc: '599,85',
    total_outros: '0',
    totaldesc: '0',
    requisicao: '2024110268',
    num_contribuinte: '508085888',
    nome: 'UNIDADE LOCAL SAÚDE DO ALENTEJO CENTRAL,EPE',
    morada: 'HOSPITAL DO ESPÍRITO SANTO DE ÉVORA-FARMÁCIA',
    localidade: 'ÉVORA',
    cod_postal: '7000-811',
    cod_postal_localidade: 'ÉVORA',
    pais: 'PT',
    nome_entrega: '',
    entidade_entrega: '498',
    morada_entrega: 'HOSPITAL DO ESPÍRITO SANTO DE ÉVORA-FARMÁCIA',
    localidade_entrega: 'ÉVORA',
    cod_postal_entrega: '7000-811',
    observacoes: '',
    tipo_doc: 'FA',
    num_doc: '36',
  },
  {
    documento_ref: 'SER-SSF 24SEA/4',
    data: '20/02/2024',
    cliente_ser: 'Seacross',
    tipo_movimento: 'S',
    documento: 'SSF 24SEA/4',
    num_linha: 2,
    doc_linha: 'SSF 24SEA/4-2',
    chave1: 'SSF',
    chave2: '24SEA',
    valor_unitario: '13,85',
    valor_adicional: '0',
    valor_abater: '0',
    descricao: 'Azacitidina Seacross 25 mg/ml 100mg/1 vial',
    tipo_artigo: '52',
    armazem: 'SC01',
    localizacao: 'SC01.22E28',
    lote: '1012205502',
    quantidade: 100,
    familia: 'MED',
    sub_Familia: 'SEACROSS',
    data_fabrico: '22/11/2023',
    validade: '30/09/2025',
    entidade: '5960',
    total_iva: '83,1',
    total_merc: '1385',
    total_outros: '0',
    totaldesc: '0',
    requisicao: 'GR 51.1/3',
    num_contribuinte: '511228848',
    nome: 'SESARAM- SERVIÇO DE SAÚDE DA R.A.MADEIRA, E.P.E.',
    morada: 'HOSPITAL DR. NÉLIO MENDONÇA',
    localidade: 'FUNCHAL',
    cod_postal: '9004-514',
    cod_postal_localidade: 'FUNCHAL',
    pais: 'PT',
    nome_entrega: '',
    entidade_entrega: '5960',
    morada_entrega: 'HOSPITAL DR. NÉLIO MENDONÇA',
    localidade_entrega: 'FUNCHAL',
    cod_postal_entrega: '9004-514',
    observacoes: '',
    tipo_doc: 'SSF',
    num_doc: '4',
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
    documento_ref: 20,
    data: 14,
    cliente_ser: 16,
    tipo_movimento: 14,
    documento: 18,
    num_linha: 10,
    doc_linha: 24,
    chave1: 10,
    chave2: 12,
    valor_unitario: 14,
    valor_adicional: 14,
    valor_abater: 14,
    descricao: 45,
    tipo_artigo: 12,
    armazem: 12,
    localizacao: 16,
    lote: 14,
    quantidade: 12,
    familia: 10,
    sub_Familia: 14,
    data_fabrico: 14,
    validade: 14,
    entidade: 12,
    total_iva: 12,
    total_merc: 12,
    total_outros: 12,
    totaldesc: 12,
    requisicao: 18,
    num_contribuinte: 16,
    nome: 35,
    morada: 35,
    localidade: 20,
    cod_postal: 12,
    cod_postal_localidade: 22,
    pais: 8,
    nome_entrega: 25,
    entidade_entrega: 16,
    morada_entrega: 35,
    localidade_entrega: 20,
    cod_postal_entrega: 16,
    observacoes: 20,
    tipo_doc: 10,
    num_doc: 10,
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
 * Normaliza e prepara uma linha de movimento ERP para persistência na tabela public.plat_movimentos (43 colunas)
 */
export function preparePlatMovimentoForDb(
  r: PlatMovimentoRow,
  defaultCliente?: string,
  clientMapBySigla?: Map<string, string>,
  clientMapById?: Map<string, string>
) {
  let resolvedClientId: string | null = null;
  let inferredSigla = r.cliente_ser || r.sigla || r.sub_familia || r.sub_Familia || r.subfamilia || null;

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
    r.num_linha != null ? Number(r.num_linha) : r.numlinha != null ? Number(r.numlinha) : null;
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
    !r.data_fabrico && !r.datafabrico
      ? null
      : (r.data_fabrico || r.datafabrico === '1980-01-01' || r.datafabrico?.startsWith('1980-01-01'))
      ? (r.data_fabrico === '1980-01-01' || r.datafabrico === '1980-01-01' ? null : (r.data_fabrico || r.datafabrico)?.split(' ')[0])
      : null;
  const cleanValidade = r.validade ? r.validade.split(' ')[0] : null;

  const resolvedDocRef =
    r.documento_ref ||
    (resolvedClienteSer && resolvedDoc ? `${resolvedClienteSer}-${resolvedDoc}` : resolvedDoc);
  const resolvedTipoDoc =
    r.tipo_doc || r.chave1 || (resolvedDoc ? resolvedDoc.split(' ')[0] : null);
  const resolvedNumDoc =
    r.num_doc || (resolvedDoc && resolvedDoc.includes('/') ? resolvedDoc.split('/')[1] : null);
  const resolvedObs = r.observacoes ? String(r.observacoes).trim() : null;

  return {
    documento_ref: resolvedDocRef ? String(resolvedDocRef).trim() : null,
    data: cleanData,
    cliente_ser: resolvedClienteSer,
    tipo_movimento: r.tipo_movimento || r.tipomovimento || null,
    documento: resolvedDoc,
    num_linha: resolvedNumLinha,
    doc_linha: resolvedDocLinha,
    chave1: r.chave1 ? String(r.chave1).trim() : null,
    chave2: r.chave2 ? String(r.chave2).trim() : null,
    valor_unitario: Number(r.valor_unitario ?? r.valorunitario ?? 0),
    valor_adicional: Number(r.valor_adicional ?? r.valoradicional ?? 0),
    valor_abater: Number(r.valor_abater ?? r.valorabater ?? 0),
    descricao: r.descricao ? String(r.descricao).trim() : null,
    tipo_artigo: r.tipo_artigo || r.tipoartigo ? String(r.tipo_artigo || r.tipoartigo).trim() : null,
    armazem: r.armazem ? String(r.armazem).trim() : null,
    localizacao: r.localizacao ? String(r.localizacao).trim() : null,
    lote: r.lote ? String(r.lote).trim() : null,
    quantidade: Number(r.quantidade ?? 0),
    familia: r.familia ? String(r.familia).trim() : null,
    sub_familia:
      r.sub_familia || r.sub_Familia || r.subfamilia
        ? String(r.sub_familia || r.sub_Familia || r.subfamilia).trim()
        : null,
    data_fabrico: cleanDataFab,
    validade: cleanValidade,
    entidade: r.entidade ? String(r.entidade).trim() : null,
    total_iva: Number(r.total_iva ?? r.totaliva ?? 0),
    total_merc: Number(r.total_merc ?? r.totalmerc ?? 0),
    total_outros: Number(r.total_outros ?? r.totaloutros ?? 0),
    totaldesc: Number(r.totaldesc ?? r.total_desc ?? 0),
    requisicao: r.requisicao ? String(r.requisicao).trim() : null,
    num_contribuinte:
      r.num_contribuinte || r.numcontribuinte
        ? String(r.num_contribuinte || r.numcontribuinte).trim()
        : null,
    nome: r.nome ? String(r.nome).trim() : null,
    morada: r.morada ? String(r.morada).trim() : null,
    localidade: r.localidade ? String(r.localidade).trim() : null,
    cod_postal: r.cod_postal || r.codpostal ? String(r.cod_postal || r.codpostal).trim() : null,
    cod_postal_localidade:
      r.cod_postal_localidade || r.codpostallocalidade
        ? String(r.cod_postal_localidade || r.codpostallocalidade).trim()
        : null,
    pais: r.pais ? String(r.pais).trim() : null,
    nome_entrega:
      r.nome_entrega || r.nomeentrega ? String(r.nome_entrega || r.nomeentrega).trim() : null,
    entidade_entrega:
      r.entidade_entrega || r.entidadeentrega
        ? String(r.entidade_entrega || r.entidadeentrega).trim()
        : null,
    morada_entrega:
      r.morada_entrega || r.moradaentrega ? String(r.morada_entrega || r.moradaentrega).trim() : null,
    localidade_entrega:
      r.localidade_entrega || r.localidadeentrega || r.cod_postal_localidade_entrega
        ? String(r.localidade_entrega || r.localidadeentrega || r.cod_postal_localidade_entrega).trim()
        : null,
    cod_postal_entrega:
      r.cod_postal_entrega || r.codpostalentrega
        ? String(r.cod_postal_entrega || r.codpostalentrega).trim()
        : null,
    observacoes: resolvedObs,
    tipo_doc: resolvedTipoDoc ? String(resolvedTipoDoc).trim() : null,
    num_doc: resolvedNumDoc ? String(resolvedNumDoc).trim() : null,

    // Suporte adicional para tabelas relacionadas
    cli_primavera: r.cli_primavera ? String(r.cli_primavera).trim() : null,
    artigo_id: resolvedArtigoId,
    artigo_cli: resolvedArtigoCli,
  };
}

