import path from 'path';
import ExcelJS from 'exceljs';

export interface LinhaPedidoExcel {
  artigo_id?: string;
  artigo_cli?: string;
  artigo_codigo?: string;
  descricao: string;
  lote: string;
  validade?: string | null;
  quantidade: number;
  armazem?: string | null;
  tipo_artigo?: string | null;
  familia?: string | null;
  sub_familia?: string | null;
}

export interface ExcelPedidoDados {
  nr_pedido: string;
  ref_documento?: string | null;
  cliente_nome: string;
  cliente_sigla: string;
  cliente_nif?: string | null;
  nome_destinatario: string;
  morada: string;
  codigo_postal: string;
  localidade: string;
  pais?: string;
  data_pedido: string;
  data_entrega?: string | null;
  observacoes?: string | null;
  utilizador_nome?: string | null;
  utilizador_email: string;
  linhas: LinhaPedidoExcel[];
}

/**
 * Gera um ficheiro Excel (.xlsx) profissional e formatado com os dados e linhas do pedido
 * (Guia de Expedição de Pedido enviada na notificação ao executante).
 * Retorna um Buffer pronto para envio como anexo no Resend ou download.
 */
export async function gerarExcelPedido(dados: ExcelPedidoDados): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Plataforma Farma - Sermail';
  workbook.lastModifiedBy = 'Plataforma Farma';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(`Pedido ${dados.nr_pedido}`, {
    pageSetup: { paperSize: 9, orientation: 'portrait' }, // A4
    views: [{ showGridLines: true }],
  });

  // Configuração das larguras das colunas
  worksheet.columns = [
    { key: 'colA', width: 18 },
    { key: 'colB', width: 32 },
    { key: 'colC', width: 18 },
    { key: 'colD', width: 16 },
    { key: 'colE', width: 16 },
  ];

  // Cores institucionais
  const primaryColor = 'FF0284C7'; // #0284c7 (Azul Farma)
  const darkNavy = 'FF0F172A'; // #0f172a (Slate 900)
  const headerBg = 'FF0369A1'; // #0369a1
  const borderLight = {
    top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  };

  // 1. TÍTULO PRINCIPAL
  const titleRow = worksheet.addRow(['PLATAFORMA FARMA • GUIA DE EXPEDIÇÃO DE PEDIDO']);
  worksheet.mergeCells('A1:E1');
  titleRow.height = 30;
  titleRow.getCell(1).font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryColor } };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  // Linha em branco
  worksheet.addRow([]);

  // 2. CABEÇALHO DO PEDIDO
  const r3 = worksheet.addRow(['Nº DO PEDIDO:', dados.nr_pedido, '', 'DATA DO PEDIDO:', new Date(dados.data_pedido).toLocaleDateString('pt-PT')]);
  r3.getCell(1).font = { bold: true, size: 10, color: { argb: darkNavy } };
  r3.getCell(2).font = { bold: true, size: 11, color: { argb: headerBg } };
  r3.getCell(4).font = { bold: true, size: 10, color: { argb: darkNavy } };
  r3.getCell(5).font = { size: 10 };

  const r4 = worksheet.addRow([
    'CLIENTE:',
    `${dados.cliente_nome} (${dados.cliente_sigla})`,
    '',
    'PREVISÃO ENTREGA:',
    dados.data_entrega ? new Date(dados.data_entrega).toLocaleDateString('pt-PT') : 'Não indicada',
  ]);
  r4.getCell(1).font = { bold: true, size: 10, color: { argb: darkNavy } };
  r4.getCell(2).font = { bold: true, size: 10 };
  r4.getCell(4).font = { bold: true, size: 10, color: { argb: darkNavy } };
  r4.getCell(5).font = { size: 10 };

  const r5 = worksheet.addRow([
    'REF. DOCUMENTO:',
    dados.ref_documento || 'N/A',
    '',
    'REQUERENTE:',
    dados.utilizador_nome ? `${dados.utilizador_nome} (${dados.utilizador_email})` : dados.utilizador_email,
  ]);
  r5.getCell(1).font = { bold: true, size: 10, color: { argb: darkNavy } };
  r5.getCell(4).font = { bold: true, size: 10, color: { argb: darkNavy } };

  // Linha em branco
  worksheet.addRow([]);

  // 3. SECÇÃO DADOS DE DESTINO
  const destTitleRow = worksheet.addRow(['DADOS DE DESTINO & ENTREGA']);
  worksheet.mergeCells(`A${destTitleRow.number}:E${destTitleRow.number}`);
  destTitleRow.height = 20;
  destTitleRow.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF166534' } };
  destTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Light green
  destTitleRow.getCell(1).alignment = { vertical: 'middle', indent: 1 };

  const rDest1 = worksheet.addRow(['Destinatário:', dados.nome_destinatario]);
  worksheet.mergeCells(`B${rDest1.number}:E${rDest1.number}`);
  rDest1.getCell(1).font = { bold: true, size: 10 };

  const rDest2 = worksheet.addRow(['Morada:', dados.morada]);
  worksheet.mergeCells(`B${rDest2.number}:E${rDest2.number}`);
  rDest2.getCell(1).font = { bold: true, size: 10 };

  const rDest3 = worksheet.addRow(['Localidade / CP:', `${dados.codigo_postal} ${dados.localidade} (${dados.pais || 'Portugal'})`]);
  worksheet.mergeCells(`B${rDest3.number}:E${rDest3.number}`);
  rDest3.getCell(1).font = { bold: true, size: 10 };

  if (dados.observacoes) {
    const rObs = worksheet.addRow(['Observações:', dados.observacoes]);
    worksheet.mergeCells(`B${rObs.number}:E${rObs.number}`);
    rObs.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF92400E' } };
    rObs.getCell(2).font = { italic: true, size: 10, color: { argb: 'FF78350F' } };
  }

  // Linha em branco
  worksheet.addRow([]);

  // 4. TABELA DE ARTIGOS / LINHAS (FEFO)
  const headerTable = worksheet.addRow([
    'CÓDIGO ARTIGO',
    'DESCRIÇÃO DO ARTIGO',
    'LOTE',
    'VALIDADE',
    'QUANTIDADE (UN)',
  ]);
  headerTable.height = 24;

  for (let c = 1; c <= 5; c++) {
    const cell = headerTable.getCell(c);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: darkNavy } };
    cell.alignment = {
      horizontal: c === 5 ? 'right' : c === 3 || c === 4 ? 'center' : 'left',
      vertical: 'middle',
    };
    cell.border = borderLight;
  }

  // Inserir linhas do pedido
  let totalUnidades = 0;
  dados.linhas.forEach((l, index) => {
    totalUnidades += l.quantidade;
    const isEven = index % 2 === 0;
    const row = worksheet.addRow([
      l.artigo_cli || l.artigo_codigo || '',
      l.descricao,
      l.lote,
      l.validade || '-',
      l.quantidade,
    ]);
    row.height = 20;

    const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    for (let c = 1; c <= 5; c++) {
      const cell = row.getCell(c);
      cell.font = {
        name: 'Arial',
        size: 10,
        bold: c === 1 || c === 5,
        color: c === 1 ? { argb: 'FF0284C7' } : { argb: 'FF1E293B' },
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = borderLight;
      cell.alignment = {
        horizontal: c === 5 ? 'right' : c === 3 || c === 4 ? 'center' : 'left',
        vertical: 'middle',
      };
      if (c === 5) {
        cell.numFmt = '#,##0';
      }
    }
  });

  // 5. LINHA DE TOTALIZADOR
  const totalRow = worksheet.addRow([
    'TOTAL GERAL',
    `${dados.linhas.length} linha(s) de artigo`,
    '',
    '',
    totalUnidades,
  ]);
  totalRow.height = 24;
  worksheet.mergeCells(`A${totalRow.number}:B${totalRow.number}`);
  worksheet.mergeCells(`C${totalRow.number}:D${totalRow.number}`);

  for (let c = 1; c <= 5; c++) {
    const cell = totalRow.getCell(c);
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = borderLight;
    cell.alignment = {
      horizontal: c === 5 ? 'right' : 'left',
      vertical: 'middle',
    };
    if (c === 5) {
      cell.numFmt = '#,##0';
      cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF0284C7' } };
    }
  }

  // Linha em branco
  worksheet.addRow([]);

  // 6. RODAPÉ INSTITUCIONAL
  const footerRow = worksheet.addRow([
    `Documento gerado eletronicamente pela Plataforma Farma (Sermail) em ${new Date().toLocaleString('pt-PT')} • Armazém 01 (${dados.cliente_sigla}-01)`,
  ]);
  worksheet.mergeCells(`A${footerRow.number}:E${footerRow.number}`);
  footerRow.getCell(1).font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
  footerRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  // Gerar Buffer
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Gera o ficheiro Excel (.xlsx) para importação ERP a partir do template oficial
 * `public/templates/Template-Pedidos.xlsx` (folha "Vendas"), destinado a ser enviado
 * num email separado exclusivamente para o administrador.
 *
 * Regras de preenchimento definidas até ao momento:
 * - Coluna A (1 - Nr.Documento Ext): número do pedido efetuado (`dados.nr_pedido`)
 * - Coluna C (3 - Artigo(*)): código simples do artigo (`linha.artigo_id`)
 * - Coluna D (4 - Descrição (*)): descrição do artigo (`linha.descricao`)
 * - Coluna E (5 - Quant.(*)): quantidade pedida (`linha.quantidade`)
 * - Coluna K (11 - Contribuinte(*)): NIF / contribuinte do cliente (`dados.cliente_nif`)
 * - Coluna L (12 - Nome): nome do destinatário do pedido (`dados.nome_destinatario`)
 * - Coluna N (14 - Morada): morada do destinatário do pedido (`dados.morada`)
 * - Coluna P (16 - Localidade): localidade do destinatário do pedido (`dados.localidade`)
 * - Coluna R (18 - Cod.Postal): código postal do destinatário do pedido (`dados.codigo_postal`)
 * - Coluna T (20 - Localidade Cod.Postal): localidade do código postal do destinatário (`dados.localidade`)
 * - Coluna AB (28 - Referência): referência do documento do pedido (`dados.ref_documento`)
 * - Coluna AH (34 - Local Descarga): localidade do destinatário do pedido (`dados.localidade`)
 * - Coluna AL (38 - Armazém): armazém da linha (`linha.armazem`)
 * - Coluna AN (40 - Lote): lote da linha (`linha.lote`)
 * - Coluna AO (41 - Tipo Artigo): código numérico `id_tipo_artigo` da tabela `artigos` (`linha.tipo_artigo`)
 * - Coluna AP (42 - Familia): família do artigo (`linha.familia`)
 * - Coluna AQ (43 - Sub.Familia): subfamília do artigo (`linha.sub_familia`)
 * - Coluna AZ (52 - Tipo Doc): texto fixo `"ECL"`
 */
export async function gerarExcelTemplatePedido(dados: ExcelPedidoDados): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), 'public', 'templates', 'Template-Pedidos.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const worksheet = workbook.getWorksheet('Vendas') || workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Folha "Vendas" não encontrada no ficheiro Template-Pedidos.xlsx');
  }

  // A linha 3 contém os cabeçalhos ("Nr.Documento Ext", "Data Doc.", "Artigo(*)", "Descrição (*)", "Quant.(*)", ..., "Contribuinte(*)", etc.)
  // As linhas de dados começam na linha 4
  const START_ROW = 4;
  const clienteNif = dados.cliente_nif ? dados.cliente_nif.trim() : '';
  const nomeDestinatario = dados.nome_destinatario ? dados.nome_destinatario.trim() : '';
  const moradaDestinatario = dados.morada ? dados.morada.trim() : '';
  const localidadeDestinatario = dados.localidade ? dados.localidade.trim() : '';
  const codPostalDestinatario = dados.codigo_postal ? dados.codigo_postal.trim() : '';
  const refDocumento = dados.ref_documento ? dados.ref_documento.trim() : '';
  const defaultArmazem = dados.cliente_sigla ? `${dados.cliente_sigla.trim().toUpperCase()}01` : '';

  const preencherDadosComunsLinha = (row: ExcelJS.Row, rowNumber: number) => {
    // Coluna A (1): Nr.Documento Ext
    row.getCell(1).value = dados.nr_pedido;
    // Coluna K (11): Contribuinte(*)
    row.getCell(11).value = clienteNif;
    // Coluna L (12): Nome
    row.getCell(12).value = nomeDestinatario;
    // Coluna N (14): Morada
    row.getCell(14).value = moradaDestinatario;
    // Coluna P (16): Localidade
    row.getCell(16).value = localidadeDestinatario;
    // Coluna R (18): Cod.Postal
    row.getCell(18).value = codPostalDestinatario;
    // Coluna T (20): Localidade Cod.Postal
    row.getCell(20).value = localidadeDestinatario;
    // Coluna AB (28): Referência
    row.getCell(28).value = refDocumento;
    // Coluna AH (34): Local Descarga
    row.getCell(34).value = localidadeDestinatario;
    // Coluna AZ (52): Tipo Doc -> Texto fixo "ECL"
    row.getCell(52).value = 'ECL';

    // Garantir fórmulas de contagem de caracteres (Caract.) nas linhas 4 e 5 caso estejam vazias no template
    if (!row.getCell(13).value) row.getCell(13).value = { formula: `LEN(L${rowNumber})` };
    if (!row.getCell(15).value) row.getCell(15).value = { formula: `LEN(N${rowNumber})` };
    if (!row.getCell(17).value) row.getCell(17).value = { formula: `LEN(P${rowNumber})` };
    if (!row.getCell(19).value) row.getCell(19).value = { formula: `LEN(R${rowNumber})` };
    if (!row.getCell(21).value) row.getCell(21).value = { formula: `LEN(T${rowNumber})` };
  };

  if (dados.linhas.length === 0) {
    const row = worksheet.getRow(START_ROW);
    preencherDadosComunsLinha(row, START_ROW);
    row.commit();
  } else {
    dados.linhas.forEach((linha, i) => {
      const rowNumber = START_ROW + i;
      const row = worksheet.getRow(rowNumber);

      // Obter artigo_id simples (sem prefixo de cliente caso não venha isolado)
      const artigoSimples =
        linha.artigo_id?.trim() ||
        (linha.artigo_cli?.includes('-')
          ? linha.artigo_cli.substring(linha.artigo_cli.indexOf('-') + 1).trim()
          : linha.artigo_cli?.trim()) ||
        linha.artigo_codigo?.trim() ||
        '';

      preencherDadosComunsLinha(row, rowNumber);

      // Coluna C (3): Artigo(*)
      row.getCell(3).value = artigoSimples;
      // Coluna D (4): Descrição (*)
      row.getCell(4).value = linha.descricao || '';
      // Coluna E (5): Quant.(*)
      row.getCell(5).value = Number(linha.quantidade) || 0;
      // Coluna AL (38): Armazém
      row.getCell(38).value = linha.armazem?.trim() || defaultArmazem;
      // Coluna AN (40): Lote
      row.getCell(40).value = linha.lote?.trim() || '';
      // Coluna AO (41): Tipo Artigo
      row.getCell(41).value = linha.tipo_artigo?.trim() || '';
      // Coluna AP (42): Familia
      row.getCell(42).value = linha.familia?.trim() || '';
      // Coluna AQ (43): Sub.Familia
      row.getCell(43).value = linha.sub_familia?.trim() || '';

      row.commit();
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
