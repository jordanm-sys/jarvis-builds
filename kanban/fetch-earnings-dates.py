#!/usr/bin/env python3
import yfinance as yf
import json
import sys

results = {}
for t in sys.argv[1:]:
    try:
        info = yf.Ticker(t).calendar
        if info is not None and isinstance(info, dict):
            ed = info.get('Earnings Date')
            if ed and len(ed) > 0:
                results[t] = str(ed[0].date()) if hasattr(ed[0], 'date') else str(ed[0])[:10]
            else:
                results[t] = None
        else:
            results[t] = None
    except Exception:
        results[t] = None

print(json.dumps(results))
