# Pattern Analysis & Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-agent pattern analysis that detects behavioral patterns in blocked request history and suggests upstream root-cause fixes via Claude.

**Architecture:** A shared `lib/analyze.ts` module fetches BLOCKED requests since the last analysis, groups them by tool name, calls Claude for root-cause suggestions, and writes structured `Pattern[]` to a new `insights` table. Two API routes expose this: `POST /api/analyze` (on-demand, CORS-restricted) and `POST /api/analyze/cron` (scheduled via Vercel cron). A dashboard panel and per-agent detail page surface the results.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (service role key for API routes), Anthropic SDK (`claude-sonnet-4-6`), Tailwind CSS 4, React 19 Server Components, Jest + ts-jest for unit tests.

## Global Constraints

- Tailwind CSS 4 — PostCSS plugin syntax only, no `tailwind.config.js`
- `supabaseAdmin` from `lib/supabase/server.ts` (service role, bypasses RLS) for all server-side Supabase calls
- Model: `claude-sonnet-4-6`
- CORS-restricted routes check the `Origin` header against `host`; no API key required
- Cron route auth: `Authorization: Bearer ${CRON_SECRET}` (env var)
- Commit after every task: `git add ... && git commit -m "feat: ..." && git push`

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/003_insights.sql` | Create | DB schema for insights table |
| `apps/web/lib/supabase/types.ts` | Modify | Add `Pattern`, `Insight`, `SuggestionType` |
| `apps/web/jest.config.ts` | Create | Jest config for ts-jest |
| `apps/web/lib/analyze.ts` | Create | `groupRequests`, `runAnalysis`, `fetchAndAnalyze` |
| `apps/web/lib/analyze.test.ts` | Create | Unit tests for `groupRequests` |
| `apps/web/app/api/analyze/route.ts` | Create | `GET` + `POST` (on-demand, CORS) |
| `apps/web/app/api/analyze/cron/route.ts` | Create | `POST` (Vercel cron, CRON_SECRET) |
| `vercel.json` | Create | Daily cron schedule |
| `apps/web/app/agents/[id]/AnalyzeButton.tsx` | Create | Client component: triggers on-demand analysis |
| `apps/web/app/agents/[id]/page.tsx` | Create | Agent detail page with full insight breakdown |
| `apps/web/app/page.tsx` | Modify | Real dashboard: agent list + insights summary panel |

---

### Task 1: DB migration & TypeScript types

**Files:**
- Create: `supabase/migrations/003_insights.sql`
- Modify: `apps/web/lib/supabase/types.ts`

**Interfaces:**
- Produces: `SuggestionType`, `Pattern`, `Insight` — consumed by Tasks 2, 3, 5, 6

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/003_insights.sql`:

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

- [ ] **Step 2: Run the migration in Supabase**

Open the Supabase project dashboard → SQL Editor → paste the file contents and run. Verify the `insights` table appears in Table Editor.

- [ ] **Step 3: Append types to `apps/web/lib/supabase/types.ts`**

Add at the end of the file, after the `Request` interface:

```typescript
// ------------------------------------------------------------------
// insights — pattern analysis results per (agent_id, agent_version)
// ------------------------------------------------------------------
export type SuggestionType =
  | 'prompt_injection'
  | 'tool_redesign'
  | 'data_provision'
  | 'other';

export interface Pattern {
  tool_name: string;
  blocked_count: number;
  severity: Severity | null;
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

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/003_insights.sql apps/web/lib/supabase/types.ts
git commit -m "feat: add insights table migration and TypeScript types"
git push
```

---

### Task 2: Core analysis logic + unit tests

**Files:**
- Create: `apps/web/jest.config.ts`
- Create: `apps/web/lib/analyze.ts`
- Create: `apps/web/lib/analyze.test.ts`
- Modify: `apps/web/package.json` (add `jest`, `ts-jest`, `@types/jest` to devDependencies, add `test` script)

