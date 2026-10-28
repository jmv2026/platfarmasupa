export type UserRole = 'admin' | 'gestor' | 'user1' | 'user2' | 'user3';

export interface PerfilPermissoes {
  all?: boolean;
  admin?: boolean;
  gestor?: boolean;
  dashboard?: boolean;
  clientes?: {
    read?: boolean;
    write?: boolean;
    delete?: boolean;
  };
  utilizadores?: {
    read?: boolean;
    write?: boolean;
    delete?: boolean;
  };
  artigos?: {
    read?: boolean;
    write?: boolean;
    delete?: boolean;
  };
  armazens?: {
    read?: boolean;
    write?: boolean;
    delete?: boolean;
  };
  movimentos?: {
    read?: boolean;
    write?: boolean;
    delete?: boolean;
  };
  pedidos?: {
    read?: boolean;
    write?: boolean;
    delete?: boolean;
  };
  [key: string]: unknown;
}

export interface Perfil {
  codigo: UserRole;
  nome: string;
  descricao: string | null;
  permissoes: PerfilPermissoes;
  created_at?: string;
  updated_at?: string;
}

export type IdiomaUtilizador = 'PT' | 'EN' | 'ES';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  empresa: string | null;
  cliente_id: string | null;
  idioma?: IdiomaUtilizador | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export type TipoCliente = 'CF' | 'SF';

export const TIPO_CLIENTE_LABELS: Record<TipoCliente, string> = {
  CF: 'Com Faturação (CF)',
  SF: 'Sem Faturação (SF)',
};

export interface Cliente {
  id: string;
  name: string;
  sigla: string;
  tipo_cliente: TipoCliente;
  nif: string | null;
  email: string | null;
  telefone: string | null;
  morada: string | null;
  cod_postal?: string | null;
  localidade?: string | null;
  cli_primavera?: string | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export type Client = Cliente;

export type TipoArtigo = 'MH' | 'MV' | 'DM' | 'DC' | 'SC' | 'SA';

export const TIPO_ARTIGO_LABELS: Record<TipoArtigo, string> = {
  MH: 'Medicamento de uso humano',
  MV: 'Medicamento de uso veterinário',
  DM: 'Dispositivo médico',
  DC: 'Dermo-Cosmético',
  SC: 'Substância controlada',
  SA: 'Suplemento alimentar',
};

export const ID_TIPO_ARTIGO_MAP: Record<string, TipoArtigo> = {
  '80': 'MH',
  '81': 'MV',
  '82': 'DM',
  '83': 'DC',
  '84': 'SA',
  '85': 'SC',
};

export const TIPO_ARTIGO_ID_MAP: Record<TipoArtigo, string> = {
  MH: '80',
  MV: '81',
  DM: '82',
  DC: '83',
  SA: '84',
  SC: '85',
};

export type TipoArmazenamento = 'TA' | 'TC' | 'TF';

export const TIPO_ARMAZENAMENTO_LABELS: Record<TipoArmazenamento, string> = {
  TA: 'Temperatura Ambiente',
  TC: 'Temperatura controlada (15-25 ºC)',
  TF: 'Temperatura controlada frio (2-8 ºC)',
};

export interface Artigo {
  artigo_id: string;
  artigo_cli: string;
  descricao: string;
  id_tipo_artigo?: string;
  tipo_artigo?: TipoArtigo;
  tipo_armazenamento: TipoArmazenamento;
  tratamento_lote: boolean;
  tratamento_serie: boolean;
  familia?: string | null;
  subfamilia?: string | null;
  cli_primavera?: string | null;
  pva?: number | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export type TipoArmazem = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '09' | '10';

export const TIPO_ARMAZEM_LABELS: Record<TipoArmazem, string> = {
  '01': 'Venda',
  '02': 'Expirados',
  '03': 'Danificados',
  '04': 'Devoluções',
  '05': 'Quarentena',
  '06': 'Destruição',
  '07': 'Farmacoteca',
  '09': 'Validade',
  '10': 'MIA',
};

export interface Armazem {
  tipo_armazem: TipoArmazem;
  descricao: string;
  created_at?: string;
  updated_at?: string;
}

export type TipoMovimento = 'es' | 'ss' | 'et' | 'st';

export const TIPO_MOVIMENTO_LABELS: Record<TipoMovimento, string> = {
  es: 'Entrada de Stock',
  ss: 'Saída de Stock',
  et: 'Entrada por Transferência',
  st: 'Saída por Transferência',
};

export interface Movimento {
  id: string;
  artigo_cli: string;
  cliente_id: string;

