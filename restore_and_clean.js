const fs = require('fs');
const path = 'src/app/configuracao/importacao-movimentos-tab.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. We want to KEEP only the 	abela_movimentos part.
// First, let's inject the Transfer state and function.
content = content.replace(/  const \[clearingMovLoading, setClearingMovLoading\] = useState\(false\);\r?\n  const \[confirmClearMovModal, setConfirmClearMovModal\] = useState\(false\);\r?\n/, 
  "  const [clearingMovLoading, setClearingMovLoading] = useState(false);\n" +
  "  const [confirmClearMovModal, setConfirmClearMovModal] = useState(false);\n" +
  "  const [transferringPlatMov, setTransferringPlatMov] = useState(false);\n" +
  "  const [confirmTransferModal, setConfirmTransferModal] = useState(false);\n"
);

content = content.replace(/  const handleClearMovimentosTable = async \(\) => \{[\s\S]*?    \} finally \{\r?\n      setClearingMovLoading\(false\);\r?\n    \}\r?\n  \};\r?\n/, 
  "$&" +
  "\n  const handleTransferirPlatMov = async () => {\n" +
  "    setTransferringPlatMov(true);\n" +
  "    try {\n" +
  "      const res = await transferirPlatMovimentosParaMovimentosAction();\n" +
  "      if (res.success) {\n" +
  "        setFeedback({ type: 'success', message: 'Transferência concluída! ' + res.count + ' movimentos inseridos.' });\n" +
  "        setConfirmTransferModal(false);\n" +
  "        if (onRefresh) onRefresh();\n" +
  "      } else {\n" +
  "        setFeedback({ type: 'error', message: res.error || 'Erro na transferência.' });\n" +
  "      }\n" +
  "    } catch (err) {\n" +
  "      const msg = err instanceof Error ? err.message : 'Erro ao transferir';\n" +
  "      setFeedback({ type: 'error', message: msg });\n" +
  "    } finally {\n" +
  "      setTransferringPlatMov(false);\n" +
  "    }\n  };\n"
);

// Inject Transfer Button
content = content.replace(/                \{\/\* Limpar Tabela \*\/\}/, 
  "                {/* Transferir de plat_movimentos */}\n" +
  "                <button\n" +
  "                  type=\"button\"\n" +
  "                  onClick={() => setConfirmTransferModal(true)}\n" +
  "                  disabled={transferringPlatMov}\n" +
  "                  className=\"px-3 py-1.5 bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-sm\"\n" +
  "                >\n" +
  "                  <span className=\"material-symbols-outlined text-sm\">move_down</span>\n" +
  "                  Transferir plat_movimentos\n" +
  "                </button>\n\n" +
  "                {/* Limpar Tabela */}"
);

// Inject Transfer Modal
content = content.replace(/      \{\/\* Modal de Limpeza de Movimentos \*\/\}/, 
  "      {/* Modal de Transferência plat_movimentos */}\n" +
  "      {confirmTransferModal && (\n" +
  "        <div className=\"fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 z-[60]\">\n" +
  "          <div className=\"bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4\">\n" +
  "            <div className=\"flex items-center gap-3\">\n" +
  "              <div className=\"w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center\">\n" +
  "                <span className=\"material-symbols-outlined text-xl\">move_down</span>\n" +
  "              </div>\n" +
  "              <div>\n" +
  "                <h4 className=\"text-sm font-bold text-on-surface\">Transferir plat_movimentos</h4>\n" +
  "                <p className=\"text-xs text-on-surface-variant mt-0.5\">Mover dados para a tabela principal.</p>\n" +
  "              </div>\n" +
  "            </div>\n" +
  "            <p className=\"text-xs text-on-surface leading-relaxed\">\n" +
  "              Tem a certeza de que deseja executar a transferência da tabela <code>plat_movimentos</code> para a tabela <code>movimentos</code>? \n" +
  "              <br/><br/>\n" +
  "              Apenas os movimentos novos (cujo <code>doc_linha</code> não exista) serão importados.\n" +
  "            </p>\n" +
  "            <div className=\"flex items-center justify-end gap-3 pt-2\">\n" +
  "              <button\n" +
  "                type=\"button\"\n" +
  "                onClick={() => setConfirmTransferModal(false)}\n" +
  "                disabled={transferringPlatMov}\n" +
  "                className=\"px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container rounded-xl transition-all disabled:opacity-50 cursor-pointer\"\n" +
  "              >\n" +
  "                Cancelar\n" +
  "              </button>\n" +
  "              <button\n" +
  "                type=\"button\"\n" +
  "                onClick={handleTransferirPlatMov}\n" +
  "                disabled={transferringPlatMov}\n" +
  "                className=\"px-4 py-2 bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer\"\n" +
  "              >\n" +
  "                <span className=\"material-symbols-outlined text-sm\">check</span>\n" +
  "                {transferringPlatMov ? 'A Transferir...' : 'Sim, Transferir'}\n" +
  "              </button>\n" +
  "            </div>\n" +
  "          </div>\n" +
  "        </div>\n" +
  "      )}\n\n" +
  "      {/* Modal de Limpeza de Movimentos */}"
);

