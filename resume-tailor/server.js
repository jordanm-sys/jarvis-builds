const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });
const OpenAI = require('openai');
const pdfParse = require('pdf-parse');
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
const app = express();
const PORT = 3342;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const RESUME_FILE = path.join(DATA_DIR, 'master-resume.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

// File upload — extract text from .docx/.doc/.pdf/.txt
const multer = require('multer');
const mammoth = require('mammoth');
const upload = multer({ dest: path.join(DATA_DIR, 'uploads'), limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  try {
    let text = '';
    let html = '';
    if (ext === '.docx') {
      const [textResult, htmlResult] = await Promise.all([
        mammoth.extractRawText({ path: req.file.path }),
        mammoth.convertToHtml({ path: req.file.path })
      ]);
      text = textResult.value;
      html = htmlResult.value;
    } else if (ext === '.txt') {
      text = fs.readFileSync(req.file.path, 'utf8');
      html = '<pre>' + text.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</pre>';
    } else if (ext === '.pdf') {
      const data = await pdfParse(fs.readFileSync(req.file.path));
      text = data.text;
      html = '<pre>' + text.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</pre>';
    } else {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Supported formats: .docx, .txt, .pdf' });
    }
    fs.unlinkSync(req.file.path);
    res.json({ text, html });
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    res.status(500).json({ error: e.message });
  }
});

// Master resume
app.get('/api/resume', (_, res) => {
  if (fs.existsSync(RESUME_FILE)) return res.json(JSON.parse(fs.readFileSync(RESUME_FILE, 'utf8')));
  res.json({ resume: '' });
});

app.post('/api/resume', (req, res) => {
  fs.writeFileSync(RESUME_FILE, JSON.stringify({ resume: req.body.resume, resumeHtml: req.body.resumeHtml || '', updatedAt: new Date().toISOString() }));
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

// AI Tailor endpoint
app.post('/api/tailor', async (req, res) => {
  const { resume, jobPosting, company, role } = req.body;
  if (!resume || !jobPosting) return res.status(400).json({ error: 'Resume and job posting required' });
  
  try {
    if (openai) {
      const systemPrompt = `You are an expert resume writer and career coach. Respond ONLY with valid JSON in this shape:\n{\n  "tailoredResume": "...",\n  "coverLetter": "...",\n  "keywordsMatched": [],\n  "atsScore": 0,\n  "tips": []\n}\nThe tailored resume must be 1 page of polished bullet points, formatted in markdown style (headings, bullets). The cover letter should be 3-4 paragraphs, professional tone. Include at least 10 keywords matched from the job posting. ATS score must be 0-100 integer. Tips should be a helpful list.`;
      const userPrompt = `MASTER RESUME:\n${resume}\n\nJOB POSTING:\n${jobPosting}\n\nCOMPANY: ${company || 'Unknown'}\nROLE: ${role || 'Unknown'}\n\nTailor the resume and cover letter for this specific opportunity. Emphasize accounting/audit skills, CPA aspirations, teamwork, learning mindset, and bilingual requirement if present.`;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.35,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      });
      const text = completion.choices[0].message.content;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(500).json({ error: 'Failed to parse AI response' });
      const result = JSON.parse(jsonMatch[0]);
      return res.json(result);
    }
    
    // Fallback: trigger OpenClaw manual workflow
    const requestId = Date.now().toString();
    const requestFile = path.join(DATA_DIR, `request-${requestId}.json`);
    const resultFile = path.join(DATA_DIR, `result-${requestId}.json`);
    fs.writeFileSync(requestFile, JSON.stringify({ resume, jobPosting, company, role, requestId }));
    
    const { exec: execCmd } = require('child_process');
    const env = { HOME: '/Users/jordanmaragliano', PATH: '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin' };
    execCmd(`/opt/homebrew/bin/openclaw system event --text "RESUME_TAILOR_REQUEST:${requestId}" --mode now`, { timeout: 15000, env }, (err) => {
      if (err) console.log('OpenClaw event trigger failed:', err.message);
      else console.log('⚡ Resume tailor request sent to Jarvis:', requestId);
    });
    
    let attempts = 0;
    const maxAttempts = 60;
    const poll = () => new Promise((resolve) => {
      const interval = setInterval(() => {
        attempts++;
        if (fs.existsSync(resultFile)) {
          clearInterval(interval);
          const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
          try { fs.unlinkSync(requestFile); fs.unlinkSync(resultFile); } catch(e) {}
          resolve(result);
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          resolve(null);
        }
      }, 2000);
    });
    
    const fallbackResult = await poll();
    if (!fallbackResult) return res.status(504).json({ error: 'Timed out waiting for AI response. Try again.' });
    res.json(fallbackResult);
  } catch (e) {
    console.error('Tailor error', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload-job', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  try {
    let text = '';
    if (ext === '.pdf') {
      const data = await pdfParse(fs.readFileSync(req.file.path));
      text = data.text;
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: req.file.path });
      text = result.value;
    } else if (ext === '.txt') {
      text = fs.readFileSync(req.file.path, 'utf8');
    } else {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Supported formats: .pdf, .docx, .txt' });
    }
    fs.unlinkSync(req.file.path);
    res.json({ text });
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    res.status(500).json({ error: e.message });
  }
});

