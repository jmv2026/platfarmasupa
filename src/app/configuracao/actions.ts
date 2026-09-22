'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { UserRole, TipoArtigo, TipoArmazenamento, ImpStkInput } from '@/lib/supabase/types';
import { parseDateStockToISO } from '@/lib/parse-stock-file';
import { ArtigoImportInput, parseArtigoBoolean } from '@/lib/parse-artigos-file';
import { MovimentoImportInput } from '@/lib/parse-movimentos-file';

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
  cod_postal?: string;
  localidade?: string;
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
        pvp: input.pvp !== undefined && input.pvp !== null ? Number(input.pvp) : 0.00,
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

  const userRole = profile?.role || (user.user_metadata?.role as string);

  if (userRole !== 'admin' && userRole !== 'gestor') {
    return { success: false, error: 'Acesso negado: Apenas administradores e gestores podem limpar o catálogo de artigos.' };
  }

  try {
    const { error: deleteErr } = await supabase
      .from('artigos')
      .delete()
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

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado ao limpar artigos';
    return { success: false, error: msg };
  }
}

// 3.2 AÇÃO: Importar Catálogo de Artigos em Lote (Upsert na tabela artigos)
export async function importarArtigosAction(rows: ArtigoImportInput[]) {
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

  const userRole = profile?.role || (user.user_metadata?.role as string);

  if (userRole !== 'admin' && userRole !== 'gestor') {
    return { success: false, error: 'Acesso negado: Apenas administradores e gestores podem importar artigos.' };
  }

  if (!rows || rows.length === 0) {
    return { success: false, error: 'O ficheiro não contém artigos válidos para importar.' };
  }

  try {
    // 1. Garantir deduplicação estrita de artigo_id para evitar erro de concorrência do Postgres (código 21000)
    const uniqueMap = new Map<string, ArtigoImportInput>();
    for (const r of rows) {
      const code = (r.artigo_id || '').trim().toUpperCase();
      if (code) {
        uniqueMap.set(code, {
          ...r,
          artigo_id: code,
          descricao: (r.descricao || '').trim() || code,
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
        descricao: r.descricao,
        tipo_artigo: r.tipo_artigo || 'MH',
        tipo_armazenamento: r.tipo_armazenamento || 'TA',
        tratamento_lote: parseArtigoBoolean(r.tratamento_lote, true),
        tratamento_serie: parseArtigoBoolean(r.tratamento_serie, false),
        pvp: r.pvp !== undefined && r.pvp !== null ? Number(r.pvp) : 0.00,
        ativo: parseArtigoBoolean(r.ativo, true),
      }));

      const { data: upsertedBatch, error: upsertErr } = await supabase
        .from('artigos')
        .upsert(batch, { onConflict: 'artigo_id' })
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

  if (profile?.role !== 'admin') {
    return { success: false, recipients: [] as string[], error: 'Acesso negado: Apenas administradores podem disparar emails de teste.' };
  }

  const { enviarEmailTesteAdmin } = await import('@/lib/email');

  const rawInput = destinatarioCustom?.trim() || profile.email || user.email || 'jccmmelo@gmail.com, joao.melo@sermail.pt';
  const listaDestinatarios = rawInput.split(/[,;\s]+/).map((e: string) => e.trim()).filter(Boolean);

  const result = await enviarEmailTesteAdmin({
    destinatarios: listaDestinatarios,
    solicitanteNome: profile.full_name || 'Administrador Farma',
    solicitanteEmail: user.email || profile.email || 'admin@sermail.pt',
  });

  return result;
}

// 5. AÇÃO: Importar Stocks em Lote para a tabela imp_stk (Aba Movimentos)
export async function importarStocksAction(rows: ImpStkInput[]) {
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

  const userRole = profile?.role || (user.user_metadata?.role as string);

  if (userRole !== 'admin' && userRole !== 'gestor') {
    return { success: false, error: 'Acesso negado: Apenas administradores e gestores podem importar stocks.' };
  }

  if (!rows || rows.length === 0) {
    return { success: false, error: 'O ficheiro não contém linhas de dados válidas para importar.' };
  }

  try {
    const BATCH_SIZE = 500;
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE).map((r) => ({
        artigo: r.artigo?.trim() || null,
        descricao: r.descricao?.trim() || null,
        armazem: r.armazem?.trim() || null,
        lote: r.lote?.trim() || null,
        estado_stock: r.estado_stock?.trim() || 'DISP',
        stk: typeof r.stk === 'number' ? r.stk : Number(r.stk || 0),
        datastock: parseDateStockToISO(r.datastock) || (r.datastock ? r.datastock.trim() : null),
        bloqueado: typeof r.bloqueado === 'boolean'
          ? r.bloqueado
          : String(r.bloqueado ?? '0').trim().toLowerCase() === '1' || String(r.bloqueado ?? '').trim().toLowerCase() === 'true',
        familia: r.familia?.trim() || null,
        tipo_artigo: r.tipo_artigo?.trim() || null,
        sub_familia: r.sub_familia?.trim() || null,
      }));

      const { error: insertErr } = await supabase.from('imp_stk').insert(batch);
      if (insertErr) {
        console.error('Erro ao inserir lote em imp_stk:', insertErr);
        return { success: false, error: `Erro na gravação (lote ${Math.floor(i / BATCH_SIZE) + 1}): ${insertErr.message}` };
      }
      totalInserted += batch.length;
    }

    revalidatePath('/configuracao');
    return { success: true, count: totalInserted };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado na importação';
    return { success: false, error: msg };
  }
}

