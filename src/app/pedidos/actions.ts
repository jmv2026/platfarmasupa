'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { NovoPedidoInput, NovoDestinoInput, Destino } from '@/lib/supabase/types';
import { enviarEmailConfirmacaoPedido, enviarEmailTemplatePedidoAdmin } from '@/lib/email';

export async function criarDestinoAction(input: NovoDestinoInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Utilizador não autenticado' };
  }

  // 0. Obter perfil do utilizador para controlo de acesso RBAC
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
    return { success: false, error: 'Preencha todos os campos obrigatórios do destino' };
  }

  // Inserir destino na tabela destinos (o trigger do Supabase gera o código [SIGLA]-0001 automaticamente)
  const { data: destino, error } = await supabase
    .from('destinos')
    .insert({
      cliente_id: targetClientId,
      codigo: '', // O trigger preenche com a sigla do cliente e o número sequencial de 4 dígitos
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
    console.error('Erro ao criar destino:', error);
    return { success: false, error: error?.message || 'Erro ao criar destino' };
  }

  revalidatePath('/pedidos');
  revalidatePath('/historico-pedidos');
  revalidatePath('/configuracao');

  return { success: true, destino: destino as Destino };
}

export async function criarPedidoAction(input: NovoPedidoInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Utilizador não autenticado' };
  }

  // 0. Obter perfil do utilizador para controlo de acesso RBAC
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
    // Forçar o cliente do utilizador para não permitir alterações
    targetClientId = profile.cliente_id;
  }

  if (!targetClientId) {
    return { success: false, error: 'Selecione o cliente proprietário do produto' };
  }

  if (!input.nome_destinatario || !input.morada || !input.codigo_postal || !input.localidade) {
    return { success: false, error: 'Preencha todos os campos obrigatórios do destino' };
  }

  if (!input.linhas || input.linhas.length === 0) {
    return { success: false, error: 'O pedido deve conter pelo menos uma linha de artigo' };
  }

  // 1. Obter a sigla e NIF do cliente
  const { data: client, error: clientErr } = await supabase
    .from('clientes')
    .select('id, sigla, name, cli_primavera, nif')
    .eq('id', targetClientId)
    .single();

  if (clientErr || !client) {
    return { success: false, error: 'Cliente não encontrado na base de dados' };
  }

  // 1.1 Se o utilizador pediu para guardar o destino e não havia destino_id associado, criar na tabela destinos
  let finalDestinoId = input.destino_id || null;

  if (input.guardar_novo_destino && !finalDestinoId) {
    const { data: novoDestino, error: destErr } = await supabase
      .from('destinos')
      .insert({
        cliente_id: targetClientId,
        codigo: '', // O trigger preenche com a sigla do cliente e o número sequencial
        nome: input.nome_destinatario.trim(),
        cli_primavera: input.cli_primavera?.trim() || null,
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

  // 2. Gerar número de pedido único sequencial (ex: PED-2026-0001) e sigla_pedido (ex: AOP-PED-2026-0001)
  const today = new Date();
  const year = today.getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const nrPedido = `PED-${year}-${randomSuffix}`;
  const siglaPedido = `${client.sigla.trim().toUpperCase()}-${nrPedido}`;

  // Apenas gestor ou admin pode optar por não contabilizar em stock; utilizadores comuns abatem sempre stock (true)
  const finalStock = isManagerOrAdmin
    ? (input.stock !== undefined ? Boolean(input.stock) : true)
    : true;

  // 3. Inserir cabeçalho do pedido
  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos')
    .insert({
      nr_pedido: nrPedido,
      sigla_pedido: siglaPedido,
      ref_documento: input.ref_documento || null,
      cliente_id: targetClientId,
      destino_id: finalDestinoId,
      classifica_destino: input.classifica_destino?.trim() || null,
      nome_destinatario: input.nome_destinatario,
      morada: input.morada,
      codigo_postal: input.codigo_postal,
      localidade: input.localidade,
      pais: input.pais || 'Portugal',
      data_pedido: input.data_pedido || today.toISOString().split('T')[0],
      data_entrega: input.data_entrega || null,
      status: 'pendente',
      tipo_movimento: 'SS',
      doc_primavera: null,
      stock: finalStock,
      observacoes: input.observacoes || null,
      documentos_anexos:
        input.documentos_anexos && input.documentos_anexos.length > 0
          ? input.documentos_anexos
          : [],
      created_by: user.id,
    })
    .select()
    .single();

  if (pedidoErr || !pedido) {
    return { success: false, error: `Erro ao criar cabeçalho do pedido: ${pedidoErr?.message}` };
  }

  // 4. Inserir linhas do pedido na tabela pedido_linhas
  const linhasParaInserir = input.linhas
    .filter((linha) => linha.quantidade > 0)
    .map((linha) => {
      const artigoCliFinal = linha.artigo_cli || linha.artigo_codigo || '';
      return {
        pedido_id: pedido.id,
        cliente_id: targetClientId,
        artigo_id: linha.artigo_id.trim(),
        artigo_cli: artigoCliFinal,
        descricao: linha.descricao,
        lote: linha.lote,
        validade: linha.validade || null,
        quantidade: linha.quantidade,
      };
    });

  if (linhasParaInserir.length > 0) {
    const { error: linhasErr } = await supabase
      .from('pedido_linhas')
      .insert(linhasParaInserir);

    if (linhasErr) {
      console.error('Erro ao inserir linhas do pedido em pedido_linhas:', linhasErr);
      return {
        success: false,
        error: `Erro ao registar linhas do pedido: ${linhasErr.message}`,
      };
    }
  }

  // 4. REGRA DE NEGÓCIO: Só os pedidos com o campo stock verdadeiro (stock = true) é que deverão ser contabilizados em stock!
  // A contabilização não está associada cegamente a premir o botão, mas sim a este campo stock ser verdadeiro
  if (pedido.stock) {
    const { error: syncError } = await (supabase.rpc as any)(
      'sincronizar_pedido_para_movimentos',
      { p_pedido_id: pedido.id }
    );
    if (syncError) {
      console.error('[criarPedidoAction] Erro ao sincronizar pedido para movimentos (abate de stock):', syncError);
    }
  }

  // 5. Obter perfil do utilizador + metadados dos artigos (id_tipo_artigo, familia, subfamilia) e armazém em stock
  const uniqueArtigoIds = Array.from(
    new Set(input.linhas.map((l) => l.artigo_id.trim()).filter(Boolean))
  );

  const [{ data: userProfile }, { data: artigosInfo }, { data: stockInfo }] = await Promise.all([
    supabase.from('users').select('full_name, email').eq('id', user.id).single(),
    uniqueArtigoIds.length > 0
      ? supabase
          .from('artigos')
          .select('artigo_id, artigo_cli, id_tipo_artigo, familia, subfamilia')
          .in('artigo_id', uniqueArtigoIds)
      : Promise.resolve({ data: [] as any[] }),
    uniqueArtigoIds.length > 0
      ? supabase
          .from('stock')
          .select('artigo_id, lote, armazem')
          .eq('cliente_ser', client.sigla)
          .in('artigo_id', uniqueArtigoIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const defaultArmazem = `${client.sigla.toUpperCase()}01`;

  // 5.1 Carregar do bucket 'Documentos' os documentos anexados ao pedido para enviar por email
  const anexosExtras: { filename: string; content: Buffer; contentType?: string }[] = [];
  if (input.documentos_anexos && input.documentos_anexos.length > 0) {
    for (const doc of input.documentos_anexos) {
      if (!doc.storage_path) continue;
      try {
        const { data: blobData, error: dlErr } = await supabase.storage
          .from('Documentos')
          .download(doc.storage_path);
        if (!dlErr && blobData) {
          const arrayBuffer = await blobData.arrayBuffer();
          anexosExtras.push({
            filename: doc.nome || doc.storage_path.split('/').pop() || 'anexo',
            content: Buffer.from(arrayBuffer),
            contentType: doc.content_type || blobData.type || undefined,
          });
        } else if (dlErr) {
          console.warn(
            `[criarPedidoAction] Falha ao descarregar anexo ${doc.storage_path} do bucket Documentos:`,
            dlErr.message
          );
        }
      } catch (err) {
        console.warn('[criarPedidoAction] Erro ao processar anexo para envio de email:', err);
      }
    }
  }

  // 6. Enviar emails automáticos via Resend:
  //    a) Email de confirmação do pedido (com a guia Pedido_<nr_pedido>.xlsx + documentos anexos) para o executante
  //    b) Email separado exclusivamente para o administrador com o ficheiro Template-Pedidos_<nr_pedido>.xlsx + documentos anexos
  const dadosEmail = {
    nr_pedido: pedido.nr_pedido,
    ref_documento: pedido.ref_documento,
    cliente_nome: client.name,
    cliente_sigla: client.sigla,
    cliente_nif: client.nif,
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
    anexosExtras,
    linhas: input.linhas.map((l) => {
      const artIdClean = l.artigo_id.trim();
      const artCliClean = (l.artigo_cli || l.artigo_codigo || '').trim();
      const loteClean = (l.lote || '').trim();

      const artMeta =
        (artigosInfo || []).find(
          (a) => a.artigo_cli === artCliClean || a.artigo_id === artIdClean
        ) || null;

      const stockMatch =
        (stockInfo || []).find(
          (s) => s.artigo_id === artIdClean && (s.lote || '').trim() === loteClean
        ) ||
        (stockInfo || []).find((s) => s.artigo_id === artIdClean) ||
        null;

      return {
        artigo_id: artIdClean,
        artigo_cli: artCliClean,
        artigo_codigo: artCliClean,
        descricao: l.descricao,
        lote: l.lote,
        validade: l.validade,
        quantidade: l.quantidade,
        armazem: stockMatch?.armazem || defaultArmazem,
        tipo_artigo: artMeta?.id_tipo_artigo || '',
        familia: artMeta?.familia || '',
        sub_familia: artMeta?.subfamilia || '',
      };
    }),
  };

  // Ao submeter o pedido: enviar confirmação por email ao utilizador e ficheiro template de pedidos aos destinatários configurados
  const [confirmacaoResult, templateResult] = await Promise.allSettled([
    enviarEmailConfirmacaoPedido(dadosEmail),
    enviarEmailTemplatePedidoAdmin(dadosEmail),
  ]);

  const emailResult =
    confirmacaoResult.status === 'fulfilled'
      ? confirmacaoResult.value
      : { success: false, error: String(confirmacaoResult.reason), recipients: [] };

  const emailTemplateEnvio =
    templateResult.status === 'fulfilled'
      ? templateResult.value
      : { success: false, error: String(templateResult.reason), recipients: [] };

  if (!emailTemplateEnvio.success) {
    console.warn('[criarPedidoAction] Aviso ao enviar ficheiro template do pedido:', emailTemplateEnvio.error);
  } else {
    console.log('[criarPedidoAction] Ficheiro template enviado com sucesso para:', emailTemplateEnvio.recipients);
  }

  revalidatePath('/pedidos');
  revalidatePath('/dashboard');
  revalidatePath('/historico-pedidos');
  revalidatePath('/stocks');
  revalidatePath('/Proc_Pedidos');
  revalidatePath('/proc-pedidos');

  return {
    success: true,
    pedidoId: pedido.id,
    nrPedido: pedido.nr_pedido,
    emailEnviado: emailResult.success,
    emailDestinatarios: emailResult.recipients,
    emailError: emailResult.error,
    templateEnviado: emailTemplateEnvio.success,
    templateDestinatarios: emailTemplateEnvio.recipients,
  };
}
