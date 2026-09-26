export type Language = 'pt' | 'es' | 'en';

export interface Translations {
  nav: {
    plataformaFarma: string;
    dashboard: string;
    stocks: string;
    criarPedido: string;
    historicoPedidos: string;
    configuracao: string;
    terminarSessao: string;
    languageLabel: string;
    pt: string;
    es: string;
    en: string;
    ptFull: string;
    esFull: string;
    enFull: string;
  };
  common: {
    loading: string;
    actions: string;
    active: string;
    inactive: string;
    search: string;
    all: string;
    total: string;
    yes: string;
    no: string;
    edit: string;
    delete: string;
    close: string;
    back: string;
    save: string;
    cancel: string;
    confirm: string;
    export: string;
    print: string;
    status: string;
    date: string;
    client: string;
    warehouse: string;
    batch: string;
    expiry: string;
    code: string;
    description: string;
    quantity: string;
    type: string;
    days: string;
    details: string;
    error: string;
    success: string;
    noRecords: string;
    sermailCompany: string;
  };
  dashboard: {
    bannerTitle: string;
    bannerSubtitle: string;
    filterByClient: string;
    allClients: string;
    kpiRiskItems: string;
    kpiHumanMeds: string;
    kpiRiskPeriod: string;
    kpiBlockedItems: string;
    kpiBlockedPeriod: string;
    kpiOrdersMonth: string;
    kpiCurrentMonth: string;
    kpiOrdersYear: string;
    kpiCurrentYear: string;
    kpiTotalOrders: string;
    kpiActiveArticles: string;
    kpiInCatalog: string;
    kpiSaleStock: string;
    kpiUnitsAvailable: string;
    chartMonthlyTitle: string;
    chartMonthlyDesc: string;
    chartTop5Title: string;
    chartTop5Desc: string;
    chartForecastTitle: string;
    chartForecastDesc: string;
    ordersLabel: string;
    quantityLabel: string;
    noOrdersData: string;
    months: string[];
  };
  stocks: {
    bannerTitle: string;
    bannerSubtitle: string;
    tabVenda: string;
    tabConsolidado: string;
    tabArtigos: string;
    tabValidades: string;
    searchPlaceholder: string;
    filterClient: string;
    filterStorage: string;
    filterArticleType: string;
    filterWarehouse: string;
    allClients: string;
    allStorage: string;
    allTypes: string;
    allWarehouses: string;
    exportExcel: string;
    exportPdf: string;
    totalStockUnits: string;
    totalBatches: string;
    distinctArticles: string;
    alertsMh: string;
    alertsDm: string;
    alertsDcSa: string;
    colClient: string;
    colCode: string;
    colDesc: string;
    colBatch: string;
    colExpiry: string;
    colWarehouse: string;
    colStock: string;
    colType: string;
    colStatus: string;
    colDays: string;
    colStorage: string;
    colPva: string;
    colStockTotal: string;
    colStockDisponivel: string;
    colStockQuarentena: string;
    colStockBloqueado: string;
    expired: string;
    inRisk: string;
    valid: string;
    noRecords: string;
    detailsTitle: string;
  };
  pedidos: {
    bannerTitle: string;
    bannerSubtitle: string;
    section1Title: string;
    section2Title: string;
    client: string;
    destination: string;
    selectDestination: string;
    codeDestination: string;
    btnNovoDestino: string;
    recipientName: string;
    address: string;
    postalCode: string;
    city: string;
    country: string;
    orderDate: string;
    deliveryDate: string;
    docRef: string;
    docRefPlaceholder: string;
    notes: string;
    notesPlaceholder: string;
    selectArticle: string;
    selectBatch: string;
    quantity: string;
    availableStock: string;
    btnAddLine: string;
    fefoSuggested: string;
    tableArticle: string;
    tableBatch: string;
    tableExpiry: string;
    tableQty: string;
    tableActions: string;
    noLinesAdded: string;
    btnSubmit: string;
    btnSubmitting: string;
    btnClear: string;
    orderSuccessTitle: string;
    orderSuccessMsg: string;
    viewInHistory: string;
    classificaDestino: string;
    selectClassification: string;
    modalNewDestTitle: string;
    modalNewDestDesc: string;
    modalNif: string;
    modalPhone: string;
    modalEmail: string;
    modalSaveDest: string;
  };
  historico: {
    bannerTitle: string;
    bannerSubtitle: string;
    searchPlaceholder: string;
    filterClient: string;
    filterStatus: string;
    filterDate: string;
    allClients: string;
    allStatuses: string;
    allPeriods: string;
    periodToday: string;
    period7Days: string;
    period30Days: string;
    periodThisMonth: string;
    viewTable: string;
    viewCards: string;
    statusPendente: string;
    statusConfirmado: string;
    statusPreparacao: string;
    statusExpedido: string;
    statusEntregue: string;
    statusCancelado: string;
    colOrderNumber: string;
    colDate: string;
    colClient: string;
    colDestination: string;
    colDocRef: string;
    colLines: string;
    colTotalQty: string;
    colStatus: string;
    colActions: string;
    orderDetails: string;
    printOrder: string;
    closeModal: string;
    noOrdersFound: string;
    totalOrders: string;
    changeStatus: string;
  };
  configuracao: {
    bannerTitle: string;
    bannerSubtitle: string;
    tabUsers: string;
    tabClients: string;
    tabArticles: string;
    tabMovements: string;
    tabEmail: string;
    addUser: string;
    addClient: string;
    addArticle: string;
    importArticles: string;
    importMovements: string;
    serverEmail: string;
    save: string;
    cancel: string;
    userFullName: string;
    userEmail: string;
    userPassword: string;
    userRole: string;
    userCompany: string;
    userClientAssoc: string;
    userActive: string;
    clientName: string;
    clientSigla: string;
    clientNif: string;
    clientEmail: string;
    clientPhone: string;
    clientAddress: string;
    clientPostalCode: string;
    clientCity: string;
    clientTipoCliente: string;
    tipoClienteSf: string;
    tipoClienteCf: string;
    clientPrimaveraCode: string;
    clientActive: string;
    articleCode: string;
    articleDesc: string;
    articleType: string;
    articleStorage: string;
    articlePva: string;
    articleActive: string;
    testEmail: string;
    testEmailSend: string;
    testEmailSending: string;
  };
  login: {
    title: string;
    welcome: string;
    userEmail: string;
    password: string;
    rememberMe: string;
    forgotPassword: string;
    forgotPasswordAlert: string;
    loginButton: string;
    authenticating: string;
    support: string;
    privacy: string;
    terms: string;
    copyright: string;
    invalidCredentials: string;
    emailNotConfirmed: string;
    accountInactive: string;
    loginSuccess: string;
  };
}

