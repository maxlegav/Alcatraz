# Pattern Analysis & Insights — Design Spec
_Date: 2026-06-27_

## Problem

Guardrails correctly block dangerous tool calls, but blocking alone doesn't fix the root cause. When an agent repeatedly hits a guardrail (e.g. keeps trying `env_read` for `DATABASE_URL`), the right fix is often upstream — inject the value into the system prompt, redesign the tool, or provide the data a different way. This feature surfaces those root-cause suggestions automatically.

---

## Data Model

### New `insights` table

```sql
create table insights (
  id            uuid default gen_random_uuid() primary key,
  agent_id      uuid not null references agents(id) on delete cascade,
  agent_version int  not null,
  patterns      jsonb not null default '[]',
  summary       text,
  triggered_by  text not null check (triggered_by in ('manual', 'scheduled')),
  created_at    timestamptz default now()
);

create index insights_agent_id_idx   on insights(agent_id);
create index insights_created_at_idx on insights(created_at desc);
```

Multiple rows per agent accumulate over time (not upserted) — this preserves history so recurring patterns can be detected.

### `Pattern` shape (inside `patterns` JSONB array)

```typescript
interface Pattern {
  tool_name: string;
  blocked_count: number;
  severity: Severity;                          // worst severity seen in this window
  description: string;                         // what the agent was trying to do
  suggestion: string;                          // upstream fix in plain English
  suggestion_type: 'prompt_injection'          // add value to system prompt
                 | 'tool_redesign'             // replace tool with safer typed alternative
                 | 'data_provision'            // provide data via a different mechanism
                 | 'other';
  example_payloads: Record<string, unknown>[]; // 1–3 representative payloads
}
```

### New TypeScript types (in `lib/supabase/types.ts`)

```typescript
export type SuggestionType = 'prompt_injection' | 'tool_redesign' | 'data_provision' | 'other';

export interface Pattern {
  tool_name: string;
  blocked_count: number;
  severity: Severity;
  description: string;
  suggestion: string;
  suggestion_type: SuggestionType;
  example_payloads: Record<string, unknown>[];
}

export interface Insight {
  id: string;
  agent_id: string;
  agent_version: number;
  patterns: Pattern[];
  summary: string | null;
  triggered_by: 'manual' | 'scheduled';
  created_at: string;
}
```

---

## API Routes

All three routes live under `apps/web/app/api/analyze/`.

### `POST /api/analyze` — on-demand analysis

- **Auth:** Supabase session cookie (same-origin, not API-key). Resolves `user_id` from the session.
- **Body:** `{ agent_id: string, agent_version?: number }`
- **Logic:**
  1. Verify agent belongs to the authenticated user.
  2. Fetch the most recent `insights` row for this agent (to determine the analysis window start and to pass previous patterns to Claude).
  3. Fetch requests: all BLOCKED requests since `last_insight.created_at`, or if that gives > 1000, trim to the 1000 highest-severity ones. If no previous insight exists, use the last 1000 BLOCKED requests.
  4. Group requests by `tool_name`. For each group, collect `blocked_count`, worst `severity`, and up to 3 example payloads.
  5. Call Claude with the grouped data + previous patterns (if any). See prompt below.
  6. Parse Claude's response into `Pattern[]` and a `summary`.
  7. Insert a new row into `insights` with `triggered_by: 'manual'`.
  8. Return `{ insight }`.
- **Error cases:** 401 unauthorized, 404 agent not found, 500 on Supabase/Claude error.

### `GET /api/analyze` — fetch latest insight

- **Auth:** Supabase session cookie (same-origin).
- **Query params:** `agent_id`, `agent_version` (optional).
- **Returns:** The most recent `insights` row for that agent version, plus a `recurring_tool_names: string[]` field — tool names that also appeared in the previous run, so the UI can show a "Recurring" badge without fetching all history.
- **Logic:** Two queries — latest insight + the one before it (to compute recurring).

### `POST /api/analyze/cron` — scheduled trigger

