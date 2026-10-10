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

  const isManagerOrAdmin = profile?.role === 'admin' || profile?.role === 'gestor';
  const userClientId = profile?.client_id;

  let clientsQuery = supabase.from('clients').select('*').eq('ativo', true).order('name');
  if (!isManagerOrAdmin && userClientId) {
    clientsQuery = clientsQuery.eq('id', userClientId);
  }

  const { data: clients } = await clientsQuery;
  const cfClientIds = clients ? clients.filter((c: any) => c.tipo_cliente === 'CF' || c.tipo_cliente === 'cf').map((c: any) => c.id) : [];

  let pedidosQuery = supabase
    .from('pedidos')
    .select('*, clients(id, name, sigla), destinos(id, codigo, nome), pedido_linhas(*)')
    .order('created_at', { ascending: false });

  if (!isManagerOrAdmin && userClientId) {
    if (cfClientIds.includes(userClientId)) {
      pedidosQuery = pedidosQuery.eq('id', '00000000-0000-0000-0000-000000000000');
    } else {
      pedidosQuery = pedidosQuery.eq('client_id', userClientId);
    }
  } else {
    if (cfClientIds.length > 0) {
      pedidosQuery = pedidosQuery.not('client_id', 'in', `(${cfClientIds.join(',')})`);
    }
  }

  // Buscar pedidos
  const { data: pedidos } = await pedidosQuery;

  let finalPedidos = pedidos || [];

  if (clients && clients.length > 0) {
    if (cfClientIds.length > 0) {
      // O filtro em memória já não é necessário, pois a query excluiu os CF

      const { data: cfMovimentos } = await supabase
        .from('movimentos')
        .select('documento_ref, ref_ser, client_id, data_movimento, created_at, artigo_cli, quantidade, tipo_movimento, armazem_loc, lote, validade, nome, morada, cod_postal, cod_postal_localidade, requisicao')
        .in('client_id', cfClientIds)
        .order('created_at', { ascending: false });

      if (cfMovimentos && cfMovimentos.length > 0) {
        const grouped = cfMovimentos.reduce((acc: any, mov: any) => {
          const docRef = mov.documento_ref || `SEM_REF_${mov.created_at}`;
          const key = `${mov.client_id}_${docRef}_${mov.tipo_movimento}`;

          if (!acc[key]) {
            acc[key] = {
              id: key,
              nr_pedido: docRef,
              client_id: mov.client_id,
              data_pedido: mov.data_movimento || mov.created_at,
              created_at: mov.created_at,
              status: (mov.tipo_movimento || '').toUpperCase() === 'ES' ? 'rececionado' : 
                      ((mov.tipo_movimento || '').toUpperCase() === 'ST' || (mov.tipo_movimento || '').toUpperCase() === 'ET') ? 'transfer' : 'em_preparacao',
              tipo_movimento: mov.tipo_movimento,
              ref_ser: mov.ref_ser,
              clients: clients.find((c: any) => c.id === mov.client_id),
              destinos: { nome: mov.nome }, // mock destino with nome from movimento
              morada: mov.morada,
              codigo_postal: mov.cod_postal,
              cod_postal: mov.cod_postal,
              cod_postal_localidade: mov.cod_postal_localidade,
              localidade: mov.cod_postal_localidade || mov.localidade,
              requisicao: mov.requisicao,
              pedido_linhas: []
            };
          }

          acc[key].pedido_linhas.push({
            id: `${key}_${mov.artigo_cli}`,
            artigo_codigo: mov.artigo_cli,
            descricao: mov.artigo_cli,
            quantidade: mov.quantidade || 0,
            lote: mov.lote || '',
            validade: mov.validade || null
          });

          return acc;
        }, {});

        const { data: torrestirStatus } = await supabase
          .from('VW_torrestir_last')
          .select('ref_ser, desc_estado_expedicao, url_comprovativo');

        const statusMap = new Map<string, any>();
        if (torrestirStatus) {
          for (const st of torrestirStatus) {
            if (st.ref_ser) {
              const rawRef = st.ref_ser.toString().trim();
              const numRef = rawRef.replace(/^0+/, ''); // strip leading zeros
              if (!statusMap.has(rawRef)) statusMap.set(rawRef, st);
              if (!statusMap.has(numRef)) statusMap.set(numRef, st);
            }
          }
        }

        console.log('--- DEBUG --- torrestirStatus length:', torrestirStatus?.length);
        console.log('--- DEBUG --- torrestirStatus sample:', torrestirStatus?.slice(0, 2));

        const pseudoPedidos = Object.values(grouped).map((p: any) => {
          let refStr = p.ref_ser;
          if (!refStr) {
            refStr = (p.nr_pedido || '').trim();
            if (refStr.includes(' ')) {
              refStr = refStr.substring(refStr.indexOf(' ') + 1).trim();
            }
          }
          refStr = (refStr || '').replace(/^0+/, ''); // remover zeros à esquerda
          const matchedStatus = statusMap.get(refStr);
          p.status = matchedStatus ? (matchedStatus.desc_estado_expedicao || p.status) : p.status;
          return p;
        });
        finalPedidos = [...finalPedidos, ...(pseudoPedidos as any)];

        // Map status and url_comprovativo to ALL orders (including real ones)
        finalPedidos = finalPedidos.map((p: any) => {
          let refStr = (p.nr_pedido || p.requisicao || p.ref_documento || '').trim();
          if (refStr.includes(' ')) {
            refStr = refStr.substring(refStr.indexOf(' ') + 1).trim();
          }
          refStr = refStr.replace(/^0+/, ''); // strip leading zeros
          
          const matchedStatus = statusMap.get(refStr);
          if (matchedStatus) {
            p.status = matchedStatus.desc_estado_expedicao || p.status;
          }
          return p;
        });

        // Ordenar os pedidos novamente por data decrescente
        finalPedidos.sort((a: any, b: any) => {
          const dateA = new Date(a.created_at || a.data_pedido).getTime();
          const dateB = new Date(b.created_at || b.data_pedido).getTime();
          return dateB - dateA;
        });
      }
    }
  }

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
        pedidos={(finalPedidos as PedidoComLinhas[]) || []}
        clients={(clients as Client[]) || []}
        currentUserProfile={(profile as UserProfile) || null}
      />
    </div>
  );
}

