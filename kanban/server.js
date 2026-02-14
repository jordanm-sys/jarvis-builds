const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const TASKS_FILE = path.join(__dirname, 'tasks.json');
const PROJECTS_FILE = path.join(__dirname, 'projects.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const read = () => JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
const save = (d) => fs.writeFileSync(TASKS_FILE, JSON.stringify(d, null, 2));
const readProjects = () => JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
const saveProjects = (d) => fs.writeFileSync(PROJECTS_FILE, JSON.stringify(d, null, 2));

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
  projects[i] = { ...projects[i], ...req.body };
  saveProjects(projects);
  res.json(projects[i]);
});

app.delete('/api/projects/:id', (req, res) => {
  let projects = readProjects();
  projects = projects.filter(p => p.id !== req.params.id);
  saveProjects(projects);
  res.json({ ok: true });
});

app.listen(3333, () => console.log('Kanban server running on http://localhost:3333'));
