#!/usr/bin/env node
// fetch-options.js — Scans options chains for unusual activity on Jordan's tickers
const http = require('http');
const { execSync } = require('child_process');
const path = require('path');

const KANBAN_API = 'http://localhost:3333';
const MIN_VOLUME = 150;
const MIN_PREMIUM = 20000;   // $20k total premium
const MIN_VOL_OI_RATIO = 1.5;
const SKIP_TICKERS = ['FBTC']; // Canadian ETF, no US options

const PYTHON_SCRIPT = path.join(__dirname, 'fetch-options-data.py');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function httpPost(apiPath, body) {
  const bodyStr = JSON.stringify(body);
  const tmpFile = `/tmp/options-payload-${Date.now()}.json`;
  require('fs').writeFileSync(tmpFile, bodyStr);
  try {
    const result = execSync(
      `curl -s -X POST -H "Content-Type: application/json" -d @${tmpFile} "http://localhost:3333${apiPath}"`,
      { maxBuffer: 1024 * 1024 }
    ).toString();
    require('fs').unlinkSync(tmpFile);
    return JSON.parse(result);
  } catch(e) {
    require('fs').unlinkSync(tmpFile);
    throw e;
  }
}

async function getStocks() {
  const data = await httpGet(`${KANBAN_API}/api/stocks`);
  const tickers = [
    ...(data.tickers || []).map(t => t.symbol),
    ...(data.watchlist || []).map(t => t.symbol)
  ].filter(s => !SKIP_TICKERS.includes(s));
  return [...new Set(tickers)];
}

function fetchAllOptions(tickers) {
  console.log('  Fetching via yfinance...');
  const result = execSync(
    `python3 "${PYTHON_SCRIPT}" ${tickers.join(' ')}`,
    { maxBuffer: 20 * 1024 * 1024, timeout: 120000 }
  ).toString();
  return JSON.parse(result);
}

function analyzeContracts(contracts, type, spot) {
  const alerts = [];
  for (const c of contracts) {
    const volume = c.volume || 0;
    const oi = Math.max(c.openInterest || 1, 1);
    const price = c.lastPrice || 0;
    const premium = volume * price * 100;
    const ratio = volume / oi;

    if (volume < MIN_VOLUME) continue;
    if (premium < MIN_PREMIUM) continue;
    if (ratio < MIN_VOL_OI_RATIO && volume < 500) continue;

    const strike = c.strike;
    const otmPct = spot ? Math.abs((strike - spot) / spot * 100) : 0;

    const ratioScore   = Math.min(40, ratio * 8);
    const premiumScore = Math.min(35, Math.log10(premium + 1) * 8);
    const volumeScore  = volume > 10000 ? 15 : volume > 3000 ? 10 : volume > 500 ? 5 : 0;
    const otmBonus     = (otmPct > 3 && otmPct < 30) ? 10 : 0;
    const score = Math.min(100, Math.round(ratioScore + premiumScore + volumeScore + otmBonus));

    if (score < 20) continue;

    alerts.push({
      strike,
      expiry: c.expiry,
      type,
      volume,
      openInterest: c.openInterest || 0,
      volOiRatio: parseFloat(ratio.toFixed(1)),
      lastPrice: price,
      premium: Math.round(premium),
      unusualScore: score,
      inTheMoney: c.inTheMoney || false,
      impliedVolatility: c.impliedVolatility ? parseFloat((c.impliedVolatility * 100).toFixed(1)) : null,
      sentiment: type === 'call' ? 'bullish' : 'bearish'
    });
  }
  return alerts.sort((a, b) => b.unusualScore - a.unusualScore).slice(0, 6);
}

function fmtPremium(p) {
  if (p >= 1000000) return `$${(p / 1000000).toFixed(1)}M`;
  return `$${(p / 1000).toFixed(0)}K`;
}

async function main() {
  console.log('🔍 Options Flow Scanner — ' + new Date().toLocaleString());
  const tickers = await getStocks();
  console.log(`Scanning ${tickers.length} tickers: ${tickers.join(', ')}\n`);

  let rawData;
  try {
    rawData = fetchAllOptions(tickers);
  } catch (e) {
    console.error('Failed to fetch options data:', e.message);
    process.exit(1);
  }

  const allAlerts = [];

  for (const symbol of tickers) {
    const d = rawData[symbol];
    if (!d || d.error) {
      console.log(`  ${symbol}... skipped (${d?.error || 'no data'})`);
      continue;
    }

    const calls = analyzeContracts(d.calls || [], 'call', d.spot);
    const puts  = analyzeContracts(d.puts  || [], 'put',  d.spot);
    const combined = [...calls, ...puts].sort((a, b) => b.unusualScore - a.unusualScore).slice(0, 6);

    if (combined.length > 0) {
      console.log(`  ${symbol}... ${combined.length} unusual (spot: $${d.spot?.toFixed(2) || '?'})`);
      combined.forEach(a => {
        allAlerts.push({
          id: `${symbol}_${a.expiry}_${a.strike}_${a.type}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          symbol,
          ...a
        });
      });
    } else {
      console.log(`  ${symbol}... nothing unusual`);
    }
  }

  allAlerts.sort((a, b) => b.unusualScore - a.unusualScore);

  const payload = { scannedAt: new Date().toISOString(), alerts: allAlerts };
  httpPost('/api/stocks/options', payload);
  console.log(`\n✅ ${allAlerts.length} unusual contracts saved.`);

  const top = allAlerts.filter(a => a.unusualScore >= 50).slice(0, 5);
  if (top.length > 0) {
    console.log('\n🔥 TOP ALERTS:');
    top.forEach(a => {
      const icon = a.sentiment === 'bullish' ? '🟢' : '🔴';
      console.log(`${icon} ${a.symbol} $${a.strike}${a.type === 'call' ? 'C' : 'P'} exp ${a.expiry} | Vol: ${a.volume.toLocaleString()} | Ratio: ${a.volOiRatio}x | Premium: ${fmtPremium(a.premium)} | Score: ${a.unusualScore}`);
    });
  } else {
    console.log('\nNo high-conviction alerts today.');
  }

  return allAlerts;
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
