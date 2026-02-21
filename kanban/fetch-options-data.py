#!/usr/bin/env python3
"""Fetches options chain data for given tickers using yfinance."""
import sys, json, warnings
warnings.filterwarnings('ignore')
import yfinance as yf

tickers = sys.argv[1:]
results = {}

for symbol in tickers:
    try:
        t = yf.Ticker(symbol)
        expiries = t.options
        if not expiries:
            results[symbol] = {'error': 'no options'}
            continue

        # Get up to 3 nearest expiries
        all_calls = []
        all_puts = []
        spot = None
        try:
            info = t.fast_info
            spot = getattr(info, 'last_price', None)
        except:
            pass

        for exp in expiries[:3]:
            try:
                chain = t.option_chain(exp)
                for _, row in chain.calls.iterrows():
                    all_calls.append({
                        'strike': row.get('strike'),
                        'expiry': exp,
                        'volume': int(row.get('volume', 0) or 0),
                        'openInterest': int(row.get('openInterest', 0) or 0),
                        'lastPrice': float(row.get('lastPrice', 0) or 0),
                        'impliedVolatility': float(row.get('impliedVolatility', 0) or 0),
                        'inTheMoney': bool(row.get('inTheMoney', False))
                    })
                for _, row in chain.puts.iterrows():
                    all_puts.append({
                        'strike': row.get('strike'),
                        'expiry': exp,
                        'volume': int(row.get('volume', 0) or 0),
                        'openInterest': int(row.get('openInterest', 0) or 0),
                        'lastPrice': float(row.get('lastPrice', 0) or 0),
                        'impliedVolatility': float(row.get('impliedVolatility', 0) or 0),
                        'inTheMoney': bool(row.get('inTheMoney', False))
                    })
            except Exception as e:
                pass

        results[symbol] = {'calls': all_calls, 'puts': all_puts, 'spot': spot}
    except Exception as e:
        results[symbol] = {'error': str(e)}

print(json.dumps(results))
