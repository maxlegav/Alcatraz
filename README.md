# Alcatraz — AI Agent Security Layer

Alcatraz intercepts, logs, and blocks dangerous tool calls from AI agents in real time — before they execute.

AI agents can call tools like `bash_executor`, `env_reader`, or `http_request`. Without guardrails, a compromised or misbehaving agent can exfiltrate secrets, run arbitrary commands, or cause real damage. Alcatraz sits between your agent and its tools and enforces a security policy you define.

---

## What it does

- **Blocks** tool calls that match your DENY list — the tool never runs
- **Allows** tool calls that match your ALLOW list — logged and passed through
- **Reviews** tool calls that need human approval — pauses the agent, presents the call in the dashboard or terminal, waits for an operator decision
- **Monitors** LLM inputs and outputs for prompt injection and credential leaks
- **Scans** your agent source code for vulnerabilities before you deploy (CVSS scores, CWE IDs, OWASP LLM Top 10)
- **Streams** every event to a real-time dashboard — live feed, KPI cards, per-agent history

---

## Architecture

```
Python agent
    │
    ▼
alcatraz.init()          ← monkey-patches LangChain BaseTool.run + OpenAI completions
    │
    ├── check_rules()    ← DENY / ALLOW / REVIEW decision
    ├── AlcatrazMonitor  ← LangChain callback: monitors LLM input/output for injection & secrets
    │
    ├── BLOCKED ────────► send_log() ──► POST /api/log ──► Supabase `requests` table
    ├── ALLOWED ────────► send_log() ──► POST /api/log ──► Supabase `requests` table
    └── REVIEW  ────────► POST /api/hitl ──► dashboard HITL panel ──► operator approves/denies
                                                          │
                                          poll /api/hitl/:id every 2s
```

```
alcatraz/
├── packages/alcatraz-py/       Python SDK (pip installable)
│   └── alcatraz/
│       ├── core.py             init(), monkey patches (LangChain + OpenAI), HITL logic
│       ├── monitor.py          LangChain callback handler — prompt injection + secret detection
│       ├── rules.py            DENY / ALLOW / REVIEW rule matching
│       ├── logger.py           HTTP log sender → /api/log
│       ├── redteam.py          Claude-powered static vulnerability scanner
│       ├── finder.py           Agent file discovery for project-wide scans
│       ├── serve.py            Local agent runner server
│       └── cli.py              `alcatraz scan` CLI command
│
├── apps/web/                   Next.js dashboard (UI + API)
│   └── app/
│       ├── page.tsx            Landing page
│       ├── dashboard/          Real-time event feed, KPI cards, HITL panel, guardrails
│       ├── agents/[id]/        Per-agent history, vulnerability analysis
│       ├── onboarding/         Step-by-step setup wizard
│       ├── report/             Red team scan report viewer
│       └── api/
│           ├── log/            POST — receives tool call events from the SDK
│           ├── requests/       GET  — filtered event query for the dashboard
│           ├── hitl/           POST/GET — human-in-the-loop request lifecycle
│           ├── agents/         CRUD for registered agents
│           ├── guardrails/     DENY/ALLOW/REVIEW rule management
│           ├── redteam/        Trigger Claude vulnerability scan
│           └── analyze/        AI-generated insight summaries
│
├── supabase/migrations/        SQL schema
└── demo/langchain/             Example agents (protected vs unprotected)
```

**Stack:** Next.js · React · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Realtime) · Anthropic SDK

---

## Quick start

### 1. Dashboard

```bash
git clone https://github.com/maxlegav/Alcatraz
cd Alcatraz/apps/web
cp .env.example .env.local   # fill in Supabase + Anthropic keys
npm install
npm run dev                  # http://localhost:3000
```

Environment variables:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

### 2. Python SDK

```bash
pip install git+https://github.com/maxlegav/Alcatraz.git#subdirectory=packages/alcatraz-py
```

Add two lines to your agent:

```python
import alcatraz
alcatraz.init(api_key="your-alcatraz-key")
```

### 3. Run the demo

```bash
cd demo/langchain
python agent_vulnerable.py   # runs without protection
python agent_protected.py    # same agent, blocked by Alcatraz
```

---

## How protection works

```python
alcatraz.init(
    api_key="your-key",
    agent_id="uuid-from-dashboard",   # enables dashboard logging + HITL
    rules={
        "DENY":  ["bash_executor", "env_reader"],   # always block, never execute
        "ALLOW": ["file_reader", "http_request"],   # always allow, log and pass through
        "REVIEW": ["send_email"],                   # pause and wait for human approval
    },
    verbose=True,
)
```

- `DENY` — the tool call is intercepted, never executed, logged as BLOCKED
- `ALLOW` — the tool call runs normally, logged as ALLOWED
- `REVIEW` — the agent pauses; the dashboard shows a pending approval card; operator clicks Approve or Deny; agent resumes or is blocked
- Everything not listed defaults to ALLOW

---

## Red team scanner

Scan any agent file or project directory for vulnerabilities before deploying:

```bash
alcatraz scan path/to/agent.py
alcatraz scan .                    # whole project
alcatraz scan . --output report.json
```

The scanner uses Claude to analyze your code and returns:

- CVSS v3.1 scores and vectors
- CWE identifiers
- OWASP LLM Top 10 (2025) categories
- A generated security policy (`DENY`/`ALLOW` rules) ready to paste into `alcatraz.init()`
