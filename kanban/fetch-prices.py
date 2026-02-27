#!/usr/bin/env python3
"""Fetches current prices, previous close, and % change for given tickers using yfinance.

Usage: python3 fetch-prices.py MSFT NVDA FBTC.TO
Output: JSON object keyed by ticker with price, previousClose, change, changePercent.

For Canadian tickers (e.g. FBTC), pass the Yahoo symbol (FBTC.TO).
"""
import sys, json, warnings
warnings.filterwarnings('ignore')
import yfinance as yf

tickers = sys.argv[1:]
results = {}

for symbol in tickers:
    try:
        t = yf.Ticker(symbol)
        info = t.fast_info
        price = round(info.last_price, 2)
        prev = round(info.previous_close, 2)
        change = round(price - prev, 2)
        change_pct = round((change / prev) * 100, 2) if prev else 0
        results[symbol] = {
            'price': price,
            'previousClose': prev,
            'change': change,
            'changePercent': change_pct
        }
    except Exception as e:
        results[symbol] = {'error': str(e)}

print(json.dumps(results))
