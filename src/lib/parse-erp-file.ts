import ExcelJS from 'exceljs';

export interface PlatEntradaRow {
  id?: number;
  serie?: string | null;
  tipo_doc?: string | null;
  num_doc?: number | null;
  entidade?: string | null;
  data?: string | null;
  num_doc_externo?: string | null;
  total_merc?: number | null;
  total_iva?: number | null;
  total_desc?: number | null;
  total_outros?: number | null;
  requisicao?: string | null;
  num_contribuinte?: string | null;
  localidade?: string | null;
  morada?: string | null;
  nome?: string | null;
  cod_postal?: string | null;
  cod_postal_localidade?: string | null;
  id_linha?: string | null;
  id_cabec_compras?: string | null;
  referencia?: string | null;
  num_linha?: number | null;
  desconto1?: number | null;
  desconto2?: number | null;
  desconto3?: number | null;
  taxa_iva?: number | null;
  quantidade?: number | null;
  cod_iva?: string | null;
  prec_unit?: number | null;
  armazem?: string | null;
  lote?: string | null;
  descricao?: string | null;
  total_iliquido?: number | null;
  total_da?: number | null;
  total_dc?: number | null;
  total_df?: number | null;
  total_recargo?: number | null;
  total_iva_linhas?: number | null;
  familia?: string | null;
  subfamilia?: string | null;
  entidade_entrega?: string | null;
  nome_entrega?: string | null;
  localidade_entrega?: string | null;
  morada_entrega?: string | null;
  cod_postal_entrega?: string | null;
  cod_postal_localidade_entrega?: string | null;
  artigo?: string | null;
  desc_pag?: number | null;
  created_at?: string;
}

export interface PlatSaidaRow {
  id?: number;
  data?: string | null;
  entidade?: string | null;
  tipo_doc?: string | null;
  num_doc?: number | null;
  total_merc?: number | null;
  total_iva?: number | null;
  total_desc?: number | null;
  total_outros?: number | null;
  serie?: string | null;
  morada?: string | null;
  nome?: string | null;
  localidade?: string | null;
  cod_postal?: string | null;
  cod_postal_localidade?: string | null;
  entidade_entrega?: string | null;
  morada_entrega?: string | null;
  nome_entrega?: string | null;
  localidade_entrega?: string | null;
  cod_postal_entrega?: string | null;
  cod_postal_localidade_entrega?: string | null;
  num_linha?: number | null;
  artigo?: string | null;
  desconto1?: number | null;
  desconto2?: number | null;
  desconto3?: number | null;
  taxa_iva?: number | null;
  quantidade?: number | null;
  cod_iva?: string | null;
  prec_unit?: number | null;
  armazem?: string | null;
  desconto_comercial?: number | null;
  lote?: string | null;
  descricao?: string | null;
  devolucao?: boolean | null;
  total_da?: number | null;
  total_dc?: number | null;
  total_iliquido?: number | null;
  total_df?: number | null;
  total_recargo?: number | null;
  total_iva_linhas?: number | null;
  id_linha?: string | null;
  id_cabec_doc?: string | null;
  familia?: string | null;
  subfamilia?: string | null;
  pcm?: number | null;
  desc_pag?: number | null;
  created_at?: string;
}

function parseNum(v: any): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') {
    return isNaN(v) ? null : v;
  }
  const s = String(v).trim().replace(',', '.');
  if (s === '' || s.toLowerCase() === 'null') return null;
  const num = Number(s);
  return isNaN(num) ? null : num;
}

function parseDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString().replace('T', ' ').substring(0, 19);
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

function normalizeHeader(key: string): string {
  if (!key) return '';
  return key
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '');
}