export const translations: Record<Language, Translations> = {
  pt: {
    nav: {
      plataformaFarma: 'Plataforma Farma',
      dashboard: 'Dashboard',
      stocks: 'Stocks',
      criarPedido: 'Criar Pedido',
      historicoPedidos: 'Histórico Pedidos',
      configuracao: 'Configuração',
      terminarSessao: 'Terminar Sessão',
      languageLabel: 'Idioma:',
      pt: 'PT',
      es: 'ES',
      en: 'EN',
      ptFull: 'Português',
      esFull: 'Espanhol',
      enFull: 'Inglês',
    },
    common: {
      loading: 'A carregar...',
      actions: 'Ações',
      active: 'Ativo',
      inactive: 'Inativo',
      search: 'Pesquisar...',
      all: 'Todos',
      total: 'Total',
      yes: 'Sim',
      no: 'Não',
      edit: 'Editar',
      delete: 'Eliminar',
      close: 'Fechar',
      back: 'Voltar',
      save: 'Guardar',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      export: 'Exportar',
      print: 'Imprimir',
      status: 'Estado',
      date: 'Data',
      client: 'Cliente',
      warehouse: 'Armazém',
      batch: 'Lote',
      expiry: 'Validade',
      code: 'Código',
      description: 'Descrição',
      quantity: 'Quantidade',
      type: 'Tipo',
      days: 'Dias',
      details: 'Detalhes',
      error: 'Erro',
      success: 'Sucesso',
      noRecords: 'Nenhum registo encontrado.',
      sermailCompany: 'Sermail, Logística Integrada Lda.',
    },
    dashboard: {
      bannerTitle: 'Painel Informativo',
      bannerSubtitle: 'Visão geral das operações de armazém, encomendas e controlo de stocks.',
      filterByClient: 'Filtrar por Cliente:',
      allClients: 'Todos os Clientes',
      kpiRiskItems: 'Artigos em Risco',
      kpiHumanMeds: 'Medicamentos Uso Humano',
      kpiRiskPeriod: '60 a 180 d',
      kpiBlockedItems: 'Artigos Bloqueados',
      kpiBlockedPeriod: '1 a 60 d',
      kpiOrdersMonth: 'Pedidos (Mês)',
      kpiCurrentMonth: 'Mês Corrente',
      kpiOrdersYear: 'Pedidos (Ano)',
      kpiCurrentYear: 'Ano Corrente',
      kpiTotalOrders: 'Total Histórico',
      kpiActiveArticles: 'Artigos Ativos',
      kpiInCatalog: 'no catálogo do cliente',
      kpiSaleStock: 'Stock Venda',
      kpiUnitsAvailable: 'unidades disponíveis',
      chartMonthlyTitle: 'Evolução Mensal de Pedidos',
      chartMonthlyDesc: 'Volume de encomendas processadas por mês',
      chartTop5Title: 'Top 5 Produtos Mais Pedidos',
      chartTop5Desc: 'Artigos com maior quantidade expedida',
      chartForecastTitle: 'Previsão de Stock',
      chartForecastDesc: 'Projeção futura de existências, taxa de consumo e estimativa de autonomia',
      ordersLabel: 'Pedidos',
      quantityLabel: 'Quantidade',
      noOrdersData: 'Sem registos de pedidos para apresentar.',
      months: [
        'Janeiro',
        'Fevereiro',
        'Março',
        'Abril',
        'Maio',
        'Junho',
        'Julho',
        'Agosto',
        'Setembro',
        'Outubro',
        'Novembro',
        'Dezembro',
      ],
    },
    stocks: {
      bannerTitle: 'Stocks',
      bannerSubtitle: 'Controlo e consulta de existências em armazém, lotes e validades.',
      tabVenda: 'Stock de Venda (Disponível)',
      tabConsolidado: 'Stock Consolidado (Geral)',
      tabArtigos: 'Agrupado por Artigo',
      tabValidades: 'Validades & Alertas',
      searchPlaceholder: 'Pesquisar por código, descrição, lote ou cliente...',
      filterClient: 'Cliente',
      filterStorage: 'Armazenamento',
      filterArticleType: 'Tipo de Artigo',
      filterWarehouse: 'Armazém',
      allClients: 'Todos os Clientes',
      allStorage: 'Todos os Tipos',
      allTypes: 'Todos os Tipos',
      allWarehouses: 'Todos os Armazéns',
      exportExcel: 'Exportar Excel',
      exportPdf: 'Exportar PDF',
      totalStockUnits: 'Stock de Venda',
      totalBatches: 'Total de Lotes',
      distinctArticles: 'Artigos Distintos',
      alertsMh: 'Alertas MH (<180d)',
      alertsDm: 'Alertas DM (Expirados)',
      alertsDcSa: 'Alertas DC/SA (Expirados)',
      colClient: 'Cliente',
      colCode: 'Código',
      colDesc: 'Descrição',
      colBatch: 'Lote',
      colExpiry: 'Validade',
      colWarehouse: 'Armazém',
      colStock: 'Stock',
      colType: 'Tipo',
      colStatus: 'Estado',
      colDays: 'Dias',
      colStorage: 'Armazenamento',
      colPva: 'PVA (€)',
      colStockTotal: 'Stock Total',
      colStockDisponivel: 'Disponível',
      colStockQuarentena: 'Quarentena',
      colStockBloqueado: 'Bloqueado',
      expired: 'Expirado',
      inRisk: 'Em Risco',
      valid: 'Válido',
      noRecords: 'Nenhum registo de stock encontrado com os filtros selecionados.',
      detailsTitle: 'Detalhe do Lote e Movimentos',
    },
    pedidos: {
      bannerTitle: 'Criar Pedido',
      bannerSubtitle: 'Registo e expedição de ordens de entrega com seleção por código e sugestão FEFO.',
      section1Title: '1. Dados do Pedido & Destinatário',
      section2Title: '2. Artigos & Quantidades (Seleção FEFO)',
      client: 'Cliente Proprietário',
      destination: 'Destino / Destinatário',
      selectDestination: 'Selecione um destino pré-cadastrado...',
      codeDestination: 'Código Destino (ex: D001)',
      btnNovoDestino: '+ Novo Destino',
      recipientName: 'Nome do Destinatário',
      address: 'Morada / Endereço',
      postalCode: 'Código Postal',
      city: 'Localidade / Cidade',
      country: 'País',
      orderDate: 'Data do Pedido',
      deliveryDate: 'Data de Entrega Pretendida',
      docRef: 'Ref. / Documento do Cliente',
      docRefPlaceholder: 'Ex: PO-2026-00129',
      notes: 'Observações / Instruções de Entrega',
      notesPlaceholder: 'Instruções especiais de transporte, contacto de receção, etc.',
      selectArticle: 'Selecionar Artigo...',
      selectBatch: 'Selecionar Lote...',
      quantity: 'Quantidade',
      availableStock: 'Stock Disponível:',
      btnAddLine: 'Adicionar Artigo',
      fefoSuggested: 'Sugestão FEFO (Validade mais próxima)',
      tableArticle: 'Artigo / Código',
      tableBatch: 'Lote',
      tableExpiry: 'Validade',
      tableQty: 'Qtd.',
      tableActions: 'Ações',
      noLinesAdded: 'Nenhum artigo adicionado ao pedido. Selecione um artigo acima e clique em "Adicionar Artigo".',
      btnSubmit: 'Submeter Pedido',
      btnSubmitting: 'A submeter pedido...',
      btnClear: 'Limpar Formulário',
      orderSuccessTitle: 'Pedido Criado com Sucesso!',
      orderSuccessMsg: 'A ordem de entrega foi registada e encaminhada para a equipa de logística.',
      viewInHistory: 'Ver no Histórico',
      classificaDestino: 'Classificação do Destino',
      selectClassification: 'Selecione a classificação...',
      modalNewDestTitle: 'Registo de Novo Destino',
      modalNewDestDesc: 'Preencha os dados do novo ponto de entrega para o cliente.',
      modalNif: 'NIF / Identificação Fiscal',
      modalPhone: 'Telefone / Contacto',
      modalEmail: 'Email de Notificação',
      modalSaveDest: 'Guardar Destino',
    },
    historico: {
      bannerTitle: 'Histórico Pedidos',
      bannerSubtitle: 'Consulta e rastreio de encomendas registadas, estados de expedição e detalhe de artigos.',
      searchPlaceholder: 'Pesquisar por nº pedido, cliente, destino, documento...',
      filterClient: 'Cliente',
      filterStatus: 'Estado',
      filterDate: 'Período',
      allClients: 'Todos os Clientes',
      allStatuses: 'Todos os Estados',
      allPeriods: 'Todo o Histórico',
      periodToday: 'Hoje',
      period7Days: 'Últimos 7 Dias',
      period30Days: 'Últimos 30 Dias',
      periodThisMonth: 'Este Mês',
      viewTable: 'Vista em Tabela',
      viewCards: 'Vista em Cartões',
      statusPendente: 'Pendente',
      statusConfirmado: 'Confirmado',
      statusPreparacao: 'Em Preparação',
      statusExpedido: 'Expedido',
      statusEntregue: 'Entregue',
      statusCancelado: 'Cancelado',
      colOrderNumber: 'Nº Pedido',
      colDate: 'Data',
      colClient: 'Cliente',
      colDestination: 'Destino',
      colDocRef: 'Ref. Doc',
      colLines: 'Linhas',
      colTotalQty: 'Qtd. Total',
      colStatus: 'Estado',
      colActions: 'Ações',
      orderDetails: 'Detalhes do Pedido',
      printOrder: 'Imprimir / PDF',
      closeModal: 'Fechar',
      noOrdersFound: 'Nenhum pedido encontrado para os filtros selecionados.',
      totalOrders: 'Total de Pedidos',
      changeStatus: 'Alterar Estado',
    },
    configuracao: {
      bannerTitle: 'Configuração & Administração do Sistema',
      bannerSubtitle: 'Gestão centralizada de contas de utilizadores, parametrização de clientes e cadastro de artigos.',
      tabUsers: 'Utilizadores',
      tabClients: 'Clientes',
      tabArticles: 'Artigos',
      tabMovements: 'Movimentos',
      tabEmail: 'Servidor de Email',
      addUser: 'Novo Utilizador',
      addClient: 'Novo Cliente',
      addArticle: 'Novo Artigo',
      importArticles: 'Importação de Artigos',
      importMovements: 'Importação de Movimentos',
      serverEmail: 'Parametrização do Servidor de Email',
      save: 'Guardar',
      cancel: 'Cancelar',
      userFullName: 'Nome Completo',
      userEmail: 'Email',
      userPassword: 'Palavra-passe Inicial',
      userRole: 'Perfil / Função',
      userCompany: 'Empresa',
      userClientAssoc: 'Cliente Associado',
      userActive: 'Conta Ativa',
      clientName: 'Nome do Cliente / Empresa',
      clientSigla: 'Sigla (ex: BCN)',
      clientNif: 'NIF',
      clientEmail: 'Email Principal',
      clientPhone: 'Telefone',
      clientAddress: 'Morada',
      clientPostalCode: 'Código Postal',
      clientCity: 'Localidade',
      clientTipoCliente: 'Tipo de Cliente',
      tipoClienteSf: 'SF (Sem Faturação)',
      tipoClienteCf: 'CF (Com Faturação)',
      clientPrimaveraCode: 'Cód. Primavera (ERP)',
      clientActive: 'Cliente Ativo',
      articleCode: 'Código do Artigo',
      articleDesc: 'Descrição',
      articleType: 'Tipo de Artigo',
      articleStorage: 'Condição de Armazenamento',
      articlePva: 'PVA (€)',
      articleActive: 'Artigo Ativo',
      testEmail: 'Email de Teste',
      testEmailSend: 'Enviar Email de Teste',
      testEmailSending: 'A enviar email de teste...',
    },
    login: {
      title: 'Plataforma Farma',
      welcome: 'Acesso à Plataforma Logística Integrada',
      userEmail: 'Email do Utilizador',
      password: 'Palavra-passe',
      rememberMe: 'Lembrar-me',
      forgotPassword: 'Esqueceu-se da palavra-passe?',
      forgotPasswordAlert: 'Para recuperar a palavra-passe, por favor contacte o administrador de sistemas da Sermail.',
      loginButton: 'Entrar',
      authenticating: 'A autenticar...',
      support: 'Contactar Suporte',
      privacy: 'Privacidade',
      terms: 'Termos',
      copyright: '© 2026 Sermail, Logística Integrada Lda.',
      invalidCredentials: 'Credenciais inválidas. Verifique o email e a palavra-passe.',
      emailNotConfirmed: 'O email ainda não foi confirmado.',
      accountInactive: 'Esta conta de utilizador encontra-se inativa. Contacte o administrador.',
      loginSuccess: 'Autenticação bem-sucedida! A redirecionar...',
    },
  },
  es: {
    nav: {
      plataformaFarma: 'Plataforma Farma',
      dashboard: 'Dashboard',
      stocks: 'Stocks',
      criarPedido: 'Crear Pedido',
      historicoPedidos: 'Historial Pedidos',
      configuracao: 'Configuración',
      terminarSessao: 'Cerrar Sesión',
      languageLabel: 'Idioma:',
      pt: 'PT',
      es: 'ES',
      en: 'EN',
      ptFull: 'Portugués',
      esFull: 'Español',
      enFull: 'Inglés',
    },
    common: {
      loading: 'Cargando...',
      actions: 'Acciones',
      active: 'Activo',
      inactive: 'Inactivo',
      search: 'Buscar...',
      all: 'Todos',
      total: 'Total',
      yes: 'Sí',
      no: 'No',
      edit: 'Editar',
      delete: 'Eliminar',
      close: 'Cerrar',
      back: 'Volver',
      save: 'Guardar',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      export: 'Exportar',
      print: 'Imprimir',
      status: 'Estado',
      date: 'Fecha',
      client: 'Cliente',
      warehouse: 'Almacén',
      batch: 'Lote',
      expiry: 'Caducidad',
      code: 'Código',
      description: 'Descripción',
      quantity: 'Cantidad',
      type: 'Tipo',
      days: 'Días',
      details: 'Detalles',
      error: 'Error',
      success: 'Éxito',
      noRecords: 'No se encontraron registros.',
      sermailCompany: 'Sermail, Logística Integrada Lda.',
    },
    dashboard: {
      bannerTitle: 'Panel Informativo',
      bannerSubtitle: 'Visión general de las operaciones de almacén, pedidos y control de existencias.',
      filterByClient: 'Filtrar por Cliente:',
      allClients: 'Todos los Clientes',
      kpiRiskItems: 'Artículos en Riesgo',
      kpiHumanMeds: 'Medicamentos Uso Humano',
      kpiRiskPeriod: '60 a 180 d',
      kpiBlockedItems: 'Artículos Bloqueados',
      kpiBlockedPeriod: '1 a 60 d',
      kpiOrdersMonth: 'Pedidos (Mes)',
      kpiCurrentMonth: 'Mes en Curso',
      kpiOrdersYear: 'Pedidos (Año)',
      kpiCurrentYear: 'Año en Curso',
      kpiTotalOrders: 'Total Histórico',
      kpiActiveArticles: 'Artículos Activos',
      kpiInCatalog: 'en el catálogo del cliente',
      kpiSaleStock: 'Stock Venta',
      kpiUnitsAvailable: 'unidades disponibles',
      chartMonthlyTitle: 'Evolución Mensual de Pedidos',
      chartMonthlyDesc: 'Volumen de pedidos procesados por mes',
      chartTop5Title: 'Top 5 Productos Más Pedidos',
      chartTop5Desc: 'Artículos con mayor cantidad expedida',
      chartForecastTitle: 'Previsión de Stock',
      chartForecastDesc: 'Proyección futura de existencias, tasa de consumo y estimación de autonomía',
      ordersLabel: 'Pedidos',
      quantityLabel: 'Cantidad',
      noOrdersData: 'Sin registros de pedidos para mostrar.',
      months: [
        'Enero',
        'Febrero',
        'Marzo',
        'Abril',
        'Mayo',
        'Junio',
        'Julio',
        'Agosto',
        'Septiembre',
        'Octubre',
        'Noviembre',
        'Diciembre',
      ],
    },
    stocks: {
      bannerTitle: 'Stocks',
      bannerSubtitle: 'Control y consulta de existencias en almacén, lotes y caducidades.',
      tabVenda: 'Stock de Venta (Disponible)',
      tabConsolidado: 'Stock Consolidado (General)',
      tabArtigos: 'Agrupado por Artículo',
      tabValidades: 'Caducidades y Alertas',
      searchPlaceholder: 'Buscar por código, descripción, lote o cliente...',
      filterClient: 'Cliente',
      filterStorage: 'Almacenamiento',
      filterArticleType: 'Tipo de Artículo',
      filterWarehouse: 'Almacén',
      allClients: 'Todos los Clientes',
      allStorage: 'Todos los Tipos',
      allTypes: 'Todos los Tipos',
      allWarehouses: 'Todos los Almacenes',
      exportExcel: 'Exportar Excel',
      exportPdf: 'Exportar PDF',
      totalStockUnits: 'Stock de Venta',
      totalBatches: 'Total de Lotes',
      distinctArticles: 'Artículos Distintos',
      alertsMh: 'Alertas MH (<180d)',
      alertsDm: 'Alertas DM (Caducados)',
      alertsDcSa: 'Alertas DC/SA (Caducados)',
      colClient: 'Cliente',
      colCode: 'Código',
      colDesc: 'Descripción',
      colBatch: 'Lote',
      colExpiry: 'Caducidad',
      colWarehouse: 'Almacén',
      colStock: 'Stock',
      colType: 'Tipo',
      colStatus: 'Estado',
      colDays: 'Días',
      colStorage: 'Almacenamiento',
      colPva: 'PVA (€)',
      colStockTotal: 'Stock Total',
      colStockDisponivel: 'Disponible',
      colStockQuarentena: 'Cuarentena',
      colStockBloqueado: 'Bloqueado',
      expired: 'Caducado',
      inRisk: 'En Riesgo',
      valid: 'Válido',
      noRecords: 'No se encontraron registros de stock con los filtros seleccionados.',
      detailsTitle: 'Detalle del Lote y Movimientos',
    },
    pedidos: {
      bannerTitle: 'Crear Pedido',
      bannerSubtitle: 'Registro y expedición de pedidos de entrega con selección por código y sugerencia FEFO.',
      section1Title: '1. Datos del Pedido y Destinatario',
      section2Title: '2. Artículos y Cantidades (Selección FEFO)',
      client: 'Cliente Propietario',
      destination: 'Destino / Destinatario',
      selectDestination: 'Seleccione un destino registrado...',
      codeDestination: 'Código Destino (ej: D001)',
      btnNovoDestino: '+ Nuevo Destino',
      recipientName: 'Nombre del Destinatario',
      address: 'Dirección / Domicilio',
      postalCode: 'Código Postal',
      city: 'Localidad / Ciudad',
      country: 'País',
      orderDate: 'Fecha del Pedido',
      deliveryDate: 'Fecha de Entrega Deseada',
      docRef: 'Ref. / Documento del Cliente',
      docRefPlaceholder: 'Ej: PO-2026-00129',
      notes: 'Observaciones / Instrucciones de Entrega',
      notesPlaceholder: 'Instrucciones especiales de transporte, contacto de recepción, etc.',
      selectArticle: 'Seleccionar Artículo...',
      selectBatch: 'Seleccionar Lote...',
      quantity: 'Cantidad',
      availableStock: 'Stock Disponible:',
      btnAddLine: 'Añadir Artículo',
      fefoSuggested: 'Sugerencia FEFO (Caducidad más cercana)',
      tableArticle: 'Artículo / Código',
      tableBatch: 'Lote',
      tableExpiry: 'Caducidad',
      tableQty: 'Cant.',
      tableActions: 'Acciones',
      noLinesAdded: 'Ningún artículo añadido al pedido. Seleccione un artículo arriba y pulse en "Añadir Artículo".',
      btnSubmit: 'Enviar Pedido',
      btnSubmitting: 'Enviando pedido...',
      btnClear: 'Limpiar Formulario',
      orderSuccessTitle: '¡Pedido Creado con Éxito!',
      orderSuccessMsg: 'La orden de entrega ha sido registrada y enviada al equipo de logística.',
      viewInHistory: 'Ver en Historial',
      classificaDestino: 'Clasificación del Destino',
      selectClassification: 'Seleccione la clasificación...',
      modalNewDestTitle: 'Registro de Nuevo Destino',
      modalNewDestDesc: 'Rellene los datos del nuevo punto de entrega para el cliente.',
      modalNif: 'NIF / Identificación Fiscal',
      modalPhone: 'Teléfono / Contacto',
      modalEmail: 'Email de Notificación',
      modalSaveDest: 'Guardar Destino',
    },
    historico: {
      bannerTitle: 'Historial Pedidos',
      bannerSubtitle: 'Consulta y seguimiento de pedidos registrados, estados de expedición y detalle de artículos.',
      searchPlaceholder: 'Buscar por nº pedido, cliente, destino, documento...',
      filterClient: 'Cliente',
      filterStatus: 'Estado',
      filterDate: 'Período',
      allClients: 'Todos los Clientes',
      allStatuses: 'Todos los Estados',
      allPeriods: 'Todo el Historial',
      periodToday: 'Hoy',
      period7Days: 'Últimos 7 Días',
      period30Days: 'Últimos 30 Días',
      periodThisMonth: 'Este Mes',
      viewTable: 'Vista en Tabla',
      viewCards: 'Vista en Tarjetas',
      statusPendente: 'Pendiente',
      statusConfirmado: 'Confirmado',
      statusPreparacao: 'En Preparación',
      statusExpedido: 'Expedido',
      statusEntregue: 'Entregado',
      statusCancelado: 'Cancelado',
      colOrderNumber: 'Nº Pedido',
      colDate: 'Fecha',
      colClient: 'Cliente',
      colDestination: 'Destino',
      colDocRef: 'Ref. Doc',
      colLines: 'Líneas',
      colTotalQty: 'Cant. Total',
      colStatus: 'Estado',
      colActions: 'Acciones',
      orderDetails: 'Detalles del Pedido',
      printOrder: 'Imprimir / PDF',
      closeModal: 'Cerrar',
      noOrdersFound: 'No se encontraron pedidos con los filtros seleccionados.',
      totalOrders: 'Total de Pedidos',
      changeStatus: 'Cambiar Estado',
    },
    configuracao: {
      bannerTitle: 'Configuración y Administración del Sistema',
      bannerSubtitle: 'Gestión centralizada de cuentas de usuarios, parametrización de clientes y registro de artículos.',
      tabUsers: 'Usuarios',
      tabClients: 'Clientes',
      tabArticles: 'Artículos',
      tabMovements: 'Movimientos',
      tabEmail: 'Servidor de Email',
      addUser: 'Nuevo Usuario',
      addClient: 'Nuevo Cliente',
      addArticle: 'Nuevo Artículo',
      importArticles: 'Importación de Artículos',
      importMovements: 'Importación de Movimientos',
      serverEmail: 'Parametrización del Servidor de Email',
      save: 'Guardar',
      cancel: 'Cancelar',
      userFullName: 'Nombre Completo',
      userEmail: 'Email',
      userPassword: 'Password Inicial',
      userRole: 'Perfil / Rol',
      userCompany: 'Empresa',
      userClientAssoc: 'Cliente Asociado',
      userActive: 'Cuenta Activa',
      clientName: 'Nombre del Cliente / Empresa',
      clientSigla: 'Sigla (ej: BCN)',
      clientNif: 'NIF',
      clientEmail: 'Email Principal',
      clientPhone: 'Teléfono',
      clientAddress: 'Dirección',
      clientPostalCode: 'Código Postal',
      clientCity: 'Localidad',
      clientTipoCliente: 'Tipo de Cliente',
      tipoClienteSf: 'SF (Sin Facturación)',
      tipoClienteCf: 'CF (Con Facturación)',
      clientPrimaveraCode: 'Cód. Primavera (ERP)',
      clientActive: 'Cliente Activo',
      articleCode: 'Código del Artículo',
      articleDesc: 'Descripción',
      articleType: 'Tipo de Artículo',
      articleStorage: 'Condición de Almacenamiento',
      articlePva: 'PVA (€)',
      articleActive: 'Artículo Activo',
      testEmail: 'Email de Prueba',
      testEmailSend: 'Enviar Email de Prueba',
      testEmailSending: 'Enviando email de prueba...',
    },
    login: {
      title: 'Plataforma Farma',
      welcome: 'Acceso a la Plataforma Logística Integrada',
      userEmail: 'Email del Usuario',
      password: 'Password / Contraseña',
      rememberMe: 'Recordarme',
      forgotPassword: '¿Ha olvidado la contraseña?',
      forgotPasswordAlert: 'Para recuperar su contraseña, contacte con el administrador de sistemas de Sermail.',
      loginButton: 'Entrar',
      authenticating: 'Autenticando...',
      support: 'Contactar Soporte',
      privacy: 'Privacidad',
      terms: 'Términos',
      copyright: '© 2026 Sermail, Logística Integrada Lda.',
      invalidCredentials: 'Credenciales inválidas. Verifique el email y la contraseña.',
      emailNotConfirmed: 'El email todavía no ha sido confirmado.',
      accountInactive: 'Esta cuenta de usuario se encuentra inactiva. Contacte al administrador.',
      loginSuccess: '¡Autenticación exitosa! Redirigiendo...',
    },
  },
  en: {
    nav: {
      plataformaFarma: 'Plataforma Farma',
      dashboard: 'Dashboard',
      stocks: 'Stocks',
      criarPedido: 'Create Order',
      historicoPedidos: 'Order History',
      configuracao: 'Settings',
      terminarSessao: 'Sign Out',
      languageLabel: 'Language:',
      pt: 'PT',
      es: 'ES',
      en: 'EN',
      ptFull: 'Portuguese',
      esFull: 'Spanish',
      enFull: 'English',
    },
    common: {
      loading: 'Loading...',
      actions: 'Actions',
      active: 'Active',
      inactive: 'Inactive',
      search: 'Search...',
      all: 'All',
      total: 'Total',
      yes: 'Yes',
      no: 'No',
      edit: 'Edit',
      delete: 'Delete',
      close: 'Close',
      back: 'Back',
      save: 'Save',
      cancel: 'Cancel',
      confirm: 'Confirm',
      export: 'Export',
      print: 'Print',
      status: 'Status',
      date: 'Date',
      client: 'Client',
      warehouse: 'Warehouse',
      batch: 'Batch',
      expiry: 'Expiry',
      code: 'Code',
      description: 'Description',
      quantity: 'Quantity',
      type: 'Type',
      days: 'Days',
      details: 'Details',
      error: 'Error',
      success: 'Success',
      noRecords: 'No records found.',
      sermailCompany: 'Sermail, Logística Integrada Lda.',
    },
    dashboard: {
      bannerTitle: 'Information Dashboard',
      bannerSubtitle: 'Overview of warehouse operations, orders, and inventory control.',
      filterByClient: 'Filter by Client:',
      allClients: 'All Clients',
      kpiRiskItems: 'At-Risk Items',
      kpiHumanMeds: 'Human Use Medicines',
      kpiRiskPeriod: '60 to 180 d',
      kpiBlockedItems: 'Blocked Items',
      kpiBlockedPeriod: '1 to 60 d',
      kpiOrdersMonth: 'Orders (Month)',
      kpiCurrentMonth: 'Current Month',
      kpiOrdersYear: 'Orders (Year)',
      kpiCurrentYear: 'Current Year',
      kpiTotalOrders: 'Historical Total',
      kpiActiveArticles: 'Active Articles',
      kpiInCatalog: 'in client catalog',
      kpiSaleStock: 'Sale Stock',
      kpiUnitsAvailable: 'available units',
      chartMonthlyTitle: 'Monthly Order Trends',
      chartMonthlyDesc: 'Volume of orders processed per month',
      chartTop5Title: 'Top 5 Most Ordered Products',
      chartTop5Desc: 'Articles with highest dispatched quantity',
      chartForecastTitle: 'Stock Forecast',
      chartForecastDesc: 'Future stock projection, depletion rate and runway estimates',
      ordersLabel: 'Orders',
      quantityLabel: 'Quantity',
      noOrdersData: 'No order records to display.',
      months: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ],
    },
    stocks: {
      bannerTitle: 'Inventory & Stocks',
      bannerSubtitle: 'Warehouse stock control, batch tracking, and expiration monitoring.',
      tabVenda: 'Sale Stock (Available)',
      tabConsolidado: 'Consolidated Stock (General)',
      tabArtigos: 'Grouped by Article',
      tabValidades: 'Expirations & Alerts',
      searchPlaceholder: 'Search by code, description, batch or client...',
      filterClient: 'Client',
      filterStorage: 'Storage',
      filterArticleType: 'Article Type',
      filterWarehouse: 'Warehouse',
      allClients: 'All Clients',
      allStorage: 'All Types',
      allTypes: 'All Types',
      allWarehouses: 'All Warehouses',
      exportExcel: 'Export Excel',
      exportPdf: 'Export PDF',
      totalStockUnits: 'Sale Stock',
      totalBatches: 'Total Batches',
      distinctArticles: 'Distinct Articles',
      alertsMh: 'MH Alerts (<180d)',
      alertsDm: 'DM Alerts (Expired)',
      alertsDcSa: 'DC/SA Alerts (Expired)',
      colClient: 'Client',
      colCode: 'Code',
      colDesc: 'Description',
      colBatch: 'Batch',
      colExpiry: 'Expiry',
      colWarehouse: 'Warehouse',
      colStock: 'Stock',
      colType: 'Type',
      colStatus: 'Status',
      colDays: 'Days',
      colStorage: 'Storage',
      colPva: 'PVA (€)',
      colStockTotal: 'Total Stock',
      colStockDisponivel: 'Available',
      colStockQuarentena: 'Quarantine',
      colStockBloqueado: 'Blocked',
      expired: 'Expired',
      inRisk: 'At Risk',
      valid: 'Valid',
      noRecords: 'No stock records found matching the selected filters.',
      detailsTitle: 'Batch Details & Movements',
    },
    pedidos: {
      bannerTitle: 'Create Order',
      bannerSubtitle: 'Registration and dispatch of delivery orders with code selection and FEFO suggestion.',
      section1Title: '1. Order & Destination Details',
      section2Title: '2. Articles & Quantities (FEFO Selection)',
      client: 'Owner Client',
      destination: 'Destination / Recipient',
      selectDestination: 'Select a registered destination...',
      codeDestination: 'Destination Code (e.g. D001)',
      btnNovoDestino: '+ New Destination',
      recipientName: 'Recipient Name',
      address: 'Address / Street',
      postalCode: 'Postal Code',
      city: 'City / Locality',
      country: 'Country',
      orderDate: 'Order Date',
      deliveryDate: 'Requested Delivery Date',
      docRef: 'Client Ref. / Document',
      docRefPlaceholder: 'E.g.: PO-2026-00129',
      notes: 'Notes / Delivery Instructions',
      notesPlaceholder: 'Special transport instructions, recipient contact, etc.',
      selectArticle: 'Select Article...',
      selectBatch: 'Select Batch...',
      quantity: 'Quantity',
      availableStock: 'Available Stock:',
      btnAddLine: 'Add Article',
      fefoSuggested: 'FEFO Suggestion (Earliest Expiration)',
      tableArticle: 'Article / Code',
      tableBatch: 'Batch',
      tableExpiry: 'Expiry',
      tableQty: 'Qty',
      tableActions: 'Actions',
      noLinesAdded: 'No articles added to the order. Select an article above and click "Add Article".',
      btnSubmit: 'Submit Order',
      btnSubmitting: 'Submitting order...',
      btnClear: 'Clear Form',
      orderSuccessTitle: 'Order Created Successfully!',
      orderSuccessMsg: 'The delivery order has been registered and forwarded to the logistics team.',
      viewInHistory: 'View in History',
      classificaDestino: 'Destination Classification',
      selectClassification: 'Select classification...',
      modalNewDestTitle: 'New Destination Registration',
      modalNewDestDesc: 'Fill in the details for the client\'s new delivery point.',
      modalNif: 'Tax ID / VAT Number',
      modalPhone: 'Phone / Contact',
      modalEmail: 'Notification Email',
      modalSaveDest: 'Save Destination',
    },
    historico: {
      bannerTitle: 'Order History',
      bannerSubtitle: 'Consultation and tracking of registered orders, dispatch status, and item details.',
      searchPlaceholder: 'Search by order no., client, destination, document...',
      filterClient: 'Client',
      filterStatus: 'Status',
      filterDate: 'Period',
      allClients: 'All Clients',
      allStatuses: 'All Statuses',
      allPeriods: 'All History',
      periodToday: 'Today',
      period7Days: 'Last 7 Days',
      period30Days: 'Last 30 Days',
      periodThisMonth: 'This Month',
      viewTable: 'Table View',
      viewCards: 'Cards View',
      statusPendente: 'Pending',
      statusConfirmado: 'Confirmed',
      statusPreparacao: 'In Preparation',
      statusExpedido: 'Dispatched',
      statusEntregue: 'Delivered',
      statusCancelado: 'Cancelled',
      colOrderNumber: 'Order #',
      colDate: 'Date',
      colClient: 'Client',
      colDestination: 'Destination',
      colDocRef: 'Doc Ref',
      colLines: 'Lines',
      colTotalQty: 'Total Qty',
      colStatus: 'Status',
      colActions: 'Actions',
      orderDetails: 'Order Details',
      printOrder: 'Print / PDF',
      closeModal: 'Close',
      noOrdersFound: 'No orders found for the selected filters.',
      totalOrders: 'Total Orders',
      changeStatus: 'Change Status',
    },
    configuracao: {
      bannerTitle: 'System Configuration & Administration',
      bannerSubtitle: 'Centralized user account management, client configuration, and item catalog.',
      tabUsers: 'Users',
      tabClients: 'Clients',
      tabArticles: 'Articles',
      tabMovements: 'Movements',
      tabEmail: 'Email Server',
      addUser: 'New User',
      addClient: 'New Client',
      addArticle: 'New Article',
      importArticles: 'Import Articles',
      importMovements: 'Import Movements',
      serverEmail: 'Email Server Settings',
      save: 'Save',
      cancel: 'Cancel',
      userFullName: 'Full Name',
      userEmail: 'Email',
      userPassword: 'Initial Password',
      userRole: 'Role / Profile',
      userCompany: 'Company',
      userClientAssoc: 'Associated Client',
      userActive: 'Active Account',
      clientName: 'Client / Company Name',
      clientSigla: 'Acronym (e.g.: BCN)',
      clientNif: 'Tax ID',
      clientEmail: 'Main Email',
      clientPhone: 'Phone',
      clientAddress: 'Address',
      clientPostalCode: 'Postal Code',
      clientCity: 'City',
      clientTipoCliente: 'Client Type',
      tipoClienteSf: 'SF (Without Invoicing)',
      tipoClienteCf: 'CF (With Invoicing)',
      clientPrimaveraCode: 'Primavera Code (ERP)',
      clientActive: 'Active Client',
      articleCode: 'Article Code',
      articleDesc: 'Description',
      articleType: 'Article Type',
      articleStorage: 'Storage Condition',
      articlePva: 'PVA (€)',
      articleActive: 'Active Article',
      testEmail: 'Test Email',
      testEmailSend: 'Send Test Email',
      testEmailSending: 'Sending test email...',
    },
    login: {
      title: 'Plataforma Farma',
      welcome: 'Integrated Logistics Platform Access',
      userEmail: 'User Email',
      password: 'Password',
      rememberMe: 'Remember me',
      forgotPassword: 'Forgot password?',
      forgotPasswordAlert: 'To recover your password, please contact the Sermail systems administrator.',
      loginButton: 'Sign In',
      authenticating: 'Authenticating...',
      support: 'Contact Support',
      privacy: 'Privacy',
      terms: 'Terms',
      copyright: '© 2026 Sermail, Logística Integrada Lda.',
      invalidCredentials: 'Invalid credentials. Please verify your email and password.',
      emailNotConfirmed: 'Email has not been confirmed yet.',
      accountInactive: 'This user account is inactive. Please contact the administrator.',
      loginSuccess: 'Authentication successful! Redirecting...',
    },
  },
};
