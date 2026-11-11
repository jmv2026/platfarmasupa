'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface ApagarMovimentoInput {
  id: string;
  nr_pedido: string;
  sigla_pedido?: string | null;
  cliente_id?: string | null;
  cliente_sigla?: string | null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function apagarMovimentoAction(input: ApagarMovimentoInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Utilizador não autenticado.' };
  }

  // Verificar permissões RBAC: apenas Administrador e Gestor podem apagar movimentos
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const isManagerOrAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'gestor' ||
    user.email === 'admin@sermail.pt' ||
    user.user_metadata?.role === 'admin';

  if (!isManagerOrAdmin) {
    return {
      success: false,
      error: 'Apenas administradores e gestores têm permissão para apagar movimentos.',
    };
  }

  const rawId = (input.id || '').trim();
  const nrPedido = (input.nr_pedido || '').trim();
  const siglaPedido = (input.sigla_pedido || '').trim();
  const siglaCli = (input.cliente_sigla || '').trim().toUpperCase();

  if (!rawId && !nrPedido) {
    return {
      success: false,
      error: 'Identificador do movimento em falta.',
    };
  }

  // Lista de referências de documento possíveis em movimentos / movimentos_linhas
  const docRefsSet = new Set<string>();
  if (nrPedido) docRefsSet.add(nrPedido);
  if (siglaPedido) docRefsSet.add(siglaPedido);
  if (siglaCli && nrPedido && !nrPedido.toUpperCase().startsWith(`${siglaCli}-`)) {
    docRefsSet.add(`${siglaCli}-${nrPedido}`);
  }
  const docRefs = Array.from(docRefsSet).filter(Boolean);

  try {
    // 1. Se o ID for um UUID válido da tabela pedidos, apagar linhas e cabeçalho do pedido
    if (UUID_REGEX.test(rawId)) {
      const { error: delLinhasPedErr } = await supabase
        .from('pedido_linhas')
        .delete()
        .eq('pedido_id', rawId);

      if (delLinhasPedErr) {
        console.error('[apagarMovimentoAction] Erro ao apagar pedido_linhas:', delLinhasPedErr);
        return {
          success: false,
          error: `Erro ao apagar linhas do pedido: ${delLinhasPedErr.message}`,
        };
      }

      const { error: delPedErr } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', rawId);

      if (delPedErr) {
        console.error('[apagarMovimentoAction] Erro ao apagar pedido:', delPedErr);
        return {
          success: false,
          error: `Erro ao apagar pedido: ${delPedErr.message}`,
        };
      }
    } else if (docRefs.length > 0) {
      // Caso o movimento venha de pseudoPedidos mas exista um pedido correspondente por nr_pedido ou sigla_pedido
      const { data: matchingPedidos } = await supabase
        .from('pedidos')
        .select('id')
        .or(
          docRefs
            .flatMap((ref) => [`nr_pedido.eq.${ref}`, `sigla_pedido.eq.${ref}`])
            .join(',')
        );

      if (matchingPedidos && matchingPedidos.length > 0) {
        const pedidoIds = matchingPedidos.map((p) => p.id);
        await supabase.from('pedido_linhas').delete().in('pedido_id', pedidoIds);
        await supabase.from('pedidos').delete().in('id', pedidoIds);
      }
    }

    // 2. Apagar de movimentos_linhas e movimentos por documento_ref
    if (docRefs.length > 0) {
      const { error: delMovLinhasErr } = await supabase
        .from('movimentos_linhas')
        .delete()
        .in('documento_ref', docRefs);

      if (delMovLinhasErr) {
        console.error('[apagarMovimentoAction] Erro ao apagar movimentos_linhas:', delMovLinhasErr);
        return {
          success: false,
          error: `Erro ao apagar linhas do movimento: ${delMovLinhasErr.message}`,
        };
      }

      const { error: delMovErr } = await supabase
        .from('movimentos')
        .delete()
        .in('documento_ref', docRefs);

      if (delMovErr) {
        console.error('[apagarMovimentoAction] Erro ao apagar movimentos:', delMovErr);
        return {
          success: false,
          error: `Erro ao apagar cabeçalho do movimento: ${delMovErr.message}`,
        };
      }
    }

    revalidatePath('/historico-pedidos');
    revalidatePath('/pedidos');
    revalidatePath('/stocks');
    revalidatePath('/dashboard');
    revalidatePath('/Proc_Pedidos');
    revalidatePath('/proc-pedidos');
    revalidatePath('/logistica-inversa');

    return {
      success: true,
      deletedDoc: nrPedido || rawId,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro inesperado ao apagar movimento.';
    return {
      success: false,
      error: message,
    };
  }
}