export function parseCsvTextToEntradas(text: string): PlatEntradaRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  let delimiter = ';';
  if (lines[0].includes(';')) delimiter = ';';
  else if (lines[0].includes('\t')) delimiter = '\t';
  else if (lines[0].includes(',')) delimiter = ',';
  const header = lines[0].split(delimiter).map(c => normalizeHeader(c));
  const rows: PlatEntradaRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter);
    const r: Record<string, string> = {};
    header.forEach((h, idx) => {
      r[h] = cols[idx] !== undefined ? cols[idx].trim() : '';
    });

    rows.push({
      serie: r['serie'] || null,
      tipo_doc: r['tipodoc'] || r['tipo_doc'] || null,
      num_doc: parseNum(r['numdoc'] || r['num_doc']),
      entidade: r['entidade'] || null,
      data: parseDate(r['data']),
      num_doc_externo: r['numdocexterno'] || r['num_doc_externo'] || null,
      total_merc: parseNum(r['totalmerc'] || r['total_merc']),
      total_iva: parseNum(r['totaliva'] || r['total_iva']),
      total_desc: parseNum(r['totaldesc'] || r['total_desc']),
      total_outros: parseNum(r['totaloutros'] || r['total_outros']),
      requisicao: r['requisicao'] || null,
      num_contribuinte: r['numcontribuinte'] || r['num_contribuinte'] || null,
      localidade: r['localidade'] || null,
      morada: r['morada'] || null,
      nome: r['nome'] || null,
      cod_postal: r['codpostal'] || r['cod_postal'] || null,
      cod_postal_localidade: r['codpostallocalidade'] || r['cod_postal_localidade'] || null,
      id_linha: r['id'] || r['id_linha'] || null,
      id_cabec_compras: r['idcabeccompras'] || r['id_cabec_compras'] || null,
      referencia: r['referencia'] || null,
      num_linha: parseNum(r['numlinha'] || r['num_linha']),
      desconto1: parseNum(r['desconto1']),
      desconto2: parseNum(r['desconto2']),
      desconto3: parseNum(r['desconto3']),
      taxa_iva: parseNum(r['taxaiva'] || r['taxa_iva']),
      quantidade: parseNum(r['quantidade']),
      cod_iva: r['codiva'] || r['cod_iva'] || null,
      prec_unit: parseNum(r['precunit'] || r['prec_unit']),
      armazem: r['armazem'] || null,
      lote: r['lote'] || null,
      descricao: r['descricao'] || null,
      total_iliquido: parseNum(r['totaliliquido'] || r['total_iliquido']),
      total_da: parseNum(r['totalda'] || r['total_da']),
      total_dc: parseNum(r['totaldc'] || r['total_dc']),
      total_df: parseNum(r['totaldf'] || r['total_df']),
      total_recargo: parseNum(r['totalrecargo'] || r['total_recargo']),
      total_iva_linhas: parseNum(r['totalivalinhas'] || r['total_iva_linhas']),
      familia: r['familia'] || null,
      subfamilia: r['subfamilia'] || null,
      entidade_entrega: r['entidadeentrega'] || r['entidade_entrega'] || null,
      nome_entrega: r['nomeentrega'] || r['nome_entrega'] || null,
      localidade_entrega: r['localidadeentrega'] || r['localidade_entrega'] || null,
      morada_entrega: r['moradaentrega'] || r['morada_entrega'] || null,
      cod_postal_entrega: r['codpostalentrega'] || r['cod_postal_entrega'] || null,
      cod_postal_localidade_entrega: r['codpostallocalidadeentrega'] || r['cod_postal_localidade_entrega'] || null,
      artigo: r['artigo'] || null,
      desc_pag: parseNum(r['descpag'] || r['desc_pag']),
    });
  }

  return rows;
}

