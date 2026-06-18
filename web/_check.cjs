const { parse } = require('@babel/parser');
const fs = require('fs');
const code = fs.readFileSync('src/App.jsx','utf8');
try {
  parse(code, { sourceType: 'module', plugins: ['jsx'] });
  console.log('PARSE OK — no syntax errors');
} catch (e) {
  console.log('PARSE ERROR:', e.message);
  process.exit(2);
}
