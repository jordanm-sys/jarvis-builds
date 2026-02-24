const express = require('express');
const path = require('path');
const app = express();
const PORT = 3339;
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, () => console.log('Shark fun fact running at http://localhost:3339'));