export function parseCsvTextToSaidas(text: string): PlatSaidaRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  let delimiter = ';';
  if (lines[0].includes(';')) delimiter = ';';
  else if (lines[0].includes('\t')) delimiter = '\t';
  else if (lines[0].includes(',')) delimiter = ',';
  const header = lines[0].split(delimiter).map(c => normalizeHeader(c));
  const rows: PlatSaidaRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter);
    const r: Record<string, string> = {};
    header.forEach((h, idx) => {
      r[h] = cols[idx] !== undefined ? cols[idx].trim() : '';
    });

    const devolucaoVal = r['devolucao'];
    const devolucao = devolucaoVal === '1' || devolucaoVal?.toLowerCase() === 'true';

    rows.push({
      data: parseDate(r['data']),
      entidade: r['entidade'] || null,
      tipo_doc: r['tipodoc'] || r['tipo_doc'] || null,
      num_doc: parseNum(r['numdoc'] || r['num_doc']),
      total_merc: parseNum(r['totalmerc'] || r['total_merc']),
      total_iva: parseNum(r['totaliva'] || r['total_iva']),
      total_desc: parseNum(r['totaldesc'] || r['total_desc']),
      total_outros: parseNum(r['totaloutros'] || r['total_outros']),
      serie: r['serie'] || null,
      morada: r['morada'] || null,
      nome: r['nome'] || null,
      localidade: r['localidade'] || null,
      cod_postal: r['codpostal'] || r['cod_postal'] || null,
      cod_postal_localidade: r['codpostallocalidade'] || r['cod_postal_localidade'] || null,
      entidade_entrega: r['entidadeentrega'] || r['entidade_entrega'] || null,
      morada_entrega: r['moradaentrega'] || r['morada_entrega'] || null,
      nome_entrega: r['nomeentrega'] || r['nome_entrega'] || null,
      localidade_entrega: r['localidadeentrega'] || r['localidade_entrega'] || null,
      cod_postal_entrega: r['codpostalentrega'] || r['cod_postal_entrega'] || null,
      cod_postal_localidade_entrega: r['codpostallocalidadeentrega'] || r['cod_postal_localidade_entrega'] || null,
      num_linha: parseNum(r['numlinha'] || r['num_linha']),
      artigo: r['artigo'] || null,
      desconto1: parseNum(r['desconto1']),
      desconto2: parseNum(r['desconto2']),
      desconto3: parseNum(r['desconto3']),
      taxa_iva: parseNum(r['taxaiva'] || r['taxa_iva']),
      quantidade: parseNum(r['quantidade']),
      cod_iva: r['codiva'] || r['cod_iva'] || null,
      prec_unit: parseNum(r['precunit'] || r['prec_unit']),
      armazem: r['armazem'] || null,
      desconto_comercial: parseNum(r['descontocomercial'] || r['desconto_comercial']),
      lote: r['lote'] || null,
      descricao: r['descricao'] || null,
      devolucao,
      total_da: parseNum(r['totalda'] || r['total_da']),
      total_dc: parseNum(r['totaldc'] || r['total_dc']),
      total_iliquido: parseNum(r['totaliliquido'] || r['total_iliquido']),
      total_df: parseNum(r['totaldf'] || r['total_df']),
      total_recargo: parseNum(r['totalrecargo'] || r['total_recargo']),
      total_iva_linhas: parseNum(r['totalivalinhas'] || r['total_iva_linhas']),
      id_linha: r['id'] || r['id_linha'] || null,
      id_cabec_doc: r['idcabecdoc'] || r['id_cabec_doc'] || null,
      familia: r['familia'] || null,
      subfamilia: r['subfamilia'] || null,
      pcm: parseNum(r['pcm']),
      desc_pag: parseNum(r['descpag'] || r['desc_pag']),
    });
  }

  return rows;
}

