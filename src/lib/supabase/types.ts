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
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export type TipoArtigo = 'MH' | 'MV' | 'DM' | 'DC' | 'SC';

export const TIPO_ARTIGO_LABELS: Record<TipoArtigo, string> = {
  MH: 'Medicamento de uso humano',
  MV: 'Medicamento de uso veterinário',
  DM: 'Dispositivo médico',
  DC: 'Dermo-Cosmético',
  SC: 'Substância controlada',
};

export type TipoArmazenamento = 'TA' | 'TC' | 'TF';

export const TIPO_ARMAZENAMENTO_LABELS: Record<TipoArmazenamento, string> = {
  TA: 'Temperatura Ambiente',
  TC: 'Temperatura controlada (15-25 ºC)',
  TF: 'Temperatura controlada frio (2-8 ºC)',
};

export interface Artigo {
  id: string;
  artigo_id: string;
  descricao: string;
  tipo_artigo: TipoArtigo;
  tipo_armazenamento: TipoArmazenamento;
  tratamento_lote: boolean;
  tratamento_serie: boolean;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export type TipoArmazem = '01' | '02' | '03' | '04' | '05' | '06' | '07';

export const TIPO_ARMAZEM_LABELS: Record<TipoArmazem, string> = {
  '01': 'Venda',
  '02': 'Expirados',
  '03': 'Danificados',
  '04': 'Devoluções',
  '05': 'Quarentena',
  '06': 'Destruição',
  '07': 'Farmacoteca',
};

export interface Armazem {
  tipo_armazem: TipoArmazem;
  descricao: string;
  created_at?: string;
  updated_at?: string;
}
