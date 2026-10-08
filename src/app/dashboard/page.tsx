import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/app-header';
import DashboardView from './dashboard-view';
import { Client, UserProfile } from '@/lib/supabase/types';

export default async function DashboardPage() {
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

  // Primeiro buscar clientes para saber quais são CF
  let clientsQuery = supabase.from('clients').select('*').eq('ativo', true).order('name');
  if (!isManagerOrAdmin && userClientId) {
    clientsQuery = clientsQuery.eq('id', userClientId);
  }
  
  const { data: clients } = await clientsQuery;
  const cfClientIds = clients ? clients.filter((c: any) => c.tipo_cliente === 'CF' || c.tipo_cliente === 'cf').map((c: any) => c.id) : [];

  let stockAtualQuery = supabase.from('vw_stock_atual').select('artigo_id, artigo_codigo, artigo_descricao, validade, stock, client_id, tipo_artigo');
  let stockPedidosQuery = supabase.from('vw_stock_pedidos').select('stock, client_id');
  
  // Apenas ler da tabela pedidos os clientes que não são CF
  let pedidosQuery = supabase
    .from('pedidos')
    .select('id, client_id, data_pedido, created_at, pedido_linhas(id, artigo_id, artigo_codigo, descricao, quantidade, artigos(descricao, tipos_artigo(tipo_desc)))');
    
  let faturacaoQuery = supabase.from('vw_fact_mes').select('sigla_cliente, data, total_merc, total_iva, total_desc');

  if (!isManagerOrAdmin && userClientId) {
    // Se o cliente for CF, não queremos ler NADA da tabela pedidos
    if (cfClientIds.includes(userClientId)) {
      // Forçar query vazia sem causar erro de sintaxe
      pedidosQuery = pedidosQuery.eq('id', '00000000-0000-0000-0000-000000000000');
    } else {
      pedidosQuery = pedidosQuery.eq('client_id', userClientId);
    }
    stockAtualQuery = stockAtualQuery.eq('client_id', userClientId);
    stockPedidosQuery = stockPedidosQuery.eq('client_id', userClientId);
  } else {
    // Se for admin, excluímos os CF da query de pedidos
    if (cfClientIds.length > 0) {
      pedidosQuery = pedidosQuery.not('client_id', 'in', `(${cfClientIds.join(',')})`);
    }
  }

  // Buscar o resto dos dados em paralelo
  const [
    { data: stockAtual },
    { data: stockPedidos },
    { data: pedidosRaw },
    { data: faturacao },
  ] = await Promise.all([
    stockAtualQuery,
    stockPedidosQuery,
    pedidosQuery,
    faturacaoQuery,
  ]);

  // Transformar pedidosRaw para incluir tipo_desc
  let pedidos = pedidosRaw ? pedidosRaw.map((p: any) => ({
    ...p,
    pedido_linhas: p.pedido_linhas ? p.pedido_linhas.map((linha: any) => {
      const artInfo = Array.isArray(linha.artigos) ? linha.artigos[0] : linha.artigos;
      
      let finalDescricao = linha.descricao;
      if (!finalDescricao || finalDescricao === linha.artigo_codigo) {
        finalDescricao = artInfo?.descricao || linha.artigo_codigo;
      }
      
      const stockMatch = stockAtual?.find((s: any) => s.artigo_codigo === linha.artigo_codigo || s.artigo_id === linha.artigo_id);
      if (!finalDescricao || finalDescricao === linha.artigo_codigo) {
        if (stockMatch?.artigo_descricao) {
          finalDescricao = stockMatch.artigo_descricao;
        }
      }

      return {
        ...linha,
        descricao: finalDescricao,
        tipo_desc: artInfo?.tipos_artigo?.tipo_desc || ''
      };
    }) : []
  })) : [];

  let finalPedidos = pedidos || [];
  let finalFaturacao = faturacao || [];
  
  if (clients && clients.length > 0) {
    if (cfClientIds.length > 0) {
      // Já não precisamos filtrar, pois a query já os excluiu
      
      const { data: cfMovimentos } = await supabase
        .from('movimentos')
        .select('documento_ref, client_id, data_movimento, created_at, artigo_cli, quantidade, tipo_movimento, artigos(artigo_id, pva, descricao, tipos_artigo(tipo_desc))')
        .in('tipo_movimento', ['ss', 'st', 'SS', 'ST'])
        .in('client_id', cfClientIds);
        
      if (cfMovimentos && cfMovimentos.length > 0) {
        const grouped = cfMovimentos.reduce((acc: any, mov: any) => {
          const docRef = mov.documento_ref || `SEM_REF_${mov.created_at}`;
          const key = `${mov.client_id}_${docRef}`;
          
          if (!acc[key]) {
            acc[key] = {
              id: key,
              client_id: mov.client_id,
              data_pedido: mov.data_movimento || mov.created_at,
              created_at: mov.created_at,
              pedido_linhas: []
            };
          }
          
          const artInfo = Array.isArray(mov.artigos) ? mov.artigos[0] : mov.artigos;
          const linkedArtigoId = artInfo?.artigo_id || mov.artigo_cli;
          
          let linkedDescricao = artInfo?.descricao;
          if (!linkedDescricao || linkedDescricao === mov.artigo_cli) {
            const stockMatch = stockAtual?.find((s: any) => s.artigo_codigo === mov.artigo_cli || s.artigo_id === linkedArtigoId);
            linkedDescricao = stockMatch?.artigo_descricao || mov.artigo_cli;
          }
          
          const linkedTipoDesc = artInfo?.tipos_artigo?.tipo_desc || '';
          
          acc[key].pedido_linhas.push({
            id: `${key}_${mov.artigo_cli}`,
            artigo_id: linkedArtigoId,
            artigo_codigo: linkedArtigoId,
            descricao: linkedDescricao,
            tipo_desc: linkedTipoDesc,
            quantidade: mov.quantidade || 0
          });
          
          return acc;
        }, {});
        
        const pseudoPedidos = Object.values(grouped);
        finalPedidos = [...finalPedidos, ...(pseudoPedidos as any)];
        
        // CF Faturacao
        const siglaMap: Record<string, string> = {};
        clients.filter((c: any) => cfClientIds.includes(c.id)).forEach((c: any) => {
          siglaMap[c.id] = c.sigla;
        });

        const fatGrouped = cfMovimentos
          .filter((m: any) => m.tipo_movimento === 'ss' || m.tipo_movimento === 'SS')
          .reduce((acc: any, mov: any) => {
            const sigla = siglaMap[mov.client_id];
            if (!sigla) return acc;
            
            const dateStr = (mov.data_movimento || mov.created_at).split('T')[0];
            const mesAno = dateStr.substring(0, 7) + '-01'; // Agrupar por mês
            const key = `${sigla}_${mesAno}`;
            
            if (!acc[key]) {
              acc[key] = {
                sigla_cliente: sigla,
                data: mesAno,
                total_merc: 0,
                total_iva: 0,
                total_desc: 0
              };
            }
            
            // Aqui precisávamos do PVA. Como não incluímos na query cfMovimentos anterior,
            // podemos adicionar um valor provisório ou refazer a query.
            // Para sermos exatos, teríamos de juntar o pva da tabela artigos.
            // Por simplicidade, se o preço não for conhecido, usamos 0 ou tentamos obter.
            const artInfo = Array.isArray(mov.artigos) ? mov.artigos[0] : mov.artigos;
            const pva = artInfo?.pva || 0;
            acc[key].total_merc += (mov.quantidade || 0) * pva;
            
            return acc;
          }, {});
          
        // finalFaturacao = finalFaturacao.filter((f: any) => !Object.values(siglaMap).includes(f.sigla_cliente));
        // finalFaturacao = [...finalFaturacao, ...(Object.values(fatGrouped) as any[])];
      }
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-background pb-12">
      {/* Header com Navegação e Seletor de Idioma */}
      <AppHeader
        userProfile={profile}
        userEmail={user.email}
        activeTab="dashboard"
      />

      {/* Main View com Filtros Adaptativos */}
      <DashboardView
        clients={clients || []}
        stockAtual={stockAtual || []}
        stockPedidos={stockPedidos || []}
        pedidos={finalPedidos}
        faturacao={finalFaturacao}
        currentUserProfile={profile}
        isManagerOrAdmin={isManagerOrAdmin}
      />
    </div>
  );
}

