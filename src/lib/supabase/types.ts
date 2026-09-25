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

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  empresa: string | null;
  client_id: string | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id: string;
  name: string;
  sigla: string;
  nif: string | null;
  email: string | null;
  telefone: string | null;
  morada: string | null;
  cod_postal?: string | null;
  localidade?: string | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export type TipoArtigo = 'MH' | 'MV' | 'DM' | 'DC' | 'SC' | 'SA';

export const TIPO_ARTIGO_LABELS: Record<TipoArtigo, string> = {
  MH: 'Medicamento de uso humano',
  MV: 'Medicamento de uso veterinário',
  DM: 'Dispositivo médico',
  DC: 'Dermo-Cosmético',
  SC: 'Substância controlada',
  SA: 'Suplemento alimentar',
};

export type TipoArmazenamento = 'TA' | 'TC' | 'TF';

export const TIPO_ARMAZENAMENTO_LABELS: Record<TipoArmazenamento, string> = {
  TA: 'Temperatura Ambiente',
  TC: 'Temperatura controlada (15-25 ºC)',
  TF: 'Temperatura controlada frio (2-8 ºC)',
};

export interface Artigo {
  artigo_id: string;
  descricao: string;
  tipo_artigo: TipoArtigo;
  tipo_armazenamento: TipoArmazenamento;
  tratamento_lote: boolean;
  tratamento_serie: boolean;
  pva?: number | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export type TipoArmazem = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '10';

export const TIPO_ARMAZEM_LABELS: Record<TipoArmazem, string> = {
  '01': 'Venda',
  '02': 'Expirados',
  '03': 'Danificados',
  '04': 'Devoluções',
  '05': 'Quarentena',
  '06': 'Destruição',
  '07': 'Farmacoteca',
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
  artigo_id: string;
  client_id: string;
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
  observacoes?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StockAtual {
  client_id: string;
  cliente_nome: string;
  cliente_sigla: string;
  artigo_id: string;
  artigo_codigo: string;
  artigo_descricao: string;
  tipo_artigo: TipoArtigo;
  tipo_armazenamento: TipoArmazenamento;
  tipo_armazem: TipoArmazem;
  armazem_descricao: string;
  armazem_loc: string;
  lote: string | null;
  validade: string | null;
  data_fabrico: string | null;
  stock: number;
  ultimo_movimento: string;
}

export interface StockPedido {
  client_id: string;
  cliente_nome: string;
  cliente_sigla: string;
  artigo_id: string;
  artigo_codigo: string;
  artigo_descricao: string;
  tipo_artigo: TipoArtigo;
  tipo_armazenamento: TipoArmazenamento;
  lote: string | null;
  validade: string | null;
  data_fabrico: string | null;
  stock: number;
  ultimo_movimento: string;
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

export interface Destino {
  id: string;
  client_id: string;
  codigo: string;
  nome: string;
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
  client_id: string;
  nome: string;
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
  client_id: string;
  destino_id?: string | null;
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
  client_id: string;
  artigo_id: string;
  artigo_codigo: string;
  descricao: string;
  lote: string;
  validade: string | null;
  quantidade: number;
  created_at?: string;
}

export interface PedidoComLinhas extends Pedido {
  clients?: Client;
  destinos?: Destino;
  pedido_linhas?: PedidoLinha[];
}

export interface NovaLinhaPedidoInput {
  artigo_id: string;
  artigo_codigo: string;
  descricao: string;
  lote: string;
  validade: string | null;
  quantidade: number;
  stock_disponivel?: number;
}

export interface NovoPedidoInput {
  client_id: string;
  destino_id?: string | null;
  guardar_novo_destino?: boolean;
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

export interface ImpStk {
  artigo: string | null;
  descricao: string | null;
  armazem: string | null;
  lote: string | null;
  estado_stock: string | null;
  stk: number;
  datastock: string | null;
  bloqueado: boolean;
  familia: string | null;
  tipo_artigo: string | null;
  sub_familia: string | null;
  created_at?: string;
}

export interface ImpStkInput {
  artigo?: string;
  descricao?: string;
  armazem?: string;
  lote?: string;
  estado_stock?: string;
  stk?: number;
  datastock?: string;
  bloqueado?: boolean | string;
  familia?: string;
  tipo_artigo?: string;
  sub_familia?: string;
}
