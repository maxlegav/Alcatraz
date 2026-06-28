# alcatraz-py

Python SDK for the Alcatraz AI Agent Security Layer.

Intercepts tool calls from LangChain and OpenAI agents, enforces a DENY/ALLOW/REVIEW policy, and streams every event to the Alcatraz dashboard in real time.

## Install

```bash
pip install git+https://github.com/maxlegav/Alcatraz.git#subdirectory=packages/alcatraz-py
```

## Usage

Add two lines before your agent code:

```python
import alcatraz
alcatraz.init(api_key="your-key")
```

That's it. Alcatraz monkey-patches `LangChain BaseTool.run` and `openai.chat.completions.create` — no changes to your agent logic.

## Full options

```python
alcatraz.init(
    api_key="your-key",               # from the Alcatraz dashboard
    agent_id="uuid-from-dashboard",   # enables dashboard logging + HITL (recommended)
    alcatraz_url="https://...",        # defaults to ALCATRAZ_API_URL env var or localhost:3000
    rules={
        "DENY":   ["bash_executor", "env_reader"],   # always block
        "ALLOW":  ["file_reader", "http_request"],   # always allow
        "REVIEW": ["send_email"],                    # require human approval
    },
    verbose=True,                     # print allow/block decisions to stdout
)
```

## How decisions are made

| Rule | What happens |
|---|---|
| `DENY` | Tool call is intercepted and never executed. Logged as BLOCKED. |
| `ALLOW` | Tool call runs normally. Logged as ALLOWED. |
| `REVIEW` | Agent pauses. Dashboard shows an approval card. Operator approves or denies. Agent resumes or is blocked. |
| _(unlisted)_ | Defaults to ALLOW. |

## What gets monitored

Beyond tool call interception, the `AlcatrazMonitor` LangChain callback handler also watches:

- **LLM inputs** — scans messages sent to the model for prompt injection patterns (`ignore all previous instructions`, `you are now`, etc.)
- **LLM outputs** — scans model responses for credential leaks (API keys, AWS access keys, passwords)
- **Tool outputs** — scans tool results for prompt injection and secrets before they re-enter the agent loop

Security events are logged to the dashboard as `prompt_injection` or `sensitive_data_leak` with `critical` / `high` severity.

## Human-in-the-loop (HITL)

When a `REVIEW` rule fires:

1. The SDK posts the pending request to `/api/hitl`
2. The dashboard shows an approval card with the tool name and input preview
3. The SDK polls `/api/hitl/:id` every 2 seconds (up to 2 minutes)
4. If approved — the tool runs and is logged as ALLOWED
5. If denied or timed out — the tool is blocked and logged as BLOCKED

Without `agent_id`, HITL falls back to an interactive terminal prompt.

## Red team scanner (CLI)

Scan agent source code for vulnerabilities before deploying:

```bash
# Single file
alcatraz scan path/to/agent.py

# Whole project (auto-discovers agent files)
alcatraz scan .

# Save report to JSON
alcatraz scan . --output report.json

# Raw JSON only (for CI pipelines)
alcatraz scan agent.py --json
```

The scanner uses `claude-sonnet-4-6` to analyze your code and returns:

- CVSS v3.1 scores and vectors
- CWE identifiers (e.g. CWE-78 OS Command Injection)
- OWASP LLM Top 10 (2025) categories
- A generated `DENY`/`ALLOW` policy ready to paste into `alcatraz.init()`

Set `ANTHROPIC_API_KEY` in your environment or pass `--api-key`.

## Requirements

- Python 3.9+
- `requests`, `click`, `rich`, `anthropic`
- Optional: `langchain-core>=0.3.0` for LangChain integration

## Example

See `demo/langchain/agent_protected.py` in the repo — the same agent as `agent_vulnerable.py` with three lines added at the top.
