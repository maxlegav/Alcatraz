# Alcatraz — Web Dashboard

The Next.js app that serves both the marketing site and the operator dashboard.

## What's in here

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/dashboard` | Real-time event feed — live tool call log, KPI cards, HITL panel, guardrails |
| `/agents/[id]` | Per-agent history and AI-generated vulnerability analysis |
| `/onboarding` | Step-by-step setup wizard (register agent, set rules, get API key) |
| `/report` | Red team scan report viewer |

### API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/log` | POST | Receives tool call events from the Python SDK (Bearer auth) |
| `/api/requests` | GET | Filtered event query for the dashboard feed |
| `/api/hitl` | POST | Create a human-in-the-loop approval request |
| `/api/hitl/[id]` | GET | Poll HITL request status (SDK polls every 2s) |
| `/api/agents` | GET/POST | List and register agents |
| `/api/agents/[id]` | GET/PATCH/DELETE | Agent detail and rule management |
| `/api/guardrails` | GET/POST/DELETE | DENY/ALLOW/REVIEW rule CRUD |
| `/api/redteam` | POST | Trigger a Claude vulnerability scan |
| `/api/analyze` | POST | Generate AI insight summary for an agent |
| `/api/api-keys` | GET/POST/DELETE | API key management |

## Running locally

```bash
npm install
npm run dev   # http://localhost:3000
```

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

## Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS v4** — PostCSS plugin, not v3 config syntax
- **Supabase JS v2** — Postgres + Realtime subscriptions for the live feed
- **Anthropic SDK** — `claude-sonnet-4-6` for red team scans and AI summaries
- **Framer Motion** — dashboard animations

## Authentication

Both `/api/log` and agent-facing routes require `Authorization: Bearer <api_key>`. The key is looked up in the `agents` table — `agent_id` is always derived server-side, never trusted from the request body.

## Database tables (Supabase)

| Table | Purpose |
|---|---|
| `agents` | Registered agents — `api_key`, `rules` (DENY/ALLOW/REVIEW lists) |
| `requests` | Intercepted tool call events — `tool_name`, `status`, `severity`, `payload`. Realtime enabled. |
| `hitl_requests` | Human-in-the-loop approval queue — `pending` → `approved` / `denied` |
| `guardrails` | Per-agent rule overrides managed from the dashboard |

Migrations are in `supabase/migrations/` — run them in the Supabase SQL editor.
