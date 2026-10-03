const fs = require('fs');
const path = 'src/app/configuracao/importacao-movimentos-tab.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove subTab state
content = content.replace(/  const \[subTab, setSubTab\] = useState[^;]+;\r?\n/, '');

// 2. Remove states related to file uploading and imp_stk
content = content.replace(/  \/\/ Estados para Importação de Movimentos[\s\S]*?const \[selectedDefaultClient, setSelectedDefaultClient\] = useState<string>\(''\);\r?\n/, '');
content = content.replace(/  const \[parsingMovLoading, setParsingMovLoading\] = useState\(false\);\r?\n/, '');
content = content.replace(/  const \[importingMovLoading, setImportingMovLoading\] = useState\(false\);\r?\n/, '');
content = content.replace(/  \/\/ Estados para imp_stk \(Legado \/ Inventários Brutos\)[\s\S]*?const \[stockSearchTerm, setStockSearchTerm\] = useState\(''\);\r?\n/, '');

content = content.replace(/  const movFileInputRef = useRef<HTMLInputElement>\(null\);\r?\n/, '');
content = content.replace(/  const stockFileInputRef = useRef<HTMLInputElement>\(null\);\r?\n/, '');

// 3. Remove handler functions
content = content.replace(/  \/\/ =========================================================================\r?\n  \/\/ 1\. MANIPULAÇÃO DO FICHEIRO DE MOVIMENTOS \(\.xlsx, \.xls, \.csv, \.txt\)\r?\n  \/\/ =========================================================================[\s\S]*?const handleClearMovimentosTable = async \(\) => \{/m, '  const handleClearMovimentosTable = async () => {');

// Remove everything from handleDownloadMovimentosCSV to renderTipoMovBadge
content = content.replace(/  \/\/ Download do Modelo CSV de Movimentos[\s\S]*?(\/\/ Renderizador de Badge por Tipo de Movimento)/m, '');

// 4. Remove UI blocks
// Tabs
content = content.replace(/      \{\/\* Navegação Secundária da Aba Movimentos \*\/\}[\s\S]*?\{\/\* ========================================================================= \*\/\}/m, '{/* ========================================================================= */}');

// Importar ficheiro UI
content = content.replace(/      \{\/\* 1\. SUB-ABA: IMPORTAR FICHEIRO DE MOVIMENTOS PARA A TABELA MOVIMENTOS \*\/\}[\s\S]*?\{\/\* ========================================================================= \*\/\}/m, '{/* ========================================================================= */}');

// imp_stk UI
content = content.replace(/      \{\/\* 3\. SUB-ABA: IMPORTAÇÃO DE STOCKS \(imp_stk - INVENTÁRIOS BRUTOS\) \*\/\}[\s\S]*?(\{\/\* Modal de Transferência plat_movimentos \*\/\}|\{\/\* Modal de Limpeza de Movimentos \*\/\})/m, '');

// Tabela de movimentos wrapper
content = content.replace(/      \{\/\* ========================================================================= \*\/\}\r?\n      \{\/\* 2\. SUB-ABA: TABELA DE MOVIMENTOS \(REGISTOS NA BASE DE DADOS\) \*\/\}\r?\n      \{\/\* ========================================================================= \*\/\}\r?\n      \{subTab === 'tabela_movimentos' && \(\r?\n        <div className="space-y-6">/, '      {/* ========================================================================= */}\n      {/* 2. TABELA DE MOVIMENTOS (REGISTOS NA BASE DE DADOS) */}\n      {/* ========================================================================= */}\n      <div className="space-y-6">');

// Remove closing brace of tabela_movimentos (which is right before the transfer modal)
content = content.replace(/        <\/div>\r?\n      \)\}\r?\n\r?\n      \{\/\* Modal de Transferência/m, '      </div>\n\n      {/* Modal de Transferência');

fs.writeFileSync(path, content);
console.log("File cleaned");
