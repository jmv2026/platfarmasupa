'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/context';
import { apagarLinhaStockAction, editarLinhaStockAction } from './actions';
import {
  StockAtual,
  StockPedido,
  StockZero,
  Client,
  TIPO_ARTIGO_LABELS,
  TIPO_ARMAZENAMENTO_LABELS,
  ID_TIPO_ARTIGO_MAP,
  TipoArtigo,
  TipoArmazenamento,
  UserProfile,
  Tempo,
} from '@/lib/supabase/types';


interface StocksViewProps {
  stockAtual: StockAtual[];
  stockPedidos: StockPedido[];
  clients: Client[];
  stockZero?: StockZero[];
  currentUserProfile: UserProfile | null;
  tempos: Tempo[];
}

type TabType = 'pedidos' | 'consolidado' | 'artigos' | 'validade' | 'stock_zero';
type StockSortField = 'artigo' | 'descricao';
type StockSortOrder = 'asc' | 'desc';

interface TabSortState {
  field: StockSortField | 'default';
  order: StockSortOrder;
}

export default function StocksView({
  stockAtual,
  stockPedidos,
  clients,
  stockZero = [],
  currentUserProfile,
  tempos,
}: StocksViewProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [stockAtualList, setStockAtualList] = useState<StockAtual[]>(stockAtual);

  useEffect(() => {
    setStockAtualList(stockAtual);
  }, [stockAtual]);

  const [activeTab, setActiveTab] = useState<TabType>('pedidos');
  const [tabSorts, setTabSorts] = useState<Record<TabType, TabSortState>>({
    pedidos: { field: 'artigo', order: 'asc' },
    consolidado: { field: 'artigo', order: 'asc' },
    artigos: { field: 'artigo', order: 'asc' },
    validade: { field: 'default', order: 'asc' },
    stock_zero: { field: 'artigo', order: 'asc' },
  });

  const handleToggleSort = (field: StockSortField) => {
    setTabSorts((prev) => {
      const current = prev[activeTab];
      const isSameField = current.field === field;
      const newOrder: StockSortOrder = isSameField && current.order === 'asc' ? 'desc' : 'asc';
      return {
        ...prev,
        [activeTab]: {
          field,
          order: newOrder,
        },
      };
    });
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('todos');
  const [selectedArmazenamento, setSelectedArmazenamento] = useState<string>('todos');
  const [selectedTipoArtigo, setSelectedTipoArtigo] = useState<string>('todos');
  const [selectedTipoArmazem, setSelectedTipoArmazem] = useState<string>('todos');

  const isAdmin =
    currentUserProfile?.role === 'admin' ||
    currentUserProfile?.email === 'admin@sermail.pt';

  const isManagerOrAdmin =
    currentUserProfile?.role === 'admin' ||
    currentUserProfile?.role === 'gestor' ||
    currentUserProfile?.email === 'admin@sermail.pt';

  // Estados de Edição e Remoção de Linha de Stock (Apenas Administrador)
  const [editingStock, setEditingStock] = useState<StockAtual | null>(null);
  const [editForm, setEditForm] = useState({
    artigo_id: '',
    lote: '',
    validade: '',
    armazem_loc: '',
    stock: 0,
  });
  const [deletingStock, setDeletingStock] = useState<StockAtual | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [stockFeedback, setStockFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleOpenEdit = (item: StockAtual) => {
    setEditingStock(item);
    setEditForm({
      artigo_id: item.artigo_id,
      lote: item.lote || '',
      validade: item.validade ? item.validade.split('T')[0] : '',
      armazem_loc: item.armazem_loc || '',
      stock: Number(item.stock) || 0,
    });
    setStockFeedback(null);
  };

  const handleConfirmEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStock || !editingStock.stock_id) {
      setStockFeedback({ type: 'error', message: 'Identificador do registo de stock não encontrado.' });
      return;
    }

    setActionLoading(true);
    setStockFeedback(null);

    try {
      const res = await editarLinhaStockAction({
        stockId: editingStock.stock_id,
        artigo_id: editForm.artigo_id,
        lote: editForm.lote || null,
        validade: editForm.validade || null,
        armazem_loc: editForm.armazem_loc || null,
        stock: editForm.stock,
      });

      if (res.success) {
        setStockFeedback({ type: 'success', message: `Linha de stock [${editForm.artigo_id}] atualizada com sucesso.` });
        setStockAtualList((prev) =>
          prev.map((s) =>
            s.stock_id === editingStock.stock_id
              ? {
                  ...s,
                  artigo_id: editForm.artigo_id.trim().toUpperCase(),
                  lote: editForm.lote ? editForm.lote.trim() : null,
                  validade: editForm.validade || null,
                  armazem_loc: editForm.armazem_loc ? editForm.armazem_loc.trim() : s.armazem_loc,
                  stock: editForm.stock,
                }
              : s
          )
        );
        setEditingStock(null);
        router.refresh();
      } else {
        setStockFeedback({ type: 'error', message: res.error || 'Erro ao editar linha de stock.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao editar linha de stock.';
      setStockFeedback({ type: 'error', message: msg });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingStock || !deletingStock.stock_id) {
      setStockFeedback({ type: 'error', message: 'Identificador do registo de stock não encontrado.' });
      return;
    }

    setActionLoading(true);
    setStockFeedback(null);

    try {
      const res = await apagarLinhaStockAction(deletingStock.stock_id);

      if (res.success) {
        setStockFeedback({
          type: 'success',
          message: `Linha de stock [${deletingStock.artigo_id} - ${deletingStock.lote || 'S/L'}] eliminada com sucesso.`,
        });
        setStockAtualList((prev) => prev.filter((s) => s.stock_id !== deletingStock.stock_id));
        setDeletingStock(null);
        router.refresh();
      } else {
        setStockFeedback({ type: 'error', message: res.error || 'Erro ao apagar linha de stock.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao apagar linha de stock.';
      setStockFeedback({ type: 'error', message: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // Helper para calcular dias até à validade
  const getDaysUntilExpiry = (dateStr: string | null) => {
    if (!dateStr) return null;
    const expiry = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Helper para ordenação dinâmica (Artigo ou Descrição, crescente ou decrescente)
  const compareStockItems = (
    a: { artigo_id?: string | null; artigo_cli?: string | null; descricao?: string | null; validade?: string | null; lote?: string | null },
    b: { artigo_id?: string | null; artigo_cli?: string | null; descricao?: string | null; validade?: string | null; lote?: string | null },
    sortConfig: TabSortState
  ) => {
    const orderMultiplier = sortConfig.order === 'desc' ? -1 : 1;

    if (sortConfig.field === 'descricao') {
      const descA = (a.descricao || '').trim();
      const descB = (b.descricao || '').trim();
      const comp = descA.localeCompare(descB, undefined, { numeric: true, sensitivity: 'base' });
      if (comp !== 0) return comp * orderMultiplier;
      // Desempate pelo artigo
      const artA = (a.artigo_id || a.artigo_cli || '').trim();
      const artB = (b.artigo_id || b.artigo_cli || '').trim();
      return artA.localeCompare(artB, undefined, { numeric: true, sensitivity: 'base' }) * orderMultiplier;
    }

    // sortConfig.field === 'artigo' ou 'default'
    const artA = (a.artigo_id || a.artigo_cli || '').trim();
    const artB = (b.artigo_id || b.artigo_cli || '').trim();
    const comp = artA.localeCompare(artB, undefined, { numeric: true, sensitivity: 'base' });
    if (comp !== 0) return comp * orderMultiplier;

    // Desempate por validade ou lote se aplicável
    if (a.validade && b.validade) {
      const timeA = new Date(a.validade).getTime();
      const timeB = new Date(b.validade).getTime();
      if (timeA !== timeB) return timeA - timeB;
    }
    return (a.lote || '').localeCompare(b.lote || '', undefined, { numeric: true, sensitivity: 'base' });
  };

  // Botão interativo para o cabeçalho das tabelas (alterna asc/desc) com fundo verde lima suave
  const renderSortableHeader = (field: StockSortField, label: string) => {
    const activeSort = tabSorts[activeTab];
    const isCurrent = activeSort.field === field;
    const isAsc = activeSort.order === 'asc';

    return (
      <button
        type="button"
        onClick={() => handleToggleSort(field)}
        className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold transition-all text-left select-none cursor-pointer border shadow-2xs ${
          isCurrent
            ? 'bg-lime-200 hover:bg-lime-300/80 text-lime-950 border-lime-400 ring-1 ring-lime-400/50 shadow-xs'
            : 'bg-lime-100 hover:bg-lime-200/80 text-lime-900 border-lime-200/90'
        }`}
        title={`Clique para alternar ordenação por ${label} (${isCurrent && isAsc ? 'decrescente' : 'crescente'})`}
      >
        <span className="leading-tight">{label}</span>
        <span
          className={`material-symbols-outlined transition-transform duration-200 shrink-0 ${
            isCurrent
              ? isAsc
                ? 'text-lime-950 transform rotate-0'
                : 'text-lime-950 transform rotate-180'
              : 'text-lime-700/80 group-hover:text-lime-900'
          }`}
          style={{ fontSize: '15px' }}
        >
          {isCurrent ? 'arrow_upward' : 'swap_vert'}
        </span>
      </button>
    );
  };

  // KPIs

  const totalStockOutros = useMemo(() => {
    return stockAtualList
      .filter((s) => s.tipo_armazem !== '01')
      .reduce((acc, curr) => acc + Number(curr.stock || 0), 0);
  }, [stockAtualList]);


  const artigosAlertaValidadeMH = useMemo(() => {
    const artigosSet = new Set<string>();
    stockAtualList.forEach((s) => {
      // A validade de 180 dias apenas se aplica a medicamentos de uso humano (MH)
      const tipo = s.tipo_artigo ? String(s.tipo_artigo).trim().toUpperCase() : '';
      const isMH = tipo === 'MH' || tipo.startsWith('MH') || tipo.includes('HUMANO');
      if (isMH) {
        const days = getDaysUntilExpiry(s.validade);
        if (days !== null && days < 180) {
          artigosSet.add(s.artigo_id);
        }
      }
    });
    return artigosSet.size;
  }, [stockAtualList]);

  const artigosAlertaValidadeDM = useMemo(() => {
    const artigosSet = new Set<string>();
    stockAtualList.forEach((s) => {
      // Contabilizar todos os artigos do tipo DM cuja validade esteja expirada (<= 0 dias)
      const tipo = s.tipo_artigo ? String(s.tipo_artigo).trim().toUpperCase() : '';
      const isDM = tipo === 'DM' || tipo.startsWith('DM') || tipo.includes('DISPOSITIVO');
      if (isDM) {
        const days = getDaysUntilExpiry(s.validade);
        if (days !== null && days <= 0) {
          artigosSet.add(s.artigo_id);
        }
      }
    });
    return artigosSet.size;
  }, [stockAtualList]);

  const artigosAlertaValidadeDCSA = useMemo(() => {
    const artigosSet = new Set<string>();
    stockAtualList.forEach((s) => {
      // Contabilizar todos os artigos do tipo DC e SA cuja validade esteja expirada (<= 0 dias)
      const tipo = s.tipo_artigo ? String(s.tipo_artigo).trim().toUpperCase() : '';
      const isDCSA =
        tipo === 'DC' ||
        tipo === 'SA' ||
        tipo.startsWith('DC') ||
        tipo.startsWith('SA') ||
        tipo.includes('DERMO') ||
        tipo.includes('COSM') ||
        tipo.includes('SUPL');

      if (isDCSA) {
        const days = getDaysUntilExpiry(s.validade);
        if (days !== null && days <= 0) {
          artigosSet.add(s.artigo_id);
        }
      }
    });
    return artigosSet.size;
  }, [stockAtualList]);

  // Filtragem para Stock de Venda (vw_stock_pedidos) - Ordenação dinâmica
  const filteredStockPedidos = useMemo(() => {
    return stockPedidos
      .filter((item) => {
        if (selectedClientId !== 'todos' && item.cliente_id !== selectedClientId) {
          return false;
        }
        if (
          selectedArmazenamento !== 'todos' &&
          item.tipo_armazenamento !== selectedArmazenamento
        ) {
          return false;
        }
        if (
          selectedTipoArtigo !== 'todos' &&
          item.tipo_artigo !== selectedTipoArtigo
        ) {
          return false;
        }
        if (searchTerm.trim()) {
          const query = searchTerm.toLowerCase();
          const matchCod =
            item.artigo_id?.toLowerCase().includes(query) ||
            item.artigo_cli?.toLowerCase().includes(query);
          const matchDesc = item.descricao?.toLowerCase().includes(query);
          const matchLote = item.lote?.toLowerCase().includes(query);
          const matchCli = item.cliente_sigla?.toLowerCase().includes(query) || item.cliente_nome?.toLowerCase().includes(query);
          if (!matchCod && !matchDesc && !matchLote && !matchCli) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => compareStockItems(a, b, tabSorts.pedidos));
  }, [stockPedidos, selectedClientId, selectedArmazenamento, selectedTipoArtigo, searchTerm, tabSorts.pedidos]);

  // Filtragem para Stock Consolidado (vw_stock_atual) - Ordenação dinâmica
  const filteredStockAtual = useMemo(() => {
    return stockAtualList
      .filter((item) => {
        if (selectedClientId !== 'todos' && item.cliente_id !== selectedClientId) {
          return false;
        }
        if (
          selectedArmazenamento !== 'todos' &&
          item.tipo_armazenamento !== selectedArmazenamento
        ) {
          return false;
        }
        if (
          selectedTipoArtigo !== 'todos' &&
          item.tipo_artigo !== selectedTipoArtigo
        ) {
          return false;
        }
        if (
          selectedTipoArmazem !== 'todos' &&
          item.tipo_armazem !== selectedTipoArmazem
        ) {
          return false;
        }
        if (searchTerm.trim()) {
          const query = searchTerm.toLowerCase();
          const matchCod =
            item.artigo_id?.toLowerCase().includes(query) ||
            item.artigo_cli?.toLowerCase().includes(query);
          const matchDesc = item.descricao?.toLowerCase().includes(query);
          const matchLote = item.lote?.toLowerCase().includes(query);
          const matchArmLoc = item.armazem_loc?.toLowerCase().includes(query);
          const matchCli = item.cliente_sigla?.toLowerCase().includes(query) || item.cliente_nome?.toLowerCase().includes(query);
          if (!matchCod && !matchDesc && !matchLote && !matchArmLoc && !matchCli) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => compareStockItems(a, b, tabSorts.consolidado));
  }, [stockAtualList, selectedClientId, selectedArmazenamento, selectedTipoArtigo, selectedTipoArmazem, searchTerm, tabSorts.consolidado]);

  // Agrupamento por Artigo - Ordenação dinâmica
  const resumoArtigos = useMemo(() => {
    const map = new Map<
      string,
      {
        artigo_id: string;
        artigo_cli: string;
        descricao: string | null;
        cliente_sigla: string;
        cliente_id: string;

        tipo_artigo: TipoArtigo;
        tipo_armazenamento: TipoArmazenamento;
        stockVenda: number;
        stockOutros: number;
        stockTotal: number;
        lotesCount: Set<string>;
        primeiraValidade: string | null;
      }
    >();

    filteredStockAtual.forEach((item) => {
      const currentClientId = item.cliente_id || '';
      const key = `${currentClientId}_${item.artigo_id}`;
      if (!map.has(key)) {
        map.set(key, {
          artigo_id: item.artigo_id,
          artigo_cli: item.artigo_cli,
          descricao: item.descricao,
          cliente_sigla: item.cliente_sigla,
          cliente_id: currentClientId,

          tipo_artigo: item.tipo_artigo,
          tipo_armazenamento: item.tipo_armazenamento,
          stockVenda: 0,
          stockOutros: 0,
          stockTotal: 0,
          lotesCount: new Set<string>(),
          primeiraValidade: item.validade,
        });
      }

      const obj = map.get(key)!;
      if (!obj.descricao && item.descricao) {
        obj.descricao = item.descricao;
      }
      const qtd = Number(item.stock || 0);
      obj.stockTotal += qtd;
      if (item.tipo_armazem === '01') {
        obj.stockVenda += qtd;
      } else {
        obj.stockOutros += qtd;
      }
      if (item.lote) {
        obj.lotesCount.add(item.lote);
      }
      if (item.validade) {
        if (!obj.primeiraValidade || new Date(item.validade) < new Date(obj.primeiraValidade)) {
          obj.primeiraValidade = item.validade;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => compareStockItems(a, b, tabSorts.artigos));
  }, [filteredStockAtual, tabSorts.artigos]);

  // Lotes para Alerta de Validade (FEFO com suporte a ordenação dinâmica por cabeçalho)
  const lotesValidade = useMemo(() => {
    const sortConfig = tabSorts.validade;
    return [...filteredStockAtual]
      .filter((s) => s.validade)
      .sort((a, b) => {
        if (sortConfig.field !== 'default') {
          return compareStockItems(a, b, sortConfig);
        }
        if (!a.validade) return 1;
        if (!b.validade) return -1;
        const diff = new Date(a.validade).getTime() - new Date(b.validade).getTime();
        if (diff !== 0) return diff;
        return compareStockItems(a, b, { field: 'artigo', order: 'asc' });
      });
  }, [filteredStockAtual, tabSorts.validade]);


  // Set de artigos que têm stock positivo em armazém (o lote deve ser ignorado)
  const artigosComStockPositivo = useMemo(() => {
    const set = new Set<string>();
    (stockAtualList || []).forEach((item) => {
      if (Number(item.stock) > 0) {
        const cid = item.cliente_id || '';
        if (item.artigo_id) {
          set.add(`${cid}::${item.artigo_id.trim().toLowerCase()}`);
          const norm = item.artigo_id.trim().replace(/^[0-9]+-/, '').toLowerCase();
          set.add(`${cid}::${norm}`);
        }
        if (item.artigo_cli) {
          set.add(`${cid}::${item.artigo_cli.trim().toLowerCase()}`);
          const normCli = item.artigo_cli.trim().replace(/^[0-9]+-/, '').toLowerCase();
          set.add(`${cid}::${normCli}`);
        }
      }
    });
    return set;
  }, [stockAtualList]);

  // Filtragem para Artigos com Stock 0 (vw_stock_zero)
  // Regra: O lote deve ser ignorado, e verificado apenas o artigo
  const filteredStockZero = useMemo(() => {
    const seenArtigos = new Set<string>();

    return (stockZero || []).filter((item) => {
      const cid = item.cliente_id || '';
      const artId = (item.artigo_id || '').trim().toLowerCase();
      const artCli = (item.artigo_cli || '').trim().toLowerCase();
      const normArtId = artId.replace(/^[0-9]+-/, '');
      const normArtCli = artCli.replace(/^[0-9]+-/, '');

      // Se o artigo tiver stock positivo em qualquer lote/armazém, NÃO deve constar como stock 0
      if (
        artigosComStockPositivo.has(`${cid}::${artId}`) ||
        (artCli && artigosComStockPositivo.has(`${cid}::${artCli}`)) ||
        (normArtId && artigosComStockPositivo.has(`${cid}::${normArtId}`)) ||
        (normArtCli && artigosComStockPositivo.has(`${cid}::${normArtCli}`))
      ) {
        return false;
      }

      // Evitar duplicações do mesmo artigo (verificação a nível de artigo)
      const uniqueKey = `${cid}::${normArtId || artId}`;
      if (seenArtigos.has(uniqueKey)) {
        return false;
      }
      seenArtigos.add(uniqueKey);

      if (selectedClientId !== 'todos' && item.cliente_id !== selectedClientId) {
        return false;
      }
      if (
        selectedArmazenamento !== 'todos' &&
        item.tipo_armazenamento !== selectedArmazenamento
      ) {
        return false;
      }
      if (
        selectedTipoArtigo !== 'todos' &&
        item.tipo_artigo !== selectedTipoArtigo &&
        ID_TIPO_ARTIGO_MAP[item.tipo_artigo || ''] !== selectedTipoArtigo
      ) {
        return false;
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          item.artigo_id?.toLowerCase().includes(q) ||
          item.artigo_cli?.toLowerCase().includes(q) ||
          item.descricao?.toLowerCase().includes(q) ||
          item.cliente_sigla?.toLowerCase().includes(q) ||
          item.cliente_nome?.toLowerCase().includes(q)
        );
      }
      return true;
    }).sort((a, b) => compareStockItems(a, b, tabSorts.stock_zero));
  }, [stockZero, artigosComStockPositivo, selectedClientId, selectedArmazenamento, selectedTipoArtigo, searchTerm, tabSorts.stock_zero]);

  // Exportar CSV
  const handleExportCSV = () => {
    try {
      const sanitize = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      const rows: string[] = [];

      if (activeTab === 'pedidos') {
        rows.push('Cliente,Artigo,Artigo Cli,Descricao,Tipo Artigo,Conservacao,Lote,Validade,Stock Disponivel');
        filteredStockPedidos.forEach((r) => {
          rows.push(`${sanitize(r.cliente_sigla)},${sanitize(r.artigo_id)},${sanitize(r.artigo_cli)},${sanitize(r.descricao || '')},${sanitize(r.tipo_artigo)},${sanitize(r.tipo_armazenamento)},${sanitize(r.lote || '')},${sanitize(r.validade || '')},${r.stock}`);
        });
      } else if (activeTab === 'consolidado') {
        rows.push('Cliente,Artigo,Artigo Cli,Descricao,Lote,Validade,Armazem Loc,Tipo Armazem,Descricao Armazem,Stock');
        filteredStockAtual.forEach((r) => {
          rows.push(`${sanitize(r.cliente_sigla)},${sanitize(r.artigo_id)},${sanitize(r.artigo_cli)},${sanitize(r.descricao || '')},${sanitize(r.lote || '')},${sanitize(r.validade || '')},${sanitize(r.armazem_loc)},${sanitize(r.tipo_armazem)},${sanitize(r.armazem_descricao || '')},${r.stock}`);
        });
      } else if (activeTab === 'artigos') {
        rows.push('Cliente,Artigo,Artigo Cli,Descricao,Tipo Artigo,Conservacao,Stock Venda,Stock Outros,Stock Total,Lotes');
        resumoArtigos.forEach((r) => {
          rows.push(`${sanitize(r.cliente_sigla)},${sanitize(r.artigo_id)},${sanitize(r.artigo_cli)},${sanitize(r.descricao || '')},${sanitize(r.tipo_artigo)},${sanitize(r.tipo_armazenamento)},${r.stockVenda},${r.stockOutros},${r.stockTotal},${r.lotesCount.size}`);
        });
      } else if (activeTab === 'stock_zero') {
        rows.push('Cliente,Artigo,Artigo Cli,Descricao,Tipo Artigo,Conservacao,Familia,Stock,Ultimo Movimento,Total Movimentos');
        filteredStockZero.forEach((r) => {
          rows.push(`${sanitize(r.cliente_sigla)},${sanitize(r.artigo_id)},${sanitize(r.artigo_cli)},${sanitize(r.descricao || '')},${sanitize(r.tipo_artigo || '')},${sanitize(r.tipo_armazenamento || '')},${sanitize(r.familia || '')},${r.stock},${sanitize(r.ultimo_movimento || '')},${r.total_movimentos}`);
        });
      } else {
        rows.push('Cliente,Artigo,Artigo Cli,Descricao,Lote,Validade,Dias Restantes,Armazem Loc,Stock');
        lotesValidade.forEach((r) => {
          const days = getDaysUntilExpiry(r.validade);
          rows.push(`${sanitize(r.cliente_sigla)},${sanitize(r.artigo_id)},${sanitize(r.artigo_cli)},${sanitize(r.descricao || '')},${sanitize(r.lote || '')},${sanitize(r.validade || '')},${days ?? ''},${sanitize(r.armazem_loc)},${r.stock}`);
        });
      }

      const csvString = '\uFEFF' + rows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `stocks_export_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
    }
  };

  // Exportar Excel (.xlsx) com formatação rica via ExcelJS (import dinâmico para poupar ~900KB no bundle inicial)
  const handleExportExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheetTitles: Record<TabType, string> = {
      pedidos: 'Stock Disponível',
      consolidado: 'Stock Consolidado',
      artigos: 'Resumo por Artigo',
      validade: 'Controlo de Validades',
      stock_zero: 'Artigos Stock 0',
    };

    const worksheet = workbook.addWorksheet(sheetTitles[activeTab] || 'Stocks');

    if (activeTab === 'pedidos') {
      worksheet.columns = [
        { header: 'Cliente', key: 'cliente_sigla', width: 12 },
        { header: 'Artigo', key: 'artigo_id', width: 16 },
        { header: 'Artigo Cli', key: 'artigo_cli', width: 18 },
        { header: 'Descrição Artigo', key: 'descricao', width: 38 },
        { header: 'Tipo Artigo', key: 'tipo_artigo', width: 16 },
        { header: 'Conservação', key: 'tipo_armazenamento', width: 16 },
        { header: 'Lote', key: 'lote', width: 18 },
        { header: 'Validade', key: 'validade', width: 14 },
        { header: 'Stock Disponível', key: 'stock', width: 18 },
      ];

      filteredStockPedidos.forEach((r) => {
        worksheet.addRow({
          cliente_sigla: r.cliente_sigla,
          artigo_id: r.artigo_id,
          artigo_cli: r.artigo_cli,
          descricao: r.descricao || '-',
          tipo_artigo: TIPO_ARTIGO_LABELS[r.tipo_artigo as TipoArtigo] || r.tipo_artigo,
          tipo_armazenamento: TIPO_ARMAZENAMENTO_LABELS[r.tipo_armazenamento as TipoArmazenamento] || r.tipo_armazenamento,
          lote: r.lote || '-',
          validade: r.validade ? new Date(r.validade).toLocaleDateString('pt-PT') : '-',
          stock: Number(r.stock),
        });
      });
    } else if (activeTab === 'consolidado') {
      worksheet.columns = [
        { header: 'Cliente', key: 'cliente_sigla', width: 12 },
        { header: 'Artigo', key: 'artigo_id', width: 16 },
        { header: 'Artigo Cli', key: 'artigo_cli', width: 18 },
        { header: 'Descrição Artigo', key: 'descricao', width: 38 },
        { header: 'Lote', key: 'lote', width: 18 },
        { header: 'Validade', key: 'validade', width: 14 },
        { header: 'Armazém Loc', key: 'armazem_loc', width: 16 },
        { header: 'Tipo Armazém', key: 'tipo_armazem', width: 14 },
        { header: 'Descrição Armazém', key: 'armazem_descricao', width: 22 },
        { header: 'Stock', key: 'stock', width: 14 },
      ];

      filteredStockAtual.forEach((r) => {
        worksheet.addRow({
          cliente_sigla: r.cliente_sigla,
          artigo_id: r.artigo_id,
          artigo_cli: r.artigo_cli,
          descricao: r.descricao || '-',
          lote: r.lote || '-',
          validade: r.validade ? new Date(r.validade).toLocaleDateString('pt-PT') : '-',
          armazem_loc: r.armazem_loc,
          tipo_armazem: r.tipo_armazem,
          armazem_descricao: r.armazem_descricao || `Armazém ${r.tipo_armazem}`,
          stock: Number(r.stock),
        });
      });
    } else if (activeTab === 'artigos') {
      worksheet.columns = [
        { header: 'Cliente', key: 'cliente_sigla', width: 12 },
        { header: 'Artigo', key: 'artigo_id', width: 16 },
        { header: 'Artigo Cli', key: 'artigo_cli', width: 18 },
        { header: 'Descrição Artigo', key: 'descricao', width: 38 },
        { header: 'Tipo Artigo', key: 'tipo_artigo', width: 16 },
        { header: 'Conservação', key: 'tipo_armazenamento', width: 16 },
        { header: 'Stock Venda (01)', key: 'stockVenda', width: 18 },
        { header: 'Stock Outros', key: 'stockOutros', width: 16 },
        { header: 'Stock Total', key: 'stockTotal', width: 16 },
        { header: 'Lotes Distintos', key: 'lotesCount', width: 16 },
      ];

      resumoArtigos.forEach((r) => {
        worksheet.addRow({
          cliente_sigla: r.cliente_sigla,
          artigo_id: r.artigo_id,
          artigo_cli: r.artigo_cli,
          descricao: r.descricao || '-',
          tipo_artigo: TIPO_ARTIGO_LABELS[r.tipo_artigo as TipoArtigo] || r.tipo_artigo,
          tipo_armazenamento: TIPO_ARMAZENAMENTO_LABELS[r.tipo_armazenamento as TipoArmazenamento] || r.tipo_armazenamento,
          stockVenda: r.stockVenda,
          stockOutros: r.stockOutros,
          stockTotal: r.stockTotal,
          lotesCount: r.lotesCount.size,
        });
      });
    } else if (activeTab === 'stock_zero') {
      worksheet.columns = [
        { header: 'Cliente', key: 'cliente_sigla', width: 12 },
        { header: 'Artigo', key: 'artigo_id', width: 16 },
        { header: 'Artigo Cli', key: 'artigo_cli', width: 18 },
        { header: 'Descrição Artigo', key: 'descricao', width: 38 },
        { header: 'Tipo Artigo', key: 'tipo_artigo', width: 16 },
        { header: 'Conservação', key: 'tipo_armazenamento', width: 16 },
        { header: 'Família', key: 'familia', width: 16 },
        { header: 'Stock Atual', key: 'stock', width: 14 },
        { header: 'Último Movimento', key: 'ultimo_movimento', width: 22 },
        { header: 'Total Movimentos', key: 'total_movimentos', width: 16 },
      ];
      filteredStockZero.forEach((item) => {
        worksheet.addRow({
          cliente_sigla: item.cliente_sigla,
          artigo_id: item.artigo_id,
          artigo_cli: item.artigo_cli,
          descricao: item.descricao || '-',
          tipo_artigo: item.tipo_artigo || '-',
          tipo_armazenamento: item.tipo_armazenamento || '-',
          familia: item.familia || '-',
          stock: item.stock,
          ultimo_movimento: item.ultimo_movimento ? new Date(item.ultimo_movimento).toLocaleString('pt-PT') : 'Sem movimentos',
          total_movimentos: item.total_movimentos,
        });
      });
    } else {
      worksheet.columns = [
        { header: 'Cliente', key: 'cliente_sigla', width: 12 },
        { header: 'Artigo', key: 'artigo_id', width: 16 },
        { header: 'Artigo Cli', key: 'artigo_cli', width: 18 },
        { header: 'Descrição Artigo', key: 'descricao', width: 38 },
        { header: 'Lote', key: 'lote', width: 18 },
        { header: 'Validade', key: 'validade', width: 14 },
        { header: 'Dias Restantes', key: 'dias_restantes', width: 16 },
        { header: 'Armazém Loc', key: 'armazem_loc', width: 16 },
        { header: 'Stock', key: 'stock', width: 14 },
      ];

      lotesValidade.forEach((r) => {
        const days = getDaysUntilExpiry(r.validade);
        worksheet.addRow({
          cliente_sigla: r.cliente_sigla,
          artigo_id: r.artigo_id,
          artigo_cli: r.artigo_cli,
          descricao: r.descricao || '-',
          lote: r.lote || '-',
          validade: r.validade ? new Date(r.validade).toLocaleDateString('pt-PT') : '-',
          dias_restantes: days ?? '-',
          armazem_loc: r.armazem_loc,
          stock: Number(r.stock),
        });
      });
    }

    // Estilo elegante de cabeçalho
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B4332' }, // Verde floresta escuro Sermail
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
    headerRow.height = 26;

    // Gerar buffer e download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `stocks_export_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedClientId !== 'todos' ||
    selectedArmazenamento !== 'todos' ||
    selectedTipoArtigo !== 'todos' ||
    selectedTipoArmazem !== 'todos';

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedClientId('todos');
    setSelectedArmazenamento('todos');
    setSelectedTipoArtigo('todos');
    setSelectedTipoArmazem('todos');
  };

  return (
    <main className="w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Banner Sermail */}
      <div className="bg-gradient-to-r from-sermail-green-dark via-sermail-green to-[#005a46] text-white rounded-2xl px-6 py-4 shadow-sm relative overflow-hidden border border-emerald-950/30">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-sermail-lime-border shrink-0 border border-white/10">
              <span className="material-symbols-outlined text-xl">inventory_2</span>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold font-headline leading-tight text-white">
                {t.stocks.bannerTitle}
              </h1>
              <p className="text-xs sm:text-sm text-lime-300/90 font-medium">
                {t.stocks.bannerSubtitle}
              </p>
            </div>
          </div>

        </div>
      </div>

      <div className="space-y-6">
        {/* KPIs Grid (4 Indicadores superiores compactos com o mesmo formato e altura do Dashboard) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 items-stretch">
          {/* 1. Stock Outros Armazéns */}
          <div className="sermail-card px-3.5 py-2.5 sm:px-4 sm:py-3 flex flex-col justify-between gap-1.5 sm:gap-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider leading-tight">
                Stock Outros Armazéns
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-base">warehouse</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-extrabold font-headline text-slate-900 leading-none">
                {totalStockOutros.toLocaleString('pt-PT')}{' '}
                <span className="text-[10px] font-normal text-slate-500">un</span>
              </span>
              <span className="text-[10px] text-amber-800 font-semibold flex items-center gap-0.5 leading-tight">
                <span className="material-symbols-outlined text-[11px] shrink-0">info</span>
                <span>Quarentena / Devoluções</span>
              </span>
            </div>
          </div>

          {/* 2. Alertas Validade DM (Expirados - Dispositivos Médicos) */}
          <div className="sermail-card px-3.5 py-2.5 sm:px-4 sm:py-3 flex flex-col justify-between gap-1.5 sm:gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider leading-tight">
                  {t.stocks.alertsDm}
                </span>
                <span className="text-[10px] font-semibold text-rose-700 leading-tight mt-0.5">
                  Dispositivos Médicos
                </span>
              </div>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                artigosAlertaValidadeDM > 0 ? 'bg-rose-50 text-rose-600 border-rose-200/60' : 'bg-emerald-50 text-emerald-600 border-emerald-200/60'
              }`}>
                <span className="material-symbols-outlined text-base">block</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
              <span className={`text-xl sm:text-2xl font-extrabold font-headline leading-none ${
                artigosAlertaValidadeDM > 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}>
                {artigosAlertaValidadeDM}
              </span>
              <span className={`text-[10px] font-semibold flex items-center gap-0.5 leading-tight ${
                artigosAlertaValidadeDM > 0 ? 'text-rose-800' : 'text-emerald-800'
              }`}>
                <span className="material-symbols-outlined text-[11px] shrink-0">error</span>
                <span>{t.stocks.expired}</span>
              </span>
            </div>
          </div>

          {/* 3. Alertas Validade DC e SA */}
          <div className="sermail-card px-3.5 py-2.5 sm:px-4 sm:py-3 flex flex-col justify-between gap-1.5 sm:gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider leading-tight">
                  {t.stocks.alertsDcSa}
                </span>
                <span className="text-[10px] font-semibold text-rose-700 leading-tight mt-0.5">
                  Dermocosméticos, Suplementos
                </span>
              </div>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                artigosAlertaValidadeDCSA > 0 ? 'bg-rose-50 text-rose-600 border-rose-200/60' : 'bg-emerald-50 text-emerald-600 border-emerald-200/60'
              }`}>
                <span className="material-symbols-outlined text-base">block</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
              <span className={`text-xl sm:text-2xl font-extrabold font-headline leading-none ${
                artigosAlertaValidadeDCSA > 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}>
                {artigosAlertaValidadeDCSA}
              </span>
              <span className={`text-[10px] font-semibold flex items-center gap-0.5 leading-tight ${
                artigosAlertaValidadeDCSA > 0 ? 'text-rose-800' : 'text-emerald-800'
              }`}>
                <span className="material-symbols-outlined text-[11px] shrink-0">error</span>
                <span>{t.stocks.expired}</span>
              </span>
            </div>
          </div>

          {/* 4. Alertas Validade MH (< 180 dias) */}
          <div className="sermail-card px-3.5 py-2.5 sm:px-4 sm:py-3 flex flex-col justify-between gap-1.5 sm:gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider leading-tight">
                  {t.stocks.alertsMh}
                </span>
                <span className="text-[10px] font-semibold text-amber-700 leading-tight mt-0.5">
                  Medicamentos Uso Humano
                </span>
              </div>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                artigosAlertaValidadeMH > 0 ? 'bg-amber-50 text-amber-600 border-amber-200/60' : 'bg-emerald-50 text-emerald-600 border-emerald-200/60'
              }`}>
                <span className="material-symbols-outlined text-base">warning</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
              <span className={`text-xl sm:text-2xl font-extrabold font-headline leading-none ${
                artigosAlertaValidadeMH > 0 ? 'text-amber-600' : 'text-emerald-700'
              }`}>
                {artigosAlertaValidadeMH}
              </span>
              <span className={`text-[10px] font-semibold flex items-center gap-0.5 leading-tight ${
                artigosAlertaValidadeMH > 0 ? 'text-amber-800' : 'text-emerald-800'
              }`}>
                <span className="material-symbols-outlined text-[11px] shrink-0">schedule</span>
                <span>{t.stocks.inRisk} (&lt; 180d)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Painel de Filtros e Busca Sermail */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Barra de Pesquisa */}
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.stocks.searchPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300/80 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>

            {/* Botões de Exportação */}
            <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap sm:flex-nowrap">
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                  {t.common.cancel}
                </button>
              )}
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="Exportar CSV"
              >
                <span className="material-symbols-outlined text-sm text-sermail-green">description</span>
                CSV
              </button>
              <button
                onClick={handleExportExcel}
                className="px-4 py-2.5 bg-sermail-green hover:bg-sermail-green-light text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 active:scale-98 cursor-pointer"
                title="Exportar Excel (.xlsx)"
              >
                <span className="material-symbols-outlined text-sm text-sermail-lime-border">table_view</span>
                {t.stocks.exportExcel}
              </button>
            </div>
          </div>

          {/* Linha de Filtros Dropdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            {/* Filtro Cliente (Apenas se Admin/Gestor) */}
            {isManagerOrAdmin ? (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {t.stocks.filterClient}
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer"
                >
                  <option value="todos">{t.stocks.allClients}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.sigla} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {t.stocks.filterClient}
                </label>
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-sermail-green">
                  {currentUserProfile?.empresa || 'Cliente Associado'}
                </div>
              </div>
            )}

            {/* Filtro Conservação */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                {t.stocks.filterStorage}
              </label>
              <select
                value={selectedArmazenamento}
                onChange={(e) => setSelectedArmazenamento(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer"
              >
                <option value="todos">{t.stocks.allStorage}</option>
                <option value="TF">TF - Frio (2-8 ºC)</option>
                <option value="TC">TC - Controlada (15-25 ºC)</option>
                <option value="TA">TA - Temperatura Ambiente</option>
              </select>
            </div>

            {/* Filtro Tipo Artigo */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                {t.stocks.filterArticleType}
              </label>
              <select
                value={selectedTipoArtigo}
                onChange={(e) => setSelectedTipoArtigo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer"
              >
                <option value="todos">{t.stocks.allTypes}</option>
                <option value="MH">MH - Medicamento Humano</option>
                <option value="MV">MV - Medicamento Veterinário</option>
                <option value="DM">DM - Dispositivo Médico</option>
                <option value="DC">DC - Dermo-Cosmético</option>
                <option value="SC">SC - Substância Controlada</option>
                <option value="SA">SA - Suplemento Alimentar</option>
              </select>
            </div>

            {/* Filtro Tipo Armazém */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                {t.stocks.filterWarehouse}
              </label>
              <select
                value={selectedTipoArmazem}
                onChange={(e) => setSelectedTipoArmazem(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer"
              >
                <option value="todos">{t.stocks.allWarehouses}</option>
                <option value="01">01 - Venda (Disponível)</option>
                <option value="05">05 - Quarentena</option>
                <option value="04">04 - Devoluções</option>
                <option value="02">02 - Expirados</option>
                <option value="03">03 - Danificados</option>
                <option value="06">06 - Destruição</option>
                <option value="07">07 - Farmacoteca</option>
                <option value="09">09 - Validade</option>
                <option value="10">10 - MIA</option>
              </select>
            </div>
          </div>
        </div>

        {/* Abas de Navegação de Stock Sermail */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
          <div className="border-b border-slate-200/80 px-6 pt-3 bg-slate-50/70">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('pedidos')}
                className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'pedidos'
                    ? 'border-sermail-green text-sermail-green-dark bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 rounded-t-xl'
                }`}
              >
                <span className={`material-symbols-outlined text-base ${activeTab === 'pedidos' ? 'text-sermail-green' : 'text-slate-400'}`}>shopping_cart_checkout</span>
                {t.stocks.tabVenda}
                <span className="badge-sermail-lime">
                  {filteredStockPedidos.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('consolidado')}
                className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'consolidado'
                    ? 'border-sermail-green text-sermail-green-dark bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 rounded-t-xl'
                }`}
              >
                <span className={`material-symbols-outlined text-base ${activeTab === 'consolidado' ? 'text-sermail-green' : 'text-slate-400'}`}>inventory</span>
                {t.stocks.tabConsolidado}
                <span className="badge-sermail-lime">
                  {filteredStockAtual.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('artigos')}
                className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'artigos'
                    ? 'border-sermail-green text-sermail-green-dark bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 rounded-t-xl'
                }`}
              >
                <span className={`material-symbols-outlined text-base ${activeTab === 'artigos' ? 'text-sermail-green' : 'text-slate-400'}`}>category</span>
                {t.stocks.tabArtigos}
                <span className="badge-sermail-lime">
                  {resumoArtigos.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('validade')}
                className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'validade'
                    ? 'border-sermail-green text-sermail-green-dark bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 rounded-t-xl'
                }`}
              >
                <span className={`material-symbols-outlined text-base ${activeTab === 'validade' ? 'text-sermail-green' : 'text-slate-400'}`}>notification_important</span>
                {t.stocks.tabValidades}
                <span className="badge-sermail-lime">
                  {lotesValidade.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('stock_zero')}
                className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'stock_zero'
                    ? 'border-rose-600 text-rose-700 bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 rounded-t-xl'
                }`}
              >
                <span className={`material-symbols-outlined text-base ${activeTab === 'stock_zero' ? 'text-rose-600' : 'text-slate-400'}`}>
                  remove_shopping_cart
                </span>
                {t.stocks.tabStockZero || 'Artigos com Stock 0'}
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  {filteredStockZero.length}
                </span>
              </button>

            </div>
          </div>
        </div>

        {/* Conteúdo da Aba Ativa */}
        <div className="p-6">

          {/* TAB 1: Stock Venda Livre (vw_stock_pedidos) */}
          {activeTab === 'pedidos' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant/15 gap-2">
                <div>
                  <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">check_circle</span>
                    Stock Alocável para Pedidos e Expedição Comercial
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Artigos em Armazém 01 disponíveis para saída imediata com ordenação inteligente FEFO.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[650px] rounded-xl border border-outline-variant/30 shadow-2xs relative">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-surface-container text-on-surface-variant font-bold uppercase tracking-wider text-[10px] border-b border-outline-variant/30 shadow-xs">
                    <tr>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Cliente</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">{renderSortableHeader('artigo', 'Artigo')}</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">{renderSortableHeader('descricao', 'Descrição do Artigo')}</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Tipo Artigo</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Conservação</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Lote</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Validade</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0 text-right">Stock Disponível</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {filteredStockPedidos.length > 0 ? (
                      filteredStockPedidos.map((item, idx) => {
                        const days = getDaysUntilExpiry(item.validade);
                        const isExpired = days !== null && days <= 0;
                        const isWarning = days !== null && days > 0 && days <= 90;

                        let threshold = null;
                        const clientTempo = tempos.find(t => t.id_cliente === item.cliente_id);
                        if (clientTempo && item.tipo_artigo) {
                          switch (item.tipo_artigo) {
                            case 'MH': threshold = clientTempo.VAL_MH; break;
                            case 'MV': threshold = clientTempo.VAL_MV; break;
                            case 'DM': threshold = clientTempo.VAL_DM; break;
                            case 'DC': threshold = clientTempo.VAL_DC; break;
                            case 'SA': threshold = clientTempo.VAL_SA; break;
                          }
                        }
                        const isBelowThreshold = days !== null && threshold !== null && days <= threshold;
                        
                        const rowClass = isBelowThreshold
                          ? "bg-amber-200/50 hover:bg-amber-200/70 transition-colors"
                          : "hover:bg-surface-container/30 transition-colors";

                        return (
                          <tr key={idx} className={rowClass}>
                            <td className="py-3 px-3 font-semibold">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                                {item.cliente_sigla}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-medium">{item.artigo_id}</td>
                            <td className="py-3 px-3 font-medium">{item.descricao || '-'}</td>
                            <td className="py-3 px-3">
                              <span className="text-[11px] text-on-surface-variant">
                                {TIPO_ARTIGO_LABELS[item.tipo_artigo as TipoArtigo] || item.tipo_artigo}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  item.tipo_armazenamento === 'TF'
                                    ? 'bg-cyan-100 text-cyan-800'
                                    : item.tipo_armazenamento === 'TC'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[12px]">
                                  {item.tipo_armazenamento === 'TF' ? 'ac_unit' : 'thermostat'}
                                </span>
                                {TIPO_ARMAZENAMENTO_LABELS[item.tipo_armazenamento as TipoArmazenamento] ||
                                  item.tipo_armazenamento}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-semibold text-secondary">
                              {item.lote}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-on-surface-variant">
                                  {item.validade
                                    ? new Date(item.validade).toLocaleDateString('pt-PT')
                                    : '-'}
                                </span>
                                {isExpired && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                                    Expirado
                                  </span>
                                )}
                                {isWarning && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                    {days}d
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-sm text-secondary font-mono">
                              {Number(item.stock).toLocaleString('pt-PT')}{' '}
                              <span className="text-xs font-normal text-on-surface-variant">un</span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-on-surface-variant">
                          <span className="material-symbols-outlined text-3xl mb-1 text-on-surface-variant/40 block">
                            inventory_2
                          </span>
                          Nenhum artigo com stock de venda livre encontrado com os filtros aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Stock Consolidado (vw_stock_atual) */}
          {activeTab === 'consolidado' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-outline-variant/15">
                <div>
                  <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">warehouse</span>
                    Visão Consolidada por Armazém
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Registo consolidado de todos os lotes por armazém (sem separação por posição física), incluindo Venda, Quarentena, Devoluções e Expirados.
                  </p>
                </div>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
                    <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                    Modo Administrador (Edição e Remoção Ativas)
                  </span>
                )}
              </div>

              {stockFeedback && (
                <div
                  className={`p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold ${
                    stockFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    {stockFeedback.type === 'success' ? 'check_circle' : 'error'}
                  </span>
                  <p className="flex-1">{stockFeedback.message}</p>
                  <button
                    type="button"
                    onClick={() => setStockFeedback(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              )}

              <div className="overflow-x-auto overflow-y-auto max-h-[650px] rounded-xl border border-outline-variant/30 shadow-2xs relative">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-surface-container text-on-surface-variant font-bold uppercase tracking-wider text-[10px] border-b border-outline-variant/30 shadow-xs">
                    <tr>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Cliente</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">{renderSortableHeader('artigo', 'Artigo')}</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">{renderSortableHeader('descricao', 'Descrição Artigo')}</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Lote</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Validade</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Armazém</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Tipo Armazém</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0 text-right">Stock</th>
                      {isAdmin && (
                        <th className="py-3 px-3 bg-surface-container sticky top-0 text-center">Ações</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {filteredStockAtual.length > 0 ? (
                      filteredStockAtual.map((item, idx) => {
                        const days = getDaysUntilExpiry(item.validade);
                        let threshold = null;
                        const clientTempo = tempos.find(t => t.id_cliente === item.cliente_id);
                        if (clientTempo && item.tipo_artigo) {
                          switch (item.tipo_artigo) {
                            case 'MH': threshold = clientTempo.VAL_MH; break;
                            case 'MV': threshold = clientTempo.VAL_MV; break;
                            case 'DM': threshold = clientTempo.VAL_DM; break;
                            case 'DC': threshold = clientTempo.VAL_DC; break;
                            case 'SA': threshold = clientTempo.VAL_SA; break;
                          }
                        }
                        const isBelowThreshold = days !== null && threshold !== null && days <= threshold;
                        
                        const rowClass = isBelowThreshold
                          ? "bg-amber-200/50 hover:bg-amber-200/70 transition-colors"
                          : "hover:bg-surface-container/30 transition-colors";

                        return (
                        <tr key={item.stock_id || idx} className={rowClass}>
                          <td className="py-3 px-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                              {item.cliente_sigla}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-medium">{item.artigo_id}</td>
                          <td className="py-3 px-3 font-medium">{item.descricao || '-'}</td>
                          <td className="py-3 px-3 font-mono text-secondary font-semibold">
                            {item.lote}
                          </td>
                          <td className="py-3 px-3 font-mono text-on-surface-variant">
                            {item.validade
                              ? new Date(item.validade).toLocaleDateString('pt-PT')
                              : '-'}
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold text-secondary-600">
                            {item.armazem_loc}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                                item.tipo_armazem === '01'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.tipo_armazem === '05'
                                  ? 'bg-amber-100 text-amber-800'
                                  : item.tipo_armazem === '02'
                                  ? 'bg-rose-100 text-rose-800'
                                  : item.tipo_armazem === '09'
                                  ? 'bg-purple-100 text-purple-800'
                                  : item.tipo_armazem === '10'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {item.armazem_descricao || `Armazém ${item.tipo_armazem}`}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-sm text-secondary font-mono">
                            {Number(item.stock).toLocaleString('pt-PT')}{' '}
                            <span className="text-xs font-normal text-on-surface-variant">un</span>
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(item)}
                                  className="w-7 h-7 rounded-lg text-slate-500 hover:text-secondary hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
                                  title="Editar linha de stock"
                                >
                                  <span className="material-symbols-outlined text-base">edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingStock(item)}
                                  className="w-7 h-7 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Apagar linha de stock"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={isAdmin ? 9 : 8} className="py-8 text-center text-on-surface-variant">
                          <span className="material-symbols-outlined text-3xl mb-1 text-on-surface-variant/40 block">
                            warehouse
                          </span>
                          Nenhum registo consolidado encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Resumo por Artigo */}
          {activeTab === 'artigos' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-outline-variant/15">
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">category</span>
                  Stock Total Agregado por Artigo
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Consolidação do stock total em todos os armazéns e lotes para cada artigo.
                </p>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[650px] rounded-xl border border-outline-variant/30 shadow-2xs relative">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-surface-container text-on-surface-variant font-bold uppercase tracking-wider text-[10px] border-b border-outline-variant/30 shadow-xs">
                    <tr>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Cliente</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">{renderSortableHeader('artigo', 'Artigo')}</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">{renderSortableHeader('descricao', 'Descrição do Artigo')}</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Tipo Artigo</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Conservação</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0 text-center">Nº Lotes</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Próx. Validade</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0 text-right">Stock Venda</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0 text-right">Stock Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {resumoArtigos.length > 0 ? (
                      resumoArtigos.map((item, idx) => {
                        const days = getDaysUntilExpiry(item.primeiraValidade);
                        let threshold = null;
                        const clientTempo = tempos.find(t => t.id_cliente === item.cliente_id);
                        if (clientTempo && item.tipo_artigo) {
                          switch (item.tipo_artigo) {
                            case 'MH': threshold = clientTempo.VAL_MH; break;
                            case 'MV': threshold = clientTempo.VAL_MV; break;
                            case 'DM': threshold = clientTempo.VAL_DM; break;
                            case 'DC': threshold = clientTempo.VAL_DC; break;
                            case 'SA': threshold = clientTempo.VAL_SA; break;
                          }
                        }
                        const isBelowThreshold = days !== null && threshold !== null && days <= threshold;
                        
                        const rowClass = isBelowThreshold
                          ? "bg-amber-200/50 hover:bg-amber-200/70 transition-colors"
                          : "hover:bg-surface-container/30 transition-colors";

                        return (
                        <tr key={idx} className={rowClass}>
                          <td className="py-3 px-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                              {item.cliente_sigla}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-medium">{item.artigo_id}</td>
                          <td className="py-3 px-3 font-medium">{item.descricao || '-'}</td>
                          <td className="py-3 px-3">
                            <span className="text-[11px] text-on-surface-variant">
                              {TIPO_ARTIGO_LABELS[item.tipo_artigo] || item.tipo_artigo}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                item.tipo_armazenamento === 'TF'
                                  ? 'bg-cyan-100 text-cyan-800'
                                  : item.tipo_armazenamento === 'TC'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px]">
                                {item.tipo_armazenamento === 'TF' ? 'ac_unit' : 'thermostat'}
                              </span>
                              {TIPO_ARMAZENAMENTO_LABELS[item.tipo_armazenamento] ||
                                item.tipo_armazenamento}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold">
                            <span className="px-2 py-0.5 bg-surface-container rounded-full text-[11px]">
                              {item.lotesCount.size}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-on-surface-variant">
                            {item.primeiraValidade
                              ? new Date(item.primeiraValidade).toLocaleDateString('pt-PT')
                              : '-'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700">
                            {item.stockVenda.toLocaleString('pt-PT')}{' '}
                            <span className="text-[10px] text-on-surface-variant">un</span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-sm text-secondary font-mono">
                            {item.stockTotal.toLocaleString('pt-PT')}{' '}
                            <span className="text-xs font-normal text-on-surface-variant">un</span>
                          </td>
                        </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-on-surface-variant">
                          Nenhum artigo encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Controlo de Validades (FEFO Monitor) */}
          {activeTab === 'validade' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-outline-variant/15">
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">event_upcoming</span>
                  Monitorização Preventiva de Validades & Lotes (FEFO)
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Lotes ordenados por data de expiração mais próxima para priorização de expedição e gestão preventiva.
                </p>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[650px] rounded-xl border border-outline-variant/30 shadow-2xs relative">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-surface-container text-on-surface-variant font-bold uppercase tracking-wider text-[10px] border-b border-outline-variant/30 shadow-xs">
                    <tr>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Estado</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Cliente</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">{renderSortableHeader('artigo', 'Artigo')}</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">{renderSortableHeader('descricao', 'Descrição Artigo')}</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Lote</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Data Validade</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Dias Restantes</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Armazém Loc</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {lotesValidade.length > 0 ? (
                      lotesValidade.map((item, idx) => {
                        const days = getDaysUntilExpiry(item.validade);
                        const isExpired = days !== null && days <= 0;
                        const isCritical = days !== null && days > 0 && days <= 30;
                        const isWarning = days !== null && days > 30 && days <= 90;

                        let threshold = null;
                        const clientTempo = tempos.find(t => t.id_cliente === item.cliente_id);
                        if (clientTempo && item.tipo_artigo) {
                          switch (item.tipo_artigo) {
                            case 'MH': threshold = clientTempo.VAL_MH; break;
                            case 'MV': threshold = clientTempo.VAL_MV; break;
                            case 'DM': threshold = clientTempo.VAL_DM; break;
                            case 'DC': threshold = clientTempo.VAL_DC; break;
                            case 'SA': threshold = clientTempo.VAL_SA; break;
                          }
                        }
                        const isBelowThreshold = days !== null && threshold !== null && days <= threshold;
                        
                        const rowClass = isBelowThreshold
                          ? "bg-amber-200/50 hover:bg-amber-200/70 transition-colors"
                          : "hover:bg-surface-container/30 transition-colors";

                        return (
                          <tr key={idx} className={rowClass}>
                            <td className="py-3 px-3">
                              {isExpired ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                                  EXPIRADO
                                </span>
                              ) : isCritical ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse"></span>
                                  CRÍTICO (&le;30d)
                                </span>
                              ) : isWarning ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                  ALERTA (&le;90d)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                  NORMAL
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-semibold">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                                {item.cliente_sigla}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-medium">{item.artigo_id}</td>
                            <td className="py-3 px-3 font-medium">{item.descricao || '-'}</td>
                            <td className="py-3 px-3 font-mono font-bold text-secondary">{item.lote}</td>
                            <td className="py-3 px-3 font-mono font-semibold">
                              {item.validade ? new Date(item.validade).toLocaleDateString('pt-PT') : '-'}
                            </td>
                            <td className="py-3 px-3 font-mono">
                              {days !== null ? (
                                <span className={days <= 30 ? 'text-rose-600 font-bold' : days <= 90 ? 'text-amber-700 font-semibold' : 'text-on-surface-variant'}>
                                  {days <= 0 ? `${Math.abs(days)} dias atrás` : `${days} dias`}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-secondary-600 font-medium">
                              {item.armazem_loc}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-sm text-secondary font-mono">
                              {Number(item.stock).toLocaleString('pt-PT')}{' '}
                              <span className="text-xs font-normal text-on-surface-variant">un</span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-on-surface-variant">
                          Nenhum lote com data de validade registada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: Artigos com Stock 0 (vw_stock_zero) */}
          {activeTab === 'stock_zero' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant/15 gap-2">
                <div>
                  <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-600">remove_shopping_cart</span>
                    Catálogo de Artigos com Stock 0 (Sem Existências / Esgotados)
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Artigos com saldo nulo em armazém — inclui artigos que esgotaram após expedições e artigos do catálogo sem existências ativas (verificação a nível de artigo, ignorando lotes).
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <span>Total listado:</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    {filteredStockZero.length} artigos
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200/80 rounded-xl shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-700 font-semibold border-b border-slate-200/80">
                    <tr>
                      <th className="py-3 px-3">Estado</th>
                      <th className="py-3 px-3">Cliente</th>
                      <th className="py-3 px-3">{renderSortableHeader('artigo', 'Artigo')}</th>
                      <th className="py-3 px-3">{renderSortableHeader('descricao', 'Descrição do Artigo')}</th>
                      <th className="py-3 px-3">Tipo Artigo</th>
                      <th className="py-3 px-3">Conservação</th>
                      <th className="py-3 px-3 text-right">Stock Atual</th>
                      <th className="py-3 px-3 text-center">Atividade</th>
                      <th className="py-3 px-3">Último Movimento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredStockZero.length > 0 ? (
                      filteredStockZero.map((item, idx) => (
                        <tr key={item.artigo_cli || item.artigo_id || idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                              STOCK 0
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              {item.cliente_sigla}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {item.artigo_id}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-900 max-w-[280px] truncate" title={item.descricao || ''}>
                            {item.descricao || '-'}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {item.tipo_artigo ? TIPO_ARTIGO_LABELS[ID_TIPO_ARTIGO_MAP[item.tipo_artigo] || item.tipo_artigo as TipoArtigo] || item.tipo_artigo : '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                              {item.tipo_armazenamento ? TIPO_ARMAZENAMENTO_LABELS[item.tipo_armazenamento as TipoArmazenamento] || item.tipo_armazenamento : '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-sm text-rose-700 font-mono whitespace-nowrap">
                            0 <span className="text-xs font-normal text-slate-500">un</span>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {Number(item.total_movimentos || 0) > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200" title="Artigo já movimentado mas atualmente com stock esgotado">
                                <span className="material-symbols-outlined text-xs">history</span>
                                {item.total_movimentos} mov. (Esgotado)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600" title="Artigo cadastrado no catálogo sem histórico de movimentos no período">
                                <span className="material-symbols-outlined text-xs">inventory_2</span>
                                Sem entradas
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {item.ultimo_movimento ? new Date(item.ultimo_movimento).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-500">
                          <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">
                            check_circle
                          </span>
                          <p className="text-sm font-semibold">Nenhum artigo com stock zero encontrado para os filtros selecionados.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Edição de Linha de Stock (Apenas Administrador) */}
      {isAdmin && editingStock && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">edit_note</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-on-surface">Editar Linha de Stock</h4>
                  <p className="text-xs text-on-surface-variant">
                    Cliente: <strong>{editingStock.cliente_sigla}</strong> ({editingStock.cliente_nome})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStock(null)}
                disabled={actionLoading}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-on-surface mb-1">
                    Código do Artigo <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.artigo_id}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, artigo_id: e.target.value.toUpperCase() }))}
                    required
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                  {editingStock.descricao && (
                    <p className="text-[11px] text-on-surface-variant mt-1 truncate">
                      Descrição: {editingStock.descricao}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface mb-1">
                    Lote
                  </label>
                  <input
                    type="text"
                    value={editForm.lote}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, lote: e.target.value }))}
                    placeholder="Ex: 240501A"
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface mb-1">
                    Validade
                  </label>
                  <input
                    type="date"
                    value={editForm.validade}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, validade: e.target.value }))}
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface mb-1">
                    Armazém
                  </label>
                  <input
                    type="text"
                    value={editForm.armazem_loc}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, armazem_loc: e.target.value.toUpperCase() }))}
                    placeholder="Ex: MDZ01, CRD01"
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface font-mono uppercase focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface mb-1">
                    Quantidade de Stock (un) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editForm.stock}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, stock: parseFloat(e.target.value) || 0 }))}
                    required
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface font-mono font-bold focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setEditingStock(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-secondary text-on-secondary hover:bg-secondary/90 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>A gravar...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">save</span>
                      <span>Guardar Alterações</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Apagar Linha de Stock (Apenas Administrador) */}
      {isAdmin && deletingStock && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">delete_forever</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-on-surface">Apagar Linha de Stock?</h4>
                <p className="text-xs text-on-surface-variant mt-0.5">Esta ação não pode ser revertida.</p>
              </div>
            </div>

            <div className="p-3 bg-surface-container/40 rounded-xl border border-outline-variant/20 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Cliente:</span>
                <span className="font-bold text-on-surface">{deletingStock.cliente_sigla} - {deletingStock.cliente_nome}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Artigo:</span>
                <span className="font-mono font-bold text-secondary">{deletingStock.artigo_id}</span>
              </div>
              {deletingStock.descricao && (
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Designação:</span>
                  <span className="text-on-surface font-medium truncate max-w-[200px]" title={deletingStock.descricao}>{deletingStock.descricao}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Lote:</span>
                <span className="font-mono text-on-surface">{deletingStock.lote || 'S/LOTE'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Armazém:</span>
                <span className="font-mono text-on-surface">{deletingStock.armazem_loc}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Stock atual:</span>
                <span className="font-mono font-bold text-rose-700">{Number(deletingStock.stock).toLocaleString('pt-PT')} un</span>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Tem a certeza de que deseja eliminar permanentemente este registo da tabela <code className="font-mono font-bold text-rose-700">public.stock</code>?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setDeletingStock(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>A eliminar...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>Confirmar e Apagar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

