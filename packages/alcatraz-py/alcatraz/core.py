import functools
import threading
import time
from .rules import check_rules
from .logger import send_log

_config: dict = {}
_hitl_lock = threading.Lock()


def init(
    api_key: str,
    rules: dict = None,
    alcatraz_url: str = None,
    agent_id: str = None,
    verbose: bool = False,
) -> None:
    """
    Initialize Alcatraz runtime protection.

    Args:
        api_key:      Your Alcatraz API key (from the dashboard / api_keys table).
        rules:        Local security policy e.g. {"DENY": ["bash_executor"], "ALLOW": [...]}
        alcatraz_url: Override the API base URL (default: ALCATRAZ_API_URL env var).
        agent_id:     Agent UUID from the dashboard. Required to send logs and use
                      dashboard HITL. If omitted, falls back to terminal HITL.
        verbose:      Print per-tool events to stdout (default False — use dashboard).
    """
    from .monitor import AlcatrazMonitor

    _config["api_key"] = api_key
    _config["rules"] = rules or {}
    _config["agent_id"] = agent_id
    _config["verbose"] = verbose
    if alcatraz_url:
        _config["alcatraz_url"] = alcatraz_url
    _config["callbacks"] = [AlcatrazMonitor(
        api_key=api_key,
        alcatraz_url=alcatraz_url,
        agent_id=agent_id,
        verbose=verbose,
    )]

    _patch_langchain()
    _patch_openai()


def get_callbacks():
    """Return the list of Alcatraz callback handlers (AlcatrazMonitor instances)."""
    return _config.get("callbacks", [])


# ── HITL ─────────────────────────────────────────────────────────────────────

def _hitl_approve(tool_name: str, tool_input_preview: str) -> bool:
    """
    Human-in-the-loop approval.

    If dashboard is connected (agent_id set) → create pending HITL request,
    poll for operator decision every 2s (max 2 min).
    Otherwise → fall back to terminal prompt.
    """
    agent_id = _config.get("agent_id")
    api_key = _config.get("api_key", "")
    alcatraz_url = _config.get("alcatraz_url", "http://localhost:3000")

    if agent_id and api_key and api_key != "demo-key":
        return _hitl_dashboard(tool_name, tool_input_preview, agent_id, api_key, alcatraz_url)
    return _hitl_terminal(tool_name, tool_input_preview)


def _hitl_dashboard(
    tool_name: str,
    tool_input_preview: str,
    agent_id: str,
    api_key: str,
    alcatraz_url: str,
) -> bool:
    """Create a pending HITL request in the dashboard and poll for decision."""
    import requests as http

    try:
        resp = http.post(
            f"{alcatraz_url}/api/hitl",
            json={"agent_id": agent_id, "tool_name": tool_name, "tool_input": tool_input_preview},
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=5,
        )
        hitl_id = resp.json()["id"]
    except Exception:
        # Can't reach dashboard → fall back to terminal
        return _hitl_terminal(tool_name, tool_input_preview)

    # Poll every 2s, max 2 minutes
    for _ in range(60):
        time.sleep(2)
        try:
            poll = http.get(
                f"{alcatraz_url}/api/hitl/{hitl_id}",
                timeout=5,
            )
            status = poll.json().get("status")
            if status == "approved":
                return True
            if status == "denied":
                return False
        except Exception:
            pass

    return False  # timeout → deny


def _hitl_terminal(tool_name: str, tool_input_preview: str) -> bool:
    """Fallback HITL via /dev/tty when dashboard is not connected."""
    with _hitl_lock:
        try:
            tty = open("/dev/tty", "r+")
        except OSError:
            tty = None

        def _w(msg: str):
            if tty:
                tty.write(msg); tty.flush()
            else:
                print(msg, end="", flush=True)

        _w(f"\n{'─'*60}\n")
        _w(f"  🔍 [ALCATRAZ REVIEW] Approval required\n")
        _w(f"  Tool:  {tool_name}\n")
        _w(f"  Input: {tool_input_preview}\n")
        _w(f"{'─'*60}\n")
        _w("  Allow? [y / N]: ")

        try:
            response = (tty.readline() if tty else input()).strip().lower()
        except (EOFError, KeyboardInterrupt):
            response = "n"
        finally:
            if tty:
                tty.close()

    return response == "y"


# ── LangChain patch ───────────────────────────────────────────────────────────

