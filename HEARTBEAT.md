# HEARTBEAT.md

## Server Health Check (ALWAYS DO FIRST)
- Ensure kanban board is running on http://localhost:3333 — if not, start it: `node /Users/jordanmaragliano/.openclaw/workspace/kanban/server.js`
- Check all projects in projects.json — ensure each project's server is running on its port. If not, start it.
- Fitness tracker: `node /Users/jordanmaragliano/.openclaw/workspace/fitness-app/server.js` on port 3334

## Kanban Board Check
- Fetch tasks from http://localhost:3333/api/tasks
- **Scheduling**: Tasks have a `schedule` field:
  - `"instant"` — start immediately, don't wait for next heartbeat
  - ISO datetime string — deadline to complete by, plan work accordingly
  - No schedule — treat as normal (pick up when nothing else is in progress)
- **Instant tasks take top priority** — if any backlog task has `schedule: "instant"`, start it NOW regardless of what else is happening
- **Backlog priority** (for non-instant): Pick highest priority task first. If tied, pick the one with the earliest `createdAt`.
- Move picked task to "inprogress" — show ALL tasks in progress, no matter how small
- Work on any task currently in "inprogress" assigned to Jarvis
- When a task is done, move it to "review" with detailed description of what was done + key details Jordan should know
- If the completed task is a project, add it to projects.json with GitHub link + local URL if applicable
- For "recurring" tasks, check if they need attention today
- **Done section** is Jordan's — never move tasks there yourself
- If no tasks are in progress and backlog has items, start working on the next one
- If you complete work, commit and push to the jarvis-builds repo
