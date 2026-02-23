# MEMORY.md — Long-Term Memory

## Jordan
- SFU business student (2nd year), wants CS minor
- Courses: CMPT 120, MACM 101, linear algebra
- Goals: AI-powered online business, workflow automation
- Interested in AI dropshipping but open to alternatives; also researched AI smart scale concept
- Busy schedule — school, gym, healthy eating
- Wants help with: product research, website building, ads, and eventually running a business
- Vibe: casual/sharp/snarky — read the room
- Prefers clean, consistent UI formatting (e.g. "In Xd" not mixed date formats)
- Wants dashboard summary to be MY personal recommendations with reasoning, not technical data dumps
- Wants all data refreshed daily — hates stale info

## Me (Jarvis)
- First boot: 2026-02-13
- Emoji: ⚡
- Adaptive tone
- **Be disciplined about daily notes** — write to memory/YYYY-MM-DD.md during conversations, not just at the end

## Infrastructure
- **Kanban board**: http://localhost:3333 (Tailscale: http://100.109.88.104:3333)
  - Tasks stored at: /Users/jordanmaragliano/.openclaw/workspace/kanban/tasks.json
  - API: GET/POST/PUT/DELETE /api/tasks, PUT /api/tasks/:id/move
  - Jordan adds tasks → I pick them up and work on them
  - Move tasks: backlog → inprogress → review → done
  - Tasks link to projects via `projectId` — always set this when creating tasks/projects
  - Two-way sync: task column ↔ project reviewed status
  - Auto-polling UI (2s), no refresh needed
  - Managed by launchd (com.jarvis.kanban) — auto-restarts
  - **Summary tab**: `/api/stocks/summary` — I write a personal analyst note daily, stored in `summary.json`
  - **Summary format**: { sentiment, overall, picks: [{symbol, action, reasoning}], keyEvents }
  - Actions: buy / hold / trim / sell / watch
- **Fitness tracker**: http://localhost:3334 — managed by launchd (com.jarvis.fitness)
- **GitHub repo**: https://github.com/jordanm-sys/jarvis-builds — push all builds here
- **Brave Search**: configured and working
- **Telegram**: connected (bot paired with Jordan)
- **Discord**: configured
- **Models**: Claude Opus 4.6 (primary) → Gemini 2.5 Pro (fallback, free tier)
- **Research outputs**: always styled PDFs, readable, using puppeteer for HTML→PDF

## Cron Schedule (all PST, weekdays unless noted)
- **Every 2 min** — Task Watcher (Gemini, free) — checks kanban backlog, alerts me on new/instant tasks
- **7:25 AM** — Daily Earnings Calendar Refresh (Sonnet) — yfinance dates + Perplexity bull/bear cases for upcoming earnings + cleans old briefings/market insights
- **7:30 AM** — Portfolio Briefing (Sonnet) — prices, changes, news via Perplexity → posts to API + Telegram
- **7:35 AM** — Watchlist Briefing (Sonnet) — same for watchlist tickers
- **7:40 AM** — Market Insights (Sonnet) — sector rotations, opportunities, macro
- **7:45 AM** — Insider Trading Scan (Sonnet) — SEC EDGAR Form 4 filings via fetch-insiders.js
- **8:20 AM** — Options Flow Scan (Sonnet) — unusual options activity via fetch-options.js + yfinance
- **8:25 AM** — Jarvis Daily Summary (Opus) — my written analysis posted to /api/stocks/summary
- **Sunday 9 AM** — Weekly Memory Maintenance (Gemini) — review daily logs, update MEMORY.md
- **Heartbeats**: disabled (replaced by task watcher cron)

## Key Scripts
- `kanban/fetch-insiders.js` — SEC EDGAR Form 4 scraper, dedup, filters P/S only
- `kanban/fetch-options.js` — yfinance options chain scanner, unusual activity scoring
- `kanban/fetch-options-data.py` — Python helper for yfinance options data
- `kanban/refresh-earnings.js` — yfinance earnings date fetcher, updates API
- `kanban/fetch-earnings-dates.py` — Python helper for yfinance earnings dates

## Jordan's Portfolio
- **Tickers:** FBTC (CAD), SOXX, TE, MSFT, MU, FCX, AMPX, NBIS, CRWV, CIFR, IREN (all USD except FBTC)
- **Watchlist:** NVDA
- Heavy crypto mining / BTC exposure, semis, blue chips
- SOXX and FBTC are ETFs — no earnings
- **Insider alerts (as of Feb 23):** FCX 4 insiders selling $34M, CRWV 3 insiders selling $48M
- **Earnings week of Feb 24:** CIFR (Mon), NVDA (Tue), CRWV (Thu) — big week

## Workflow Rules (NON-NEGOTIABLE)
- **ALWAYS move tasks to "inprogress" before starting work** — no exceptions, even for small fixes
- Show ALL tasks in progress on the kanban board so Jordan can see what I'm working on
- When done → move to "review" with detailed description of what was done
- Never move tasks to "done" — that's Jordan's call

## Decisions & Lessons
- Briefing crons should NOT write to earnings data — that's the refresh script's job (avoids Perplexity overwriting good yfinance data)
- Old briefings/market insights should be auto-cleaned (7 days / 5 days) to prevent stale accumulation
- ETF notes should be static ("ETF — no earnings") not dynamic countdown text
- Earnings status badges should always show "In Xd" format, never mixed with date strings
- Summary tab should be Jarvis-written analysis, not auto-generated technical signals
- Task watcher cron (Gemini, 2 min) is better than frequent heartbeats (Opus) for task pickup
