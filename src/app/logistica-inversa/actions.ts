'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  NovoPedidoRecolhaInput,
  NovoDestinoInput,
  Destino,
  PedidoRecolhaComLinhas,
} from '@/lib/supabase/types';

export async function criarLocalRecolhaAction(input: NovoDestinoInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Utilizador não autenticado' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, cliente_id')
    .eq('id', user.id)
    .single();

  const isManagerOrAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'gestor' ||
    user.email === 'admin@sermail.pt' ||
    user.user_metadata?.role === 'admin';

  let targetClientId = input.cliente_id;
  if (!isManagerOrAdmin) {
    if (!profile?.cliente_id) {
      return {
        success: false,
        error: 'O seu utilizador não tem cliente proprietário associado.',
      };
    }
    targetClientId = profile.cliente_id;
  }

  if (!targetClientId) {
    return { success: false, error: 'Cliente proprietário é obrigatório' };
  }

  if (!input.nome || !input.morada || !input.codigo_postal || !input.localidade) {
    return { success: false, error: 'Preencha todos os campos obrigatórios do local de recolha' };
  }

  const { data: destino, error } = await supabase
    .from('destinos')
    .insert({
      cliente_id: targetClientId,
      codigo: '',
      nome: input.nome.trim(),
      cli_primavera: input.cli_primavera?.trim() || null,
      classifica_destino: input.classifica_destino?.trim() || null,
      morada: input.morada.trim(),
      codigo_postal: input.codigo_postal.trim(),
      localidade: input.localidade.trim(),
      pais: input.pais?.trim() || 'Portugal',
      nif: input.nif?.trim() || null,
      telefone: input.telefone?.trim() || null,
      email: input.email?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
      ativo: true,
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !destino) {
    return { success: false, error: error?.message || 'Erro ao registar local de recolha' };
  }

  revalidatePath('/logistica-inversa');
  revalidatePath('/pedidos');
  revalidatePath('/configuracao');

  return { success: true, destino: destino as Destino };
}

