const fs = require('fs');
const path = 'src/app/configuracao/importacao-movimentos-tab.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

let start = lines.findIndex(l => l.includes('const filteredStockList = useMemo(() => {'));
let end = lines.findIndex((l, i) => i > start && l.includes('}, [impStkList, stockSearchTerm]);'));

if (start !== -1 && end !== -1) {
  lines.splice(start, end - start + 1);
} else {
  console.log("Could not find filteredStockList block");
}

fs.writeFileSync(path, lines.join('\n'));
console.log('Fixed filteredStockList block');