// 6. AÇÃO: Limpar Registos de Importação da tabela imp_stk
export async function limparImportacoesStockAction() {
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

  const userRole = profile?.role || (user.user_metadata?.role as string);

  if (userRole !== 'admin' && userRole !== 'gestor') {
    return { success: false, error: 'Acesso negado: Apenas administradores e gestores podem limpar a tabela imp_stk.' };
  }

  try {
    const { error: deleteErr } = await supabase
      .from('imp_stk')
      .delete()
      .gte('created_at', '1970-01-01T00:00:00Z');

    if (deleteErr) {
      console.error('Erro ao limpar imp_stk:', deleteErr);
      return { success: false, error: `Erro ao limpar tabela: ${deleteErr.message}` };
    }

    revalidatePath('/configuracao');
    revalidatePath('/dashboard');
    revalidatePath('/stocks');
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado';
    return { success: false, error: msg };
  }
}

// 7. AÇÃO: Importar Movimentos de Stock em Lote para a tabela movimentos
export async function importarMovimentosAction(
  rows: MovimentoImportInput[],
  defaultClientId?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicie sessão como Administrador.' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, client_id')
    .eq('id', user.id)
    .single();

  const userRole = profile?.role || (user.user_metadata?.role as string);

  if (userRole !== 'admin' && userRole !== 'gestor') {
    return {
      success: false,
      error: 'Acesso negado: Apenas administradores e gestores podem importar movimentos.',
    };
  }

  if (!rows || rows.length === 0) {
    return { success: false, error: 'O ficheiro não contém linhas de movimentos válidas para importar.' };
  }

  try {
    // 1. Obter mapa de clientes para resolução de sigla -> client_id
    const { data: clientsData } = await supabase.from('clients').select('id, sigla, name');
    const clientMapBySigla = new Map<string, string>();
    const clientMapById = new Map<string, string>();

    (clientsData || []).forEach((c) => {
      if (c.sigla) clientMapBySigla.set(c.sigla.toUpperCase(), c.id);
      if (c.id) clientMapById.set(c.id, c.sigla);
    });

    // 2. Obter primeiro cliente disponível caso seja necessário fallback
    const firstClient = clientsData && clientsData.length > 0 ? clientsData[0] : null;
    const fallbackClientId = defaultClientId || profile?.client_id || firstClient?.id;

    if (!fallbackClientId && clientMapBySigla.size === 0) {
      return {
        success: false,
        error: 'Nenhum cliente cadastrado no sistema para associar aos movimentos.',
      };
    }

    const BATCH_SIZE = 250;
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE).map((r) => {
        // Resolver client_id
        let resolvedClientId = fallbackClientId;
        if (r.client_id && clientMapById.has(r.client_id)) {
          resolvedClientId = r.client_id;
        } else if (r.sigla && clientMapBySigla.has(r.sigla.toUpperCase())) {
          resolvedClientId = clientMapBySigla.get(r.sigla.toUpperCase())!;
        }

        const resolvedSigla = r.sigla
          ? r.sigla.toUpperCase()
          : resolvedClientId
          ? clientMapById.get(resolvedClientId) || null
          : null;

        const tipoArmazem = r.tipo_armazem || '01';
        const armazemLoc = r.armazem_loc || (resolvedSigla ? `${resolvedSigla}-${tipoArmazem}` : `ARM-${tipoArmazem}`);

        return {
          artigo_id: r.artigo_id.trim(),
          client_id: resolvedClientId,
          sigla: resolvedSigla,
          tipo_movimento: r.tipo_movimento || 'es',
          quantidade: Number(r.quantidade),
          tipo_armazem: tipoArmazem,
          armazem_loc: armazemLoc,
          posicao: r.posicao?.trim() || null,
          lote: r.lote?.trim() || null,
          nr_serie: r.nr_serie?.trim() || null,
          validade: r.validade || null,
          data_fabrico: r.data_fabrico || null,
          data_movimento: r.data_movimento || new Date().toISOString(),
          documento_ref: r.documento_ref?.trim() || null,
          observacoes: r.observacoes?.trim() || null,
          created_by: user.id,
        };
      });

      const { error: insertErr } = await supabase.from('movimentos').insert(batch);
      if (insertErr) {
        console.error('Erro ao inserir lote em movimentos:', insertErr);
        return {
          success: false,
          error: `Erro na gravação dos movimentos (lote ${Math.floor(i / BATCH_SIZE) + 1}): ${insertErr.message}`,
        };
      }
      totalInserted += batch.length;
    }

    revalidatePath('/configuracao');
    revalidatePath('/stocks');
    revalidatePath('/dashboard');
    revalidatePath('/pedidos');
    revalidatePath('/historico-pedidos');

    return { success: true, count: totalInserted };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado na importação de movimentos';
    return { success: false, error: msg };
  }
}

// 8. AÇÃO: Limpar Registos da tabela movimentos (Acesso restrito a Admin)
export async function limparMovimentosAction() {
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

  if (profile?.role !== 'admin') {
    return {
      success: false,
      error: 'Acesso negado: Apenas administradores podem limpar a tabela de movimentos.',
    };
  }

  try {
    const { error: deleteErr } = await supabase
      .from('movimentos')
      .delete()
      .gte('created_at', '1970-01-01T00:00:00Z');

    if (deleteErr) {
      console.error('Erro ao limpar movimentos:', deleteErr);
      return { success: false, error: `Erro ao limpar movimentos: ${deleteErr.message}` };
    }

    revalidatePath('/configuracao');
    revalidatePath('/stocks');
    revalidatePath('/dashboard');
    revalidatePath('/pedidos');
    revalidatePath('/historico-pedidos');
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado ao limpar movimentos';
    return { success: false, error: msg };
  }
}


