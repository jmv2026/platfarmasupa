const fs = require('fs');
const path = 'src/app/configuracao/importacao-movimentos-tab.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add missing imports
if (!content.includes('Client, Artigo')) {
  content = content.replace(/import \{.*?\} from '@\/lib\/parse-movimentos-file';/, 
    "import { Client, Artigo, Armazem, Movimento, TipoMovimento } from '@/lib/supabase/types';\n$&");
}

// 2. Remove filteredImpStkList block
content = content.replace(/  const filteredImpStkList = useMemo\(\(\) => \{[\s\S]*?  \}, \[impStkList, stockSearchTerm\]\);\r?\n/, '');

// 3. Remove Export CSV button
content = content.replace(/              <button\r?\n                type="button"\r?\n                onClick=\{handleExportMovimentosCSV\}[\s\S]*?              <\/button>/, '');

fs.writeFileSync(path, content);
console.log('Fixed types and leftover buttons');
