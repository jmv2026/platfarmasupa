import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/supabase/session';
import { fetchAllRowsFast } from '@/lib/supabase/pagination';
import AppHeader from '@/components/navigation/app-header';
import LogisticaInversaView from './logistica-inversa-view';
import {
  Artigo,
  Client,
  Destino,
  PedidoRecolhaComLinhas,
  RececaoArmazem04,
  UserProfile,
} from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

export const metadata = {
  title: 'Logística Inversa | PlatFarma',
};

export default async function LogisticaInversaPage() {
  const { supabase, user, profile, isManagerOrAdmin, userClientId } = await getAuthContext();

  if (!user) {
    redirect('/login');
  }

  let clientsQuery = supabase.from('clientes').select('*').eq('ativo', true).order('name');
  let destinosQuery = supabase.from('destinos').select('*').eq('ativo', true).order('codigo');
  let pedidosRecolhaQuery = supabase
    .from('pedidos_recolha')
    .select('*, clientes(id, name, sigla), destinos(id, codigo, nome), pedido_recolha_linhas(*)')
    .order('created_at', { ascending: false });

  if (!isManagerOrAdmin && userClientId) {
    clientsQuery = clientsQuery.eq('id', userClientId);
    destinosQuery = destinosQuery.eq('cliente_id', userClientId);
    pedidosRecolhaQuery = pedidosRecolhaQuery.eq('cliente_id', userClientId);
  }

  const [
    { data: clients },
    { data: destinos },
    { data: pedidosRecolha },
    artigosList,
    movimentosArm04Raw,
  ] = await Promise.all([
    clientsQuery,
    destinosQuery,
    pedidosRecolhaQuery,
    fetchAllRowsFast<any>((from, to, countMode) => {
      return supabase
        .from('artigos')
        .select(
          'artigo_id, artigo_cli, descricao, cli_primavera, id_tipo_artigo, tipo_armazenamento, ativo',
          countMode ? { count: countMode } : undefined
        )
        .eq('ativo', true)
        .order('artigo_id', { ascending: true })
        .range(from, to);
    }, 2000),
    fetchAllRowsFast<any>((from, to, countMode) => {
      let q = supabase
        .from('movimentos_linhas')
        .select(
          'doc_linha, documento_ref, ref_ser, data_movimento, created_at, artigo_id, artigo, artigo_cli, descricao, quantidade, tipo_movimento, armazem, tipo_armazem, armazem_loc, lote, validade, requisicao, movimentos!inner(cliente_id, nome, morada, cod_postal, cod_postal_localidade, requisicao)',
          countMode ? { count: countMode } : undefined
        )
        .or('tipo_armazem.eq.04,armazem.ilike.*04,armazem_loc.ilike.*04');

      if (!isManagerOrAdmin && userClientId) {
        q = q.eq('movimentos.cliente_id', userClientId);
      }

      return q.order('data_movimento', { ascending: false }).range(from, to);
    }, 2000),
  ]);

  const clientsList = (clients as Client[]) || [];
  const clientsById = new Map<string, Client>(clientsList.map((c) => [c.id, c]));

  // Mapear descrições e artigo_id do catálogo de artigos
  const artigoDescByIdMap = new Map<string, string>();
  const artigoDescByCliMap = new Map<string, string>();
  const artigoIdByCliMap = new Map<string, string>();

  if (artigosList) {
    for (const art of artigosList) {
      const desc = (art.descricao || '').toString().trim();
      const artIdStr =
        art.artigo_id !== null && art.artigo_id !== undefined ? String(art.artigo_id).trim() : '';
      const artCliKey = art.artigo_cli ? String(art.artigo_cli).trim().toLowerCase() : '';
      if (artIdStr && desc) {
        artigoDescByIdMap.set(artIdStr, desc);
      }
      if (artCliKey && desc) {
        artigoDescByCliMap.set(artCliKey, desc);
      }
      if (artCliKey && artIdStr) {
        artigoIdByCliMap.set(artCliKey, artIdStr);
      }
    }
  }

  const resolveArtigoId = (item: {
    artigo_id?: any;
    artigo?: any;
    artigo_cli?: any;
  }) => {
    const idKey =
      item.artigo_id !== null && item.artigo_id !== undefined
        ? String(item.artigo_id).trim()
        : item.artigo !== null && item.artigo !== undefined
        ? String(item.artigo).trim()
        : '';
    if (idKey) return idKey;
    const cliKey = String(item.artigo_cli || '').trim().toLowerCase();
    if (cliKey && artigoIdByCliMap.has(cliKey)) {
      return artigoIdByCliMap.get(cliKey)!;
    }
    return item.artigo_cli || '';
  };

  const resolveArtigoDescricao = (item: {
    artigo_id?: any;
    artigo?: any;
    artigo_cli?: any;
    descricao?: any;
  }) => {
    const idKey =
      item.artigo_id !== null && item.artigo_id !== undefined
        ? String(item.artigo_id).trim()
        : item.artigo !== null && item.artigo !== undefined
        ? String(item.artigo).trim()
        : '';
    if (idKey && artigoDescByIdMap.has(idKey)) {
      return artigoDescByIdMap.get(idKey)!;
    }
    const cliKey = String(item.artigo_cli || '').trim().toLowerCase();
    if (cliKey && artigoDescByCliMap.has(cliKey)) {
      return artigoDescByCliMap.get(cliKey)!;
    }
    return (item.descricao || item.artigo_cli || '').toString().trim();
  };

  // Filtrar e formatar os artigos rececionados cuja entrada é feita no armazém com terminação 04 de cada cliente
  const rececoesArmazem04: RececaoArmazem04[] = [];
  if (movimentosArm04Raw) {
    for (let i = 0; i < movimentosArm04Raw.length; i++) {
      const m = movimentosArm04Raw[i];
      const tm = String(m.tipo_movimento || '').trim().toUpperCase();
      // Garantir que é uma entrada (ES ou ET) no armazém com terminação 04
      if (tm !== 'ES' && tm !== 'ET') continue;

      const armCode = String(m.armazem || m.armazem_loc || m.tipo_armazem || '').trim();
      const tipoArm = String(m.tipo_armazem || '').trim();
      const endsWith04 =
        tipoArm === '04' ||
        armCode.endsWith('04') ||
        String(m.armazem_loc || '').trim().endsWith('04');
      if (!endsWith04) continue;

      const cliId = m.movimentos?.cliente_id || '';
      const cliObj = clientsById.get(cliId);
      const sigla = cliObj?.sigla || '';

      rececoesArmazem04.push({
        id: m.doc_linha || `${m.documento_ref}_${i}`,
        documento_ref: m.documento_ref || '-',
        ref_ser: m.ref_ser || null,
        data_movimento: m.data_movimento || m.created_at || '',
        cliente_id: cliId,
        cliente_sigla: sigla,
        cliente_nome: cliObj?.name || sigla || '-',
        armazem: m.armazem || (sigla ? `${sigla}04` : '04'),
        armazem_loc: m.armazem_loc || (sigla ? `${sigla}-04` : '04'),
        tipo_movimento: tm,
        artigo_id: resolveArtigoId(m),
        artigo_cli: m.artigo_cli || '',
        descricao: resolveArtigoDescricao(m),
        lote: m.lote || '-',
        validade: m.validade || null,
        quantidade: Math.abs(Number(m.quantidade || 0)),
        origem_nome: m.movimentos?.nome || null,
        localidade: m.movimentos?.cod_postal_localidade || null,
        requisicao: m.requisicao || m.movimentos?.requisicao || null,
      });
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-background pb-12">
      <AppHeader
        userProfile={profile as UserProfile}
        userEmail={user.email}
        activeTab="logistica-inversa"
      />

      <LogisticaInversaView
        clients={clientsList}
        destinos={(destinos as Destino[]) || []}
        artigos={(artigosList as Artigo[]) || []}
        pedidosRecolha={(pedidosRecolha as PedidoRecolhaComLinhas[]) || []}
        rececoesArmazem04={rececoesArmazem04}
        currentUserProfile={(profile as UserProfile) || null}
      />
    </div>
  );
}

