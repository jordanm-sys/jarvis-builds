const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3341;
const html = fs.readFileSync(path.join(__dirname, 'index.html'));

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}).listen(PORT, () => console.log(`Animal Facts running on http://localhost:${PORT}`));
