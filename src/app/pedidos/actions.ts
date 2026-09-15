'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { NovoPedidoInput } from '@/lib/supabase/types';
import { enviarEmailConfirmacaoPedido } from '@/lib/email';

export async function criarPedidoAction(input: NovoPedidoInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Utilizador não autenticado' };
  }

  if (!input.client_id) {
    return { success: false, error: 'Selecione o cliente proprietário do produto' };
  }

  if (!input.nome_destinatario || !input.morada || !input.codigo_postal || !input.localidade) {
    return { success: false, error: 'Preencha todos os campos obrigatórios do destino' };
  }

  if (!input.linhas || input.linhas.length === 0) {
    return { success: false, error: 'O pedido deve conter pelo menos uma linha de artigo' };
  }

  // 1. Obter a sigla do cliente para compor o armazem_loc
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, sigla, name')
    .eq('id', input.client_id)
    .single();

  if (clientErr || !client) {
    return { success: false, error: 'Cliente não encontrado na base de dados' };
  }

  // 2. Gerar número de pedido único sequencial (ex: PED-2026-0001)
  const today = new Date();
  const year = today.getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const nrPedido = `PED-${year}-${randomSuffix}`;

  // 3. Inserir cabeçalho do pedido
  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos')
    .insert({
      nr_pedido: nrPedido,
      ref_documento: input.ref_documento || null,
      client_id: input.client_id,
      nome_destinatario: input.nome_destinatario,
      morada: input.morada,
      codigo_postal: input.codigo_postal,
      localidade: input.localidade,
      pais: input.pais || 'Portugal',
      data_pedido: input.data_pedido || today.toISOString().split('T')[0],
      data_entrega: input.data_entrega || null,
      status: 'pendente',
      observacoes: input.observacoes || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (pedidoErr || !pedido) {
    return { success: false, error: `Erro ao criar cabeçalho do pedido: ${pedidoErr?.message}` };
  }

  // 4. Inserir linhas do pedido e movimentos SS em tempo real
  const armazemLoc = `${client.sigla}-01`;

  for (const linha of input.linhas) {
    if (linha.quantidade <= 0) {
      continue;
    }

    // Inserir linha do pedido
    const { error: linhaErr } = await supabase.from('pedido_linhas').insert({
      pedido_id: pedido.id,
      client_id: input.client_id,
      artigo_id: linha.artigo_id,
      artigo_codigo: linha.artigo_codigo,
      descricao: linha.descricao,
      lote: linha.lote,
      validade: linha.validade || null,
      quantidade: linha.quantidade,
    });

    if (linhaErr) {
      console.error('Erro ao inserir linha do pedido:', linhaErr);
      return { success: false, error: `Erro ao registar linha ${linha.artigo_codigo}: ${linhaErr.message}` };
    }

    // Gerar movimento de saída de stock SS correspondente
    const { error: movErr } = await supabase.from('movimentos').insert({
      artigo_id: linha.artigo_id,
      client_id: input.client_id,
      tipo_movimento: 'ss',
      quantidade: linha.quantidade,
      tipo_armazem: '01', // Armazém Venda
      armazem_loc: armazemLoc,
      posicao: 'A-01-01',
      lote: linha.lote,
      validade: linha.validade || null,
      documento_ref: nrPedido,
      observacoes: `Expedição para ${input.nome_destinatario} (${input.localidade}) - Pedido ${nrPedido}`,
      created_by: user.id,
      data_movimento: new Date().toISOString(),
    });

    if (movErr) {
      console.error('Erro ao registar movimento SS:', movErr);
      return { success: false, error: `Erro ao debitar stock do lote ${linha.lote}: ${movErr.message}` };
    }
  }

  // 5. Obter perfil do utilizador para envio de email
  const { data: userProfile } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', user.id)
    .single();

  // 6. Enviar emails automáticos via Resend (utilizador criador + joao.melo@sermail.pt)
  const emailResult = await enviarEmailConfirmacaoPedido({
    nr_pedido: pedido.nr_pedido,
    ref_documento: pedido.ref_documento,
    cliente_nome: client.name,
    cliente_sigla: client.sigla,
    nome_destinatario: pedido.nome_destinatario,
    morada: pedido.morada,
    codigo_postal: pedido.codigo_postal,
    localidade: pedido.localidade,
    pais: pedido.pais,
    data_pedido: pedido.data_pedido,
    data_entrega: pedido.data_entrega,
    observacoes: pedido.observacoes,
    utilizador_nome: userProfile?.full_name || user.email?.split('@')[0],
    utilizador_email: user.email || userProfile?.email || 'admin@sermail.pt',
    linhas: input.linhas.map((l) => ({
      artigo_codigo: l.artigo_codigo,
      descricao: l.descricao,
      lote: l.lote,
      validade: l.validade,
      quantidade: l.quantidade,
    })),
  });

  revalidatePath('/pedidos');
  revalidatePath('/dashboard');

  return {
    success: true,
    pedidoId: pedido.id,
    nrPedido: pedido.nr_pedido,
    emailEnviado: emailResult.success,
    emailDestinatarios: emailResult.recipients,
    emailError: emailResult.error,
  };
}
