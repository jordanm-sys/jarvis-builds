const express = require('express');
const path = require('path');
const app = express();
const PORT = 3341;
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="African-Safari-Trip-Plan.pdf"');
  require('fs').createReadStream(path.join(__dirname, 'safari-trip.pdf')).pipe(res);
});
app.listen(PORT, () => console.log(`Safari trip plan running at http://localhost:${PORT}`));
