# Alcatraz — AI Agent Security Layer

AI security platform that intercepts, logs, and blocks dangerous tool calls from AI agents in real time.

## Architecture

Two independent Next.js 16 apps deployed separately to Vercel, sharing one Supabase database.

```
apps/web    → Dashboard UI (port 3000)   — realtime logs, scan reports
apps/api    → Backend API  (port 3001)   — POST /api/log, POST /api/scan
packages/   → (future) alcatraz-py pip package
demo/       → CrewAI demo agents
```

Data flow: Python agent → `alcatraz.init()` monkey patch → `POST apps/api/api/log` → Supabase `logs` table → `apps/web` dashboard via Supabase Realtime.

## Skills

Use these skills for specific tasks:

- `/alcatraz-arch` — full architecture, data flow, Supabase schema, key files
- `/alcatraz-testing` — how to test endpoints and the dashboard
- `/alcatraz-debug` — debugging Next.js 16, Supabase, and API routes
- `/alcatraz-commit` — how to commit after completing a task

## Running the apps

```bash
# Terminal 1 — API
cd apps/api && npm run dev     # http://localhost:3001

# Terminal 2 — Dashboard
cd apps/web && npm run dev     # http://localhost:3000
```

## Environment

**apps/web/.env.local**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**apps/api/.env.local**
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

## Key files

| File | Purpose |
|---|---|
| `apps/api/app/api/log/route.ts` | Receives tool call logs from agents |
| `apps/api/app/api/scan/route.ts` | Red team scan via Claude Sonnet |
| `apps/api/lib/supabase.ts` | Supabase server client (service role) |
| `apps/web/app/page.tsx` | Dashboard homepage |
| `apps/web/lib/supabase.ts` | Supabase browser client |
| `apps/web/lib/database.types.ts` | TypeScript types for all 3 tables |

## Supabase tables

- `logs` — tool call events (agent_id, tool_name, status ALLOWED/BLOCKED, severity, payload)
- `agents` — registered agents with rules (DENY/ALLOW lists)
- `scans` — red team scan reports (vulnerabilities JSON, generated rules)

## Next.js 16 — breaking changes

This is **Next.js 16**, not 14 or 15. Read `node_modules/next/dist/docs/` before writing routing or server component code. APIs differ from training data.

## Stack

- Next.js 16, React 19, TypeScript 5
- Tailwind CSS 4 (PostCSS plugin, not v3 config syntax)
- Supabase JS v2 with Realtime
- Anthropic SDK v0.106 (claude-sonnet-4-6 for red team scans)
