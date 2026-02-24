const express = require('express');
const path = require('path');
const app = express();
const PORT = 3341;
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'plan.html')));
app.get('/pdf', (req, res) => res.sendFile(path.join(__dirname, 'safari-trip.pdf')));
app.listen(PORT, () => console.log(`Safari trip plan running at http://localhost:${PORT}`));
