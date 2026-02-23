const http = require('http');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
http.createServer((_, res) => { res.writeHead(200, {'Content-Type':'text/html'}); res.end(html); }).listen(3341, '0.0.0.0', () => console.log('Animal fact site running on http://localhost:3341'));
