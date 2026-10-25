import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/app-header';
import HistoricoPedidosView from './historico-pedidos-view';
import { Client, PedidoComLinhas, UserProfile } from '@/lib/supabase/types';

export default async function HistoricoPedidosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  const isManagerOrAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'gestor' ||
    user.email === 'admin@sermail.pt' ||
    user.user_metadata?.role === 'admin';
  const userClientId = profile?.cliente_id;

  // Função auxiliar para paginação rápida paralela de dados (ultrapassa limite de 1000 registos do PostgREST)
  async function fetchAllRowsFast<T>(
    fetchPage: (from: number, to: number, countMode?: 'exact') => PromiseLike<{ data: T[] | null; count?: number | null; error: any }>,
    pageSize = 1000
  ): Promise<T[]> {
    const firstPage = await fetchPage(0, pageSize - 1, 'exact');
    if (firstPage.error || !firstPage.data) {
      if (firstPage.error) console.error('Erro ao buscar dados paginados:', firstPage.error);
      return [];
    }

    const allRows: T[] = [...firstPage.data];
    const total = firstPage.count ?? allRows.length;

    if (total <= pageSize || firstPage.data.length < pageSize) {
      return allRows;
    }

    const numRemainingPages = Math.ceil((total - pageSize) / pageSize);
    const remainingPromises = Array.from({ length: numRemainingPages }, (_, i) => {
      const pageIndex = i + 1;
      const from = pageIndex * pageSize;
      const to = from + pageSize - 1;
      return fetchPage(from, to);
    });

    const remainingResults = await Promise.all(remainingPromises);
    for (const res of remainingResults) {
      if (res.data) {
        allRows.push(...res.data);
      }
    }

    return allRows;
  }

  let clientsQuery = supabase.from('clientes').select('*').eq('ativo', true).order('name');
  let pedidosQuery = supabase
    .from('pedidos')
    .select('*, clientes(id, name, sigla), destinos(id, codigo, nome), pedido_linhas(*)')
    .order('created_at', { ascending: false });

  if (!isManagerOrAdmin && userClientId) {
    clientsQuery = clientsQuery.eq('id', userClientId);
    pedidosQuery = pedidosQuery.eq('cliente_id', userClientId);
  }

  // Buscar clientes, pedidos, status de expedição e movimentos tudo em paralelo simultâneo
  const [
    { data: clients },
    { data: pedidos },
    torrestirStatus,
    cfMovimentos,
  ] = await Promise.all([
    clientsQuery,
    pedidosQuery,
    fetchAllRowsFast<any>((from, to, countMode) => {
      return supabase
        .from('VW_torrestir_last')
        .select('ref_ser, desc_estado_expedicao, url_comprovativo', countMode ? { count: countMode } : undefined)
        .range(from, to);
    }),
    fetchAllRowsFast<any>((from, to, countMode) => {
      let q = supabase
        .from('movimentos_linhas')
        .select(
          'documento_ref, ref_ser, data_movimento, created_at, artigo_cli, quantidade, tipo_movimento, armazem_loc, lote, validade, movimentos!inner(cliente_id, nome, morada, cod_postal, cod_postal_localidade, requisicao)',
          countMode ? { count: countMode } : undefined
        );
      if (!isManagerOrAdmin && userClientId) {
        q = q.eq('movimentos.cliente_id', userClientId);
      }
      return q.order('data_movimento', { ascending: false }).range(from, to);
    }),
  ]);

  const clientsMap = new Map<string, any>((clients || []).map((c: any) => [c.id, c]));

  // Indexar status da Torrestir por ref normalizada para lookup O(1)
  const statusMap = new Map<string, any>();
  if (torrestirStatus) {
    for (const st of torrestirStatus) {
      if (st.ref_ser) {
        const rawRef = st.ref_ser.toString().trim();
        const numRef = rawRef.replace(/^0+/, '');
        if (!statusMap.has(rawRef)) statusMap.set(rawRef, st);
        if (!statusMap.has(numRef)) statusMap.set(numRef, st);
      }
    }
  }

  // Agrupar linhas de movimentos em pedidos virtuais em O(N) com Map
  const pseudoPedidosList: any[] = [];
  if (cfMovimentos && cfMovimentos.length > 0) {
    const grouped = new Map<string, any>();

    for (let i = 0; i < cfMovimentos.length; i++) {
      const mov = cfMovimentos[i];
      const docRef = mov.documento_ref || `SEM_REF_${mov.created_at}`;
      const currentMovClientId = mov.movimentos?.cliente_id || mov.cliente_id;
      const movTipo = (mov.tipo_movimento || '').toUpperCase();
      const key = `${currentMovClientId}_${docRef}_${movTipo}`;

      let p = grouped.get(key);
      if (!p) {
        const clientObj = clientsMap.get(currentMovClientId);
        p = {
          id: key,
          nr_pedido: docRef,
          cliente_id: currentMovClientId,
          data_pedido: mov.data_movimento || mov.created_at,
          created_at: mov.created_at,
          status: movTipo === 'ES' ? 'rececionado' : 
                  (movTipo === 'ST' || movTipo === 'ET') ? 'transfer' : 'em_preparacao',
          tipo_movimento: movTipo,
          ref_ser: mov.ref_ser,
          clientes: clientObj,
          clients: clientObj,
          destinos: { nome: mov.movimentos?.nome || mov.nome },
          morada: mov.movimentos?.morada || mov.morada,
          codigo_postal: mov.movimentos?.cod_postal || mov.cod_postal,
          cod_postal: mov.movimentos?.cod_postal || mov.cod_postal,
          cod_postal_localidade: mov.movimentos?.cod_postal_localidade || mov.cod_postal_localidade,
          localidade: mov.movimentos?.cod_postal_localidade || mov.cod_postal_localidade || mov.localidade,
          requisicao: mov.movimentos?.requisicao || mov.requisicao,
          pedido_linhas: []
        };
        grouped.set(key, p);
      }

      p.pedido_linhas.push({
        id: `${key}_${mov.artigo_cli}_${p.pedido_linhas.length}`,
        artigo_codigo: mov.artigo_cli,
        descricao: mov.artigo_cli,
        quantidade: mov.quantidade || 0,
        lote: mov.lote || '',
        validade: mov.validade || null
      });
    }

    for (const p of grouped.values()) {
      pseudoPedidosList.push(p);
    }
  }

  // Juntar pedidos reais e pseudoPedidos
  const allPedidos = [...(pedidos || []), ...pseudoPedidosList];

  // Aplicar status torrestir e padronização num único ciclo otimizado
  const finalPedidos = allPedidos.map((p: any) => {
    let refStr = (p.ref_ser || p.nr_pedido || p.requisicao || p.ref_documento || '').toString().trim();
    if (refStr.includes(' ')) {
      refStr = refStr.substring(refStr.indexOf(' ') + 1).trim();
    }
    refStr = refStr.replace(/^0+/, '');
    
    const matchedStatus = refStr ? statusMap.get(refStr) : undefined;
    let status = p.status;
    let url_comprovativo = p.url_comprovativo;

    if (matchedStatus) {
      status = matchedStatus.desc_estado_expedicao || status;
      url_comprovativo = matchedStatus.url_comprovativo;
    }

    const tm = (p.tipo_movimento || '').toUpperCase();
    if (tm === 'ES') {
      status = 'rececionado';
    } else if (tm === 'ST' || tm === 'ET') {
      status = 'transfer';
    }

    const clientObj = p.clientes || p.clients || clientsMap.get(p.cliente_id);

    return {
      ...p,
      status,
      url_comprovativo,
      clients: clientObj,
      clientes: clientObj,
    };
  });

  // Ordenar por data decrescente
  finalPedidos.sort((a: any, b: any) => {
    const dateA = new Date(a.created_at || a.data_pedido).getTime();
    const dateB = new Date(b.created_at || b.data_pedido).getTime();
    return dateB - dateA;
  });

  return (
    <div className="min-h-screen bg-background text-on-background pb-12">
      {/* Header com Navegação e Seletor de Idioma */}
      <AppHeader
        userProfile={profile}
        userEmail={user.email}
        activeTab="historico-pedidos"
      />

      {/* Main Content */}
      <HistoricoPedidosView
        pedidos={finalPedidos as PedidoComLinhas[]}
        clients={(clients as Client[]) || []}
        currentUserProfile={(profile as UserProfile) || null}
      />
    </div>
  );
}

