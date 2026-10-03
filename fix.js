const fs = require('fs');
const path = 'src/app/configuracao/importacao-movimentos-tab.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// 293 is after 292. We need to add '      )}'
lines.splice(293, 0, '      )}');
fs.writeFileSync(path, lines.join('\n'));
console.log('Fixed 293');