**Interfaces:**
- Consumes: `Pattern`, `Insight`, `Request`, `Severity` from `lib/supabase/types.ts`; `supabaseAdmin` from `lib/supabase/server.ts`; `Anthropic` from `@anthropic-ai/sdk`
- Produces:
  - `groupRequests(requests: Request[]): GroupedTool[]` — pure, tested
  - `runAnalysis(input: AnalysisInput): Promise<AnalysisResult>` — calls Claude
  - `fetchAndAnalyze(agentId: string, agentVersion: number, agentName: string, triggeredBy: 'manual' | 'scheduled'): Promise<Insight>` — full pipeline, used by Tasks 3 and 4

- [ ] **Step 1: Install test dependencies**

```bash
cd apps/web && npm install --save-dev jest @types/jest ts-jest
```

Expected: packages appear in `package.json` devDependencies.

- [ ] **Step 2: Add test script to `apps/web/package.json`**

In the `scripts` object, add:

```json
"test": "jest"
```

- [ ] **Step 3: Create `apps/web/jest.config.ts`**

```typescript
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react' } }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
};

export default config;
```

- [ ] **Step 4: Write failing tests**

Create `apps/web/lib/analyze.test.ts`:

```typescript
import { groupRequests } from './analyze';
import type { Request } from './supabase/types';

const base: Omit<Request, 'tool_name' | 'severity' | 'payload'> = {
  id: '1',
  agent_id: 'a1',
  agent_version: 1,
  status: 'BLOCKED',
  created_at: '2026-06-27T00:00:00Z',
};

describe('groupRequests', () => {
  it('returns empty array for no requests', () => {
    expect(groupRequests([])).toEqual([]);
  });

  it('counts blocked_count per tool', () => {
    const requests: Request[] = [
      { ...base, id: '1', tool_name: 'env_read', severity: 'high', payload: { key: 'DATABASE_URL' } },
      { ...base, id: '2', tool_name: 'env_read', severity: 'low', payload: { key: 'PORT' } },
      { ...base, id: '3', tool_name: 'shell_exec', severity: 'critical', payload: { command: 'rm -rf /' } },
    ];
    const result = groupRequests(requests);
    expect(result).toHaveLength(2);
    expect(result.find(g => g.tool_name === 'env_read')!.blocked_count).toBe(2);
    expect(result.find(g => g.tool_name === 'shell_exec')!.blocked_count).toBe(1);
  });

  it('tracks worst severity across a group', () => {
    const requests: Request[] = [
      { ...base, id: '1', tool_name: 'env_read', severity: 'low', payload: null },
      { ...base, id: '2', tool_name: 'env_read', severity: 'critical', payload: null },
      { ...base, id: '3', tool_name: 'env_read', severity: 'medium', payload: null },
    ];
    expect(groupRequests(requests)[0].severity).toBe('critical');
  });

  it('collects up to 3 example payloads', () => {
    const requests: Request[] = Array.from({ length: 5 }, (_, i) => ({
      ...base,
      id: String(i),
      tool_name: 'env_read',
      severity: 'high' as const,
      payload: { key: `SECRET_${i}` },
    }));
    expect(groupRequests(requests)[0].example_payloads).toHaveLength(3);
  });

  it('skips null payloads in example_payloads', () => {
    const requests: Request[] = [
      { ...base, id: '1', tool_name: 'env_read', severity: 'high', payload: null },
      { ...base, id: '2', tool_name: 'env_read', severity: 'high', payload: { key: 'SECRET' } },
    ];
    expect(groupRequests(requests)[0].example_payloads).toEqual([{ key: 'SECRET' }]);
  });
});
```

- [ ] **Step 5: Run tests — verify they fail**

```bash
cd apps/web && npm test
```

Expected: FAIL — `Cannot find module './analyze'`

