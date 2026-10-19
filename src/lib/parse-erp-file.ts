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

function parseBool(v: any, defaultVal = false): boolean {
  if (v === undefined || v === null || v === '') return defaultVal;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  const s = String(v).trim().toLowerCase();
  if (s === 'verdadeiro' || s === 'true' || s === '1' || s === 'sim' || s === 'v' || s === 't') return true;
  if (s === 'falso' || s === 'false' || s === '0' || s === 'nao' || s === 'f') return false;
  return defaultVal;
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
  sigla?: string | null;
  sigla_cliente?: string | null;
  data?: string | null;
  data_movimento?: string | null;
  tipo_movimento?: string | null;
  documento?: string | null;
  documento_ref?: string | null;
  tipo_doc?: string | null;
  num_linha?: number | null;
  doc_linha?: string | null;
  num_registo?: number | null;
  chave1?: string | null;
  chave2?: string | null;
  valor_unitario?: number | null;
  valor_adicional?: number | null;
  valor_abater?: number | null;
  artigo?: string | null;
  descricao?: string | null;
  tipo_artigo?: string | null;
  armazem?: string | null;
  localizacao?: string | null;
  lote?: string | null;
  estado_stock?: string | null;
  quantidade?: number | null;
  familia?: string | null;
  sub_familia?: string | null;
  num_chave1?: number | null;
  num_chave2?: number | null;
  datafabrico?: string | null;
  validade?: string | null;
  sistema?: boolean | null;
  entidade?: string | null;
  total_iva?: number | null;
  total_merc?: number | null;
  total_outros?: number | null;
  total_desc?: number | null;
  requisicao?: string | null;
  num_contribuinte?: string | null;
  morada?: string | null;
  nome?: string | null;
  localidade?: string | null;
  cod_postal?: string | null;
  cod_postal_localidade?: string | null;
  pais?: string | null;
  nome_entrega?: string | null;
  morada_entrega?: string | null;
  cod_postal_entrega?: string | null;
  cod_postal_localidade_entrega?: string | null;
  entidade_entrega?: string | null;
  ativa?: boolean | null;
  chave_ativa?: boolean | null;
  created_at?: string;
}