// NOW, REMOVE UNWANTED TABS
// 1. Remove subTab state entirely
content = content.replace(/  const \[subTab, setSubTab\] = useState[^;]+;\r?\n/, '');

// 2. We can hide the sub tabs UI simply by removing {subTab === ... && ( conditions.
// Remove the buttons:
content = content.replace(/      \{\/\* Navegação Secundária da Aba Movimentos \*\/\}[\s\S]*?\{\/\* ========================================================================= \*\/\}/, '{/* ========================================================================= */}');

// Remove the importar_movimentos block entirely:
content = content.replace(/      \{\/\* 1\. SUB-ABA: IMPORTAR FICHEIRO DE MOVIMENTOS PARA A TABELA MOVIMENTOS \*\/\}[\s\S]*?\{\/\* ========================================================================= \*\/\}/, '{/* ========================================================================= */}');

// Un-wrap 	abela_movimentos by replacing {subTab === 'tabela_movimentos' && ( with just its contents
content = content.replace(/      \{\/\* 2\. SUB-ABA: TABELA DE MOVIMENTOS \(REGISTOS NA BASE DE DADOS\) \*\/\}\r?\n      \{\/\* ========================================================================= \*\/\}\r?\n      \{subTab === 'tabela_movimentos' && \(\r?\n        <div className="space-y-6">/, '      {/* 2. TABELA DE MOVIMENTOS (REGISTOS NA BASE DE DADOS) */}\n      {/* ========================================================================= */}\n      <div className="space-y-6">');

// Remove imp_stk entirely. The tricky part is finding where 	abela_movimentos ends.
// 	abela_movimentos ends right before imp_stk.
content = content.replace(/        <\/div>\r?\n      \)\}\r?\n\r?\n      \{\/\* ========================================================================= \*\/\}\r?\n      \{\/\* 3\. SUB-ABA: IMPORTAÇÃO DE STOCKS \(imp_stk - INVENTÁRIOS BRUTOS\) \*\/\}[\s\S]*?(?=\{\/\* Modal de Transferência plat_movimentos \*\/\})/, '      </div>\n\n');

// We also don't need the file upload states but to be safe with TS, let's keep them and just suppress warnings, or we can just remove them. Let's just remove them so the code is clean.
content = content.replace(/  \/\/ Estados para Importação de Movimentos[\s\S]*?const \[selectedDefaultClient, setSelectedDefaultClient\] = useState<string>\(''\);\r?\n/, '');
content = content.replace(/  const \[parsingMovLoading, setParsingMovLoading\] = useState\(false\);\r?\n/, '');
content = content.replace(/  const \[importingMovLoading, setImportingMovLoading\] = useState\(false\);\r?\n/, '');

content = content.replace(/  \/\/ Estados para imp_stk \(Legado \/ Inventários Brutos\)[\s\S]*?const \[stockSearchTerm, setStockSearchTerm\] = useState\(''\);\r?\n/, '');

content = content.replace(/  const movFileInputRef = useRef<HTMLInputElement>\(null\);\r?\n/, '');
content = content.replace(/  const stockFileInputRef = useRef<HTMLInputElement>\(null\);\r?\n/, '');

content = content.replace(/  \/\/ =========================================================================\r?\n  \/\/ 1\. MANIPULAÇÃO DO FICHEIRO DE MOVIMENTOS \(\.xlsx, \.xls, \.csv, \.txt\)\r?\n  \/\/ =========================================================================[\s\S]*?const handleClearMovimentosTable = async \(\) => \{/m, '  const handleClearMovimentosTable = async () => {');

content = content.replace(/  \/\/ Download do Modelo CSV de Movimentos[\s\S]*?(\/\/ Renderizador de Badge por Tipo de Movimento)/m, '');

// And remove imports that are now unused to fix TS errors:
content = content.replace(/parseExcelMovimentosFile,\r?\n  parseTextMovimentosFile,\r?\n  generateMovimentosSampleCSV,\r?\n  normalizeMovimentoPosicao,\r?\n/, '');
content = content.replace(/import \{ parseTextStockFile, parseExcelStockFile \} from '@\/lib\/parse-stock-file';\r?\n/, '');
content = content.replace(/importarMovimentosAction,\r?\n/, '');
content = content.replace(/  importarStocksAction,\r?\n/, '');
content = content.replace(/  limparImportacoesStockAction,\r?\n/, '');

fs.writeFileSync(path, content);
console.log("File processed");
