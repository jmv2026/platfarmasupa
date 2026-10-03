const fs = require('fs');
const path = 'src/app/configuracao/configuracao-tabs.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/initialImpStk=\{initialImpStk\}/, '');
fs.writeFileSync(path, content);
console.log('Fixed configuracao-tabs.tsx');
