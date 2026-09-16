import ExcelJS from 'exceljs';

export interface LinhaPedidoExcel {
  artigo_codigo: string;
  descricao: string;
  lote: string;
  validade?: string | null;
  quantidade: number;
}

export interface ExcelPedidoDados {
  nr_pedido: string;
  ref_documento?: string | null;
  cliente_nome: string;
  cliente_sigla: string;
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
 * Gera um ficheiro Excel (.xlsx) profissional e formatado com os dados e linhas do pedido.
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
  const subBg = 'FFF0F9FF'; // Light blue
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
      l.artigo_codigo,
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