export async function criarPedidoRecolhaAction(input: NovoPedidoRecolhaInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Utilizador não autenticado' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, cliente_id, email, full_name')
    .eq('id', user.id)
    .single();

  const isManagerOrAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'gestor' ||
    user.email === 'admin@sermail.pt' ||
    user.user_metadata?.role === 'admin';

  let targetClientId = input.cliente_id;
  if (!isManagerOrAdmin) {
    if (!profile?.cliente_id) {
      return {
        success: false,
        error: 'O seu perfil de utilizador não tem um cliente proprietário associado. Contacte um administrador.',
      };
    }
    targetClientId = profile.cliente_id;
  }

  if (!targetClientId) {
    return { success: false, error: 'Selecione o cliente proprietário do produto' };
  }

  if (!input.nome_origem || !input.morada || !input.codigo_postal || !input.localidade) {
    return { success: false, error: 'Preencha todos os campos obrigatórios do local de recolha' };
  }

  if (!input.linhas || input.linhas.length === 0) {
    return { success: false, error: 'O pedido de recolha deve conter pelo menos uma linha de artigo' };
  }

  const { data: client, error: clientErr } = await supabase
    .from('clientes')
    .select('id, sigla, name, cli_primavera, nif')
    .eq('id', targetClientId)
    .single();

  if (clientErr || !client) {
    return { success: false, error: 'Cliente não encontrado na base de dados' };
  }

  let finalDestinoId = input.destino_id || null;

  if (input.guardar_novo_destino && !finalDestinoId) {
    const { data: novoDestino, error: destErr } = await supabase
      .from('destinos')
      .insert({
        cliente_id: targetClientId,
        codigo: '',
        nome: input.nome_origem.trim(),
        classifica_destino: input.classifica_destino?.trim() || null,
        morada: input.morada.trim(),
        codigo_postal: input.codigo_postal.trim(),
        localidade: input.localidade.trim(),
        pais: input.pais?.trim() || 'Portugal',
        ativo: true,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (!destErr && novoDestino) {
      finalDestinoId = novoDestino.id;
    }
  }

  const today = new Date();
  const year = today.getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const siglaClean = client.sigla.trim().toUpperCase();
  const nrPedido = `REC-${year}-${randomSuffix}`;
  const siglaPedido = `${siglaClean}-${nrPedido}`;
  const armazemDestino = `${siglaClean}04`;

  const { data: pedidoRecolha, error: pedidoErr } = await supabase
    .from('pedidos_recolha')
    .insert({
      nr_pedido: nrPedido,
      sigla_pedido: siglaPedido,
      ref_documento: input.ref_documento?.trim() || null,
      motivo_recolha: input.motivo_recolha?.trim() || 'Devolução Comercial',
      cliente_id: targetClientId,
      destino_id: finalDestinoId,
      classifica_destino: input.classifica_destino?.trim() || null,
      nome_origem: input.nome_origem.trim(),
      morada: input.morada.trim(),
      codigo_postal: input.codigo_postal.trim(),
      localidade: input.localidade.trim(),
      pais: input.pais?.trim() || 'Portugal',
      contacto_local: input.contacto_local?.trim() || null,
      data_pedido: input.data_pedido || today.toISOString().split('T')[0],
      data_recolha: input.data_recolha || null,
      status: 'pendente',
      armazem_destino: armazemDestino,
      observacoes: input.observacoes?.trim() || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (pedidoErr || !pedidoRecolha) {
    return {
      success: false,
      error: `Erro ao criar cabeçalho do pedido de recolha: ${pedidoErr?.message}`,
    };
  }

  const linhasParaInserir = input.linhas
    .filter((l) => Number(l.quantidade) > 0)
    .map((l) => ({
      pedido_recolha_id: pedidoRecolha.id,
      cliente_id: targetClientId,
      artigo_id: l.artigo_id.trim(),
      artigo_cli: (l.artigo_cli || `${client.cli_primavera || siglaClean}-${l.artigo_id}`).trim(),
      descricao: l.descricao.trim(),
      lote: (l.lote || '').trim(),
      validade: l.validade || null,
      quantidade: Number(l.quantidade),
      motivo_linha: l.motivo_linha?.trim() || null,
    }));

  if (linhasParaInserir.length > 0) {
    const { error: linhasErr } = await supabase
      .from('pedido_recolha_linhas')
      .insert(linhasParaInserir);

    if (linhasErr) {
      return {
        success: false,
        error: `Erro ao registar linhas do pedido de recolha: ${linhasErr.message}`,
      };
    }
  }

  revalidatePath('/logistica-inversa');

  const novoPedidoCompleto: PedidoRecolhaComLinhas = {
    ...pedidoRecolha,
    clientes: client as any,
    clients: client as any,
    pedido_recolha_linhas: linhasParaInserir.map((l, idx) => ({
      id: `${pedidoRecolha.id}_${idx}`,
      ...l,
    })),
  };

  return {
    success: true,
    nr_pedido: nrPedido,
    sigla_pedido: siglaPedido,
    armazem_destino: armazemDestino,
    pedido: novoPedidoCompleto,
  };
}

export async function atualizarEstadoPedidoRecolhaAction(
  pedidoId: string,
  novoStatus: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Utilizador não autenticado' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, cliente_id')
    .eq('id', user.id)
    .single();

  const isManagerOrAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'gestor' ||
    user.email === 'admin@sermail.pt' ||
    user.user_metadata?.role === 'admin';

  if (!isManagerOrAdmin && novoStatus !== 'cancelado') {
    return {
      success: false,
      error: 'Apenas gestores ou administradores podem alterar o estado operacional da recolha.',
    };
  }

  const { error } = await supabase
    .from('pedidos_recolha')
    .update({
      status: novoStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pedidoId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/logistica-inversa');
  return { success: true };
}

