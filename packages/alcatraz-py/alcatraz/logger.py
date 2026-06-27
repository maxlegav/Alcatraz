import os
import requests

_DEFAULT_URL = os.environ.get("ALCATRAZ_API_URL", "http://localhost:3000")

STATUS_ICONS = {"ALLOWED": "✅", "BLOCKED": "🔴"}


def send_log(
    api_key: str,
    tool_name: str,
    status: str,
    severity: str = "low",
    payload: dict = None,
    alcatraz_url: str = None,
) -> None:
    """Send a tool call event to the Alcatraz API (fire-and-forget)."""
    base_url = alcatraz_url or _DEFAULT_URL
    icon = STATUS_ICONS.get(status, "•")
    print(f"  {icon} [ALCATRAZ] {status}: {tool_name} | severity={severity}")

    try:
        requests.post(
            f"{base_url}/api/log",
            json={
                "tool_name": tool_name,
                "status": status,
                "severity": severity,
                "payload": payload or {},
            },
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=2,
        )
    except Exception:
        # Never block the agent for a failed log delivery
        pass