- [ ] **Step 6: Create `apps/web/lib/analyze.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from './supabase/server';
import type { Pattern, Insight, Request, Severity } from './supabase/types';

const anthropic = new Anthropic();

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export interface GroupedTool {
  tool_name: string;
  blocked_count: number;
  severity: Severity | null;
  example_payloads: Record<string, unknown>[];
}

export interface AnalysisInput {
  agentName: string;
  agentVersion: number;
  groupedTools: GroupedTool[];
  previousPatterns: Pattern[];
  previousAnalysisDate: string | null;
}

export interface AnalysisResult {
  patterns: Pattern[];
  summary: string;
}

export function groupRequests(requests: Request[]): GroupedTool[] {
  const groups = new Map<string, GroupedTool>();

  for (const req of requests) {
    const existing = groups.get(req.tool_name);
    if (!existing) {
      groups.set(req.tool_name, {
        tool_name: req.tool_name,
        blocked_count: 1,
        severity: req.severity,
        example_payloads: req.payload ? [req.payload] : [],
      });
    } else {
      existing.blocked_count++;
      if (existing.example_payloads.length < 3 && req.payload) {
        existing.example_payloads.push(req.payload);
      }
      const incomingRank = req.severity ? (SEVERITY_RANK[req.severity] ?? 0) : 0;
      const existingRank = existing.severity ? (SEVERITY_RANK[existing.severity] ?? 0) : 0;
      if (incomingRank > existingRank) existing.severity = req.severity;
    }
  }

  return Array.from(groups.values());
}

export async function runAnalysis(input: AnalysisInput): Promise<AnalysisResult> {
  const { agentName, agentVersion, groupedTools, previousPatterns, previousAnalysisDate } = input;

  if (groupedTools.length === 0) {
    return { patterns: [], summary: 'No blocked requests found in the analysis window.' };
  }

  const toolsText = groupedTools
    .map(
      (t) =>
        `- tool: ${t.tool_name}\n  blocked ${t.blocked_count} times\n  worst severity: ${t.severity ?? 'unknown'}\n  example payloads: ${JSON.stringify(t.example_payloads)}`
    )
    .join('\n');

  const previousText =
    previousPatterns.length > 0
      ? `\nPreviously identified patterns (last analysis: ${previousAnalysisDate}):\n${JSON.stringify(previousPatterns, null, 2)}\nNote which patterns are NEW vs RECURRING.`
      : '';

  const prompt = `You are a security analyst reviewing an AI agent's blocked tool calls.
Your goal is NOT to suggest more guardrail rules — the guardrails are working.
Instead, identify WHY the agent keeps hitting these blocks and suggest upstream fixes.

Agent: ${agentName} (version ${agentVersion})

Blocked tool calls since last analysis:
${toolsText}
${previousText}

For each pattern output:
- tool_name (string)
- blocked_count (integer)
- severity (worst seen: critical/high/medium/low, or null)
- description: what is the agent trying to accomplish with this tool?
- suggestion: a specific upstream fix (e.g. "Inject DATABASE_URL into the agent's system prompt so it doesn't need to read it from the environment")
- suggestion_type: one of prompt_injection | tool_redesign | data_provision | other
- example_payloads: array of 1–3 representative payload objects

Also write a 2–3 sentence summary of the agent's overall behavior and risk posture.

Respond with valid JSON only, no markdown fences: { "patterns": [...], "summary": "..." }`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  return JSON.parse(text) as AnalysisResult;
}

export async function fetchAndAnalyze(
  agentId: string,
  agentVersion: number,
  agentName: string,
  triggeredBy: 'manual' | 'scheduled'
): Promise<Insight> {
  const { data: lastInsight } = await supabaseAdmin
    .from('insights')
    .select('*')
    .eq('agent_id', agentId)
    .eq('agent_version', agentVersion)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let query = supabaseAdmin
    .from('requests')
    .select('*')
    .eq('agent_id', agentId)
    .eq('agent_version', agentVersion)
    .eq('status', 'BLOCKED')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (lastInsight) {
    query = query.gt('created_at', lastInsight.created_at);
  }

  const { data: requests, error } = await query.returns<Request[]>();
  if (error) throw new Error(error.message);

  const groupedTools = groupRequests(requests ?? []);

  const result = await runAnalysis({
    agentName,
    agentVersion,
    groupedTools,
    previousPatterns: (lastInsight?.patterns as Pattern[]) ?? [],
    previousAnalysisDate: lastInsight?.created_at ?? null,
  });

  const { data: insight, error: insertErr } = await supabaseAdmin
    .from('insights')
    .insert({
      agent_id: agentId,
      agent_version: agentVersion,
      patterns: result.patterns,
      summary: result.summary,
      triggered_by: triggeredBy,
    })
    .select()
    .single();

  if (insertErr) throw new Error(insertErr.message);

  return insight as Insight;
}
```

