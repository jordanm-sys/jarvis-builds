#!/usr/bin/env node
// refresh-earnings.js — Fetches latest earnings dates via yfinance and updates the dashboard
const { execSync } = require('child_process');
const http = require('http');

const KANBAN_API = 'http://localhost:3333';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, res => {
      let r = '';
      res.on('data', c => r += c);
      res.on('end', () => { try { resolve(JSON.parse(r)); } catch(e) { resolve(r); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function fetchEarningsDates(tickers) {
  const pyScript = require('path').join(__dirname, 'fetch-earnings-dates.py');
  const result = execSync(
    `python3 "${pyScript}" ${tickers.join(' ')}`,
    { maxBuffer: 5 * 1024 * 1024, timeout: 60000 }
  ).toString().trim();
  return JSON.parse(result);
}

async function main() {
  console.log('📅 Earnings Calendar Refresh —', new Date().toLocaleString());

  const stocks = await httpGet(`${KANBAN_API}/api/stocks`);
  const allTickers = [
    ...(stocks.tickers || []).map(t => t.symbol),
    ...(stocks.watchlist || []).map(t => t.symbol)
  ].filter(s => !['FBTC', 'SOXX'].includes(s)); // ETFs don't have earnings

  console.log(`Checking ${allTickers.length} tickers: ${allTickers.join(', ')}\n`);

  const dates = fetchEarningsDates(allTickers);
  const earnings = await httpGet(`${KANBAN_API}/api/stocks/earnings`);
  const now = new Date();
  let updated = 0;

  for (const symbol of allTickers) {
    const newDate = dates[symbol] || null;
    const existing = earnings.find(e => e.symbol === symbol);
    const source = (stocks.watchlist || []).find(t => t.symbol === symbol) ? 'watchlist' : 'portfolio';

    // Calculate status note
    let statusNote = '';
    if (newDate) {
      const rd = new Date(newDate + 'T00:00:00');
      const diff = Math.ceil((rd - now) / (1000 * 60 * 60 * 24));
      if (diff < 0) statusNote = 'Reported';
      else if (diff === 0) statusNote = '⚠️ REPORTING TODAY';
      else if (diff === 1) statusNote = '⚠️ REPORTING TOMORROW';
      else if (diff <= 7) statusNote = `⚠️ EARNINGS IN ${diff} DAYS`;
      else statusNote = `Earnings in ${diff} days`;
    } else {
      statusNote = 'No confirmed earnings date';
    }

    // For ETFs, keep simple notes
    const isETF = ['SOXX', 'FBTC'].includes(symbol);
    const etfNotes = { SOXX: 'ETF — tracks semiconductor index. No earnings.', FBTC: 'ETF — tracks BTC spot price. No earnings.' };

    const payload = {
      symbol,
      reportDate: newDate,
      source,
      bullCase: existing?.bullCase || '—',
      bearCase: existing?.bearCase || '—',
      notes: isETF ? (etfNotes[symbol] || 'ETF — no earnings') : statusNote
    };

    await httpPost(`${KANBAN_API}/api/stocks/earnings`, payload);
    const changed = existing?.reportDate !== newDate;
    if (changed) console.log(`  ${symbol}: ${existing?.reportDate || 'none'} → ${newDate || 'TBD'} ${changed ? '🔄' : ''}`);
    else console.log(`  ${symbol}: ${newDate || 'TBD'} (unchanged)`);
    updated++;
  }

  console.log(`\n✅ ${updated} tickers refreshed.`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
