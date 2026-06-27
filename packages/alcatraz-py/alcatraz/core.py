import functools
from .rules import check_rules
from .logger import send_log

_config: dict = {}


def init(api_key: str, rules: dict = None, alcatraz_url: str = None) -> None:
    """
    Initialize Alcatraz runtime protection.

    Args:
        api_key:      Your Alcatraz API key (from the dashboard).
        rules:        Security policy, e.g. {"DENY": ["bash_executor"], "ALLOW": [...]}
        alcatraz_url: Override the API base URL (default: ALCATRAZ_API_URL env var).
    """
    _config["api_key"] = api_key
    _config["rules"] = rules or {}
    if alcatraz_url:
        _config["alcatraz_url"] = alcatraz_url

    _patch_langchain()
    _patch_openai()


def _patch_langchain() -> None:
    try:
        from langchain_core.tools import BaseTool

        original_run = BaseTool.run

        @functools.wraps(original_run)
        def patched_run(self, tool_input, *args, **kwargs):
            tool_name = self.name
            allowed = check_rules(tool_name, _config.get("rules", {}))
            severity = _infer_severity(tool_name)

            send_log(
                api_key=_config["api_key"],
                tool_name=tool_name,
                status="ALLOWED" if allowed else "BLOCKED",
                severity=severity,
                payload={"input": str(tool_input)[:300]},
                alcatraz_url=_config.get("alcatraz_url"),
            )

            if not allowed:
                # Soft block: return an error string so the LLM sees the block
                # and the agent keeps running (other tools still work).
                return (
                    f"[ALCATRAZ BLOCKED] '{tool_name}' is denied by your security policy. "
                    "This action has been logged."
                )

            return original_run(self, tool_input, *args, **kwargs)

        BaseTool.run = patched_run
        print("✅ Alcatraz: LangChain BaseTool intercepted")

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
                            allowed = check_rules(name, _config.get("rules", {}))
                            send_log(
                                api_key=_config["api_key"],
                                tool_name=name,
                                status="ALLOWED" if allowed else "BLOCKED",
                                severity=_infer_severity(name),
                                alcatraz_url=_config.get("alcatraz_url"),
                            )
                            if not allowed:
                                raise PermissionError(
                                    f"🔴 Alcatraz BLOCKED: '{name}' is denied."
                                )
            return response

        openai.chat.completions.create = patched_create
        print("✅ Alcatraz: OpenAI intercepted")

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