def _patch_langchain() -> None:
    try:
        from langchain_core.tools import BaseTool

        original_run = BaseTool.run

        @functools.wraps(original_run)
        def patched_run(self, tool_input, *args, **kwargs):
            tool_name = self.name
            decision  = check_rules(tool_name, _config.get("rules", {}))
            severity  = _infer_severity(tool_name)
            verbose   = _config.get("verbose", False)

            if decision == "DENY":
                if verbose:
                    print(f"  🔴 [ALCATRAZ] BLOCKED: {tool_name}")
                send_log(
                    api_key=_config["api_key"], tool_name=tool_name,
                    status="BLOCKED", severity=severity,
                    payload={"input": str(tool_input)[:300]},
                    alcatraz_url=_config.get("alcatraz_url"),
                    agent_id=_config.get("agent_id"),
                )
                from langchain_core.messages import ToolMessage
                return ToolMessage(
                    content=f"[ALCATRAZ BLOCKED] '{tool_name}' is denied by your security policy.",
                    tool_call_id=kwargs.get("tool_call_id", ""),
                    status="error",
                )

            elif decision == "REVIEW":
                send_log(
                    api_key=_config["api_key"], tool_name=tool_name,
                    status="BLOCKED", severity=severity,
                    payload={"input": str(tool_input)[:300], "hitl": "pending"},
                    alcatraz_url=_config.get("alcatraz_url"),
                    agent_id=_config.get("agent_id"),
                )
                approved = _hitl_approve(tool_name, str(tool_input)[:300])
                if not approved:
                    if verbose:
                        print(f"  🔴 [ALCATRAZ] REVIEW DENIED: {tool_name}")
                    from langchain_core.messages import ToolMessage
                    return ToolMessage(
                        content=f"[ALCATRAZ REVIEW DENIED] '{tool_name}' was not approved.",
                        tool_call_id=kwargs.get("tool_call_id", ""),
                        status="error",
                    )
                if verbose:
                    print(f"  ✅ [ALCATRAZ] REVIEW APPROVED: {tool_name}")
                send_log(
                    api_key=_config["api_key"], tool_name=tool_name,
                    status="ALLOWED", severity=severity,
                    payload={"input": str(tool_input)[:300], "hitl": "approved"},
                    alcatraz_url=_config.get("alcatraz_url"),
                    agent_id=_config.get("agent_id"),
                )
                return original_run(self, tool_input, *args, **kwargs)

            else:  # ALLOW
                if verbose:
                    print(f"  ✅ [ALCATRAZ] ALLOWED: {tool_name}")
                send_log(
                    api_key=_config["api_key"], tool_name=tool_name,
                    status="ALLOWED", severity=severity,
                    payload={"input": str(tool_input)[:300]},
                    alcatraz_url=_config.get("alcatraz_url"),
                    agent_id=_config.get("agent_id"),
                )
                return original_run(self, tool_input, *args, **kwargs)

        BaseTool.run = patched_run

    except ImportError:
        pass


# ── OpenAI patch ──────────────────────────────────────────────────────────────

def _patch_openai() -> None:
    try:
        import openai

        original_create = openai.chat.completions.create

        @functools.wraps(original_create)
        def patched_create(*args, **kwargs):
            response = original_create(*args, **kwargs)
            if hasattr(response, "choices"):
                for choice in response.choices:
                    tc = getattr(choice.message, "tool_calls", None)
                    if tc:
                        for tool_call in tc:
                            name     = tool_call.function.name
                            decision = check_rules(name, _config.get("rules", {}))
                            send_log(
                                api_key=_config["api_key"],
                                tool_name=name,
                                status="ALLOWED" if decision == "ALLOW" else "BLOCKED",
                                severity=_infer_severity(name),
                                alcatraz_url=_config.get("alcatraz_url"),
                                agent_id=_config.get("agent_id"),
                            )
                            if decision == "DENY":
                                raise PermissionError(f"Alcatraz BLOCKED: '{name}' is denied.")
            return response

        openai.chat.completions.create = patched_create

    except ImportError:
        pass


def _infer_severity(tool_name: str) -> str:
    name = tool_name.lower()
    if any(p in name for p in ["bash", "shell", "exec", "system", "cmd", "command"]):
        return "critical"
    if any(p in name for p in ["env", "secret", "key", "password", "credential", "token"]):
        return "high"
    if any(p in name for p in ["http", "request", "url", "write", "delete", "remove", "send", "report"]):
        return "medium"
    return "low"