- [ ] **Step 7: Run tests — verify they pass**

```bash
cd apps/web && npm test
```

Expected: 5 tests PASS.

- [ ] **Step 8: Verify TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/analyze.ts apps/web/lib/analyze.test.ts apps/web/jest.config.ts apps/web/package.json apps/web/package-lock.json
git commit -m "feat: add core analysis logic and unit tests"
git push
```

---

### Task 3: API routes — on-demand POST + GET

**Files:**
- Create: `apps/web/app/api/analyze/route.ts`

**Interfaces:**
- Consumes: `fetchAndAnalyze` from `lib/analyze.ts`; `supabaseAdmin` from `lib/supabase/server.ts`; `Insight`, `Pattern` from `lib/supabase/types.ts`
- Produces:
  - `POST /api/analyze` → `{ insight: Insight }`
  - `GET /api/analyze?agent_id=...&agent_version=...` → `{ insight: Insight | null, recurring_tool_names: string[] }`

- [ ] **Step 1: Create `apps/web/app/api/analyze/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { fetchAndAnalyze } from '@/lib/analyze';
import type { Insight, Pattern } from '@/lib/supabase/types';

function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // server-to-server calls have no Origin header
  const host = req.headers.get('host') ?? '';
  return origin === `http://${host}` || origin === `https://${host}`;
}