  sigla?: string | null;
  tipo_movimento: TipoMovimento;
  quantidade: number;
  tipo_armazem: TipoArmazem;
  armazem_loc: string;
  posicao: string | null;
  lote: string | null;
  nr_serie: string | null;
  validade: string | null;
  data_fabrico: string | null;
  data_movimento: string;
  documento_ref?: string | null;
  tipo_doc?: string | null;
  observacoes?: string | null;

  // 25 campos alinhados com plat_movimentos
  data?: string | null;
  cli_primavera?: string | null;
  cliente_ser?: string | null;
  tipomovimento?: string | null;
  documento?: string | null;
  chave1?: string | null;
  chave2?: string | null;
  entidade?: string | null;
  totaliva?: number | null;
  totalmerc?: number | null;
  totaloutros?: number | null;
  totaldesc?: number | null;
  requisicao?: string | null;
  numcontribuinte?: string | null;
  nome?: string | null;
  morada?: string | null;
  localidade?: string | null;
  codpostal?: string | null;
  codpostallocalidade?: string | null;
  pais?: string | null;
  nomeentrega?: string | null;
  entidadeentrega?: string | null;
  moradaentrega?: string | null;
  localidadeentrega?: string | null;
  codpostalentrega?: string | null;

  // Campos de compatibilidade / legado
  cod_postal?: string | null;
  cod_postal_localidade?: string | null;
  total_iva?: number | null;
  total_merc?: number | null;
  total_outros?: number | null;
  total_desc?: number | null;
  num_linha?: number | null;
  doc_linha?: string | null;
  num_registo?: number | null;
  num_chave1?: number | null;
  num_chave2?: number | null;
  valor_unitario?: number | null;
  valor_adicional?: number | null;
  valor_abater?: number | null;
  estado_stock?: string | null;
  familia?: string | null;
  sub_familia?: string | null;
  sistema?: boolean | null;
  ativa?: boolean | null;
  chave_ativa?: boolean | null;
  tipo_artigo?: string | null;
  ref_ser?: string | null;
  num_contribuinte?: string | null;
  nome_entrega?: string | null;
  entidade_entrega?: string | null;
  morada_entrega?: string | null;
  localidade_entrega?: string | null;
  cod_postal_entrega?: string | null;
  cod_postal_localidade_entrega?: string | null;
  num_doc?: string | null;
  artigo_id?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MovimentoLinha {
  doc_linha: string; // PRIMARY KEY
  documento_ref: string;
  num_linha?: number | null;
  data?: string | null;
  data_movimento?: string | null;
  cliente_ser?: string | null;
  cli_primavera?: string | null;
  sigla?: string | null;
  documento?: string | null;
  tipo_doc?: string | null;
  num_doc?: string | null;
  chave1?: string | null;
  chave2?: string | null;
  valor_unitario?: number | null;
  valor_adicional?: number | null;
  valor_abater?: number | null;
  artigo?: string | null;
  artigo_id?: string | null;
  artigo_cli?: string | null;
  descricao?: string | null;
  tipo_artigo?: string | null;
  armazem?: string | null;
  localizacao?: string | null;
  posicao?: string | null;
  lote?: string | null;
  quantidade: number;
  familia?: string | null;
  sub_familia?: string | null;
  data_fabrico?: string | null;
  validade?: string | null;
  tipo_movimento: string;
  tipo_armazem?: string | null;
  armazem_loc?: string | null;
  entidade?: string | null;
  total_iva?: number | null;
  total_merc?: number | null;
  total_outros?: number | null;
  totaldesc?: number | null;
  total_desc?: number | null;
  requisicao?: string | null;
  num_contribuinte?: string | null;
  nome?: string | null;
  morada?: string | null;
  localidade?: string | null;
  cod_postal?: string | null;
  cod_postal_localidade?: string | null;
  pais?: string | null;
  nome_entrega?: string | null;
  entidade_entrega?: string | null;
  morada_entrega?: string | null;
  localidade_entrega?: string | null;
  cod_postal_entrega?: string | null;
  observacoes?: string | null;
  observacoes_linha?: string | null;
  nr_serie?: string | null;
  ref_ser?: string | null;
  estado_stock?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type MovimentoSF = Movimento;

export interface PlatMovimento {
  // 43 Campos do Perfil ERP
  documento_ref?: string | null;
  data?: string | null;
  cliente_ser?: string | null;
  tipo_movimento?: string | null;
  documento?: string | null;
  num_linha?: number | null;
  doc_linha: string; // PRIMARY KEY
  chave1?: string | null;
  chave2?: string | null;
  valor_unitario?: number | null;
  valor_adicional?: number | null;
  valor_abater?: number | null;
  descricao?: string | null;
  tipo_artigo?: string | null;
  armazem?: string | null;
  localizacao?: string | null;
  lote?: string | null;
  quantidade?: number | null;
  familia?: string | null;
  sub_familia?: string | null;
  sub_Familia?: string | null;
  data_fabrico?: string | null;
  validade?: string | null;
  entidade?: string | null;
  total_iva?: number | null;
  total_merc?: number | null;
  total_outros?: number | null;
  totaldesc?: number | null;
  requisicao?: string | null;
  num_contribuinte?: string | null;
  nome?: string | null;
  morada?: string | null;
  localidade?: string | null;
  cod_postal?: string | null;
  cod_postal_localidade?: string | null;
  pais?: string | null;
  nome_entrega?: string | null;
  entidade_entrega?: string | null;
  morada_entrega?: string | null;
  localidade_entrega?: string | null;
  cod_postal_entrega?: string | null;
  observacoes?: string | null;
  tipo_doc?: string | null;
  num_doc?: string | null;

  // Campos opcionais / integração / auditoria
  cli_primavera?: string | null;
  artigo_id?: string | null;
  artigo_cli?: string | null;
  created_at?: string;

  // Aliases de compatibilidade
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
  sigla?: string | null;
  data_movimento?: string | null;
  artigo?: string | null;
}

export interface StockAtual {
  cliente_id: string;

  cliente_nome: string;
  cliente_sigla: string;
  artigo_id: string;
  artigo_cli: string;
  descricao: string | null;
  tipo_artigo: TipoArtigo;
  tipo_armazenamento: TipoArmazenamento;
  tipo_armazem: TipoArmazem;
  armazem_descricao: string;
  armazem_loc: string;
  lote: string | null;
  data_stock?: string | null;
  validade: string | null;
  data_fabrico: string | null;
  stock: number;
  ultimo_movimento: string;
  stock_id?: string | null;
}

export interface StockPedido {
  cliente_id: string;

  cliente_nome: string;
  cliente_sigla: string;
  artigo_id: string;
  artigo_cli: string;
  descricao: string | null;
  tipo_artigo: TipoArtigo;
  tipo_armazenamento: TipoArmazenamento;
  lote: string | null;
  data_stock?: string | null;
  validade: string | null;
  data_fabrico: string | null;
  stock: number;
  ultimo_movimento: string;
}

export interface StockZero {
  cliente_id: string;
  cliente_nome: string;
  cliente_sigla: string;
  artigo_id: string;
  artigo_cli: string;
  descricao: string | null;
  tipo_artigo?: TipoArtigo | string;
  tipo_armazenamento?: TipoArmazenamento | string;
  familia?: string | null;
  subfamilia?: string | null;
  stock: number;
  ultimo_movimento: string | null;
  total_movimentos: number;
  lotes_historico: string;
}

export type StatusPedido = 'pendente' | 'confirmado' | 'em_preparacao' | 'expedido' | 'entregue' | 'cancelado';

export const STATUS_PEDIDO_LABELS: Record<StatusPedido, string> = {
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  em_preparacao: 'Em Preparação',
  expedido: 'Expedido',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export const CLASSIFICACOES_DESTINO = [
  'Farmácia',
  'Grupos Farmacia',
  'Hospital',
  'Grossista / Distribuidor',
  'Exportação',
  'Clínica / Centro de Saúde',
  'Laboratório',
  'Outro',
] as const;

export type ClassificacaoDestino = (typeof CLASSIFICACOES_DESTINO)[number] | string;

export interface Destino {
  id: string;
  cliente_id: string;

  codigo: string;
  nome: string;
  cli_primavera?: string | null;
  classifica_destino?: string | null;
  morada: string;
  codigo_postal: string;
  localidade: string;
  pais: string;
  nif?: string | null;
  telefone?: string | null;
  email?: string | null;
  observacoes?: string | null;
  ativo: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface NovoDestinoInput {
  cliente_id: string;

  nome: string;
  cli_primavera?: string;
  classifica_destino?: string;
  morada: string;
  codigo_postal: string;
  localidade: string;
  pais?: string;
  nif?: string;
  telefone?: string;
  email?: string;
  observacoes?: string;
}

export interface Pedido {
  id: string;
  nr_pedido: string;
  ref_documento: string | null;
  cliente_id: string;

  destino_id?: string | null;
  classifica_destino?: string | null;
  nome_destinatario: string;
  morada: string;
  codigo_postal: string;
  localidade: string;
  pais: string;
  data_pedido: string;
  data_entrega: string | null;
  status: StatusPedido | string;
  observacoes: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PedidoLinha {
  id: string;
  pedido_id: string;
  cliente_id: string;

  artigo_id: string;
  artigo_cli: string;
  artigo_codigo?: string;
  descricao: string;
  lote: string;
  validade: string | null;
  quantidade: number;
  created_at?: string;
}

export interface PedidoComLinhas extends Pedido {
  clientes?: Cliente;
  clients?: Client;
  destinos?: Destino;
  pedido_linhas?: PedidoLinha[];
  tipo_movimento?: string;
  requisicao?: string | null;
  cod_postal?: string | null;
  cod_postal_localidade?: string | null;
}

export interface NovaLinhaPedidoInput {
  artigo_id: string;
  artigo_cli: string;
  artigo_codigo?: string;
  descricao: string;
  lote: string;
  validade: string | null;
  quantidade: number;
  stock_disponivel?: number;
}

export interface NovoPedidoInput {
  cliente_id: string;

  destino_id?: string | null;
  guardar_novo_destino?: boolean;
  cli_primavera?: string;
  classifica_destino?: string;
  ref_documento?: string;
  nome_destinatario: string;
  morada: string;
  codigo_postal: string;
  localidade: string;
  pais: string;
  data_pedido: string;
  data_entrega?: string;
  observacoes?: string;
  linhas: NovaLinhaPedidoInput[];
}


export interface Tempo {
  id: string;
  id_cliente: string;
  sigla: string;
  VAL_MH: number;
  EXP_MH: number;
  VAL_MV: number;
  EXP_MV: number;
  VAL_DM: number;
  EXP_DM: number;
  VAL_DC: number;
  EXP_DC: number;
  VAL_SA: number;
  EXP_SA: number;
  created_at?: string;
  updated_at?: string;
}

export interface LogAcesso {
  id: string;
  user_id?: string | null;
  nome: string;
  email?: string | null;
  role?: string | null;
  cliente_id?: string | null;
  cliente_sigla?: string | null;
  empresa?: string | null;
  tipo_movimento: 'LOGIN' | 'LOGOUT';
  data: string;
  hora: string;
  ip_address?: string | null;
  user_agent?: string | null;
  observacoes?: string | null;
  created_at?: string;
}
