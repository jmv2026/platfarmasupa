'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { UserRole, TipoArmazenamento, TipoCliente } from '@/lib/supabase/types';
import { ArtigoImportInput, parseArtigoBoolean } from '@/lib/parse-artigos-file';
import { PlatMovimentoRow, preparePlatMovimentoForDb } from '@/lib/parse-erp-file';
import type { StockImportRow } from '@/lib/parse-stock-file';

// Helper para validar de forma resiliente permissões de Admin e Gestor
function checkUserRole(
  user: { email?: string | null; user_metadata?: Record<string, any>; app_metadata?: Record<string, any> } | null | undefined,
  profile?: { role?: string | null } | null
) {
  const email = user?.email?.trim().toLowerCase() || '';
  const isAdmin =
    email === 'admin@sermail.pt' ||
    profile?.role === 'admin' ||
    user?.app_metadata?.role === 'admin' ||
    user?.user_metadata?.role === 'admin';

  const isGestor =
    profile?.role === 'gestor' ||
    user?.app_metadata?.role === 'gestor' ||
    user?.user_metadata?.role === 'gestor';

  return {
    isAdmin,
    isGestor,
    isManagerOrAdmin: isAdmin || isGestor,
  };
}

// 1. AÇÃO: Criar Utilizador (Acesso restrito a Admin)
export async function criarUtilizadorAction(input: {
  email: string;
  password?: string;
  full_name: string;
  role: UserRole;
  empresa: string;
  cliente_id?: string | null;

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

  const { isAdmin } = checkUserRole(user, profile);
  if (!isAdmin) {
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
        cliente_id: input.cliente_id ?? null,
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
          cliente_id: input.cliente_id ?? null,
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

export interface ClienteTemposInput {
  VAL_MH?: number;
  EXP_MH?: number;
  VAL_MV?: number;
  EXP_MV?: number;
  VAL_DM?: number;
  EXP_DM?: number;
  VAL_DC?: number;
  EXP_DC?: number;
  VAL_SA?: number;
  EXP_SA?: number;
}

// 2. AÇÃO: Criar Cliente (Validação de Sigla <= 4 carateres e criação de tempos)
export async function criarClienteAction(input: {
  name: string;
  sigla: string;
  tipo_cliente?: TipoCliente;
  cli_primavera?: string;
  nif?: string;
  email?: string;
  telefone?: string;
  morada?: string;
  cod_postal?: string;
  localidade?: string;
  ativo?: boolean;
  tempos?: ClienteTemposInput;
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

  const { isAdmin } = checkUserRole(user, profile);
  if (!isAdmin) {
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
      .from('clientes')
      .insert({
        name: input.name.trim(),
        sigla: siglaFormatada,
        tipo_cliente: input.tipo_cliente || 'SF',
        cli_primavera: input.cli_primavera?.trim() || null,
        nif: input.nif?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        telefone: input.telefone?.trim() || null,
        morada: input.morada?.trim() || null,
        cod_postal: input.cod_postal?.trim() || null,
        localidade: input.localidade?.trim() || null,
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

    // Registar tempos de validade e expiração para este cliente na tabela public.tempos
    const valMh = Number.isFinite(input.tempos?.VAL_MH) ? Number(input.tempos?.VAL_MH) : 180;
    const expMh = Number.isFinite(input.tempos?.EXP_MH) ? Number(input.tempos?.EXP_MH) : 60;
    const valMv = Number.isFinite(input.tempos?.VAL_MV) ? Number(input.tempos?.VAL_MV) : 180;
    const expMv = Number.isFinite(input.tempos?.EXP_MV) ? Number(input.tempos?.EXP_MV) : 60;
    const valDm = Number.isFinite(input.tempos?.VAL_DM) ? Number(input.tempos?.VAL_DM) : 180;
    const expDm = Number.isFinite(input.tempos?.EXP_DM) ? Number(input.tempos?.EXP_DM) : 60;
    const valDc = Number.isFinite(input.tempos?.VAL_DC) ? Number(input.tempos?.VAL_DC) : 180;
    const expDc = Number.isFinite(input.tempos?.EXP_DC) ? Number(input.tempos?.EXP_DC) : 60;
    const valSa = Number.isFinite(input.tempos?.VAL_SA) ? Number(input.tempos?.VAL_SA) : 180;
    const expSa = Number.isFinite(input.tempos?.EXP_SA) ? Number(input.tempos?.EXP_SA) : 60;

    const { error: temposErr } = await supabase.from('tempos').insert({
      id_cliente: client.id,
      sigla: siglaFormatada,
      VAL_MH: valMh,
      EXP_MH: expMh,
      VAL_MV: valMv,
      EXP_MV: expMv,
      VAL_DM: valDm,
      EXP_DM: expDm,
      VAL_DC: valDc,
      EXP_DC: expDc,
      VAL_SA: valSa,
      EXP_SA: expSa,
    });

    if (temposErr) {
      console.error('Erro ao registar tempos na criação do cliente:', temposErr);
    }

    revalidatePath('/configuracao');
    revalidatePath('/pedidos');
    revalidatePath('/stocks');
    revalidatePath('/dashboard');

    return { success: true, client };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado';
    return { success: false, error: msg };
  }
}

// 2.1 AÇÃO: Atualizar Tempos de Armazém de um Cliente
export async function atualizarTemposClienteAction(input: {
  id_cliente: string;
  sigla?: string;
  tempos: ClienteTemposInput;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicie sessão como Administrador.' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const { isManagerOrAdmin } = checkUserRole(user, profile);
  if (!isManagerOrAdmin) {
    return { success: false, error: 'Acesso negado: Apenas administradores ou gestores podem configurar tempos.' };
  }

  if (!input.id_cliente) {
    return { success: false, error: 'ID do cliente é obrigatório.' };
  }

  try {
    const valMh = Number.isFinite(input.tempos.VAL_MH) ? Number(input.tempos.VAL_MH) : 180;
    const expMh = Number.isFinite(input.tempos.EXP_MH) ? Number(input.tempos.EXP_MH) : 60;
    const valMv = Number.isFinite(input.tempos.VAL_MV) ? Number(input.tempos.VAL_MV) : 180;
    const expMv = Number.isFinite(input.tempos.EXP_MV) ? Number(input.tempos.EXP_MV) : 60;
    const valDm = Number.isFinite(input.tempos.VAL_DM) ? Number(input.tempos.VAL_DM) : 180;
    const expDm = Number.isFinite(input.tempos.EXP_DM) ? Number(input.tempos.EXP_DM) : 60;
    const valDc = Number.isFinite(input.tempos.VAL_DC) ? Number(input.tempos.VAL_DC) : 180;
    const expDc = Number.isFinite(input.tempos.EXP_DC) ? Number(input.tempos.EXP_DC) : 60;
    const valSa = Number.isFinite(input.tempos.VAL_SA) ? Number(input.tempos.VAL_SA) : 180;
    const expSa = Number.isFinite(input.tempos.EXP_SA) ? Number(input.tempos.EXP_SA) : 60;

    const { data: updated, error } = await supabase
      .from('tempos')
      .upsert(
        {
          id_cliente: input.id_cliente,
          sigla: input.sigla || null,
          VAL_MH: valMh,
          EXP_MH: expMh,
          VAL_MV: valMv,
          EXP_MV: expMv,
          VAL_DM: valDm,
          EXP_DM: expDm,
          VAL_DC: valDc,
          EXP_DC: expDc,
          VAL_SA: valSa,
          EXP_SA: expSa,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id_cliente' }
      )
      .select()
      .single();

    if (error) {
      return { success: false, error: `Erro ao atualizar tempos: ${error.message}` };
    }

    revalidatePath('/configuracao');
    revalidatePath('/stocks');
    revalidatePath('/dashboard');

    return { success: true, tempos: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado';
    return { success: false, error: msg };
  }
}

// 3. AÇÃO: Criar Artigo (Validação de Tipos Regulamentares)
export async function criarArtigoAction(input: {
  artigo_id: string;
  artigo_cli?: string;
  descricao: string;
  id_tipo_artigo: string;
  tipo_armazenamento: TipoArmazenamento;
  tratamento_lote?: boolean;
  tratamento_serie?: boolean;
  pva?: number;
  pvp?: number;
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

  const { isAdmin } = checkUserRole(user, profile);
  if (!isAdmin) {
    return { success: false, error: 'Acesso negado: Apenas administradores podem criar artigos.' };
  }

  if (!input.artigo_id || !input.descricao || !input.id_tipo_artigo || !input.tipo_armazenamento) {
    return { success: false, error: 'Preencha todos os campos obrigatórios do artigo.' };
  }

  const codigoFormatado = input.artigo_id.trim().toUpperCase();

  try {
    const { data: artigo, error: artigoErr } = await supabase
      .from('artigos')
      .insert({
        artigo_id: codigoFormatado,
        descricao: input.descricao.trim(),
        id_tipo_artigo: input.id_tipo_artigo,
        tipo_armazenamento: input.tipo_armazenamento,
        tratamento_lote: input.tratamento_lote !== undefined ? input.tratamento_lote : true,
        tratamento_serie: input.tratamento_serie !== undefined ? input.tratamento_serie : false,
        pva: (input.pva !== undefined && input.pva !== null)
          ? Number(input.pva)
          : (input.pvp !== undefined && input.pvp !== null ? Number(input.pvp) : 0.00),
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

// 3.1 AÇÃO: Limpar Todos os Artigos (Acesso restrito a Administradores e Gestores)
export async function limparArtigosAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicie sessão como Administrador.' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const { isManagerOrAdmin } = checkUserRole(user, profile);

  if (!isManagerOrAdmin) {
    return { success: false, error: 'Acesso negado: Apenas administradores e gestores podem limpar o catálogo de artigos.' };
  }

  try {
    const { error: deleteErr, count } = await supabase
      .from('artigos')
      .delete({ count: 'exact' })
      .neq('artigo_id', '');

    if (deleteErr) {
      if (deleteErr.code === '23503') {
        return {
          success: false,
          error: 'Não é possível limpar o catálogo de artigos pois existem movimentos de stock ou linhas de pedidos associados a estes artigos.',
        };
      }
      console.error('Erro ao limpar artigos:', deleteErr);
      return { success: false, error: `Erro ao limpar artigos: ${deleteErr.message}` };
    }

    revalidatePath('/configuracao');
    revalidatePath('/pedidos');
    revalidatePath('/dashboard');
    revalidatePath('/stocks');

    return { success: true, count: count ?? 0 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado ao limpar artigos';
    return { success: false, error: msg };
  }
}

// 3.2 AÇÃO: Importar Catálogo de Artigos em Lote (Upsert na tabela artigos)
export async function importarArtigosAction(rows: ArtigoImportInput[], fallbackSigla?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicie sessão como Administrador.' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const { isManagerOrAdmin } = checkUserRole(user, profile);

  if (!isManagerOrAdmin) {
    return { success: false, error: 'Acesso negado: Apenas administradores e gestores podem importar artigos.' };
  }

  if (!rows || rows.length === 0) {
    return { success: false, error: 'O ficheiro não contém artigos válidos para importar.' };
  }

  try {
    // 1. Garantir deduplicação estrita de artigo_cli para evitar erro de concorrência do Postgres (código 21000)
    const uniqueMap = new Map<string, ArtigoImportInput>();
    for (const r of rows) {
      const code = (r.artigo_id || '').trim().toUpperCase();
      if (code) {
        let cli = r.artigo_cli ? r.artigo_cli.trim() : '';
        const cliprim = r.cli_primavera ? r.cli_primavera.trim() : '';
        if (!cli && cliprim) {
          cli = cliprim + '-' + code;
        } else if (!cli && fallbackSigla) {
          cli = fallbackSigla + '-' + code;
        } else if (!cli) {
          cli = code; // Fallback se não houver sigla
        }

        uniqueMap.set(cli, {
          ...r,
          artigo_id: code,
          descricao: (r.descricao || '').trim() || code,
          artigo_cli: cli,
          cli_primavera: cliprim || undefined,
          familia: (r.familia || '').trim() || undefined,
          sub_familia: (r.sub_familia || r.subfamilia || '').trim() || undefined,
        });
      }
    }

    const uniqueRows = Array.from(uniqueMap.values());
    if (uniqueRows.length === 0) {
      return { success: false, error: 'Nenhum código de artigo válido encontrado.' };
    }

    const BATCH_SIZE = 250;
    let totalUpserted = 0;
    const allUpsertedData: any[] = [];

    for (let i = 0; i < uniqueRows.length; i += BATCH_SIZE) {
      const batch = uniqueRows.slice(i, i + BATCH_SIZE).map((r) => ({
        artigo_id: r.artigo_id,
        artigo_cli: r.artigo_cli,
        descricao: r.descricao,
        id_tipo_artigo: r.id_tipo_artigo || '80',
        tipo_armazenamento: r.tipo_armazenamento || 'TA',
        tratamento_lote: parseArtigoBoolean(r.tratamento_lote, true),
        tratamento_serie: parseArtigoBoolean(r.tratamento_serie, false),
        familia: r.familia || null,
        subfamilia: r.sub_familia || r.subfamilia || null,
        cli_primavera: r.cli_primavera || null,
        pva: r.pva !== undefined && r.pva !== null
          ? Number(r.pva)
          : (r.pvp !== undefined && r.pvp !== null ? Number(r.pvp) : 0.00),
        ativo: parseArtigoBoolean(r.ativo, true),
      }));

      const { data: upsertedBatch, error: upsertErr } = await supabase
        .from('artigos')
        .upsert(batch, { onConflict: 'artigo_cli' })
        .select();

      if (upsertErr) {
        console.error('Erro ao importar lote em artigos:', upsertErr);
        return {
          success: false,
          error: `Erro na gravação (lote ${Math.floor(i / BATCH_SIZE) + 1}): ${upsertErr.message}`,
        };
      }

      if (upsertedBatch) {
        allUpsertedData.push(...upsertedBatch);
      }
      totalUpserted += batch.length;
    }

    revalidatePath('/configuracao');
    revalidatePath('/pedidos');
    revalidatePath('/dashboard');
    revalidatePath('/stocks');

    return { success: true, count: totalUpserted, artigos: allUpsertedData };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado na importação de artigos';
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

  const { isAdmin } = checkUserRole(user, profile);
  if (!isAdmin) {
    return { success: false, recipients: [] as string[], error: 'Acesso negado: Apenas administradores podem disparar emails de teste.' };
  }

  const { enviarEmailTesteAdmin } = await import('@/lib/email');

  const rawInput = destinatarioCustom?.trim() || profile?.email || user.email || 'jccmmelo@gmail.com, joao.melo@sermail.pt';
  const listaDestinatarios = rawInput.split(/[,;\s]+/).map((e: string) => e.trim()).filter(Boolean);

  const result = await enviarEmailTesteAdmin({
    destinatarios: listaDestinatarios,
    solicitanteNome: profile?.full_name || 'Administrador Farma',
    solicitanteEmail: user.email || profile?.email || 'admin@sermail.pt',
  });

  return result;
}

// 8. AÇÃO: Limpar Registos das tabelas movimentos e movimentos_linhas (Acesso restrito a Admin)
export async function limparMovimentosAction(clienteId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicie sessão como Administrador.' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const { isAdmin } = checkUserRole(user, profile);
  if (!isAdmin) {
    return {
      success: false,
      error: 'Acesso negado: Apenas administradores podem limpar a tabela de movimentos.',
    };
  }

  try {
    let query = supabase.from('movimentos').delete({ count: 'exact' });
    if (clienteId && clienteId !== 'todos') {
      query = query.eq('cliente_id', clienteId);
    } else {
      query = query.neq('documento_ref', '');
    }

    const { error: deleteErr, count } = await query;

    if (deleteErr) {
      console.error('Erro ao limpar movimentos:', deleteErr);
      return { success: false, error: `Erro ao limpar movimentos: ${deleteErr.message}` };
    }

    revalidatePath('/configuracao');
    revalidatePath('/stocks');
    revalidatePath('/dashboard');
    revalidatePath('/pedidos');
    revalidatePath('/historico-pedidos');
    return { success: true, count: count ?? 0 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado ao limpar movimentos';
    return { success: false, error: msg };
  }
}


// 12. AÇÃO: Importar Movimentos ERP para plat_movimentos
export async function importarPlatMovimentosAction(
  rows: PlatMovimentoRow[],
  defaultClientId?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicie sessão como Administrador ou Gestor.' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, cliente_id')
    .eq('id', user.id)
    .single();

  const { isManagerOrAdmin } = checkUserRole(user, profile);
  if (!isManagerOrAdmin) {
    return { success: false, error: 'Acesso negado: Apenas administradores e gestores podem importar movimentos ERP.' };
  }

  if (!rows || rows.length === 0) {
    return { success: false, error: 'Nenhum registo de movimentos ERP fornecido para importação.' };
  }

  try {
    const { data: clientsData } = await supabase.from('clientes').select('id, sigla, name');
    const clientMapBySigla = new Map<string, string>();
    const clientMapById = new Map<string, string>();

    (clientsData || []).forEach((c) => {
      if (c.sigla) clientMapBySigla.set(c.sigla.toUpperCase(), c.id);
      if (c.id) clientMapById.set(c.id, c.sigla);
    });

    const fallbackClientId = defaultClientId || profile?.cliente_id;

    const BATCH_SIZE = 250;
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows
        .slice(i, i + BATCH_SIZE)
        .map((r) => preparePlatMovimentoForDb(r, fallbackClientId, clientMapBySigla, clientMapById));

      const { error: insertErr } = await supabase
        .from('plat_movimentos')
        .upsert(batch, { onConflict: 'doc_linha' });

      if (insertErr) {
        console.error('Erro ao gravar lote em plat_movimentos:', insertErr);
        return {
          success: false,
          error: `Erro na gravação (lote ${Math.floor(i / BATCH_SIZE) + 1}): ${insertErr.message}`,
        };
      }
      totalInserted += batch.length;
    }

    revalidatePath('/configuracao');
    return { success: true, count: totalInserted };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado na importação de plat_movimentos';
    return { success: false, error: msg };
  }
}

// 13. AÇÃO: Limpar Registos de plat_movimentos
export async function limparPlatMovimentosAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada.' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const { isAdmin } = checkUserRole(user, profile);
  if (!isAdmin) {
    return { success: false, error: 'Apenas administradores podem limpar a tabela plat_movimentos.' };
  }

  try {
    const { error } = await supabase.from('plat_movimentos').delete().neq('doc_linha', '');
    if (error) {
      return { success: false, error: error.message };
    }
    revalidatePath('/configuracao');
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao limpar plat_movimentos';
    return { success: false, error: msg };
  }
}




// 15. AÇÃO: Transferir de plat_movimentos para movimentos (1º Passo: Cabeçalhos/Documentos)
export async function transferirPlatMovimentosParaMovimentosAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicie sessão para continuar.' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const { isManagerOrAdmin } = checkUserRole(user, profile);
  if (!isManagerOrAdmin) {
    return { success: false, error: 'Acesso negado: Apenas administradores e gestores podem executar esta ação.' };
  }

  try {
    const { data, error } = await supabase.rpc('transferir_plat_movimentos_para_movimentos');
    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/configuracao');
    revalidatePath('/stocks');
    revalidatePath('/dashboard');
    revalidatePath('/pedidos');

    const linhas = typeof data === 'object' && data !== null 
      ? Number((data as any).linhas ?? (data as any).count ?? 0) 
      : (typeof data === 'number' ? data : 0);
    const documentos = typeof data === 'object' && data !== null 
      ? Number((data as any).documentos ?? 0) 
      : 0;

    return { 
      success: true, 
      count: linhas,
      linhas,
      documentos,
      data 
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao transferir movimentos';
    return { success: false, error: msg };
  }
}

// 10. AÇÃO: Criar artigos a partir da tabela plat_movimentos
export async function criarArtigosAPartirPlatMovimentosAction(clientId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicie sessão como Administrador.' };
  }

  try {
    const { data: client, error: clientErr } = await supabase
      .from('clientes')
      .select('sigla, cli_primavera')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) {
      return { success: false, error: 'Cliente não encontrado.' };
    }

    const clientSigla = client.sigla.toUpperCase();
    const clientCliPrimavera = client.cli_primavera || null;

    // Buscar artigos distintos da plat_movimentos
    const { data: movimentos, error: movErr } = await supabase
      .from('plat_movimentos')
      .select('artigo_id, artigo_cli, descricao, tipoartigo, familia, subfamilia, cli_primavera')
      .not('artigo_id', 'is', null);

    if (movErr || !movimentos) {
      return { success: false, error: 'Erro ao ler plat_movimentos.' };
    }

    // Remover duplicados por artigo_cli ou artigo_id
    const artigosMap = new Map<string, any>();
    movimentos.forEach((m) => {
      const artId = (m.artigo_id || '').trim().toUpperCase();
      if (!artId) return;

      const fallbackPrefix = clientCliPrimavera || m.cli_primavera || clientSigla;
      const artCli = m.artigo_cli?.trim() || `${fallbackPrefix}-${artId}`;
      const key = artCli.toUpperCase();

      if (!artigosMap.has(key)) {
        artigosMap.set(key, { ...m, artigo_id: artId, artigo_cli: artCli });
      }
    });

    const uniqueArtigos = Array.from(artigosMap.values());
    if (uniqueArtigos.length === 0) {
      return { success: false, error: 'Nenhum artigo encontrado em plat_movimentos.' };
    }

    const batch = uniqueArtigos.map((r) => {
      const tipoArt = (r.tipoartigo || '').trim().toUpperCase();
      return {
        artigo_id: r.artigo_id,
        artigo_cli: r.artigo_cli,
        descricao: r.descricao?.trim() || r.artigo_id,
        tipo_artigo: ['MH', 'MV', 'DM', 'DC', 'SC', '80', '84'].includes(tipoArt) ? tipoArt : 'MH',
        tipo_armazenamento: 'TA',
        familia: r.familia?.trim() || null,
        subfamilia: r.subfamilia?.trim() || null,
        cli_primavera: r.cli_primavera?.trim() || clientCliPrimavera || null,
        ativo: true
      };
    });

    // Inserir os artigos, ignorando duplicados
    const { error: insertErr } = await supabase.from('artigos').upsert(batch, { onConflict: 'artigo_cli' });

    if (insertErr) {
      console.error('Erro ao inserir artigos de plat_movimentos:', insertErr);
      return { success: false, error: 'Erro ao inserir artigos: ' + insertErr.message };
    }

    revalidatePath('/configuracao');
    revalidatePath('/dashboard');
    return { success: true, count: batch.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado ao criar artigos.';
    return { success: false, error: msg };
  }
}

// 12. AÇÃO: Importar ficheiro de Transporte (Torrestir) para a tabela torrestir_status
export async function importarTransporteAction(rows: any[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicie sessão.' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const { isManagerOrAdmin } = checkUserRole(user, profile);

  if (!isManagerOrAdmin) {
    return { success: false, error: 'Acesso negado: Apenas administradores e gestores podem importar transporte.' };
  }

  if (!rows || rows.length === 0) {
    return { success: false, error: 'O ficheiro não contém linhas de transporte válidas para importar.' };
  }

  try {
    const BATCH_SIZE = 500;
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: insertErr } = await supabase.from('torrestir_status').insert(batch);

      if (insertErr) {
        console.error('Erro ao inserir lote em torrestir_status:', insertErr);
        return { success: false, error: `Erro na gravação (lote ${Math.floor(i / BATCH_SIZE) + 1}): ${insertErr.message}` };
      }
      totalInserted += batch.length;
    }

    revalidatePath('/configuracao');
    return { success: true, count: totalInserted };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado na importação de transporte';
    return { success: false, error: msg };
  }
}

// 13. AÇÃO: Importar registos para a tabela public.stock
export async function importarStockAction(rows: StockImportRow[], defaultCliente?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicie sessão como Administrador ou Gestor.' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const { isManagerOrAdmin } = checkUserRole(user, profile);

  if (!isManagerOrAdmin) {
    return { success: false, error: 'Acesso negado: Apenas administradores e gestores podem importar stock.' };
  }

  if (!rows || rows.length === 0) {
    return { success: false, error: 'Nenhum registo de stock válido para importar.' };
  }

  try {
    const BATCH_SIZE = 500;
    let totalUpserted = 0;

    // Normalizar registos
    const preparedRows = rows.map((r) => {
      let cleanId = r.id?.trim();
      if (cleanId && cleanId.startsWith('{') && cleanId.endsWith('}')) {
        cleanId = cleanId.slice(1, -1).trim();
      }
      const artigoId = (r.artigo_id || r.artigo || '').trim();
      return {
        id: cleanId || undefined,
        cliente_ser: (r.cliente_ser || defaultCliente || '').trim(),
        entidade: r.entidade ? r.entidade.trim() : null,
        sigla: r.sigla ? r.sigla.trim() : (r.cliente_ser ? r.cliente_ser.trim() : null),
        artigo_id: artigoId,
        descricao: r.descricao ? r.descricao.trim() : null,
        armazem: (r.armazem || '').trim(),
        localizacao: r.localizacao ? r.localizacao.trim() : null,
        lote: r.lote ? r.lote.trim() : null,
        stock: Number(r.stock) || 0,
        data_stock: r.data_stock || null,
      };
    }).filter((r) => r.cliente_ser && r.artigo_id && r.armazem);

    if (preparedRows.length === 0) {
      return { success: false, error: 'Nenhum registo continha os campos obrigatórios (cliente_ser, artigo_id, armazem).' };
    }

    for (let i = 0; i < preparedRows.length; i += BATCH_SIZE) {
      const batch = preparedRows.slice(i, i + BATCH_SIZE);
      const { error: upsertErr } = await supabase
        .from('stock')
        .upsert(batch, { onConflict: 'id' });

      if (upsertErr) {
        console.error('Erro ao gravar lote na tabela stock:', upsertErr);
        return {
          success: false,
          error: `Erro na gravação (lote ${Math.floor(i / BATCH_SIZE) + 1}): ${upsertErr.message}`,
        };
      }
      totalUpserted += batch.length;
    }

    revalidatePath('/configuracao');
    revalidatePath('/stocks');
    return { success: true, count: totalUpserted };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado na gravação de stock';
    return { success: false, error: msg };
  }
}

// 14. AÇÃO: Limpar registos da tabela public.stock
export async function limparStockAction(cliente_ser?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicie sessão como Administrador.' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const { isManagerOrAdmin } = checkUserRole(user, profile);

  if (!isManagerOrAdmin) {
    return { success: false, error: 'Acesso negado: Apenas administradores e gestores podem limpar a tabela de stock.' };
  }

  try {
    let query = supabase.from('stock').delete();
    if (cliente_ser && cliente_ser !== 'all') {
      query = query.eq('cliente_ser', cliente_ser);
    } else {
      query = query.neq('id', '00000000-0000-0000-0000-000000000000');
    }

    const { error: delErr } = await query;
    if (delErr) {
      return { success: false, error: `Erro ao limpar tabela stock: ${delErr.message}` };
    }

    revalidatePath('/configuracao');
    revalidatePath('/stocks');
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao limpar tabela stock';
    return { success: false, error: msg };
  }
}

// 15. AÇÃO: Obter resumo estatístico da tabela public.stock
export async function obterStockStatsAction() {
  const supabase = await createClient();
  try {
    const { count, error } = await supabase
      .from('stock')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return { success: true, count: count ?? 0 };
  } catch (err: unknown) {
    return { success: false, count: 0 };
  }
}