export async function GET(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agent_id');
  const agentVersionRaw = searchParams.get('agent_version');

  if (!agentId) {
    return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
  }

  let query = supabaseAdmin
    .from('insights')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(2);

  if (agentVersionRaw) {
    query = query.eq('agent_version', Number(agentVersionRaw));
  }

  const { data: rows, error } = await query.returns<Insight[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const latest = rows?.[0] ?? null;
  const previous = rows?.[1] ?? null;

  const recurringToolNames: string[] =
    latest && previous
      ? (latest.patterns as Pattern[])
          .map((p) => p.tool_name)
          .filter((name) =>
            (previous.patterns as Pattern[]).some((p) => p.tool_name === name)
          )
      : [];

  return NextResponse.json({ insight: latest, recurring_tool_names: recurringToolNames });
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { agent_id, agent_version } = body as {
    agent_id?: string;
    agent_version?: number;
  };

  if (!agent_id) {
    return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
  }

  const { data: agent, error: agentErr } = await supabaseAdmin
    .from('agents')
    .select('id, name, version')
    .eq('id', agent_id)
    .single();

  if (agentErr || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const version = agent_version ?? (agent as { version: number }).version;

  try {
    const insight = await fetchAndAnalyze(
      agent_id,
      version,
      (agent as { name: string }).name,
      'manual'
    );
    return NextResponse.json({ insight }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start the dev server and manually test both routes**

```bash
cd apps/web && npm run dev
```

Replace `<agent_id>` with a real UUID from your `agents` table.

Test GET — returns null before any analysis:

```bash
curl "http://localhost:3000/api/analyze?agent_id=<agent_id>"
```

Expected: `{"insight":null,"recurring_tool_names":[]}`

Test POST — triggers analysis and returns the created insight:

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\":\"<agent_id>\"}"
```

Expected: `{"insight":{"id":"...","patterns":[...],"summary":"...","triggered_by":"manual",...}}`

Test GET again — now returns the insight with recurring check:

```bash
curl "http://localhost:3000/api/analyze?agent_id=<agent_id>"
```

Expected: `{"insight":{...},"recurring_tool_names":[]}`

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/analyze/route.ts
git commit -m "feat: add GET and POST /api/analyze routes (CORS-restricted)"
git push
```

---

### Task 4: Cron route + Vercel config

**Files:**
- Create: `apps/web/app/api/analyze/cron/route.ts`
- Create: `vercel.json`
- Modify: `apps/web/.env.example`

**Interfaces:**
- Consumes: `fetchAndAnalyze` from `lib/analyze.ts`; `supabaseAdmin` from `lib/supabase/server.ts`
- Produces: `POST /api/analyze/cron` — iterates all agents, runs analysis for each

- [ ] **Step 1: Add `CRON_SECRET` to `.env.example`**

Append to `apps/web/.env.example`:

```
CRON_SECRET=your-cron-secret-here
```

Add to your local `apps/web/.env.local`:

```
CRON_SECRET=dev-cron-secret
```

- [ ] **Step 2: Create `apps/web/app/api/analyze/cron/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { fetchAndAnalyze } from '@/lib/analyze';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: agents, error } = await supabaseAdmin
    .from('agents')
    .select('id, name, version');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { agent_id: string; status: 'ok' | 'error'; error?: string }[] = [];

  for (const agent of agents ?? []) {
    try {
      await fetchAndAnalyze(agent.id, agent.version, agent.name, 'scheduled');
      results.push({ agent_id: agent.id, status: 'ok' });
    } catch (err) {
      results.push({
        agent_id: agent.id,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({ results });
}
```

- [ ] **Step 3: Create `vercel.json` at the repo root**

```json
{
  "crons": [
    {
      "path": "/api/analyze/cron",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Vercel will call this endpoint daily at 06:00 UTC with `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set as a Vercel environment variable.

- [ ] **Step 4: Test the cron route manually**

```bash
curl -X POST http://localhost:3000/api/analyze/cron \
  -H "Authorization: Bearer dev-cron-secret"
```

Expected: `{"results":[{"agent_id":"...","status":"ok"},...]}`

Verify wrong secret is rejected:

```bash
curl -X POST http://localhost:3000/api/analyze/cron \
  -H "Authorization: Bearer wrong-secret"
```

Expected: `{"error":"Unauthorized"}` with status 401.

- [ ] **Step 5: Verify TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/analyze/cron/route.ts vercel.json apps/web/.env.example
git commit -m "feat: add cron route and Vercel daily schedule"
git push
```

---

### Task 5: AnalyzeButton client component

**Files:**
- Create: `apps/web/app/agents/[id]/AnalyzeButton.tsx`

**Interfaces:**
- Consumes: `POST /api/analyze`; `useRouter` from `next/navigation`
- Produces: `<AnalyzeButton agentId={string} />` — imported by both Task 5 (dashboard) and Task 6 (detail page)

- [ ] **Step 1: Create `apps/web/app/agents/[id]/AnalyzeButton.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AnalyzeButton({ agentId }: { agentId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAnalyze() {
    setLoading(true);
    try {
      await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleAnalyze}
      disabled={loading}
      className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 hover:opacity-80 disabled:opacity-40 transition-opacity"
    >
      {loading ? 'Analyzing…' : 'Analyze'}
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/agents/
git commit -m "feat: add AnalyzeButton client component"
git push
```

---

### Task 6: Dashboard page + agent detail page

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/app/agents/[id]/page.tsx`

**Interfaces:**
- Consumes: `AnalyzeButton` from `./agents/[id]/AnalyzeButton`; `supabaseAdmin`; `Agent`, `Insight`, `Pattern`, `SuggestionType` from types
- Produces: `/` dashboard with agent list + insight summaries; `/agents/[id]` detail page with full pattern breakdown + history

- [ ] **Step 1: Replace `apps/web/app/page.tsx`**

```tsx
import { supabaseAdmin } from '@/lib/supabase/server';
import type { Agent, Insight, Pattern } from '@/lib/supabase/types';
import Link from 'next/link';
import AnalyzeButton from './agents/[id]/AnalyzeButton';

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
};

const SUGGESTION_LABEL: Record<string, string> = {
  prompt_injection: 'Add to prompt',
  tool_redesign: 'Redesign tool',
  data_provision: 'Provide data',
  other: 'Review',
};

async function getAgents(): Promise<Agent[]> {
  const { data } = await supabaseAdmin.from('agents').select('*').order('created_at');
  return (data ?? []) as Agent[];
}

async function getLatestInsightWithRecurring(
  agentId: string
): Promise<(Insight & { recurring_tool_names: string[] }) | null> {
  const { data: rows } = await supabaseAdmin
    .from('insights')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(2)
    .returns<Insight[]>();

  if (!rows || rows.length === 0) return null;

  const latest = rows[0];
  const previous = rows[1] ?? null;
  const recurringToolNames = previous
    ? (latest.patterns as Pattern[])
        .map((p) => p.tool_name)
        .filter((name) => (previous.patterns as Pattern[]).some((p) => p.tool_name === name))
    : [];

  return { ...latest, recurring_tool_names: recurringToolNames };
}

async function getRequestStats(agentId: string) {
  const [{ count: total }, { count: blocked }] = await Promise.all([
    supabaseAdmin
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId),
    supabaseAdmin
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', 'BLOCKED'),
  ]);
  return { total: total ?? 0, blocked: blocked ?? 0 };
}

export default async function DashboardPage() {
  const agents = await getAgents();

  const agentData = await Promise.all(
    agents.map(async (agent) => {
      const [insight, stats] = await Promise.all([
        getLatestInsightWithRecurring(agent.id),
        getRequestStats(agent.id),
      ]);
      return { agent, insight, stats };
    })
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Alcatraz</h1>
        <p className="text-sm text-zinc-500 mt-0.5">AI Agent Security Layer</p>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Agents</h2>

        {agentData.length === 0 && (
          <p className="text-zinc-400 text-sm">No agents registered yet.</p>
        )}

        {agentData.map(({ agent, insight, stats }) => {
          const patterns = insight ? (insight.patterns as Pattern[]) : [];
          const topPattern = patterns.length > 0
            ? [...patterns].sort((a, b) => {
                const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
                return (rank[b.severity ?? ''] ?? 0) - (rank[a.severity ?? ''] ?? 0);
              })[0]
            : null;

          return (
            <div
              key={agent.id}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/agents/${agent.id}`}
                    className="font-semibold text-zinc-900 dark:text-zinc-50 hover:underline"
                  >
                    {agent.name}
                  </Link>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    v{agent.version} · {stats.total} requests · {stats.blocked} blocked
                  </p>
                </div>
                <AnalyzeButton agentId={agent.id} />
              </div>

              {insight ? (
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span>Last analyzed {new Date(insight.created_at).toLocaleDateString()}</span>
                    {insight.recurring_tool_names.length > 0 && (
                      <span className="bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-medium">
                        {insight.recurring_tool_names.length} recurring
                      </span>
                    )}
                  </div>

                  {topPattern && (
                    <div className="flex items-start gap-3">
                      {topPattern.severity && (
                        <span className={`text-xs font-medium rounded px-1.5 py-0.5 shrink-0 ${SEVERITY_COLOR[topPattern.severity] ?? ''}`}>
                          {topPattern.severity}
                        </span>
                      )}
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                        {topPattern.suggestion}
                      </p>
                      <span className="text-xs text-zinc-400 shrink-0">
                        {SUGGESTION_LABEL[topPattern.suggestion_type]}
                      </span>
                    </div>
                  )}

                  {patterns.length > 1 && (
                    <Link
                      href={`/agents/${agent.id}`}
                      className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                      + {patterns.length - 1} more pattern{patterns.length > 2 ? 's' : ''} →
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                  No analysis yet — click Analyze to run the first scan.
                </p>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/app/agents/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { Agent, Insight, Pattern, SuggestionType } from '@/lib/supabase/types';
import AnalyzeButton from './AnalyzeButton';

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
};

const SUGGESTION_ICON: Record<SuggestionType, string> = {
  prompt_injection: '💬',
  tool_redesign: '🔧',
  data_provision: '🗄️',
  other: 'ℹ️',
};

const SUGGESTION_LABEL: Record<SuggestionType, string> = {
  prompt_injection: 'Add to system prompt',
  tool_redesign: 'Redesign tool',
  data_provision: 'Provide data differently',
  other: 'Review manually',
};

async function getAgent(id: string): Promise<Agent | null> {
  const { data } = await supabaseAdmin.from('agents').select('*').eq('id', id).single();
  return data as Agent | null;
}

async function getInsights(agentId: string): Promise<Insight[]> {
  const { data } = await supabaseAdmin
    .from('insights')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(10)
    .returns<Insight[]>();
  return data ?? [];
}

async function getRequestStats(agentId: string) {
  const [{ count: total }, { count: blocked }] = await Promise.all([
    supabaseAdmin.from('requests').select('id', { count: 'exact', head: true }).eq('agent_id', agentId),
    supabaseAdmin.from('requests').select('id', { count: 'exact', head: true }).eq('agent_id', agentId).eq('status', 'BLOCKED'),
  ]);
  return { total: total ?? 0, blocked: blocked ?? 0 };
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [agent, insights, stats] = await Promise.all([
    getAgent(id),
    getInsights(id),
    getRequestStats(id),
  ]);

  if (!agent) notFound();

  const latest = insights[0] ?? null;
  const previous = insights[1] ?? null;

  const recurringToolNames: string[] =
    latest && previous
      ? (latest.patterns as Pattern[])
          .map((p) => p.tool_name)
          .filter((name) => (previous.patterns as Pattern[]).some((p) => p.tool_name === name))
      : [];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-start justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              ← Alcatraz
            </Link>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mt-1">
              {agent.name}
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              v{agent.version} · {stats.total} requests · {stats.blocked} blocked
            </p>
          </div>
          <AnalyzeButton agentId={agent.id} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {!latest && (
          <p className="text-zinc-400 text-sm">
            No analysis yet — click Analyze to run the first scan.
          </p>
        )}

        {latest && (
          <>
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
                  Latest Analysis
                </h2>
                <span className="text-xs text-zinc-400">
                  {new Date(latest.created_at).toLocaleString()} · {latest.triggered_by}
                </span>
                {recurringToolNames.length > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-medium">
                    {recurringToolNames.length} recurring
                  </span>
                )}
              </div>

              {latest.summary && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {latest.summary}
                </p>
              )}

              <div className="space-y-3">
                {(latest.patterns as Pattern[]).map((pattern) => {
                  const isRecurring = recurringToolNames.includes(pattern.tool_name);
                  return (
                    <div
                      key={pattern.tool_name}
                      className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-sm font-mono font-semibold text-zinc-900 dark:text-zinc-50">
                          {pattern.tool_name}
                        </code>
                        <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5">
                          ×{pattern.blocked_count}
                        </span>
                        {pattern.severity && (
                          <span
                            className={`text-xs font-medium rounded px-1.5 py-0.5 ${SEVERITY_COLOR[pattern.severity] ?? ''}`}
                          >
                            {pattern.severity}
                          </span>
                        )}
                        {isRecurring && (
                          <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-medium">
                            Recurring
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {pattern.description}
                      </p>

                      <div className="flex items-start gap-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">
                        <span className="text-base" aria-hidden="true">
                          {SUGGESTION_ICON[pattern.suggestion_type]}
                        </span>
                        <div>
                          <p className="text-xs font-medium text-zinc-500 mb-0.5">
                            {SUGGESTION_LABEL[pattern.suggestion_type]}
                          </p>
                          <p className="text-sm text-zinc-700 dark:text-zinc-300">
                            {pattern.suggestion}
                          </p>
                        </div>
                      </div>

                      {pattern.example_payloads.length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-zinc-400 hover:text-zinc-600 select-none">
                            Example payloads ({pattern.example_payloads.length})
                          </summary>
                          <pre className="mt-2 bg-zinc-100 dark:bg-zinc-800 rounded p-2 overflow-auto text-zinc-600 dark:text-zinc-400">
                            {JSON.stringify(pattern.example_payloads, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {insights.length > 1 && (
              <section className="space-y-2">
                <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
                  History
                </h2>
                <div className="space-y-0">
                  {insights.slice(1).map((insight) => (
                    <div
                      key={insight.id}
                      className="flex items-center justify-between text-sm text-zinc-500 py-2 border-b border-zinc-100 dark:border-zinc-800"
                    >
                      <span>{new Date(insight.created_at).toLocaleString()}</span>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span>{(insight.patterns as Pattern[]).length} patterns</span>
                        <span className="capitalize">{insight.triggered_by}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Start dev server and test the full flow**

```bash
cd apps/web && npm run dev
```

Navigate to `http://localhost:3000` and verify:

1. Agent list renders with name, version, request stats
2. "Analyze" button on each agent card triggers a POST, shows "Analyzing…" spinner, then refreshes
3. After analysis, the dashboard card shows the top-severity suggestion and a "+ N more patterns →" link
4. "Recurring" amber badge appears after a second analysis run for the same agent
5. Clicking the agent name navigates to `/agents/<id>`
6. Agent detail page shows: summary paragraph, pattern cards with severity badge, description, suggestion box with icon, expandable payloads
7. "Recurring" badge appears on pattern cards that also appeared in the previous run
8. History section lists older runs below the latest analysis
9. "Re-analyze" button in the detail page header works the same as on the dashboard

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx apps/web/app/agents/
git commit -m "feat: add dashboard and agent detail page with insights panel"
git push
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `insights` table + RLS migration | 1 |
| `Pattern`, `Insight`, `SuggestionType` TypeScript types | 1 |
| `groupRequests` pure function + unit tests | 2 |
| `runAnalysis` Claude call with previous patterns | 2 |
| `fetchAndAnalyze` pipeline: fetch → group → Claude → insert | 2 |
| Analysis window: all BLOCKED since last insight, cap 1000 | 2 |
| Previous patterns passed to Claude for new/recurring distinction | 2 |
| `POST /api/analyze` CORS-restricted on-demand trigger | 3 |
| `GET /api/analyze` fetch latest + `recurring_tool_names` | 3 |
| `POST /api/analyze/cron` CRON_SECRET auth, all agents | 4 |
| `vercel.json` daily 06:00 UTC schedule | 4 |
| `AnalyzeButton` client component with loading state + `router.refresh()` | 5 |
| Dashboard agent list with stats + top insight summary | 6 |
| Dashboard "Recurring" amber badge | 6 |
| Agent detail page with summary, pattern cards, suggestion boxes | 6 |
| Severity badges per pattern | 6 |
| Suggestion type icons + labels | 6 |
| "Recurring" badge on repeated patterns | 6 |
| Expandable example payloads | 6 |
| History section (previous runs) | 6 |

**Placeholder scan:** None — every step has complete, runnable code.

**Type consistency:**
- `groupRequests(requests: Request[]): GroupedTool[]` defined in Task 2, used only internally
- `fetchAndAnalyze(agentId, agentVersion, agentName, triggeredBy)` defined in Task 2, called identically in Tasks 3 and 4
- `Pattern` type from Task 1 cast consistently as `insight.patterns as Pattern[]` in Tasks 3, 6
- `recurring_tool_names` computed identically in Task 3 (GET route) and Task 6 (server components)
- `SuggestionType` from Task 1 used as `Record<SuggestionType, string>` keys in Task 6 — all four values covered