// Word doc generation
app.post('/api/docx', async (req, res) => {
  const { content, filename, type } = req.body;
  try {
    const docx = require('docx');
    const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, TabStopPosition, TabStopType, SectionType } = docx;
    
    const lines = (content || '').split('\n');
    const children = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Heading 1: # 
      if (line.startsWith('# ')) {
        children.push(new Paragraph({
          children: [new TextRun({ text: line.slice(2), bold: true, size: 32, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }));
        // Add a line under the name
        children.push(new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' } },
          spacing: { after: 200 },
        }));
      }
      // Heading 2: ##
      else if (line.startsWith('## ')) {
        children.push(new Paragraph({
          children: [new TextRun({ text: line.slice(3).toUpperCase(), bold: true, size: 22, font: 'Calibri', color: '2E4057' })],
          spacing: { before: 240, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
        }));
      }
      // Heading 3: ###
      else if (line.startsWith('### ')) {
        children.push(new Paragraph({
          children: [new TextRun({ text: line.slice(4), bold: true, size: 21, font: 'Calibri' })],
          spacing: { before: 120, after: 40 },
        }));
      }
      // Bullet: - 
      else if (line.startsWith('- ')) {
        const text = line.slice(2);
        const runs = parseInlineFormatting(text);
        children.push(new Paragraph({
          children: runs,
          bullet: { level: 0 },
          spacing: { after: 40 },
          style: 'bodyText',
        }));
      }
      // Italic line: *text*
      else if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
        children.push(new Paragraph({
          children: [new TextRun({ text: line.slice(1, -1), italics: true, size: 20, font: 'Calibri', color: '666666' })],
          spacing: { after: 40 },
        }));
      }
      // Empty line
      else if (line.trim() === '') {
        children.push(new Paragraph({ spacing: { after: 60 } }));
      }
      // Regular text
      else {
        const runs = parseInlineFormatting(line);
        children.push(new Paragraph({
          children: runs,
          spacing: { after: 60 },
        }));
      }
    }
    
    function parseInlineFormatting(text) {
      const runs = [];
      const regex = /\*\*(.+?)\*\*/g;
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          runs.push(new TextRun({ text: text.slice(lastIndex, match.index), size: 20, font: 'Calibri' }));
        }
        runs.push(new TextRun({ text: match[1], bold: true, size: 20, font: 'Calibri' }));
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < text.length) {
        runs.push(new TextRun({ text: text.slice(lastIndex), size: 20, font: 'Calibri' }));
      }
      if (runs.length === 0) {
        runs.push(new TextRun({ text, size: 20, font: 'Calibri' }));
      }
      return runs;
    }
    
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 900, right: 900 },
          },
        },
        children,
      }],
    });
    
    const buffer = await docx.Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'document.docx'}"`);
    res.send(buffer);
  } catch (e) {
    console.error('DOCX error:', e);
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
