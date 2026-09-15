'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { UserRole, TipoArtigo, TipoArmazenamento } from '@/lib/supabase/types';

// 1. AÇÃO: Criar Utilizador (Acesso restrito a Admin)
export async function criarUtilizadorAction(input: {
  email: string;
  password?: string;
  full_name: string;
  role: UserRole;
  empresa: string;
  client_id?: string | null;
  ativo?: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicie sessão como Administrador.' };
  }

  // Verificar perfil de administrador
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Acesso negado: Apenas administradores podem criar utilizadores.' };
  }

  if (!input.email || !input.full_name || !input.role) {
    return { success: false, error: 'Preencha todos os campos obrigatórios do utilizador.' };
  }

  const userPassword = input.password || '123456';
  if (userPassword.length < 6) {
    return { success: false, error: 'A password deve conter pelo menos 6 carateres.' };
  }

  try {
    // 1. Criar utilizador no Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: userPassword,
      options: {
        data: {
          full_name: input.full_name,
          role: input.role,
          empresa: input.empresa || 'Sermail, Logística Integrada Lda',
        },
      },
    });

    if (authErr) {
      return { success: false, error: `Erro ao registar credenciais: ${authErr.message}` };
    }

    const createdUserId = authData.user?.id;
    if (!createdUserId) {
      return { success: false, error: 'Erro ao obter ID do novo utilizador.' };
    }

    // 2. Garantir que o perfil na tabela public.users está completo
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', createdUserId)
      .single();

    if (!existingUser) {
      const { error: insertUserErr } = await supabase.from('users').insert({
        id: createdUserId,
        email: input.email.trim().toLowerCase(),
        full_name: input.full_name,
        role: input.role,
        empresa: input.empresa || 'Sermail, Logística Integrada Lda',
        client_id: input.client_id || null,
        ativo: input.ativo !== undefined ? input.ativo : true,
      });

      if (insertUserErr) {
        console.error('Erro ao inserir em public.users:', insertUserErr);
      }
    } else {
      await supabase
        .from('users')
        .update({
          full_name: input.full_name,
          role: input.role,
          empresa: input.empresa || 'Sermail, Logística Integrada Lda',
          client_id: input.client_id || null,
          ativo: input.ativo !== undefined ? input.ativo : true,
        })
        .eq('id', createdUserId);
    }

    revalidatePath('/configuracao');
    revalidatePath('/dashboard');

    return { success: true, userId: createdUserId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado';
    return { success: false, error: msg };
  }
}

// 2. AÇÃO: Criar Cliente (Validação de Sigla <= 4 carateres)
export async function criarClienteAction(input: {
  name: string;
  sigla: string;
  nif?: string;
  email?: string;
  telefone?: string;
  morada?: string;
  ativo?: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicie sessão como Administrador.' };
  }

  // Verificar perfil de administrador
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Acesso negado: Apenas administradores podem criar clientes.' };
  }

  if (!input.name || !input.sigla) {
    return { success: false, error: 'Nome e Sigla são obrigatórios.' };
  }

  const siglaFormatada = input.sigla.trim().toUpperCase();
  if (siglaFormatada.length > 4) {
    return {
      success: false,
      error: 'A Sigla regulamentar do cliente não pode exceder 4 carateres (ex: PFIZ, NOVA, BAYR).',
    };
  }

  try {
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .insert({
        name: input.name.trim(),
        sigla: siglaFormatada,
        nif: input.nif?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        telefone: input.telefone?.trim() || null,
        morada: input.morada?.trim() || null,
        ativo: input.ativo !== undefined ? input.ativo : true,
      })
      .select()
      .single();

    if (clientErr) {
      if (clientErr.code === '23505') {
        return { success: false, error: `Já existe um cliente com a sigla '${siglaFormatada}'.` };
      }
      return { success: false, error: `Erro ao criar cliente: ${clientErr.message}` };
    }

    revalidatePath('/configuracao');
    revalidatePath('/pedidos');
    revalidatePath('/dashboard');

    return { success: true, client };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado';
    return { success: false, error: msg };
  }
}

// 3. AÇÃO: Criar Artigo (Validação de Tipos Regulamentares)
export async function criarArtigoAction(input: {
  artigo_id: string;
  descricao: string;
  tipo_artigo: TipoArtigo;
  tipo_armazenamento: TipoArmazenamento;
  tratamento_lote?: boolean;
  tratamento_serie?: boolean;
  ativo?: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicie sessão como Administrador.' };
  }

  // Verificar perfil de administrador
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Acesso negado: Apenas administradores podem criar artigos.' };
  }

  if (!input.artigo_id || !input.descricao || !input.tipo_artigo || !input.tipo_armazenamento) {
    return { success: false, error: 'Preencha todos os campos obrigatórios do artigo.' };
  }

  const codigoFormatado = input.artigo_id.trim().toUpperCase();

  try {
    const { data: artigo, error: artigoErr } = await supabase
      .from('artigos')
      .insert({
        artigo_id: codigoFormatado,
        descricao: input.descricao.trim(),
        tipo_artigo: input.tipo_artigo,
        tipo_armazenamento: input.tipo_armazenamento,
        tratamento_lote: input.tratamento_lote !== undefined ? input.tratamento_lote : true,
        tratamento_serie: input.tratamento_serie !== undefined ? input.tratamento_serie : false,
        ativo: input.ativo !== undefined ? input.ativo : true,
      })
      .select()
      .single();

    if (artigoErr) {
      if (artigoErr.code === '23505') {
        return { success: false, error: `Já existe um artigo com o código '${codigoFormatado}'.` };
      }
      return { success: false, error: `Erro ao criar artigo: ${artigoErr.message}` };
    }

    revalidatePath('/configuracao');
    revalidatePath('/pedidos');
    revalidatePath('/dashboard');

    return { success: true, artigo };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado';
    return { success: false, error: msg };
  }
}

// 4. AÇÃO: Enviar Email de Teste para o Administrador (Aba Email)
export async function enviarEmailTesteConfigAction(destinatarioCustom?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, recipients: [] as string[], error: 'Sessão expirada. Inicie sessão como Administrador.' };
  }

  // Verificar perfil de administrador
  const { data: profile } = await supabase
    .from('users')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { success: false, recipients: [] as string[], error: 'Acesso negado: Apenas administradores podem disparar emails de teste.' };
  }

  const { enviarEmailTesteAdmin } = await import('@/lib/email');

  const rawInput = destinatarioCustom?.trim() || profile.email || user.email || 'jccmmelo@gmail.com, joao.melo@sermail.pt';
  const listaDestinatarios = rawInput.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);

  const result = await enviarEmailTesteAdmin({
    destinatarios: listaDestinatarios,
    solicitanteNome: profile.full_name || 'Administrador Farma',
    solicitanteEmail: user.email || profile.email || 'admin@sermail.pt',
  });

  return result;
}

