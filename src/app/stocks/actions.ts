'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface EditarStockInput {
  stockId: string;
  artigo_id: string;
  lote?: string | null;
  validade?: string | null;
  armazem_loc?: string | null;
  stock: number;
}

// 1. AÇÃO: Apagar uma linha específica da tabela public.stock (Restrito a Administradores)
export async function apagarLinhaStockAction(stockId: string) {
  if (!stockId) {
    return { success: false, error: 'Identificador do registo de stock não fornecido.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicie sessão como Administrador.' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .single();

  const isAdmin =
    profile?.role === 'admin' ||
    user.email === 'admin@sermail.pt' ||
    user.user_metadata?.role === 'admin';

  if (!isAdmin) {
    return {
      success: false,
      error: 'Acesso negado: Apenas administradores podem apagar linhas de stock.',
    };
  }

  try {
    const { error: deleteErr } = await supabase
      .from('stock')
      .delete()
      .eq('id', stockId);

    if (deleteErr) {
      console.error('Erro ao apagar linha de stock:', deleteErr);
      return { success: false, error: `Erro ao apagar registo: ${deleteErr.message}` };
    }

    revalidatePath('/stocks');
    revalidatePath('/dashboard');
    revalidatePath('/pedidos');

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado ao apagar linha de stock';
    return { success: false, error: msg };
  }
}

// 2. AÇÃO: Editar uma linha específica da tabela public.stock (Restrito a Administradores)
export async function editarLinhaStockAction(input: EditarStockInput) {
  if (!input.stockId) {
    return { success: false, error: 'Identificador do registo de stock não fornecido.' };
  }

  const artigoTrimmed = (input.artigo_id || '').trim().toUpperCase();
  if (!artigoTrimmed) {
    return { success: false, error: 'O código do artigo não pode estar vazio.' };
  }

  const qtd = Number(input.stock);
  if (isNaN(qtd) || qtd < 0) {
    return { success: false, error: 'A quantidade de stock deve ser um número maior ou igual a 0.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicie sessão como Administrador.' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .single();

  const isAdmin =
    profile?.role === 'admin' ||
    user.email === 'admin@sermail.pt' ||
    user.user_metadata?.role === 'admin';

  if (!isAdmin) {
    return {
      success: false,
      error: 'Acesso negado: Apenas administradores podem editar linhas de stock.',
    };
  }

  try {
    // Obter registo atual
    const { data: currentStock, error: fetchErr } = await supabase
      .from('stock')
      .select('*')
      .eq('id', input.stockId)
      .single();

    if (fetchErr || !currentStock) {
      return { success: false, error: 'Registo de stock não encontrado na base de dados.' };
    }

    const updates: Record<string, any> = {
      artigo_id: artigoTrimmed,
      lote: input.lote ? input.lote.trim() : null,
      data_stock: input.validade ? input.validade : null,
      stock: qtd,
    };

    if (input.armazem_loc !== undefined && input.armazem_loc !== null) {
      const loc = input.armazem_loc.trim();
      updates.localizacao = loc;
      // Se tiver formato Armazem.Posição (ex: MDZ01.12A), podemos sincronizar armazem
      if (loc.includes('.')) {
        updates.armazem = loc.split('.')[0];
      } else if (loc.length > 0 && !currentStock.armazem) {
        updates.armazem = loc;
      }
    }

    const { error: updateErr } = await supabase
      .from('stock')
      .update(updates)
      .eq('id', input.stockId);

    if (updateErr) {
      console.error('Erro ao atualizar linha de stock:', updateErr);
      return { success: false, error: `Erro ao atualizar registo: ${updateErr.message}` };
    }

    revalidatePath('/stocks');
    revalidatePath('/dashboard');
    revalidatePath('/pedidos');

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado ao editar linha de stock';
    return { success: false, error: msg };
  }
}
