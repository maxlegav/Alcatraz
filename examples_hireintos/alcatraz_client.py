"""Minimal Alcatraz API client used by HireIntOS runtime instrumentation."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


@dataclass
class AlcatrazClient:
    """HTTP client for Alcatraz validate endpoint.

    The client is intentionally no-op when env vars are missing so local
    development can run without Alcatraz.
    """

    base_url: str
    api_key: str
    agent_id: str
    timeout_seconds: float = 2.0

    @property
    def enabled(self) -> bool:
        return bool(self.base_url and self.api_key and self.agent_id)

    @classmethod
    def from_env(cls) -> "AlcatrazClient":
        return cls(
            base_url=os.getenv("ALCATRAZ_URL", "http://localhost:3000").rstrip("/"),
            api_key=os.getenv("ALCATRAZ_API_KEY", ""),
            agent_id=os.getenv("ALCATRAZ_AGENT_ID", ""),
            timeout_seconds=float(os.getenv("ALCATRAZ_TIMEOUT_SECONDS", "2.0")),
        )

    def validate_tool_call(
        self,
        tool_name: str,
        severity: str = "medium",
        payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """POST a tool call event to /api/validate.

        Returns the parsed JSON response, or a synthetic ALLOWED response when
        Alcatraz is disabled/unreachable. Runtime calls should never crash if
        logging fails.
        """
        if not self.enabled:
            return {"status": "ALLOWED", "reason": "alcatraz-disabled"}

        body = {
            "agent_id": self.agent_id,
            "tool_name": tool_name,
            "severity": severity,
            "payload": payload or {},
        }

        try:
            return self._post_json("/api/validate", body)
        except Exception:
            return {"status": "ALLOWED", "reason": "alcatraz-unreachable"}

    def _post_json(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        data = json.dumps(body).encode("utf-8")
        req = Request(
            url=f"{self.base_url}{path}",
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )

        try:
            with urlopen(req, timeout=self.timeout_seconds) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except HTTPError as exc:
            raw = exc.read().decode("utf-8") if hasattr(exc, "read") else ""
            try:
                parsed = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                parsed = {}
            return {
                "status": "BLOCKED",
                "reason": parsed.get("error") or f"http-{exc.code}",
            }
        except URLError:
            raise
