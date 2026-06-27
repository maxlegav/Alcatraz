# Alcatraz — AI Agent Security Layer

AI security platform that intercepts, logs, and blocks dangerous tool calls from AI agents in real time.

## Architecture

Single Next.js app deployed to Vercel, backed by one Supabase database.

```
alcatraz/
├── apps/web/                   Next.js app (UI + API routes)
│   ├── app/
│   │   ├── page.tsx            Dashboard — realtime logs
│   │   ├── scan/               Red team scan report page
│   │   └── api/
│   │       ├── log/route.ts    POST /api/log   — receives tool call events
│   │       └── scan/route.ts   POST /api/scan  — red team scan via Codex
│   └── lib/supabase/
│       ├── client.ts           Browser client (anon key, realtime)
│       ├── server.ts           Server client (service role, API routes only)
│       └── types.ts            Log, Scan, Vulnerability types
├── supabase/
│   └── migrations/             SQL schema — run these in Supabase dashboard
└── demo/                       CrewAI demo agents (without/with Alcatraz)
```

Data flow: Python agent → `alcatraz.init()` monkey patch → `POST /api/log` (Authorization: Bearer) → Supabase `logs` table → dashboard via Supabase Realtime.

## Running

```bash
cd apps/web && npm run dev     # http://localhost:3000
```

## Environment

Copy `apps/web/.env.example` → `apps/web/.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

## Authentication

Both API routes require `Authorization: Bearer <api_key>`. The key is looked up in the `agents` table — `agent_id` is always derived server-side, never trusted from the request body.

## Supabase tables

- `logs` — tool call events (agent_id, tool_name, status ALLOWED/BLOCKED, severity, payload). Realtime enabled.
- `agents` — registered agents with api_key and rules (DENY/ALLOW lists)
- `scans` — red team scan reports (vulnerabilities JSON, generated rules)

## Stack

- Next.js, React, TypeScript
- Tailwind CSS 4 (PostCSS plugin — not v3 config syntax)
- Supabase JS v2 with Realtime
- Anthropic SDK (Codex-sonnet-4-6 for red team scans)
