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

export interface Artigo {
  id: string;
  artigo_id: string;
  descricao: string;
  tipo_artigo: 'MH' | 'MV' | 'DM' | 'DC' | 'SC';
  tipo_armazenamento: 'TA' | 'TC' | 'TF';
  tratamento_lote: boolean;
  tratamento_serie: boolean;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Armazem {
  tipo_armazem: '01' | '02' | '03' | '04' | '05' | '06' | '07';
  descricao: string;
  created_at?: string;
  updated_at?: string;
}
