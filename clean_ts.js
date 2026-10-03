const fs = require('fs');
const path = 'src/app/configuracao/importacao-movimentos-tab.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// 1. Add imports
lines.splice(4, 0, "import { Client, Artigo, Armazem, Movimento, TipoMovimento } from '@/lib/supabase/types';");

// 2. Remove filteredImpStkList (from '  // Filtro de Stock Search' to '  }, [impStkList, stockSearchTerm]);')
let filterStart = lines.findIndex(l => l.includes('// Filtro de Stock Search'));
let filterEnd = lines.findIndex((l, i) => i > filterStart && l.includes('}, [impStkList, stockSearchTerm]);'));
if (filterStart !== -1 && filterEnd !== -1) {
  lines.splice(filterStart, filterEnd - filterStart + 1);
}

// 3. Remove Export CSV button
let exportStart = lines.findIndex(l => l.includes('onClick={handleExportMovimentosCSV}'));
if (exportStart !== -1) {
  lines.splice(exportStart - 2, 8); // Remove button tag
}

fs.writeFileSync(path, lines.join('\n'));
console.log('Fixed types');