- **Auth:** `Authorization: Bearer ${CRON_SECRET}` header (env var, not a user API key).
- **No body.**
- **Logic:** Fetches all agents across all users, runs the same analysis logic as on-demand for each, inserts rows with `triggered_by: 'scheduled'`.
- **Configured in `vercel.json`:**

```json
{
  "crons": [{ "path": "/api/analyze/cron", "schedule": "0 6 * * *" }]
}
```

Runs daily at 06:00 UTC.

---

## Claude Analysis Logic

The core analysis is extracted into `lib/analyze.ts` so both the on-demand and cron routes share the same logic with no duplication.

### Input to Claude

```
You are a security analyst reviewing an AI agent's blocked tool calls.
Your goal is NOT to suggest more guardrail rules. The guardrails are working.
Instead, identify WHY the agent keeps hitting these blocks and suggest upstream fixes.

Agent: {agent_name} (version {agent_version})

Blocked tool calls since last analysis:
{for each group}
- tool: {tool_name}
  blocked {blocked_count} times
  worst severity: {severity}
  example payloads: {example_payloads}
{/for}

{if previous_patterns}
Previously identified patterns (from last analysis on {last_analysis_date}):
{previous_patterns as JSON}
Note which patterns are NEW vs RECURRING.
{/if}

For each pattern, output:
- tool_name
- blocked_count
- severity (worst seen)
- description: what is the agent trying to accomplish with this tool?
- suggestion: specific upstream fix (e.g. "Inject DATABASE_URL into the agent's system prompt so it doesn't need to read it from the environment")
- suggestion_type: one of prompt_injection | tool_redesign | data_provision | other
- example_payloads: 1–3 representative payloads (pick the most informative ones)

Also write a 2–3 sentence summary of the agent's overall behavior and risk posture.

Respond with valid JSON: { "patterns": [...], "summary": "..." }
```

Claude model: `claude-sonnet-4-6`. Response is parsed as JSON; on parse failure the route returns a 500.

---

## UI

### Dashboard summary panel

A new section on the main dashboard (below the agent list) shows a compact "Insights" row per agent that has at least one insight:

- Agent name
- Number of patterns in latest analysis
- Highest severity badge
- "Recurring" indicator if any patterns repeat from the previous run
- "Last analyzed" timestamp
- "Analyze now" button → calls `POST /api/analyze` and refreshes

### Agent detail page (`/agents/[id]`)

A new page (or expandable panel) showing the full breakdown for one agent:

- Summary paragraph from Claude
- List of patterns, each card showing:
  - Tool name + blocked count chip
  - Severity badge
  - "Recurring since [date]" badge (if applicable)
  - Description of what the agent was trying to do
  - Suggestion with an icon per `suggestion_type`:
    - `prompt_injection` → speech bubble icon ("Add to system prompt")
    - `tool_redesign` → wrench icon ("Redesign tool")
    - `data_provision` → database icon ("Provide data differently")
    - `other` → info icon
  - Collapsed example payloads (expandable)
- "Re-analyze" button in the header
- Historical timeline: previous analysis runs listed with date + pattern count (click to view)

---

## Recurring Pattern Detection

Each `GET /api/analyze` response includes `recurring_tool_names` — the intersection of `tool_name` values between the latest insight and the one before it. This is computed server-side from two queries (no schema change needed). The UI uses this to render a "Recurring" badge on affected pattern cards.

---

## Migration

New file: `supabase/migrations/003_insights.sql`

```sql
create table insights (
  id            uuid default gen_random_uuid() primary key,
  agent_id      uuid not null references agents(id) on delete cascade,
  agent_version int  not null,
  patterns      jsonb not null default '[]',
  summary       text,
  triggered_by  text not null check (triggered_by in ('manual', 'scheduled')),
  created_at    timestamptz default now()
);

create index insights_agent_id_idx   on insights(agent_id);
create index insights_created_at_idx on insights(created_at desc);

alter table insights enable row level security;

create policy "insights: owner"
  on insights for all
  using (agent_id in (select id from agents where user_id = auth.uid()));
```

---

## Out of Scope

- Cross-agent pattern analysis (deferred)
- Push notifications when a new insight is available (deferred)
- Automatic suggestion application (e.g. auto-patching guardrails) — user always reviews first
