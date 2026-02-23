const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3340;
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}).listen(PORT, () => console.log(`Animal fact site running on http://localhost:${PORT}`));
