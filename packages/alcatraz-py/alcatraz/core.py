import functools
import threading
from .rules import check_rules
from .logger import send_log

_config: dict = {}
_session_always_allow: set = set()
_hitl_lock = threading.Lock()


def init(api_key: str, rules: dict = None, alcatraz_url: str = None) -> None:
    """
    Initialize Alcatraz runtime protection.

    Args:
        api_key:      Your Alcatraz API key (from the dashboard).
        rules:        Security policy, e.g. {"DENY": ["bash_executor"], "ALLOW": [...]}
        alcatraz_url: Override the API base URL (default: ALCATRAZ_API_URL env var).
    """
    from .monitor import AlcatrazMonitor

    _config["api_key"] = api_key
    _config["rules"] = rules or {}
    if alcatraz_url:
        _config["alcatraz_url"] = alcatraz_url
    _config["callbacks"] = [AlcatrazMonitor(api_key=api_key, alcatraz_url=alcatraz_url)]

    _patch_langchain()
    _patch_openai()


def get_callbacks():
    """Return the list of Alcatraz callback handlers (AlcatrazMonitor instances)."""
    return _config.get("callbacks", [])


def _hitl_approve(tool_name: str, tool_input_preview: str) -> bool:
    """Human-in-the-loop approval prompt for REVIEW-listed tools."""
    if tool_name in _session_always_allow:
        print(f"\n  [ALCATRAZ REVIEW] '{tool_name}' auto-approved (session)")
        return True
    print(f"\n{'='*60}")
    print(f"  [ALCATRAZ REVIEW] Human approval required")
    print(f"  Tool:  {tool_name}")
    print(f"  Input: {tool_input_preview}")
    print(f"{'='*60}", flush=True)
    try:
        # Read from /dev/tty directly so it works even from background threads
        # (LangGraph executes tools in a ThreadPoolExecutor).
        with _hitl_lock:
            print("  Allow? [y / N / always]: ", end="", flush=True)
            try:
                with open("/dev/tty", "r") as tty:
                    response = tty.readline().strip().lower()
            except OSError:
                response = input().strip().lower()
    except (EOFError, KeyboardInterrupt):
        return False
    if response == "always":
        _session_always_allow.add(tool_name)
        return True
    return response == "y"


def _patch_langchain() -> None:
    try:
        from langchain_core.tools import BaseTool

        original_run = BaseTool.run

        @functools.wraps(original_run)
        def patched_run(self, tool_input, *args, **kwargs):
            tool_name = self.name
            decision = check_rules(tool_name, _config.get("rules", {}))
            severity = _infer_severity(tool_name)

            if decision == "DENY":
                send_log(
                    api_key=_config["api_key"],
                    tool_name=tool_name,
                    status="BLOCKED",
                    severity=severity,
                    payload={"input": str(tool_input)[:300]},
                    alcatraz_url=_config.get("alcatraz_url"),
                )
                from langchain_core.messages import ToolMessage
                return ToolMessage(
                    content=(
                        f"[ALCATRAZ BLOCKED] '{tool_name}' is denied by your "
                        "security policy. This action has been logged."
                    ),
                    tool_call_id=kwargs.get("tool_call_id", ""),
                    status="error",
                )

            elif decision == "REVIEW":
                send_log(
                    api_key=_config["api_key"],
                    tool_name=tool_name,
                    status="REVIEW",
                    severity=severity,
                    payload={"input": str(tool_input)[:300]},
                    alcatraz_url=_config.get("alcatraz_url"),
                )
                approved = _hitl_approve(tool_name, str(tool_input)[:200])
                if not approved:
                    from langchain_core.messages import ToolMessage
                    return ToolMessage(
                        content=(
                            f"[ALCATRAZ REVIEW DENIED] '{tool_name}' was not approved by operator."
                        ),
                        tool_call_id=kwargs.get("tool_call_id", ""),
                        status="error",
                    )
                # Log as allowed after human approval
                send_log(
                    api_key=_config["api_key"],
                    tool_name=tool_name,
                    status="ALLOWED",
                    severity=severity,
                    payload={"input": str(tool_input)[:300]},
                    alcatraz_url=_config.get("alcatraz_url"),
                )
                return original_run(self, tool_input, *args, **kwargs)

            else:  # ALLOW
                send_log(
                    api_key=_config["api_key"],
                    tool_name=tool_name,
                    status="ALLOWED",
                    severity=severity,
                    payload={"input": str(tool_input)[:300]},
                    alcatraz_url=_config.get("alcatraz_url"),
                )
                return original_run(self, tool_input, *args, **kwargs)

        BaseTool.run = patched_run
        print("Alcatraz: LangChain BaseTool intercepted")

    except ImportError:
        pass


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
                            name = tool_call.function.name
                            decision = check_rules(name, _config.get("rules", {}))
                            send_log(
                                api_key=_config["api_key"],
                                tool_name=name,
                                status="ALLOWED" if decision == "ALLOW" else "BLOCKED",
                                severity=_infer_severity(name),
                                alcatraz_url=_config.get("alcatraz_url"),
                            )
                            if decision == "DENY":
                                raise PermissionError(
                                    f"Alcatraz BLOCKED: '{name}' is denied."
                                )
            return response

        openai.chat.completions.create = patched_create
        print("Alcatraz: OpenAI intercepted")

    except ImportError:
        pass


def _infer_severity(tool_name: str) -> str:
    name = tool_name.lower()
    if any(p in name for p in ["bash", "shell", "exec", "system", "cmd", "command"]):
        return "critical"
    if any(p in name for p in ["env", "secret", "key", "password", "credential", "token"]):
        return "high"
    if any(p in name for p in ["http", "request", "url", "write", "delete", "remove"]):
        return "medium"
    return "low"
