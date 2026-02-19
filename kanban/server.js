const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const TASKS_FILE = path.join(__dirname, 'tasks.json');
const PROJECTS_FILE = path.join(__dirname, 'projects.json');
const STOCKS_FILE = path.join(__dirname, 'stocks.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/files', express.static(path.join(__dirname, '..', 'research')));

const read = () => JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
const save = (d) => fs.writeFileSync(TASKS_FILE, JSON.stringify(d, null, 2));
const readProjects = () => JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
const saveProjects = (d) => fs.writeFileSync(PROJECTS_FILE, JSON.stringify(d, null, 2));
const readStocks = () => JSON.parse(fs.readFileSync(STOCKS_FILE, 'utf8'));
const saveStocks = (d) => fs.writeFileSync(STOCKS_FILE, JSON.stringify(d, null, 2));

// Tasks API
app.get('/api/tasks', (_, res) => res.json(read()));

app.post('/api/tasks', (req, res) => {
  const tasks = read();
  const task = { id: Date.now().toString(), createdAt: new Date().toISOString(), assignedTo: 'Jarvis', ...req.body };
  tasks.push(task);
  save(tasks);
  res.json(task);
});

app.put('/api/tasks/:id', (req, res) => {
  const tasks = read();
  const i = tasks.findIndex(t => t.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Not found' });
  tasks[i] = { ...tasks[i], ...req.body };
  save(tasks);
  res.json(tasks[i]);
});

app.put('/api/tasks/:id/move', (req, res) => {
  const tasks = read();
  const i = tasks.findIndex(t => t.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Not found' });
  const prevCol = tasks[i].column;
  tasks[i].column = req.body.column;
  save(tasks);
  // Sync linked project reviewed status with task column
  if (tasks[i].projectId) {
    try {
      const projects = readProjects();
      const pi = projects.findIndex(p => p.id === tasks[i].projectId);
      if (pi !== -1) {
        if (req.body.column === 'done' && !projects[pi].reviewed) {
          projects[pi].reviewed = true;
          saveProjects(projects);
        } else if (prevCol === 'done' && req.body.column === 'review' && projects[pi].reviewed) {
          projects[pi].reviewed = false;
          saveProjects(projects);
        }
      }
    } catch(e) {}
  }
  res.json(tasks[i]);
});

app.delete('/api/tasks/:id', (req, res) => {
  let tasks = read();
  tasks = tasks.filter(t => t.id !== req.params.id);
  save(tasks);
  res.json({ ok: true });
});

// Projects API
app.get('/api/projects', (_, res) => res.json(readProjects()));

app.post('/api/projects', (req, res) => {
  const projects = readProjects();
  const project = { id: Date.now().toString(), createdAt: new Date().toISOString().slice(0, 10), ...req.body };
  projects.push(project);
  saveProjects(projects);
  res.json(project);
});

app.put('/api/projects/:id', (req, res) => {
  const projects = readProjects();
  const i = projects.findIndex(p => p.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Not found' });
  const wasReviewed = projects[i].reviewed;
  projects[i] = { ...projects[i], ...req.body };
  saveProjects(projects);

  // Sync linked task when reviewed status changes
  if (req.body.reviewed !== undefined && req.body.reviewed !== wasReviewed) {
    try {
      const tasks = read();
      const ti = tasks.findIndex(t => t.projectId === req.params.id);
      if (ti !== -1) {
        if (req.body.reviewed === true && tasks[ti].column === 'review') {
          tasks[ti].column = 'done';
          save(tasks);
        } else if (req.body.reviewed === false && tasks[ti].column === 'done') {
          tasks[ti].column = 'review';
          save(tasks);
        }
      }
    } catch(e) {}
  }

  res.json(projects[i]);
});

app.delete('/api/projects/:id', (req, res) => {
  let projects = readProjects();
  projects = projects.filter(p => p.id !== req.params.id);
  saveProjects(projects);
  res.json({ ok: true });
});

// Stocks API
app.get('/api/stocks', (_, res) => res.json(readStocks()));

app.post('/api/stocks/tickers', (req, res) => {
  const data = readStocks();
  const { symbol, currency } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });
  const upper = symbol.toUpperCase();
  if (data.tickers.find(t => t.symbol === upper)) return res.status(409).json({ error: 'Already exists' });
  data.tickers.push({ symbol: upper, currency: currency || 'USD', addedAt: new Date().toISOString().slice(0, 10) });
  saveStocks(data);
  res.json(data.tickers);
});

app.delete('/api/stocks/tickers/:symbol', (req, res) => {
  const data = readStocks();
  const upper = req.params.symbol.toUpperCase();
  data.tickers = data.tickers.filter(t => t.symbol !== upper);
  saveStocks(data);
  res.json(data.tickers);
});

app.get('/api/stocks/briefings', (req, res) => {
  const data = readStocks();
  const { date } = req.query;
  if (date) return res.json(data.briefings.filter(b => b.date === date));
  res.json(data.briefings);
});

app.post('/api/stocks/briefings', (req, res) => {
  const data = readStocks();
  const briefing = { id: Date.now().toString(), date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(), ...req.body };
  data.briefings.unshift(briefing);
  saveStocks(data);
  res.json(briefing);
});

app.delete('/api/stocks/briefings/:id', (req, res) => {
  const data = readStocks();
  data.briefings = data.briefings.filter(b => b.id !== req.params.id);
  saveStocks(data);
  res.json({ ok: true });
});

// Watchlist API
app.post('/api/stocks/watchlist', (req, res) => {
  const data = readStocks();
  if (!data.watchlist) data.watchlist = [];
  const { symbol, currency } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });
  const upper = symbol.toUpperCase();
  if (data.watchlist.find(t => t.symbol === upper)) return res.status(409).json({ error: 'Already exists' });
  data.watchlist.push({ symbol: upper, currency: currency || 'USD', addedAt: new Date().toISOString().slice(0, 10) });
  saveStocks(data);
  res.json(data.watchlist);
});

