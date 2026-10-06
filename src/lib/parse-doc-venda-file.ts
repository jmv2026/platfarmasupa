import ExcelJS from 'exceljs';

export interface DocVendaImportInput {
  cliente_id?: string;
  sigla_cliente?: string;
  data?: string | null;
  serie?: string | null;
  entidade?: string | null;
  tipo_doc?: string | null;
  num_doc?: number | null;
  requisicao?: string | null;
  num_contribuinte?: string | null;
  nome?: string | null;
  morada?: string | null;
  localidade?: string | null;
  cod_postal?: string | null;
  cod_postal_localidade?: string | null;
  total_merc?: number | null;
  desc_pag?: number | null;
  total_iva?: number | null;
  total_desc?: number | null;
  total_outros?: number | null;
  num_linha?: number | null;
  artigo?: string | null;
  taxa_iva?: number | null;
  desconto1?: number | null;
  desconto2?: number | null;
  desconto3?: number | null;
  quantidade?: number | null;
  cod_iva?: string | null;
  armazem?: string | null;
  lote?: string | null;
  preco_liquido?: number | null;
  descricao?: string | null;
  devolucao?: boolean | null;
  total_da?: number | null;
  total_dc?: number | null;
  total_iliquido?: number | null;
  total_df?: number | null;
  total_iva_art?: number | null;
  pc_medio?: number | null;
  pc_ultimo?: number | null;
  pc_padrao?: number | null;
}

export function normalizeDocVendaHeaderKey(key: string): string {
  if (!key) return '';

  const clean = key
    .replace(/^\uFEFF/, '') // Remover UTF-8 BOM
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '');

  if (clean.includes('data')) return 'data';
  if (clean === 'serie') return 'serie';
  if (clean === 'entidade') return 'entidade';
  if (clean === 'tipodoc') return 'tipo_doc';
  if (clean === 'numdoc') return 'num_doc';
  if (clean === 'requisicao') return 'requisicao';
  if (clean.includes('contribuinte') || clean === 'nif') return 'num_contribuinte';
  if (clean === 'nome') return 'nome';
  if (clean === 'morada') return 'morada';
  if (clean === 'localidade') return 'localidade';
  if (clean === 'codpostal') return 'cod_postal';
  if (clean === 'codpostallocalidade') return 'cod_postal_localidade';
  if (clean === 'totalmerc') return 'total_merc';
  if (clean === 'descpag') return 'desc_pag';
  if (clean === 'totaliva') return 'total_iva';
  if (clean === 'totaldesc') return 'total_desc';
  if (clean === 'totaloutros') return 'total_outros';
  if (clean === 'numlinha') return 'num_linha';
  if (clean === 'artigo') return 'artigo';
  if (clean === 'taxaiva') return 'taxa_iva';
  if (clean === 'desconto1') return 'desconto1';
  if (clean === 'desconto2') return 'desconto2';
  if (clean === 'desconto3') return 'desconto3';
  if (clean === 'quantidade' || clean === 'qtd') return 'quantidade';
  if (clean === 'codiva') return 'cod_iva';
  if (clean === 'armazem') return 'armazem';
  if (clean === 'lote') return 'lote';
  if (clean === 'precoliquido') return 'preco_liquido';
  if (clean === 'descricao') return 'descricao';
  if (clean === 'devolucao') return 'devolucao';
  if (clean === 'totalda') return 'total_da';
  if (clean === 'totaldc') return 'total_dc';
  if (clean === 'totaliliquido') return 'total_iliquido';
  if (clean === 'totaldf') return 'total_df';
  if (clean === 'totalivaart' || clean === 'totaliva_art') return 'total_iva_art';
  if (clean === 'pcmedio') return 'pc_medio';
  if (clean === 'pcultimo') return 'pc_ultimo';
  if (clean === 'pcpadrao') return 'pc_padrao';

  return clean;
}

