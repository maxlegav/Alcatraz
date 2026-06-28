# alcatraz

AI Agent Security Layer — intercept, log, and block dangerous tool calls in real time.

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

That's it. Alcatraz automatically patches LangChain and OpenAI tool calls.

## Options

```python
alcatraz.init(
    api_key="your-key",           # from the Alcatraz dashboard
    rules={
        "DENY":  ["bash_executor", "env_reader"],   # always block
        "ALLOW": ["file_reader", "http_request"],   # always allow
    },
    agent_id="uuid-from-dashboard",  # enables dashboard logging + HITL
    verbose=True,                    # print allow/block to stdout
)
```

## How it works

- `DENY` list → tool call is blocked before execution, logged as BLOCKED
- `ALLOW` list → tool call passes through, logged as ALLOWED
- Everything else → allowed by default (add to DENY to restrict)
- `REVIEW` rules → pauses for human approval (terminal prompt or dashboard HITL)
