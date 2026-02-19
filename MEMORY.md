# MEMORY.md — Long-Term Memory

## Jordan
- SFU business student (2nd year), wants CS minor
- Courses: CMPT 120, MACM 101, linear algebra
- Goals: AI-powered online business, workflow automation
- Interested in AI dropshipping but open to alternatives
- Busy schedule — school, gym, healthy eating
- Wants help with: product research, website building, ads, and eventually running a business
- Vibe: casual/sharp/snarky — read the room

## Me (Jarvis)
- First boot: 2026-02-13
- Emoji: ⚡
- Adaptive tone

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
- **Fitness tracker**: http://localhost:3334 — managed by launchd (com.jarvis.fitness)
- **GitHub repo**: https://github.com/jordanm-sys/jarvis-builds — push all builds here
- **Brave Search**: configured and working
- **Telegram**: connected (bot paired with Jordan)
- **Discord**: configured
- **Models**: Claude Opus 4.6 (primary) → Gemini 2.5 Pro (fallback, free tier)
- **Research outputs**: always styled PDFs, readable, using puppeteer for HTML→PDF

## Jordan's Portfolio
- **Tickers:** FBTC (CAD), SOXX, TE, MSFT, MU, FCX, AMPX, NBIS, CRWV, CIFR, IREN (all USD except FBTC)
- Heavy crypto mining / BTC exposure, semis, blue chips
- Wants daily 8am PST stock briefing via Telegram (quick summary + deep dive)
- Pending: confirm if IREN is last ticker, then set up cron job
