'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { StatusPedido } from '@/lib/supabase/types';

export async function atualizarEstadoPedido(
  pedidoId: string,
  novoStatus: StatusPedido
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Utilizador não autenticado.' };
    }

    // Verificar perfil e permissões
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isManagerOrAdmin = profile?.role === 'admin' || profile?.role === 'gestor';
    if (!isManagerOrAdmin) {
      return {
        success: false,
        error: 'Apenas Administradores e Gestores têm permissão para alterar o estado do pedido.',
      };
    }

    // Validar status
    const statusValidos: StatusPedido[] = [
      'pendente',
      'confirmado',
      'em_preparacao',
      'expedido',
      'entregue',
      'cancelado',
    ];

    if (!statusValidos.includes(novoStatus)) {
      return { success: false, error: 'Estado de pedido inválido fornecido.' };
    }

    // Atualizar pedido no banco
    const { error: updateError } = await supabase
      .from('pedidos')
      .update({
        status: novoStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pedidoId);

    if (updateError) {
      console.error('Erro ao atualizar estado do pedido:', updateError);
      return { success: false, error: `Erro no banco de dados: ${updateError.message}` };
    }

    // Revalidar caminhos
    revalidatePath('/historico-pedidos');
    revalidatePath('/dashboard');
    revalidatePath('/pedidos');

    return { success: true };
  } catch (err: unknown) {
    console.error('Exceção ao atualizar estado do pedido:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro interno do servidor.',
    };
  }
}
