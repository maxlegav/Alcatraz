"""
alcatraz.serve — local agent runner server

Exposes a minimal HTTP server so the Alcatraz dashboard can launch demo agents
without a terminal. All agent output is suppressed — events flow to the dashboard
via Supabase Realtime instead.

Usage:
    python -m alcatraz.serve          # default port 8001
    ALCATRAZ_SERVE_PORT=9000 python -m alcatraz.serve
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import datetime
import json
import os
import subprocess
import sys
import threading
from pathlib import Path

try:
    from dotenv import load_dotenv, find_dotenv
    load_dotenv(find_dotenv(".env.local", usecwd=True), override=False)
    load_dotenv(find_dotenv(".env", usecwd=True), override=False)
except ImportError:
    pass

_state: dict = {
    "run_count": 0,
    "agent_id": os.environ.get("ALCATRAZ_AGENT_ID"),
    "started_at": None,
}

_state_lock = threading.Lock()

_DEMO_ROOT = Path(__file__).parent.parent.parent.parent / "demo" / "langchain"

_DEMO_SCRIPTS = {
    "research": _DEMO_ROOT / "research_agent.py",
    "hr":       _DEMO_ROOT / "agent_protected.py",
    "devops":   _DEMO_ROOT / "devops_agent.py",
    "finance":  _DEMO_ROOT / "finance_agent.py",
    "support":  _DEMO_ROOT / "support_agent.py",
    "long":     _DEMO_ROOT / "research_agent.py",
}

# Extra env vars injected per demo type
_DEMO_EXTRA_ENV: dict[str, dict[str, str]] = {
    "long": {"ALCATRAZ_LONG_RUN": "1"},
}


class _Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send(204, {})

    def do_POST(self):
        if self.path == "/run":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length else b"{}"
            try:
                data = json.loads(body)
            except Exception:
                data = {}

            demo = data.get("demo", "research")
            script = _DEMO_SCRIPTS.get(demo, _DEMO_SCRIPTS["research"])

            with _state_lock:
                if _state["run_count"] >= 2:
                    self._send(409, {"error": "Max concurrent agents running"})
                    return
                _state["run_count"] += 1
                _state["started_at"] = datetime.datetime.utcnow().isoformat() + "Z"

            extra_env = _DEMO_EXTRA_ENV.get(demo)
            threading.Thread(target=_run_agent, args=(script, demo, extra_env), daemon=True).start()
            self._send(200, {"status": "started", "demo": demo})
        else:
            self._send(404, {"error": "Not found"})

    def do_GET(self):
        if self.path == "/status":
            with _state_lock:
                run_count = _state["run_count"]
            self._send(200, {
                "running": run_count > 0,
                "run_count": run_count,
                "agent_id": _state.get("agent_id"),
                "started_at": _state.get("started_at"),
            })
        else:
            self._send(404, {"error": "Not found"})

    def _send(self, code: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  # silence per-request logs


def _run_agent(script: Path, demo: str, extra_env: dict | None = None):
    """Run the demo agent silently — output goes to dashboard, not terminal."""
    agent_id = _state.get("agent_id") or "unknown"
    print(f"[Alcatraz] ▶  Agent started  — {agent_id} ({demo})", flush=True)
    env = {**os.environ, **(extra_env or {})}
    try:
        subprocess.run(
            [sys.executable, str(script)],
            env=env,
            capture_output=True,  # silent: all output flows to Supabase via SDK
        )
    finally:
        with _state_lock:
            _state["run_count"] = max(0, _state["run_count"] - 1)
            if _state["run_count"] == 0:
                _state["started_at"] = None
        print(f"[Alcatraz] ■  Agent finished — {agent_id} ({demo})", flush=True)


def main():
    port = int(os.environ.get("ALCATRAZ_SERVE_PORT", 8001))
    HTTPServer.allow_reuse_address = True
    server = HTTPServer(("localhost", port), _Handler)
    agent_id = _state.get("agent_id") or "not set"
    print(f"[Alcatraz] Agent server → http://localhost:{port}")
    print(f"[Alcatraz] Dashboard   → http://localhost:3000")
    print(f"[Alcatraz] Agent ID    → {agent_id}")
    print(f"[Alcatraz] Waiting for Run request from dashboard...")
    server.serve_forever()


if __name__ == "__main__":
    main()
