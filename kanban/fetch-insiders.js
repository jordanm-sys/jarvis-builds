#!/usr/bin/env node
/**
 * Fetch insider trading data from SEC EDGAR for portfolio & watchlist tickers.
 * Posts results to the Jarvis Dashboard API.
 */

const fs = require('fs');
const path = require('path');

const STOCKS_FILE = path.join(__dirname, 'stocks.json');
const API_BASE = 'http://localhost:3333';
const USER_AGENT = 'JarvisDashboard/1.0 contact@example.com';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getAllTickers() {
  const data = JSON.parse(fs.readFileSync(STOCKS_FILE, 'utf8'));
  const portfolio = (data.tickers || []).map(t => t.symbol);
  const watchlist = (data.watchlist || []).map(t => t.symbol);
  // Filter out ETFs that won't have Form 4 filings
  const etfs = new Set(['FBTC', 'SOXX', 'SPY', 'QQQ', 'IWM', 'XLE', 'XLB', 'XLI', 'XLP', 'XLK', 'XLU', 'XLRE', 'VNQ', 'SMH', 'ITA', 'AVUV']);
  return [...new Set([...portfolio, ...watchlist])].filter(t => !etfs.has(t));
}

async function getCIK(ticker) {
  // Use SEC EDGAR company tickers JSON
  const resp = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': USER_AGENT }
  });
  if (!resp.ok) throw new Error(`Failed to fetch company tickers: ${resp.status}`);
  const data = await resp.json();
  for (const entry of Object.values(data)) {
    if (entry.ticker && entry.ticker.toUpperCase() === ticker.toUpperCase()) {
      return String(entry.cik_str).padStart(10, '0');
    }
  }
  return null;
}

// Cache the company tickers to avoid re-fetching
let companyTickersCache = null;
async function getCompanyTickers() {
  if (companyTickersCache) return companyTickersCache;
  const resp = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': USER_AGENT }
  });
  if (!resp.ok) throw new Error(`Failed to fetch company tickers: ${resp.status}`);
  companyTickersCache = await resp.json();
  return companyTickersCache;
}

async function getCIKForTicker(ticker) {
  const data = await getCompanyTickers();
  for (const entry of Object.values(data)) {
    if (entry.ticker && entry.ticker.toUpperCase() === ticker.toUpperCase()) {
      return String(entry.cik_str).padStart(10, '0');
    }
  }
  return null;
}

async function fetchFilingsForTicker(ticker) {
  const cik = await getCIKForTicker(ticker);
  if (!cik) {
    console.log(`  ⚠️ No CIK found for ${ticker}`);
    return [];
  }

  console.log(`  CIK: ${cik}`);

  // Fetch submission data from EDGAR
  const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!resp.ok) {
    console.log(`  ⚠️ Failed to fetch submissions for ${ticker}: ${resp.status}`);
    return [];
  }

  const data = await resp.json();
  const companyName = data.name || ticker;
  const recentFilings = data.filings?.recent;
  if (!recentFilings) return [];

  // Find Form 4 filings in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const form4Indices = [];
  for (let i = 0; i < (recentFilings.form || []).length; i++) {
    if (recentFilings.form[i] === '4' || recentFilings.form[i] === '4/A') {
      const filingDate = new Date(recentFilings.filingDate[i]);
      if (filingDate >= thirtyDaysAgo) {
        form4Indices.push(i);
      }
    }
  }

  if (!form4Indices.length) {
    console.log(`  No recent Form 4 filings`);
    return [];
  }

  console.log(`  Found ${form4Indices.length} Form 4 filings in last 30 days`);

  // Fetch and parse individual Form 4 XML files
  const transactions = [];
  const maxToFetch = Math.min(form4Indices.length, 15); // Limit to avoid rate limiting

  for (let j = 0; j < maxToFetch; j++) {
    const idx = form4Indices[j];
    const accession = recentFilings.accessionNumber[idx].replace(/-/g, '');
    const primaryDoc = recentFilings.primaryDocument[idx];
    const filingDate = recentFilings.filingDate[idx];

    // Fetch the filing index to find the XML file
    const cikNum = cik.replace(/^0+/, '');
    const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accession}/`;

    try {
      await sleep(150); // SEC rate limit: 10 req/sec
      const indexResp = await fetch(indexUrl, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' } });
      if (!indexResp.ok) continue;
      const indexHtml = await indexResp.text();
      
      // Find XML files (form4.xml, doc4.xml, etc.)
      const xmlMatches = [...indexHtml.matchAll(/href="([^"]+\.xml)"/g)].map(m => m[1]);
      const xmlFile = xmlMatches.find(f => !f.includes('R') && !f.includes('FilingSummary')); // Skip R*.xml and FilingSummary
      if (!xmlFile) continue;

      const xmlUrl = xmlFile.startsWith('/') ? `https://www.sec.gov${xmlFile}` : `${indexUrl}${xmlFile}`;
      await sleep(150);
      const xmlResp = await fetch(xmlUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (!xmlResp.ok) continue;

      const xmlText = await xmlResp.text();
      const parsed = parseForm4XML(xmlText, ticker, filingDate);
      transactions.push(...parsed);
    } catch (e) {
      console.log(`  ⚠️ Error fetching filing: ${e.message}`);
    }
  }

  return transactions;
}

