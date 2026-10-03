const fs = require('fs');
const path = 'src/app/configuracao/importacao-movimentos-tab.tsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');

let newLines = [];
let skip = false;
let openBraces = 0;

// Functions to remove
const funcToRemove = [
  'handleMovFileChange',
  'handleConfirmImportMovimentos',
  'handleCancelMovSelection',
  'handleExportMovimentosCSV',
  'handleDownloadMovimentosExcel',
  'handleDownloadMovimentosCSV',
  'handleStockFileChange',
  'handleConfirmImportStock',
  'handleCancelStockSelection',
  'handleClearStockTable'
];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // Fix imports
  if (line.includes('ImpStk, ImpStkInput,') || line.includes('import { parseTextStockFile') || line.includes('parseExcelMovimentosFile') || line.includes('importarStocksAction')) {
    continue;
  }
  
  // States to remove
  if (line.includes('subTab') && line.includes('useState')) continue;
  if (line.includes('selectedMovFile') && line.includes('useState')) continue;
  if (line.includes('parsedMovRows') && line.includes('useState')) continue;
  if (line.includes('selectedDefaultClient') && line.includes('useState')) continue;
  if (line.includes('parsingMovLoading') && line.includes('useState')) continue;
  if (line.includes('importingMovLoading') && line.includes('useState')) continue;
  
  if (line.includes('impStkList') && line.includes('useState')) continue;
  if (line.includes('selectedStockFile') && line.includes('useState')) continue;
  if (line.includes('parsedStockRows') && line.includes('useState')) continue;
  if (line.includes('parsingStockLoading') && line.includes('useState')) continue;
  if (line.includes('importingStockLoading') && line.includes('useState')) continue;
  if (line.includes('clearingStockLoading') && line.includes('useState')) continue;
  if (line.includes('confirmClearStockModal') && line.includes('useState')) continue;
  if (line.includes('stockSearchTerm') && line.includes('useState')) continue;

  if (line.includes('movFileInputRef')) continue;
  if (line.includes('stockFileInputRef')) continue;

  // Add transfer modal state next to clear mov state
  if (line.includes('const [confirmClearMovModal, setConfirmClearMovModal] = useState(false);')) {
    newLines.push(line);
    newLines.push("  const [transferringPlatMov, setTransferringPlatMov] = useState(false);");
    newLines.push("  const [confirmTransferModal, setConfirmTransferModal] = useState(false);");
    continue;
  }

  // Remove `initialImpStk` from props
  if (line.includes('initialImpStk')) continue;

  // Add transfer handler next to clear mov handler
  if (line.includes('const handleClearMovimentosTable = async () => {')) {
    const handler = `
  const handleTransferirPlatMov = async () => {
    setTransferringPlatMov(true);
    try {
      const { transferirPlatMovimentosParaMovimentosAction } = require('./actions');
      const res = await transferirPlatMovimentosParaMovimentosAction();
      if (res.success) {
        setFeedback({ type: 'success', message: 'Transferência concluída! ' + res.count + ' movimentos inseridos.' });
        setConfirmTransferModal(false);
        if (onRefresh) onRefresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro na transferência.' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao transferir';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setTransferringPlatMov(false);
    }
  };
`;
    newLines.push(handler);
  }

  // Skip blocks of functions to remove
  let startingFunc = funcToRemove.find(f => line.includes(`const ${f} = `));
  if (startingFunc) {
    skip = true;
    openBraces = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    continue;
  }
  
  if (skip) {
    openBraces += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    if (openBraces <= 0) {
      skip = false;
    }
    continue;
  }

  // Skip "Navegação Secundária da Aba Movimentos" div
  if (line.includes('{/* Navegação Secundária da Aba Movimentos */}')) {
    newLines.push('      {/* Removed Tabs */}');
    let j = i;
    let divOpen = 0;
    while(j < lines.length) {
      divOpen += (lines[j].match(/<div/g) || []).length - (lines[j].match(/<\/div/g) || []).length;
      if (divOpen <= 0 && j > i) {
        i = j;
        break;
      }
      j++;
    }
    continue;
  }

  // Skip "1. SUB-ABA: IMPORTAR FICHEIRO"
  if (line.includes('{/* 1. SUB-ABA: IMPORTAR FICHEIRO DE MOVIMENTOS PARA A TABELA MOVIMENTOS */}')) {
    let j = i;
    let braceOpen = 0;
    while (j < lines.length) {
      if (lines[j].includes("subTab === 'importar_movimentos' && (")) {
        braceOpen = 1;
      } else if (braceOpen > 0) {
        braceOpen += (lines[j].match(/\(/g) || []).length - (lines[j].match(/\)/g) || []).length;
        if (braceOpen <= 0) {
          i = j;
          break;
        }
      }
      j++;
    }
    continue;
  }

  // Skip "3. SUB-ABA: IMPORTAÇÃO DE STOCKS"
  if (line.includes('{/* 3. SUB-ABA: IMPORTAÇÃO DE STOCKS (imp_stk - INVENTÁRIOS BRUTOS) */}')) {
    let j = i;
    let braceOpen = 0;
    while (j < lines.length) {
      if (lines[j].includes("subTab === 'imp_stk' && (")) {
        braceOpen = 1;
      } else if (braceOpen > 0) {
        braceOpen += (lines[j].match(/\(/g) || []).length - (lines[j].match(/\)/g) || []).length;
        if (braceOpen <= 0) {
          i = j;
          break;
        }
      }
      j++;
    }
    continue;
  }

  // Un-wrap tabela_movimentos
  if (line.includes("subTab === 'tabela_movimentos' && (")) {
    continue;
  }
  if (line.trim() === ')}' && newLines[newLines.length -1] && newLines[newLines.length -1].trim() === '</div>') {
    continue;
  }

  // Inject transfer button in tabela_movimentos actions
  if (line.includes('{/* Limpar Tabela */}')) {
    newLines.push('                <button');
    newLines.push('                  type="button"');
    newLines.push('                  onClick={() => setConfirmTransferModal(true)}');
    newLines.push('                  disabled={transferringPlatMov}');
    newLines.push('                  className="px-3 py-1.5 bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-sm"');
    newLines.push('                >');
    newLines.push('                  <span className="material-symbols-outlined text-sm">move_down</span>');
    newLines.push('                  Transferir plat_movimentos');
    newLines.push('                </button>');
  }

  // Inject transfer modal next to clear mov modal
  if (line.includes('{/* Modal de Limpeza de Movimentos */}')) {
    newLines.push('      {confirmTransferModal && (');
    newLines.push('        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 z-[60]">');
    newLines.push('          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">');
    newLines.push('            <div className="flex items-center gap-3">');
    newLines.push('              <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">');
    newLines.push('                <span className="material-symbols-outlined text-xl">move_down</span>');
    newLines.push('              </div>');
    newLines.push('              <div>');
    newLines.push('                <h4 className="text-sm font-bold text-on-surface">Transferir plat_movimentos</h4>');
    newLines.push('                <p className="text-xs text-on-surface-variant mt-0.5">Mover dados para a tabela principal.</p>');
    newLines.push('              </div>');
    newLines.push('            </div>');
    newLines.push('            <p className="text-xs text-on-surface leading-relaxed">');
    newLines.push('              Tem a certeza de que deseja executar a transferência da tabela <code>plat_movimentos</code> para a tabela <code>movimentos</code>? ');
    newLines.push('              <br/><br/>');
    newLines.push('              Apenas os movimentos novos (cujo <code>doc_linha</code> não exista) serão importados.');
    newLines.push('            </p>');
    newLines.push('            <div className="flex items-center justify-end gap-3 pt-2">');
    newLines.push('              <button');
    newLines.push('                type="button"');
    newLines.push('                onClick={() => setConfirmTransferModal(false)}');
    newLines.push('                disabled={transferringPlatMov}');
    newLines.push('                className="px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container rounded-xl transition-all disabled:opacity-50 cursor-pointer"');
    newLines.push('              >');
    newLines.push('                Cancelar');
    newLines.push('              </button>');
    newLines.push('              <button');
    newLines.push('                type="button"');
    newLines.push('                onClick={handleTransferirPlatMov}');
    newLines.push('                disabled={transferringPlatMov}');
    newLines.push('                className="px-4 py-2 bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"');
    newLines.push('              >');
    newLines.push('                <span className="material-symbols-outlined text-sm">check</span>');
    newLines.push("                {transferringPlatMov ? 'A Transferir...' : 'Sim, Transferir'}");
    newLines.push('              </button>');
    newLines.push('            </div>');
    newLines.push('          </div>');
    newLines.push('        </div>');
    newLines.push('      )}');
  }

  newLines.push(line);
}

fs.writeFileSync(path, newLines.join('\n'));
console.log("Rewrite completed");
