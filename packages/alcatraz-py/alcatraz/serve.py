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
    "running": False,
    "agent_id": os.environ.get("ALCATRAZ_AGENT_ID"),
    "started_at": None,
}

# Resolve demo script path relative to this file
_DEMO_SCRIPT = (
    Path(__file__).parent.parent.parent.parent / "demo" / "langchain" / "research_agent.py"
)


class _Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send(204, {})

    def do_POST(self):
        if self.path == "/run":
            if _state["running"]:
                self._send(409, {"error": "Agent already running"})
                return
            _state["running"] = True
            _state["started_at"] = datetime.datetime.utcnow().isoformat() + "Z"
            threading.Thread(target=_run_agent, daemon=True).start()
            self._send(200, {"status": "started"})
        else:
            self._send(404, {"error": "Not found"})

    def do_GET(self):
        if self.path == "/status":
            self._send(200, {
                "running": _state["running"],
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


def _run_agent():
    """Run the demo agent silently — output goes to dashboard, not terminal."""
    agent_id = _state.get("agent_id") or "unknown"
    print(f"[Alcatraz] ▶  Agent started  — {agent_id}", flush=True)
    try:
        subprocess.run(
            [sys.executable, str(_DEMO_SCRIPT)],
            env={**os.environ},
            capture_output=True,  # silent: all output flows to Supabase via SDK
        )
    finally:
        _state["running"] = False
        _state["started_at"] = None
        print(f"[Alcatraz] ■  Agent finished — {agent_id}", flush=True)


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