export async function parseExcelToEntradas(arrayBuffer: ArrayBuffer): Promise<PlatEntradaRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers: string[] = [];
  const rows: PlatEntradaRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = normalizeHeader(cell.text || String(cell.value || ''));
      });
    } else {
      const r: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const h = headers[colNumber];
        if (h) r[h] = cell.value;
      });

      const isEmpty = Object.values(r).every(v => v === null || v === undefined || v === '');
      if (isEmpty) return;

      rows.push({
        serie: r['serie'] ? String(r['serie']).trim() : null,
        tipo_doc: r['tipodoc'] || r['tipo_doc'] ? String(r['tipodoc'] || r['tipo_doc']).trim() : null,
        num_doc: parseNum(r['numdoc'] || r['num_doc']),
        entidade: r['entidade'] ? String(r['entidade']).trim() : null,
        data: parseDate(r['data']),
        num_doc_externo: r['numdocexterno'] || r['num_doc_externo'] ? String(r['numdocexterno'] || r['num_doc_externo']).trim() : null,
        total_merc: parseNum(r['totalmerc'] || r['total_merc']),
        total_iva: parseNum(r['totaliva'] || r['total_iva']),
        total_desc: parseNum(r['totaldesc'] || r['total_desc']),
        total_outros: parseNum(r['totaloutros'] || r['total_outros']),
        requisicao: r['requisicao'] ? String(r['requisicao']).trim() : null,
        num_contribuinte: r['numcontribuinte'] || r['num_contribuinte'] ? String(r['numcontribuinte'] || r['num_contribuinte']).trim() : null,
        localidade: r['localidade'] ? String(r['localidade']).trim() : null,
        morada: r['morada'] ? String(r['morada']).trim() : null,
        nome: r['nome'] ? String(r['nome']).trim() : null,
        cod_postal: r['codpostal'] || r['cod_postal'] ? String(r['codpostal'] || r['cod_postal']).trim() : null,
        cod_postal_localidade: r['codpostallocalidade'] || r['cod_postal_localidade'] ? String(r['codpostallocalidade'] || r['cod_postal_localidade']).trim() : null,
        id_linha: r['id'] || r['id_linha'] ? String(r['id'] || r['id_linha']).trim() : null,
        id_cabec_compras: r['idcabeccompras'] || r['id_cabec_compras'] ? String(r['idcabeccompras'] || r['id_cabec_compras']).trim() : null,
        referencia: r['referencia'] ? String(r['referencia']).trim() : null,
        num_linha: parseNum(r['numlinha'] || r['num_linha']),
        desconto1: parseNum(r['desconto1']),
        desconto2: parseNum(r['desconto2']),
        desconto3: parseNum(r['desconto3']),
        taxa_iva: parseNum(r['taxaiva'] || r['taxa_iva']),
        quantidade: parseNum(r['quantidade']),
        cod_iva: r['codiva'] || r['cod_iva'] ? String(r['codiva'] || r['cod_iva']).trim() : null,
        prec_unit: parseNum(r['precunit'] || r['prec_unit']),
        armazem: r['armazem'] ? String(r['armazem']).trim() : null,
        lote: r['lote'] ? String(r['lote']).trim() : null,
        descricao: r['descricao'] ? String(r['descricao']).trim() : null,
        total_iliquido: parseNum(r['totaliliquido'] || r['total_iliquido']),
        total_da: parseNum(r['totalda'] || r['total_da']),
        total_dc: parseNum(r['totaldc'] || r['total_dc']),
        total_df: parseNum(r['totaldf'] || r['total_df']),
        total_recargo: parseNum(r['totalrecargo'] || r['total_recargo']),
        total_iva_linhas: parseNum(r['totalivalinhas'] || r['total_iva_linhas']),
        familia: r['familia'] ? String(r['familia']).trim() : null,
        subfamilia: r['subfamilia'] ? String(r['subfamilia']).trim() : null,
        entidade_entrega: r['entidadeentrega'] || r['entidade_entrega'] ? String(r['entidadeentrega'] || r['entidade_entrega']).trim() : null,
        nome_entrega: r['nomeentrega'] || r['nome_entrega'] ? String(r['nomeentrega'] || r['nome_entrega']).trim() : null,
        localidade_entrega: r['localidadeentrega'] || r['localidade_entrega'] ? String(r['localidadeentrega'] || r['localidade_entrega']).trim() : null,
        morada_entrega: r['moradaentrega'] || r['morada_entrega'] ? String(r['moradaentrega'] || r['morada_entrega']).trim() : null,
        cod_postal_entrega: r['codpostalentrega'] || r['cod_postal_entrega'] ? String(r['codpostalentrega'] || r['cod_postal_entrega']).trim() : null,
        cod_postal_localidade_entrega: r['codpostallocalidadeentrega'] || r['cod_postal_localidade_entrega'] ? String(r['codpostallocalidadeentrega'] || r['cod_postal_localidade_entrega']).trim() : null,
        artigo: r['artigo'] ? String(r['artigo']).trim() : null,
        desc_pag: parseNum(r['descpag'] || r['desc_pag']),
      });
    }
  });

  return rows;
}

