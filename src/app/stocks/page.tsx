import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/supabase/session';
import AppHeader from '@/components/navigation/app-header';
import StocksView from './stocks-view';
import { Client, StockAtual, StockPedido, StockZero, UserProfile, Tempo } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

export default async function StocksPage() {
  const { supabase, user, profile, isManagerOrAdmin, userClientId } = await getAuthContext();

  if (!user) {
    redirect('/login');
  }

  let clientsQuery = supabase.from('clientes').select('*').eq('ativo', true).order('name');
  let stockAtualPage1Query = supabase
    .from('vw_stock_atual')
    .select('*')
    .order('artigo_id', { ascending: true })
    .range(0, 999);
  let stockAtualPage2Query = supabase
    .from('vw_stock_atual')
    .select('*')
    .order('artigo_id', { ascending: true })
    .range(1000, 2999);
  let stockZeroQuery = supabase
    .from('vw_stock_zero')
    .select('*')
    .order('artigo_id', { ascending: true })
    .range(0, 1999);
  let temposQuery = supabase.from('tempos').select('*');

  if (!isManagerOrAdmin && userClientId) {
    clientsQuery = clientsQuery.eq('id', userClientId);
    stockAtualPage1Query = stockAtualPage1Query.eq('cliente_id', userClientId);
    stockAtualPage2Query = stockAtualPage2Query.eq('cliente_id', userClientId);
    stockZeroQuery = stockZeroQuery.eq('cliente_id', userClientId);
    temposQuery = temposQuery.eq('id_cliente', userClientId);
  }

  // Buscar dados em paralelo (derivando stockPedidos diretamente de stockAtual para evitar query duplicada)
  const [
    { data: clients },
    { data: stockAtualP1 },
    { data: stockAtualP2 },
    { data: stockZero },
    { data: tempos },
  ] = await Promise.all([
    clientsQuery,
    stockAtualPage1Query,
    stockAtualPage2Query,
    stockZeroQuery,
    temposQuery,
  ]);

  const stockAtual = [
    ...((stockAtualP1 as StockAtual[]) || []),
    ...((stockAtualP2 as StockAtual[]) || []),
  ];

  const stockPedidos: StockPedido[] = stockAtual
    .filter((s) => s.tipo_armazem === '01' && Number(s.stock) > 0)
    .map((s) => ({
      cliente_id: s.cliente_id,
      cliente_nome: s.cliente_nome,
      cliente_sigla: s.cliente_sigla,
      artigo_id: s.artigo_id,
      artigo_cli: s.artigo_cli,
      descricao: s.descricao,
      tipo_artigo: s.tipo_artigo,
      tipo_armazenamento: s.tipo_armazenamento,
      lote: s.lote,
      validade: s.validade,
      data_fabrico: s.data_fabrico,
      stock: s.stock,
      ultimo_movimento: s.ultimo_movimento,
      data_stock: s.data_stock,
    }));

  return (
    <div className="min-h-screen bg-background text-on-background pb-12">
      {/* Header com Navegação e Seletor de Idioma */}
      <AppHeader
        userProfile={profile}
        userEmail={user.email}
        activeTab="stocks"
      />

      {/* Main Content */}
      <StocksView
        stockAtual={(stockAtual as StockAtual[]) || []}
        stockPedidos={(stockPedidos as StockPedido[]) || []}
        stockZero={(stockZero as StockZero[]) || []}
        clients={(clients as Client[]) || []}
        currentUserProfile={(profile as UserProfile) || null}
        tempos={(tempos as Tempo[]) || []}
      />
    </div>
  );
}