function parseTipoMov(val: unknown): string | null {
  if (!val) return null;
  const up = String(val).trim().toUpperCase();
  if (up === 'E' || up === 'ES') return 'es';
  if (up === 'S' || up === 'SS') return 'ss';
  if (up === 'ET') return 'et';
  if (up === 'ST') return 'st';
  return String(val).trim().toLowerCase();
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

    const dataMov = parseDate(r['data_movimento'] || r['datamovimento'] || r['data']);
    const dataOnly = parseDateOnly(r['data'] || r['data_movimento'] || r['datamovimento']);

    rows.push({
      data: dataOnly,
      data_movimento: dataMov,
      sigla: r['sigla'] ? String(r['sigla']).trim() : null,
      tipo_movimento: parseTipoMov(r['tipomovimento'] || r['tipo_movimento']),
      documento: r['documento'] ? String(r['documento']).trim() : null,
      documento_ref: r['documentoref'] || r['documento_ref']
        ? String(r['documentoref'] || r['documento_ref']).trim()
        : (r['documento'] ? String(r['documento']).trim() : null),
      tipo_doc: r['tipodoc'] || r['tipo_doc'] ? String(r['tipodoc'] || r['tipo_doc']).trim() : null,
      num_linha: parseNum(r['numlinha'] || r['num_linha']),
      doc_linha: r['doclinha'] || r['doc_linha'] ? String(r['doclinha'] || r['doc_linha']).trim() : null,
      num_registo: parseNum(r['numregisto'] || r['num_registo']),
      chave1: r['chave1'] ? String(r['chave1']).trim() : null,
      chave2: r['chave2'] ? String(r['chave2']).trim() : null,
      valor_unitario: parseNum(r['valorunitario'] || r['valor_unitario']),
      valor_adicional: parseNum(r['valoradicional'] || r['valor_adicional']),
      valor_abater: parseNum(r['valorabater'] || r['valor_abater']),
      artigo: r['artigo'] ? String(r['artigo']).trim() : null,
      descricao: r['descricao'] ? String(r['descricao']).trim() : null,
      tipo_artigo: r['tipoartigo'] || r['tipo_artigo'] ? String(r['tipoartigo'] || r['tipo_artigo']).trim() : null,
      armazem: r['armazem'] ? String(r['armazem']).trim() : null,
      localizacao: r['localizacao'] ? String(r['localizacao']).trim() : null,
      lote: r['lote'] ? String(r['lote']).trim() : null,
      estado_stock: r['estadostock'] || r['estado_stock'] ? String(r['estadostock'] || r['estado_stock']).trim() : null,
      quantidade: parseNum(r['quantidade']),
      familia: r['familia'] ? String(r['familia']).trim() : null,
      sub_familia: r['subfamilia'] || r['sub_familia'] ? String(r['subfamilia'] || r['sub_familia']).trim() : null,
      num_chave1: parseNum(r['numchave1'] || r['num_chave1']),
      num_chave2: parseNum(r['numchave2'] || r['num_chave2']),
      datafabrico: parseDataFabrico(r['datafabrico'] || r['data_fabrico']),
      validade: parseDateOnly(r['validade']),
      sistema: parseBool(r['sistema'], false),
      entidade: r['entidade'] ? String(r['entidade']).trim() : null,
      total_iva: parseNum(r['totaliva'] || r['total_iva']),
      total_merc: parseNum(r['totalmerc'] || r['total_merc']),
      total_outros: parseNum(r['totaloutros'] || r['total_outros']),
      total_desc: parseNum(r['totaldesc'] || r['total_desc']),
      requisicao: r['requisicao'] ? String(r['requisicao']).trim() : null,
      num_contribuinte: r['numcontribuinte'] || r['num_contribuinte'] ? String(r['numcontribuinte'] || r['num_contribuinte']).trim() : null,
      morada: r['morada'] ? String(r['morada']).trim() : null,
      nome: r['nome'] ? String(r['nome']).trim() : null,
      localidade: r['localidade'] ? String(r['localidade']).trim() : null,
      cod_postal: r['codpostal'] || r['cod_postal'] ? String(r['codpostal'] || r['cod_postal']).trim() : null,
      cod_postal_localidade: r['codpostallocalidade'] || r['cod_postal_localidade'] ? String(r['codpostallocalidade'] || r['cod_postal_localidade']).trim() : null,
      pais: r['pais'] ? String(r['pais']).trim() : null,
      nome_entrega: r['nomeentrega'] || r['nome_entrega'] ? String(r['nomeentrega'] || r['nome_entrega']).trim() : null,
      morada_entrega: r['moradaentrega'] || r['morada_entrega'] ? String(r['moradaentrega'] || r['morada_entrega']).trim() : null,
      cod_postal_entrega: r['codpostalentrega'] || r['cod_postal_entrega'] ? String(r['codpostalentrega'] || r['cod_postal_entrega']).trim() : null,
      cod_postal_localidade_entrega: r['codpostallocalidadeentrega'] || r['cod_postal_localidade_entrega'] ? String(r['codpostallocalidadeentrega'] || r['cod_postal_localidade_entrega']).trim() : null,
      entidade_entrega: r['entidadeentrega'] || r['entidade_entrega'] ? String(r['entidadeentrega'] || r['entidade_entrega']).trim() : null,
      ativa: parseBool(r['ativa'], true),
      chave_ativa: parseBool(r['chaveativa'] || r['chave_ativa'], true),
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

      const dataMov = parseDate(r['data_movimento'] || r['datamovimento'] || r['data']);
      const dataOnly = parseDateOnly(r['data'] || r['data_movimento'] || r['datamovimento']);

      rows.push({
        data: dataOnly,
        data_movimento: dataMov,
        sigla: r['sigla'] ? String(r['sigla']).trim() : null,
        tipo_movimento: parseTipoMov(r['tipomovimento'] || r['tipo_movimento']),
        documento: r['documento'] ? String(r['documento']).trim() : null,
        documento_ref: r['documentoref'] || r['documento_ref']
          ? String(r['documentoref'] || r['documento_ref']).trim()
          : (r['documento'] ? String(r['documento']).trim() : null),
        tipo_doc: r['tipodoc'] || r['tipo_doc'] ? String(r['tipodoc'] || r['tipo_doc']).trim() : null,
        num_linha: parseNum(r['numlinha'] || r['num_linha']),
        doc_linha: r['doclinha'] || r['doc_linha'] ? String(r['doclinha'] || r['doc_linha']).trim() : null,
        num_registo: parseNum(r['numregisto'] || r['num_registo']),
        chave1: r['chave1'] ? String(r['chave1']).trim() : null,
        chave2: r['chave2'] ? String(r['chave2']).trim() : null,
        valor_unitario: parseNum(r['valorunitario'] || r['valor_unitario']),
        valor_adicional: parseNum(r['valoradicional'] || r['valor_adicional']),
        valor_abater: parseNum(r['valorabater'] || r['valor_abater']),
        artigo: r['artigo'] ? String(r['artigo']).trim() : null,
        descricao: r['descricao'] ? String(r['descricao']).trim() : null,
        tipo_artigo: r['tipoartigo'] || r['tipo_artigo'] ? String(r['tipoartigo'] || r['tipo_artigo']).trim() : null,
        armazem: r['armazem'] ? String(r['armazem']).trim() : null,
        localizacao: r['localizacao'] ? String(r['localizacao']).trim() : null,
        lote: r['lote'] ? String(r['lote']).trim() : null,
        estado_stock: r['estadostock'] || r['estado_stock'] ? String(r['estadostock'] || r['estado_stock']).trim() : null,
        quantidade: parseNum(r['quantidade']),
        familia: r['familia'] ? String(r['familia']).trim() : null,
        sub_familia: r['subfamilia'] || r['sub_familia'] ? String(r['subfamilia'] || r['sub_familia']).trim() : null,
        num_chave1: parseNum(r['numchave1'] || r['num_chave1']),
        num_chave2: parseNum(r['numchave2'] || r['num_chave2']),
        datafabrico: parseDataFabrico(r['datafabrico'] || r['data_fabrico']),
        validade: parseDateOnly(r['validade']),
        sistema: parseBool(r['sistema'], false),
        entidade: r['entidade'] ? String(r['entidade']).trim() : null,
        total_iva: parseNum(r['totaliva'] || r['total_iva']),
        total_merc: parseNum(r['totalmerc'] || r['total_merc']),
        total_outros: parseNum(r['totaloutros'] || r['total_outros']),
        total_desc: parseNum(r['totaldesc'] || r['total_desc']),
        requisicao: r['requisicao'] ? String(r['requisicao']).trim() : null,
        num_contribuinte: r['numcontribuinte'] || r['num_contribuinte'] ? String(r['numcontribuinte'] || r['num_contribuinte']).trim() : null,
        morada: r['morada'] ? String(r['morada']).trim() : null,
        nome: r['nome'] ? String(r['nome']).trim() : null,
        localidade: r['localidade'] ? String(r['localidade']).trim() : null,
        cod_postal: r['codpostal'] || r['cod_postal'] ? String(r['codpostal'] || r['cod_postal']).trim() : null,
        cod_postal_localidade: r['codpostallocalidade'] || r['cod_postal_localidade'] ? String(r['codpostallocalidade'] || r['cod_postal_localidade']).trim() : null,
        pais: r['pais'] ? String(r['pais']).trim() : null,
        nome_entrega: r['nomeentrega'] || r['nome_entrega'] ? String(r['nomeentrega'] || r['nome_entrega']).trim() : null,
        morada_entrega: r['moradaentrega'] || r['morada_entrega'] ? String(r['moradaentrega'] || r['morada_entrega']).trim() : null,
        cod_postal_entrega: r['codpostalentrega'] || r['cod_postal_entrega'] ? String(r['codpostalentrega'] || r['cod_postal_entrega']).trim() : null,
        cod_postal_localidade_entrega: r['codpostallocalidadeentrega'] || r['cod_postal_localidade_entrega'] ? String(r['codpostallocalidadeentrega'] || r['cod_postal_localidade_entrega']).trim() : null,
        entidade_entrega: r['entidadeentrega'] || r['entidade_entrega'] ? String(r['entidadeentrega'] || r['entidade_entrega']).trim() : null,
        ativa: parseBool(r['ativa'], true),
        chave_ativa: parseBool(r['chaveativa'] || r['chave_ativa'], true),
      });
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
      const text = await file.text();
      return parseCsvTextToPlatMovimentos(text);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao processar ficheiro';
    throw new Error(`Falha ao ler ficheiro de movimentos ERP: ${msg}`);
  }
}

export const PLAT_MOVIMENTOS_ERP_HEADERS = [
  'data_movimento',
  'sigla',
  'tipo_movimento',
  'documento',
  'documento-ref',
  'tipo_doc',
  'num_linha',
  'doc_linha',
  'Chave1',
  'Chave2',
  'valor_unitario',
  'valor_adicional',
  'valor_abater',
  'artigo',
  'descricao',
  'tipo_artigo',
  'armazem',
  'localizacao',
  'lote',
  'quantidade',
  'familia',
  'sub_familia',
  'datafabrico',
  'validade',
  'entidade',
  'total_iva',
  'total_merc',
  'total_outros',
  'total_desc',
  'requisicao',
  'num_contribuinte',
  'morada',
  'nome',
  'localidade',
  'cod_Postal',
  'cod_postal_localidade',
  'pais',
  'nome_entrega',
  'morada_entrega',
  'cod_postal_entrega',
  'cod_postal_localidade_entrega',
  'entidade_entrega',
] as const;

export const PLAT_MOVIMENTOS_SAMPLE_DATA: Record<string, any>[] = [
  {
    data_movimento: '03/09/2026',
    sigla: 'MAX',
    tipo_movimento: 'ES',
    documento: 'ES 26MAX/2',
    'documento-ref': 'MAX-ES 26MAX/2',
    tipo_doc: '',
    num_linha: 2,
    doc_linha: 'MAX-ES 26MAX/2-2',
    Chave1: 'ES',
    Chave2: '26MAX',
    valor_unitario: '0',
    valor_adicional: '0',
    valor_abater: '0',
    artigo: '7774273',
    descricao: 'AUDIOVIT PLUS 60 CAPS.',
    tipo_artigo: '84',
    armazem: 'MAX01',
    localizacao: 'MAX01.22B21',
    lote: 'Z701',
    quantidade: 9,
    familia: 'MED',
    sub_familia: 'SER',
    datafabrico: '01/01/1980',
    validade: '31/03/2029',
    entidade: '',
    total_iva: '',
    total_merc: '',
    total_outros: '',
    total_desc: '',
    requisicao: '',
    num_contribuinte: '',
    morada: '',
    nome: '',
    localidade: '',
    cod_Postal: '',
    cod_postal_localidade: '',
    pais: '',
    nome_entrega: '',
    morada_entrega: '',
    cod_postal_entrega: '',
    cod_postal_localidade_entrega: '',
    entidade_entrega: '',
  },
  {
    data_movimento: '17/09/2026',
    sigla: 'MAX',
    tipo_movimento: 'SS',
    documento: 'FA 26MAX/144',
    'documento-ref': 'MAX-FA 26MAX/144',
    tipo_doc: 'FA',
    num_linha: 2,
    doc_linha: 'MAX-FA 26MAX/144-2',
    Chave1: 'FA',
    Chave2: '26MAX',
    valor_unitario: '7,04',
    valor_adicional: '0',
    valor_abater: '0',
    artigo: '5755533',
    descricao: 'CETRAXAL DUO 10 ML GOTAS AUR. FRSC.',
    tipo_artigo: '80',
    armazem: 'MAX01',
    localizacao: 'MAX01.22C14',
    lote: '26037',
    quantidade: 200,
    familia: 'MED',
    sub_familia: 'SER',
    datafabrico: '',
    validade: '01/04/2028',
    entidade: '10012',
    total_iva: '128,45',
    total_merc: '2042,35',
    total_outros: '0',
    total_desc: '0',
    requisicao: 'M.CMPF260916.033',
    num_contribuinte: '500364877',
    morada: 'Rua do Barreiro nº235',
    nome: 'OCP Portugal-Prod. Farm. S.A.',
    localidade: 'Moreira - Maia',
    cod_Postal: '4470-573',
    cod_postal_localidade: 'Maia',
    pais: 'PT',
    nome_entrega: '',
    morada_entrega: 'Rua do Barreiro nº235',
    cod_postal_entrega: '4470-573',
    cod_postal_localidade_entrega: 'Maia',
    entidade_entrega: '10012',
  },
  {
    data_movimento: '15/09/2026',
    sigla: 'MAX',
    tipo_movimento: 'SS',
    documento: 'FA 26MAX/143',
    'documento-ref': 'MAX-FA 26MAX/143',
    tipo_doc: 'FA',
    num_linha: 6,
    doc_linha: 'MAX-FA 26MAX/143-6',
    Chave1: 'FA',
    Chave2: '26MAX',
    valor_unitario: '4,7',
    valor_adicional: '0',
    valor_abater: '0',
    artigo: '5868401',
    descricao: 'CRISTALMINA 10 MG/ML 25 ML SOL. P/ PULV. CUT. FRSC.',
    tipo_artigo: '80',
    armazem: 'MAX01',
    localizacao: 'MAX01.23A23',
    lote: 'V713',
    quantidade: 70,
    familia: 'MED',
    sub_familia: 'SER',
    datafabrico: '01/01/1980',
    validade: '01/05/2027',
    entidade: '10421',
    total_iva: '767,84',
    total_merc: '4994,48',
    total_outros: '0',
    total_desc: '178,68',
    requisicao: '939/1',
    num_contribuinte: '511029632',
    morada: 'RUA DAS HORTAS, 2-APARTADO 23 EC ZARCO',
    nome: 'CFARMA - CENTRO FARMACEUTICO DA MADEIRA, LDA',
    localidade: 'Funchal',
    cod_Postal: '9001-901',
    cod_postal_localidade: 'Funchal - Madeira',
    pais: 'PT',
    nome_entrega: '',
    morada_entrega: 'RUA DAS HORTAS, 2-APARTADO 23 EC ZARCO',
    cod_postal_entrega: '9001-901',
    cod_postal_localidade_entrega: 'Funchal - Madeira',
    entidade_entrega: '10421',
  },
  {
    data_movimento: '05/08/2026',
    sigla: 'MAX',
    tipo_movimento: 'SS',
    documento: 'FA 26MAX/14',
    'documento-ref': 'MAX-FA 26MAX/14',
    tipo_doc: 'FA',
    num_linha: 2,
    doc_linha: 'MAX-FA 26MAX/14-2',
    Chave1: 'FA',
    Chave2: '26MAX',
    valor_unitario: '11,6',
    valor_adicional: '0',
    valor_abater: '0',
    artigo: '6268128',
    descricao: 'HERPIX GRAN. P/ SOL. ORAL 8 SAQ.',
    tipo_artigo: '84',
    armazem: 'MAX01',
    localizacao: 'MAX01.22A21',
    lote: 'Z703',
    quantidade: 25,
    familia: 'MED',
    sub_familia: 'SER',
    datafabrico: '01/01/1980',
    validade: '30/04/2029',
    entidade: '10425',
    total_iva: '66,7',
    total_merc: '580',
    total_outros: '0',
    total_desc: '290',
    requisicao: 'LC310726/4',
    num_contribuinte: '506959490',
    morada: 'PRAÇA MACHADO DOS SANTOS, 24',
    nome: 'FPCA - FARMÁCIA, LDA',
    localidade: 'SETÚBAL',
    cod_Postal: '2900-178',
    cod_postal_localidade: 'SETÚBAL',
    pais: 'PT',
    nome_entrega: 'FARMÁCIA LUISA TODI',
    morada_entrega: 'PRAÇA MACHADO DOS SANTOS, 24',
    cod_postal_entrega: '2900-457',
    cod_postal_localidade_entrega: 'SETUBAL',
    entidade_entrega: '10425',
  },
  {
    data_movimento: '22/09/2026',
    sigla: 'MAX',
    tipo_movimento: 'ES',
    documento: 'VDV 26MAX/1',
    'documento-ref': 'MAX-VDV 26MAX/1',
    tipo_doc: 'VDV',
    num_linha: 1,
    doc_linha: 'MAX-VDV 26MAX/1-1',
    Chave1: 'VDV',
    Chave2: '26MAX',
    valor_unitario: '5,5',
    valor_adicional: '0',
    valor_abater: '9',
    artigo: '5596424',
    descricao: 'TEBARAT 0.125 MG/0.25 ML 30 UNID.',
    tipo_artigo: '80',
    armazem: 'MAX01',
    localizacao: 'MAX01',
    lote: 'X001',
    quantidade: 2,
    familia: 'MED',
    sub_familia: 'SER',
    datafabrico: '',
    validade: '01/09/2027',
    entidade: '10004',
    total_iva: '-0,66',
    total_merc: '-20',
    total_outros: '0',
    total_desc: '-9',
    requisicao: 'FA 26MAX/99',
    num_contribuinte: '500046921',
    morada: 'Rua Quinta dos Grilos nº 30',
    nome: 'Botelho  e Rodrigues, Lda',
    localidade: 'Carnaxide',
    cod_Postal: '2795-514',
    cod_postal_localidade: 'Carnaxide',
    pais: 'PT',
    nome_entrega: '',
    morada_entrega: 'Rua da Argila, 388',
    cod_postal_entrega: '4445-027',
    cod_postal_localidade_entrega: 'Valongo',
    entidade_entrega: '10004',
  },
];

/**
 * Gera um ficheiro CSV de exemplo/modelo para a tabela plat_movimentos com a estrutura exata do perfil ERP (42 campos).
 * O formato emitido corresponde 100% ao ficheiro modelo delimitado por ponto e vírgula (;).
 */
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

/**
 * Gera um ficheiro Excel (.xlsx) de exemplo/modelo para a tabela plat_movimentos com a estrutura exata do perfil ERP (42 campos formatados).
 */
export async function generatePlatMovimentosSampleExcel(): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Movimentos ERP');

  const columnWidths: Record<string, number> = {
    data_movimento: 16,
    sigla: 8,
    tipo_movimento: 14,
    documento: 18,
    'documento-ref': 22,
    tipo_doc: 10,
    num_linha: 10,
    doc_linha: 24,
    Chave1: 10,
    Chave2: 12,
    valor_unitario: 14,
    valor_adicional: 14,
    valor_abater: 14,
    artigo: 14,
    descricao: 45,
    tipo_artigo: 12,
    armazem: 12,
    localizacao: 16,
    lote: 14,
    quantidade: 12,
    familia: 10,
    sub_familia: 12,
    datafabrico: 14,
    validade: 14,
    entidade: 12,
    total_iva: 12,
    total_merc: 12,
    total_outros: 12,
    total_desc: 12,
    requisicao: 18,
    num_contribuinte: 16,
    morada: 40,
    nome: 40,
    localidade: 20,
    cod_Postal: 12,
    cod_postal_localidade: 22,
    pais: 8,
    nome_entrega: 30,
    morada_entrega: 40,
    cod_postal_entrega: 14,
    cod_postal_localidade_entrega: 24,
    entidade_entrega: 16,
  };

  worksheet.columns = PLAT_MOVIMENTOS_ERP_HEADERS.map((h) => ({
    header: h,
    key: h,
    width: columnWidths[h] || 16,
  }));

  // Estilo de cabeçalho com fundo Indigo e texto branco em negrito
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