export async function parseExcelToSaidas(arrayBuffer: ArrayBuffer): Promise<PlatSaidaRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers: string[] = [];
  const rows: PlatSaidaRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = normalizeHeader(cell.text || String(cell.value || ''));
      });
    } else {
      const r: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const h = headers[colNumber];
        if (h) r[h] = cell.value;
      });

      const isEmpty = Object.values(r).every(v => v === null || v === undefined || v === '');
      if (isEmpty) return;

      const devVal = r['devolucao'];
      const devolucao = devVal === '1' || devVal === 1 || String(devVal).toLowerCase() === 'true';

      rows.push({
        data: parseDate(r['data']),
        entidade: r['entidade'] ? String(r['entidade']).trim() : null,
        tipo_doc: r['tipodoc'] || r['tipo_doc'] ? String(r['tipodoc'] || r['tipo_doc']).trim() : null,
        num_doc: parseNum(r['numdoc'] || r['num_doc']),
        total_merc: parseNum(r['totalmerc'] || r['total_merc']),
        total_iva: parseNum(r['totaliva'] || r['total_iva']),
        total_desc: parseNum(r['totaldesc'] || r['total_desc']),
        total_outros: parseNum(r['totaloutros'] || r['total_outros']),
        serie: r['serie'] ? String(r['serie']).trim() : null,
        morada: r['morada'] ? String(r['morada']).trim() : null,
        nome: r['nome'] ? String(r['nome']).trim() : null,
        localidade: r['localidade'] ? String(r['localidade']).trim() : null,
        cod_postal: r['codpostal'] || r['cod_postal'] ? String(r['codpostal'] || r['cod_postal']).trim() : null,
        cod_postal_localidade: r['codpostallocalidade'] || r['cod_postal_localidade'] ? String(r['codpostallocalidade'] || r['cod_postal_localidade']).trim() : null,
        entidade_entrega: r['entidadeentrega'] || r['entidade_entrega'] ? String(r['entidadeentrega'] || r['entidade_entrega']).trim() : null,
        morada_entrega: r['moradaentrega'] || r['morada_entrega'] ? String(r['moradaentrega'] || r['morada_entrega']).trim() : null,
        nome_entrega: r['nomeentrega'] || r['nome_entrega'] ? String(r['nomeentrega'] || r['nome_entrega']).trim() : null,
        localidade_entrega: r['localidadeentrega'] || r['localidade_entrega'] ? String(r['localidadeentrega'] || r['localidade_entrega']).trim() : null,
        cod_postal_entrega: r['codpostalentrega'] || r['cod_postal_entrega'] ? String(r['codpostalentrega'] || r['cod_postal_entrega']).trim() : null,
        cod_postal_localidade_entrega: r['codpostallocalidadeentrega'] || r['cod_postal_localidade_entrega'] ? String(r['codpostallocalidadeentrega'] || r['cod_postal_localidade_entrega']).trim() : null,
        num_linha: parseNum(r['numlinha'] || r['num_linha']),
        artigo: r['artigo'] ? String(r['artigo']).trim() : null,
        desconto1: parseNum(r['desconto1']),
        desconto2: parseNum(r['desconto2']),
        desconto3: parseNum(r['desconto3']),
        taxa_iva: parseNum(r['taxaiva'] || r['taxa_iva']),
        quantidade: parseNum(r['quantidade']),
        cod_iva: r['codiva'] || r['cod_iva'] ? String(r['codiva'] || r['cod_iva']).trim() : null,
        prec_unit: parseNum(r['precunit'] || r['prec_unit']),
        armazem: r['armazem'] ? String(r['armazem']).trim() : null,
        desconto_comercial: parseNum(r['descontocomercial'] || r['desconto_comercial']),
        lote: r['lote'] ? String(r['lote']).trim() : null,
        descricao: r['descricao'] ? String(r['descricao']).trim() : null,
        devolucao,
        total_da: parseNum(r['totalda'] || r['total_da']),
        total_dc: parseNum(r['totaldc'] || r['total_dc']),
        total_iliquido: parseNum(r['totaliliquido'] || r['total_iliquido']),
        total_df: parseNum(r['totaldf'] || r['total_df']),
        total_recargo: parseNum(r['totalrecargo'] || r['total_recargo']),
        total_iva_linhas: parseNum(r['totalivalinhas'] || r['total_iva_linhas']),
        id_linha: r['id'] || r['id_linha'] ? String(r['id'] || r['id_linha']).trim() : null,
        id_cabec_doc: r['idcabecdoc'] || r['id_cabec_doc'] ? String(r['idcabecdoc'] || r['id_cabec_doc']).trim() : null,
        familia: r['familia'] ? String(r['familia']).trim() : null,
        subfamilia: r['subfamilia'] ? String(r['subfamilia']).trim() : null,
        pcm: parseNum(r['pcm']),
        desc_pag: parseNum(r['descpag'] || r['desc_pag']),
      });
    }
  });

  return rows;
}

