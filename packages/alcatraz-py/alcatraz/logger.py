import os
import requests

_DEFAULT_URL = os.environ.get("ALCATRAZ_API_URL", "http://localhost:3000")

STATUS_ICONS = {"ALLOWED": "✅", "BLOCKED": "🔴", "REVIEW": "🔍"}


def send_log(
    api_key: str,
    tool_name: str,
    status: str,
    severity: str = "low",
    payload: dict = None,
    alcatraz_url: str = None,
    agent_id: str = None,
) -> None:
    """Fire-and-forget: send a tool call event to POST /api/validate.

    If agent_id is not set the call is skipped silently (offline / demo mode).
    The server logs the request and validates it against the agent's guardrails.
    """
    base_url = alcatraz_url or _DEFAULT_URL
    icon = STATUS_ICONS.get(status, "•")
    print(f"  {icon} [ALCATRAZ] {status}: {tool_name} | severity={severity}")

    if not agent_id:
        # No agent_id → can't call /api/validate (offline/demo mode, skip silently)
        return

    try:
        requests.post(
            f"{base_url}/api/validate",
            json={
                "agent_id": agent_id,
                "tool_name": tool_name,
                "severity": severity,
                "payload": payload or {},
            },
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=2,
        )
    except Exception:
        # Never block the agent for a failed log delivery
        pass