app.delete('/api/stocks/watchlist/:symbol', (req, res) => {
  const data = readStocks();
  if (!data.watchlist) data.watchlist = [];
  const upper = req.params.symbol.toUpperCase();
  data.watchlist = data.watchlist.filter(t => t.symbol !== upper);
  saveStocks(data);
  res.json(data.watchlist);
});

// Earnings API
app.get('/api/stocks/earnings', (_, res) => {
  const data = readStocks();
  res.json(data.earnings || []);
});

app.post('/api/stocks/earnings', (req, res) => {
  const data = readStocks();
  if (!data.earnings) data.earnings = [];
  const entry = { id: Date.now().toString(), updatedAt: new Date().toISOString(), ...req.body };
  // Upsert by symbol
  const idx = data.earnings.findIndex(e => e.symbol === entry.symbol);
  if (idx !== -1) data.earnings[idx] = { ...data.earnings[idx], ...entry };
  else data.earnings.push(entry);
  saveStocks(data);
  res.json(entry);
});

app.put('/api/stocks/earnings/:id', (req, res) => {
  const data = readStocks();
  if (!data.earnings) data.earnings = [];
  const i = data.earnings.findIndex(e => e.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Not found' });
  data.earnings[i] = { ...data.earnings[i], ...req.body, updatedAt: new Date().toISOString() };
  saveStocks(data);
  res.json(data.earnings[i]);
});

app.delete('/api/stocks/earnings/:id', (req, res) => {
  const data = readStocks();
  if (!data.earnings) data.earnings = [];
  data.earnings = data.earnings.filter(e => e.id !== req.params.id);
  saveStocks(data);
  res.json({ ok: true });
});

app.listen(3333, '0.0.0.0', () => console.log('Kanban server running on http://localhost:3333'));