/**
 * Função universal que deteta se é Excel (.xlsx, .xls) ou Texto/CSV (.txt, .csv) e devolve as linhas de Entradas
 */
export async function parseEntradasFile(file: File): Promise<PlatEntradaRow[]> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const buffer = await file.arrayBuffer();
      return await parseExcelToEntradas(buffer);
    } else {
      const text = await file.text();
      return parseCsvTextToEntradas(text);
    }
  } catch (err: unknown) {
    if (name.endsWith('.xls')) {
      throw new Error('O ficheiro está em formato .xls (Excel antigo). Por favor abra-o no Excel e guarde como .xlsx ou .csv antes de importar.');
    }
    const msg = err instanceof Error ? err.message : 'Erro ao processar ficheiro';
    throw new Error(`Falha ao ler ficheiro de entradas: ${msg}`);
  }
}

/**
 * Função universal que deteta se é Excel (.xlsx, .xls) ou Texto/CSV (.txt, .csv) e devolve as linhas de Saídas
 */
export async function parseSaidasFile(file: File): Promise<PlatSaidaRow[]> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const buffer = await file.arrayBuffer();
      return await parseExcelToSaidas(buffer);
    } else {
      const text = await file.text();
      return parseCsvTextToSaidas(text);
    }
  } catch (err: unknown) {
    if (name.endsWith('.xls')) {
      throw new Error('O ficheiro está em formato .xls (Excel antigo). Por favor abra-o no Excel e guarde como .xlsx ou .csv antes de importar.');
    }
    const msg = err instanceof Error ? err.message : 'Erro ao processar ficheiro';
    throw new Error(`Falha ao ler ficheiro de saídas: ${msg}`);
  }
}

export interface PlatMovimentoRow {
  id?: number;
  cliente_id?: string | null;
  sigla_cliente?: string | null;
  num_linha?: number | null;
  data?: string | null;
  documento?: string | null;
  chave1?: string | null;
  chave2?: string | null;
  ativa?: boolean | null;
  valor_unitario?: number | null;
  valor_adicional?: number | null;
  valor_abater?: number | null;
  artigo?: string | null;
  descricao?: string | null;
  tipo_artigo?: string | null;
  armazem?: string | null;
  localizacao?: string | null;
  lote?: string | null;
  validade?: string | null;
  datafabrico?: string | null;
  tipo_movimento?: string | null;
  quantidade?: number | null;
  familia?: string | null;
  sub_familia?: string | null;
  created_at?: string;
}

