const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3342;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const RESUME_FILE = path.join(DATA_DIR, 'master-resume.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

// Master resume
app.get('/api/resume', (_, res) => {
  if (fs.existsSync(RESUME_FILE)) return res.json(JSON.parse(fs.readFileSync(RESUME_FILE, 'utf8')));
  res.json({ resume: '' });
});

app.post('/api/resume', (req, res) => {
  fs.writeFileSync(RESUME_FILE, JSON.stringify({ resume: req.body.resume, updatedAt: new Date().toISOString() }));
  res.json({ ok: true });
});

// History
app.get('/api/history', (_, res) => {
  if (fs.existsSync(HISTORY_FILE)) return res.json(JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')));
  res.json([]);
});

app.post('/api/history', (req, res) => {
  const history = fs.existsSync(HISTORY_FILE) ? JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) : [];
  const entry = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
  history.unshift(entry);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  res.json(entry);
});

app.delete('/api/history/:id', (req, res) => {
  let history = fs.existsSync(HISTORY_FILE) ? JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) : [];
  history = history.filter(h => h.id !== req.params.id);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  res.json({ ok: true });
});

// AI Tailor endpoint — triggers OpenClaw to process, polls for result
app.post('/api/tailor', async (req, res) => {
  const { resume, jobPosting, company, role } = req.body;
  if (!resume || !jobPosting) return res.status(400).json({ error: 'Resume and job posting required' });
  
  try {
    // Save the request
    const requestId = Date.now().toString();
    const requestFile = path.join(DATA_DIR, `request-${requestId}.json`);
    const resultFile = path.join(DATA_DIR, `result-${requestId}.json`);
    fs.writeFileSync(requestFile, JSON.stringify({ resume, jobPosting, company, role, requestId }));
    
    // Trigger OpenClaw system event to wake Jarvis
    const { exec: execCmd } = require('child_process');
    const env = { HOME: '/Users/jordanmaragliano', PATH: '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin' };
    execCmd(`/opt/homebrew/bin/openclaw system event --text "RESUME_TAILOR_REQUEST:${requestId}" --mode now`, { timeout: 15000, env }, (err) => {
      if (err) console.log('OpenClaw event trigger failed:', err.message);
      else console.log('⚡ Resume tailor request sent to Jarvis:', requestId);
    });
    
    // Poll for result (max 120 seconds)
    let attempts = 0;
    const maxAttempts = 60;
    const poll = () => new Promise((resolve) => {
      const interval = setInterval(() => {
        attempts++;
        if (fs.existsSync(resultFile)) {
          clearInterval(interval);
          const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
          // Cleanup
          try { fs.unlinkSync(requestFile); fs.unlinkSync(resultFile); } catch(e) {}
          resolve(result);
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          resolve(null);
        }
      }, 2000);
    });
    
    const result = await poll();
    if (!result) return res.status(504).json({ error: 'Timed out waiting for AI response. Try again.' });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PDF generation
app.post('/api/pdf', async (req, res) => {
  const { content, filename, type } = req.body;
  try {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    const isResume = type === 'resume';
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      @page { size: A4; margin: ${isResume ? '40px 50px' : '60px 70px'}; }
      body { font-family: 'Georgia', serif; color: #1a1a1a; line-height: 1.6; font-size: 13px; }
      h1 { font-size: 22px; margin-bottom: 4px; color: #2d3436; }
      h2 { font-size: 16px; color: #2d3436; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 16px; }
      h3 { font-size: 14px; color: #444; margin-top: 12px; }
      p { margin: 6px 0; }
      ul { margin: 4px 0 4px 20px; }
      li { margin: 2px 0; }
      strong { color: #2d3436; }
      .header { text-align: center; margin-bottom: 20px; }
    </style></head><body>${content}</body></html>`;
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } });
    await browser.close();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'document.pdf'}"`);
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Resume Tailor running at http://localhost:${PORT}`));
