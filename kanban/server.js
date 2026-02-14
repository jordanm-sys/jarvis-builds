const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const TASKS_FILE = path.join(__dirname, 'tasks.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const read = () => JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
const save = (d) => fs.writeFileSync(TASKS_FILE, JSON.stringify(d, null, 2));

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
  tasks[i].column = req.body.column;
  save(tasks);
  res.json(tasks[i]);
});

app.delete('/api/tasks/:id', (req, res) => {
  let tasks = read();
  tasks = tasks.filter(t => t.id !== req.params.id);
  save(tasks);
  res.json({ ok: true });
});

app.listen(3333, () => console.log('Kanban server running on http://localhost:3333'));