export function parseCsvTextToPlatMovimentos(text: string): PlatMovimentoRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  let delimiter = ';';
  if (lines[0].includes(';')) delimiter = ';';
  else if (lines[0].includes('\t')) delimiter = '\t';
  else if (lines[0].includes(',')) delimiter = ',';
  const header = lines[0].split(delimiter).map(c => normalizeHeader(c));
  const rows: PlatMovimentoRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter);
    const r: Record<string, string> = {};
    header.forEach((h, idx) => {
      r[h] = cols[idx] !== undefined ? cols[idx].trim() : '';
    });

    const ativaVal = (r['ativa'] || '').toLowerCase();
    const ativa = ativaVal === 'verdadeiro' || ativaVal === 'true' || ativaVal === '1';

    rows.push({
      num_linha: parseNum(r['numlinha'] || r['num_linha']),
      data: parseDate(r['data']),
      documento: r['documento'] || null,
      chave1: r['chave1'] || null,
      chave2: r['chave2'] || null,
      ativa,
      valor_unitario: parseNum(r['valorunitario'] || r['valor_unitario']),
      valor_adicional: parseNum(r['valoradicional'] || r['valor_adicional']),
      valor_abater: parseNum(r['valorabater'] || r['valor_abater']),
      artigo: r['artigo'] || null,
      descricao: r['descricao'] || null,
      tipo_artigo: r['tipoartigo'] || r['tipo_artigo'] || null,
      armazem: r['armazem'] || null,
      localizacao: r['localizacao'] || null,
      lote: r['lote'] || null,
      validade: parseDate(r['validade']),
      datafabrico: parseDate(r['datafabrico'] || r['data_fabrico']),
      tipo_movimento: r['tipomovimento'] || r['tipo_movimento'] || null,
      quantidade: parseNum(r['quantidade']),
      familia: r['familia'] || null,
      sub_familia: r['subfamilia'] || r['sub_familia'] || null,
    });
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
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = normalizeHeader(cell.text || String(cell.value || ''));
      });
    } else {
      const r: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const h = headers[colNumber];
        if (h) r[h] = cell.value;
      });

      const isEmpty = Object.values(r).every(v => v === null || v === undefined || v === '');
      if (isEmpty) return;

      const ativaVal = String(r['ativa'] || '').toLowerCase();
      const ativa = ativaVal === 'verdadeiro' || ativaVal === 'true' || ativaVal === '1' || r['ativa'] === true || r['ativa'] === 1;

      rows.push({
        num_linha: parseNum(r['numlinha'] || r['num_linha']),
        data: parseDate(r['data']),
        documento: r['documento'] ? String(r['documento']).trim() : null,
        chave1: r['chave1'] ? String(r['chave1']).trim() : null,
        chave2: r['chave2'] ? String(r['chave2']).trim() : null,
        ativa,
        valor_unitario: parseNum(r['valorunitario'] || r['valor_unitario']),
        valor_adicional: parseNum(r['valoradicional'] || r['valor_adicional']),
        valor_abater: parseNum(r['valorabater'] || r['valor_abater']),
        artigo: r['artigo'] ? String(r['artigo']).trim() : null,
        descricao: r['descricao'] ? String(r['descricao']).trim() : null,
        tipo_artigo: r['tipoartigo'] || r['tipo_artigo'] ? String(r['tipoartigo'] || r['tipo_artigo']).trim() : null,
        armazem: r['armazem'] ? String(r['armazem']).trim() : null,
        localizacao: r['localizacao'] ? String(r['localizacao']).trim() : null,
        lote: r['lote'] ? String(r['lote']).trim() : null,
        validade: parseDate(r['validade']),
        datafabrico: parseDate(r['datafabrico'] || r['data_fabrico']),
        tipo_movimento: r['tipomovimento'] || r['tipo_movimento'] ? String(r['tipomovimento'] || r['tipo_movimento']).trim() : null,
        quantidade: parseNum(r['quantidade']),
        familia: r['familia'] ? String(r['familia']).trim() : null,
        sub_familia: r['subfamilia'] || r['sub_familia'] ? String(r['subfamilia'] || r['sub_familia']).trim() : null,
      });
    }
  });

  return rows;
}

export async function parsePlatMovimentosFile(file: File): Promise<PlatMovimentoRow[]> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const buffer = await file.arrayBuffer();
      return await parseExcelToPlatMovimentos(buffer);
    } else {
      const text = await file.text();
      return parseCsvTextToPlatMovimentos(text);
    }
  } catch (err: unknown) {
    if (name.endsWith('.xls')) {
      throw new Error('O ficheiro está em formato .xls (Excel antigo). Por favor abra-o no Excel e guarde como .xlsx ou .csv antes de importar.');
    }
    const msg = err instanceof Error ? err.message : 'Erro ao processar ficheiro';
    throw new Error(`Falha ao ler ficheiro de movimentos ERP: ${msg}`);
  }
}