export async function parseExcelDocVendaFile(arrayBuffer: ArrayBuffer, fileName: string): Promise<DocVendaImportInput[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('O ficheiro Excel não contém folhas válidas.');
  }

  const rows: DocVendaImportInput[] = [];
  let headers: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = normalizeDocVendaHeaderKey(cell.text);
      });
    } else {
      const rowData: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          rowData[header] = cell.value;
        }
      });
      
      const isEmpty = Object.values(rowData).every(v => v === null || v === undefined || v === '');
      if (isEmpty) return;
      
      // Parse devolucao
      let devolucao = false;
      const devVal = rowData['devolucao'];
      if (devVal !== undefined && devVal !== null) {
        const devStr = String(devVal).trim().toLowerCase();
        if (devStr === '1' || devStr === 'true' || devStr === 'verdadeiro') {
          devolucao = true;
        }
      }

      // Convert date to string YYYY-MM-DD if Date object
      let dataFinal = null;
      if (rowData['data']) {
        if (rowData['data'] instanceof Date) {
          dataFinal = rowData['data'].toISOString().split('T')[0];
        } else {
          // simple formatting attempt for DD/MM/YYYY
          const str = String(rowData['data']).trim();
          const parts = str.split('/');
          if (parts.length === 3) {
            dataFinal = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          } else {
            dataFinal = str;
          }
        }
      }

      const parseNum = (val: any) => {
        if (val === undefined || val === null || val === '') return null;
        if (typeof val === 'number') return val;
        const str = String(val).replace(',', '.');
        const num = parseFloat(str);
        return isNaN(num) ? null : num;
      };

      rows.push({
        cliente_id: rowData['cliente_id'] ? String(rowData['cliente_id']) : rowData['client_id'] ? String(rowData['client_id']) : undefined,
        sigla_cliente: rowData['sigla_cliente'] ? String(rowData['sigla_cliente']) : rowData['sigla'] ? String(rowData['sigla']) : undefined,
        data: dataFinal,
        serie: rowData['serie'] ? String(rowData['serie']) : null,
        entidade: rowData['entidade'] ? String(rowData['entidade']) : null,
        tipo_doc: rowData['tipo_doc'] ? String(rowData['tipo_doc']) : null,
        num_doc: parseNum(rowData['num_doc']),
        requisicao: rowData['requisicao'] ? String(rowData['requisicao']) : null,
        num_contribuinte: rowData['num_contribuinte'] ? String(rowData['num_contribuinte']) : null,
        nome: rowData['nome'] ? String(rowData['nome']) : null,
        morada: rowData['morada'] ? String(rowData['morada']) : null,
        localidade: rowData['localidade'] ? String(rowData['localidade']) : null,
        cod_postal: rowData['cod_postal'] ? String(rowData['cod_postal']) : null,
        cod_postal_localidade: rowData['cod_postal_localidade'] ? String(rowData['cod_postal_localidade']) : null,
        total_merc: parseNum(rowData['total_merc']),
        desc_pag: parseNum(rowData['desc_pag']),
        total_iva: parseNum(rowData['total_iva']),
        total_desc: parseNum(rowData['total_desc']),
        total_outros: parseNum(rowData['total_outros']),
        num_linha: parseNum(rowData['num_linha']),
        artigo: rowData['artigo'] ? String(rowData['artigo']) : null,
        taxa_iva: parseNum(rowData['taxa_iva']),
        desconto1: parseNum(rowData['desconto1']),
        desconto2: parseNum(rowData['desconto2']),
        desconto3: parseNum(rowData['desconto3']),
        quantidade: parseNum(rowData['quantidade']),
        cod_iva: rowData['cod_iva'] ? String(rowData['cod_iva']) : null,
        armazem: rowData['armazem'] ? String(rowData['armazem']) : null,
        lote: rowData['lote'] ? String(rowData['lote']) : null,
        preco_liquido: parseNum(rowData['preco_liquido']),
        descricao: rowData['descricao'] ? String(rowData['descricao']) : null,
        devolucao: devolucao,
        total_da: parseNum(rowData['total_da']),
        total_dc: parseNum(rowData['total_dc']),
        total_iliquido: parseNum(rowData['total_iliquido']),
        total_df: parseNum(rowData['total_df']),
        total_iva_art: parseNum(rowData['total_iva_art']),
        pc_medio: parseNum(rowData['pc_medio']),
        pc_ultimo: parseNum(rowData['pc_ultimo']),
        pc_padrao: parseNum(rowData['pc_padrao']),
      });
    }
  });

  return rows;
}
