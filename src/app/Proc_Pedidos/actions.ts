'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function checkGestorOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, allowed: false, error: 'Utilizador não autenticado' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const isGestorOrAdmin =
    profile?.role === 'gestor' ||
    profile?.role === 'admin' ||
    user.email === 'admin@sermail.pt' ||
    user.user_metadata?.role === 'admin';

  if (!isGestorOrAdmin) {
    return {
      supabase,
      allowed: false,
      error: 'Acesso reservado aos perfis Gestor e Administrador.',
    };
  }

  return { supabase, allowed: true, error: null };
}

export async function atualizarProcessamentoPedidoAction(
  pedidoId: string,
  updates: { processar?: boolean; processado?: boolean }
) {
  const { supabase, allowed, error: authErr } = await checkGestorOrAdmin();
  if (!allowed) {
    return { success: false, error: authErr };
  }

  // REGRA DE NEGÓCIO: O campo doc_primavera só depois de preenchido é que se poderá assinalar o campo processar
  if (updates.processar === true) {
    const { data: pedidoAtual, error: fetchErr } = await supabase
      .from('pedidos')
      .select('doc_primavera')
      .eq('id', pedidoId)
      .single();

    if (fetchErr || !pedidoAtual) {
      return { success: false, error: 'Pedido não encontrado.' };
    }

    if (!pedidoAtual.doc_primavera || !pedidoAtual.doc_primavera.trim()) {
      return {
        success: false,
        error: 'É obrigatório preencher o Documento Primavera antes de assinalar o pedido como "A Processar".',
      };
    }
  }

  const payload: Record<string, any> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  if (typeof updates.processar === 'boolean') {
    payload.datetime_proc = updates.processar ? new Date().toISOString() : null;
  }

  const { error } = await supabase
    .from('pedidos')
    .update(payload)
    .eq('id', pedidoId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/Proc_Pedidos');
  revalidatePath('/proc-pedidos');
  revalidatePath('/historico-pedidos');

  return { success: true };
}

export interface EditarPedidoInput {
  id: string;
  cliente_id: string;
  nome_destinatario: string;
  morada: string;
  codigo_postal: string;
  localidade: string;
  pais: string;
  data_pedido: string;
  data_entrega?: string | null;
  ref_documento?: string | null;
  classifica_destino?: string | null;
  status: string;
  tipo_movimento?: string | null;
  doc_primavera?: string | null;
  observacoes?: string | null;
  processar: boolean;
  processado: boolean;
  linhas: {
    id: string;
    artigo_id: string;
    artigo_cli: string;
    descricao: string;
    lote: string;
    validade?: string | null;
    quantidade: number;
    isNew?: boolean;
  }[];
  linhasRemovidasIds?: string[];
}

export async function editarPedidoAction(input: EditarPedidoInput) {
  const { supabase, allowed, error: authErr } = await checkGestorOrAdmin();
  if (!allowed) {
    return { success: false, error: authErr };
  }

  if (!input.nome_destinatario?.trim() || !input.morada?.trim() || !input.codigo_postal?.trim() || !input.localidade?.trim()) {
    return { success: false, error: 'Preencha todos os campos obrigatórios do destinatário.' };
  }

  if (!input.linhas || input.linhas.length === 0) {
    return { success: false, error: 'O pedido deve manter pelo menos uma linha de artigo.' };
  }

  // REGRA DE NEGÓCIO: O campo doc_primavera só depois de preenchido é que se poderá assinalar o campo processar
  if (input.processar && (!input.doc_primavera || !input.doc_primavera.trim())) {
    return {
      success: false,
      error: 'É obrigatório preencher o Documento Primavera antes de assinalar o pedido como "A Processar".',
    };
  }

  const { error: pedidoError } = await supabase
    .from('pedidos')
    .update({
      nome_destinatario: input.nome_destinatario.trim(),
      morada: input.morada.trim(),
      codigo_postal: input.codigo_postal.trim(),
      localidade: input.localidade.trim(),
      pais: input.pais?.trim() || 'Portugal',
      data_pedido: input.data_pedido,
      data_entrega: input.data_entrega || null,
      ref_documento: input.ref_documento?.trim() || null,
      classifica_destino: input.classifica_destino?.trim() || null,
      status: input.status,
      tipo_movimento: input.tipo_movimento?.trim() || 'SS',
      doc_primavera: input.doc_primavera?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
      processar: Boolean(input.processar),
      processado: Boolean(input.processado),
      datetime_proc: input.processar ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id);

  if (pedidoError) {
    return { success: false, error: `Erro ao atualizar pedido: ${pedidoError.message}` };
  }

  // Remover linhas excluídas (apenas as que já existiam na BD)
  const idsParaRemover = (input.linhasRemovidasIds || []).filter((id) => !id.startsWith('new-'));
  if (idsParaRemover.length > 0) {
    const { error: delLinhasErr } = await supabase
      .from('pedido_linhas')
      .delete()
      .in('id', idsParaRemover);

    if (delLinhasErr) {
      return { success: false, error: `Erro ao remover linhas do pedido: ${delLinhasErr.message}` };
    }
  }

  // Atualizar linhas existentes e inserir novas linhas
  for (const linha of input.linhas) {
    if (Number(linha.quantidade) <= 0) {
      return { success: false, error: 'A quantidade de cada linha deve ser superior a zero.' };
    }

    const isNovaLinha = linha.isNew || linha.id.startsWith('new-');

    if (isNovaLinha) {
      const artigoIdClean = linha.artigo_id.trim();
      const artigoCliClean = (linha.artigo_cli || linha.artigo_id).trim();
      const descricaoClean = (linha.descricao || linha.artigo_id).trim();

      // Garantir que artigo_cli existe na tabela artigos para respeitar a FK pedido_linhas_artigo_cli_fkey
      const { data: existingArtigo } = await supabase
        .from('artigos')
        .select('artigo_cli')
        .eq('artigo_cli', artigoCliClean)
        .maybeSingle();

      if (!existingArtigo) {
        await supabase.from('artigos').insert({
          artigo_id: artigoIdClean,
          artigo_cli: artigoCliClean,
          descricao: descricaoClean,
          tipo_artigo: 'MH',
          id_tipo_artigo: '80',
          tipo_armazenamento: 'TA',
          tratamento_lote: true,
          tratamento_serie: false,
          ativo: true,
        });
      }

      const { error: insLinhaErr } = await supabase
        .from('pedido_linhas')
        .insert({
          pedido_id: input.id,
          cliente_id: input.cliente_id,
          artigo_id: artigoIdClean,
          artigo_cli: artigoCliClean,
          descricao: descricaoClean,
          lote: linha.lote.trim(),
          validade: linha.validade || null,
          quantidade: Number(linha.quantidade),
        });

      if (insLinhaErr) {
        return {
          success: false,
          error: `Erro ao acrescentar linha (${artigoCliClean}): ${insLinhaErr.message}`,
        };
      }
    } else {
      const { error: updLinhaErr } = await supabase
        .from('pedido_linhas')
        .update({
          descricao: linha.descricao.trim(),
          lote: linha.lote.trim(),
          validade: linha.validade || null,
          quantidade: Number(linha.quantidade),
        })
        .eq('id', linha.id);

      if (updLinhaErr) {
        return {
          success: false,
          error: `Erro ao atualizar linha (${linha.artigo_cli}): ${updLinhaErr.message}`,
        };
      }
    }
  }

  const { data: linhasAtualizadas } = await supabase
    .from('pedido_linhas')
    .select('*')
    .eq('pedido_id', input.id)
    .order('created_at', { ascending: true });

  // Se o pedido estiver ou passar a estar concluído, garantir sincronização com movimentos e movimentos_linhas
  if (input.status === 'concluido') {
    const { error: syncError } = await (supabase.rpc as any)(
      'sincronizar_pedido_para_movimentos',
      { p_pedido_id: input.id }
    );
    if (syncError) {
      console.error('Erro ao sincronizar pedido concluído para movimentos:', syncError);
    }

    // Enviar ficheiro Excel gerado a partir do template para os destinatários configurados na plataforma
    try {
      const { data: pedCompleto } = await supabase
        .from('pedidos')
        .select('*, clientes(name, sigla, nif)')
        .eq('id', input.id)
        .single();

      if (pedCompleto) {
        const { enviarEmailTemplatePedidoAdmin } = await import('@/lib/email');
        const dadosEmail = {
          nr_pedido: pedCompleto.nr_pedido,
          ref_documento: pedCompleto.ref_documento,
          cliente_nome: pedCompleto.clientes?.name || 'Cliente',
          cliente_sigla: pedCompleto.clientes?.sigla || 'CLI',
          cliente_nif: pedCompleto.clientes?.nif,
          nome_destinatario: pedCompleto.nome_destinatario,
          morada: pedCompleto.morada,
          codigo_postal: pedCompleto.codigo_postal,
          localidade: pedCompleto.localidade,
          pais: pedCompleto.pais || 'Portugal',
          data_pedido: pedCompleto.data_pedido,
          observacoes: pedCompleto.observacoes,
          utilizador_email: 'admin@sermail.pt',
          linhas: (linhasAtualizadas || []).map((l: any) => ({
            artigo_id: l.artigo_id,
            artigo_cli: l.artigo_cli,
            descricao: l.descricao,
            lote: l.lote,
            validade: l.validade,
            quantidade: l.quantidade,
          })),
        };
        await enviarEmailTemplatePedidoAdmin(dadosEmail);
      }
    } catch (emailErr) {
      console.warn('[Proc_Pedidos] Falha ao enviar email do template para os destinatários:', emailErr);
    }
  }

  revalidatePath('/Proc_Pedidos');
  revalidatePath('/proc-pedidos');
  revalidatePath('/historico-pedidos');
  revalidatePath('/dashboard');

  return { success: true, linhas: linhasAtualizadas || [] };
}

export async function apagarPedidoAction(pedidoId: string) {
  const { supabase, allowed, error: authErr } = await checkGestorOrAdmin();
  if (!allowed) {
    return { success: false, error: authErr };
  }

  const { error } = await supabase
    .from('pedidos')
    .delete()
    .eq('id', pedidoId);

  if (error) {
    return { success: false, error: `Erro ao apagar pedido: ${error.message}` };
  }

  revalidatePath('/Proc_Pedidos');
  revalidatePath('/proc-pedidos');
  revalidatePath('/historico-pedidos');
  revalidatePath('/dashboard');

  return { success: true };
}

export async function atualizarDocPrimaveraAction(
  pedidoId: string,
  docPrimavera: string | null
) {
  const { supabase, allowed, error: authErr } = await checkGestorOrAdmin();
  if (!allowed) {
    return { success: false, error: authErr };
  }

  const trimmed = docPrimavera?.trim() || null;

  const { data: pedidoAtual, error: fetchErr } = await supabase
    .from('pedidos')
    .select('id, processar')
    .eq('id', pedidoId)
    .single();

  if (fetchErr || !pedidoAtual) {
    return { success: false, error: 'Pedido não encontrado.' };
  }

  const payload: Record<string, any> = {
    doc_primavera: trimmed,
    updated_at: new Date().toISOString(),
  };

  if (!trimmed && pedidoAtual.processar) {
    payload.processar = false;
    payload.datetime_proc = null;
  }

  const { error } = await supabase
    .from('pedidos')
    .update(payload)
    .eq('id', pedidoId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/Proc_Pedidos');
  revalidatePath('/proc-pedidos');
  revalidatePath('/historico-pedidos');
  revalidatePath('/dashboard');

  return { success: true };
}
