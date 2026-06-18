const { parse } = require('@babel/parser');
const code = require('fs').readFileSync('src/App.jsx','utf8');
console.log('chars:', code.length, 'lines:', code.split('\n').length);
console.log('has panel:', code.includes('Physical Server License Summary'));
try { parse(code,{sourceType:'module',plugins:['jsx']}); console.log('PARSE OK'); }
catch(e){ console.log('PARSE ERROR:', e.message); process.exit(2); }