function parseForm4XML(xml, ticker, filingDate) {
  const transactions = [];

  // Extract reporting person (insider) name
  const nameMatch = xml.match(/<rptOwnerName>([^<]+)<\/rptOwnerName>/);
  const insiderName = nameMatch ? nameMatch[1].trim() : 'Unknown';

  // Extract title/role
  const titleMatch = xml.match(/<officerTitle>([^<]+)<\/officerTitle>/);
  const isDirectorMatch = xml.match(/<isDirector>(?:1|true)<\/isDirector>/i);
  const isOfficerMatch = xml.match(/<isOfficer>(?:1|true)<\/isOfficer>/i);
  const isTenPercentMatch = xml.match(/<isTenPercentOwner>(?:1|true)<\/isTenPercentOwner>/i);
  let role = titleMatch ? titleMatch[1].trim() : '';
  if (!role && isDirectorMatch) role = 'Director';
  if (!role && isTenPercentMatch) role = '10% Owner';
  if (!role && isOfficerMatch) role = 'Officer';
  if (!role) role = 'Insider';

  // Extract ticker from filing if available
  const tickerMatch = xml.match(/<issuerTradingSymbol>([^<]+)<\/issuerTradingSymbol>/);
  const filingTicker = tickerMatch ? tickerMatch[1].trim().toUpperCase() : ticker;

  // Parse non-derivative transactions
  const txnRegex = /<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g;
  let match;
  while ((match = txnRegex.exec(xml)) !== null) {
    const block = match[1];

    // Transaction code (inside transactionCoding)
    const codingMatch = block.match(/<transactionCoding>[\s\S]*?<transactionCode>([^<]+)<\/transactionCode>/);
    const code = codingMatch ? codingMatch[1].trim() : '';

    // Only keep direct buys (P) and sells (S)
    if (code !== 'P' && code !== 'S') continue;

    // Transaction date
    const dateMatch = block.match(/<transactionDate>[\s\S]*?<value>([^<]+)<\/value>/);
    const txnDate = dateMatch ? dateMatch[1].trim() : filingDate;

    // Shares
    const sharesMatch = block.match(/<transactionAmounts>[\s\S]*?<transactionShares>[\s\S]*?<value>([^<]+)<\/value>/);
    const shares = sharesMatch ? parseFloat(sharesMatch[1]) : 0;

    // Price per share
    const priceMatch = block.match(/<transactionPricePerShare>[\s\S]*?<value>([^<]+)<\/value>/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

    // Acquisition or disposition
    const adMatch = block.match(/<transactionAcquiredDisposedCode>[\s\S]*?<value>([^<]+)<\/value>/);
    const ad = adMatch ? adMatch[1].trim() : '';

    const type = code === 'P' ? 'BUY' : 'SELL';
    const totalValue = Math.round(shares * price * 100) / 100;

    if (shares > 0) {
      transactions.push({
        symbol: filingTicker,
        insiderName,
        role,
        type,
        shares: Math.round(shares),
        pricePerShare: Math.round(price * 100) / 100,
        totalValue,
        date: txnDate,
        filingDate,
        transactionCode: code,
        source: 'SEC EDGAR Form 4'
      });
    }
  }

  return transactions;
}

async function postTransactions(transactions) {
  if (!transactions.length) {
    console.log('\nNo transactions to post.');
    return;
  }

  console.log(`\nPosting ${transactions.length} transactions to API...`);
  const resp = await fetch(`${API_BASE}/api/stocks/insiders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transactions)
  });

  if (!resp.ok) {
    console.error(`Failed to post: ${resp.status}`);
    return;
  }

  const result = await resp.json();
  console.log(`✅ Added ${result.added} new transactions (${result.total} total in DB)`);
}

async function main() {
  console.log('🏛️  Insider Trading Fetcher');
  console.log('========================\n');

  const tickers = await getAllTickers();
  console.log(`Tickers to check: ${tickers.join(', ')}\n`);

  const allTransactions = [];

  for (const ticker of tickers) {
    console.log(`📊 Fetching ${ticker}...`);
    try {
      const txns = await fetchFilingsForTicker(ticker);
      if (txns.length) {
        console.log(`  ✅ ${txns.length} buy/sell transactions found`);
        allTransactions.push(...txns);
      }
    } catch (e) {
      console.error(`  ❌ Error: ${e.message}`);
    }
    await sleep(200); // Respect SEC rate limits
  }

  console.log(`\n📋 Total transactions found: ${allTransactions.length}`);
  
  // Summary
  const buys = allTransactions.filter(t => t.type === 'BUY');
  const sells = allTransactions.filter(t => t.type === 'SELL');
  console.log(`  🟢 Buys: ${buys.length} (${formatDollar(buys.reduce((s, t) => s + t.totalValue, 0))})`);
  console.log(`  🔴 Sells: ${sells.length} (${formatDollar(sells.reduce((s, t) => s + t.totalValue, 0))})`);

  await postTransactions(allTransactions);
}

function formatDollar(val) {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
