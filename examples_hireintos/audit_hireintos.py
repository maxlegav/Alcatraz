#!/usr/bin/env python3
"""CLI-only Alcatraz campaign for HireIntOS.

What this script does:
1) Registers or reuses an Alcatraz agent id
2) Runs red-team scans on HireIntOS agent source files
3) Pushes findings and guardrails to Alcatraz via API
4) Triggers Alcatraz analysis
5) Fetches JSON outputs (requests, findings, guardrails, insights)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = Path(__file__).resolve().parents[1]
ALCATRAZ_PY = ROOT / "packages" / "alcatraz-py"

if str(ALCATRAZ_PY) not in sys.path:
    sys.path.insert(0, str(ALCATRAZ_PY))

try:
    from alcatraz import scan as alcatraz_scan
except Exception as exc:  # pragma: no cover - runtime import guard
    raise SystemExit(
        "Cannot import alcatraz package. Install it with: "
        "pip install -e /Users/celialecat/Desktop/Cesure/hackathon_cyber/Alcatraz/packages/alcatraz-py"
    ) from exc


def http_json(
    method: str,
    base_url: str,
    path: str,
    body: Dict[str, Any] | None = None,
    bearer: str | None = None,
    timeout: float = 20.0,
) -> Dict[str, Any]:
    url = f"{base_url.rstrip('/')}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json"}
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"

    req = Request(url=url, data=data, headers=headers, method=method.upper())
    try:
        with urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except HTTPError as exc:
        raw = exc.read().decode("utf-8") if hasattr(exc, "read") else ""
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"error": raw or str(exc)}
        raise RuntimeError(f"{method} {path} failed ({exc.code}): {payload}") from exc
    except URLError as exc:
        raise RuntimeError(f"{method} {path} failed: {exc}") from exc


def agent_source_files() -> List[Path]:
    return [
        BACKEND_DIR / "app" / "agents" / "hr_agent.py",
        BACKEND_DIR / "app" / "agents" / "manager_agent.py",
        BACKEND_DIR / "app" / "agents" / "technical_agent.py",
        BACKEND_DIR / "app" / "agents" / "coding_agent.py",
        BACKEND_DIR / "app" / "agents" / "tools.py",
        BACKEND_DIR / "app" / "routes" / "interview.py",
    ]


def ensure_agent_id(base_url: str, api_key: str, agent_name: str, preset_id: str | None) -> str:
    if preset_id:
        return preset_id

    listing = http_json("GET", base_url, "/api/agents")
    for item in listing.get("agents", []):
        if item.get("name") == agent_name and item.get("id"):
            return str(item["id"])

    created = http_json(
        "POST",
        base_url,
        "/api/agents",
        body={"name": agent_name},
        bearer=api_key,
    )
    return str(created["agent"]["id"])


def aggregate_rules(scan_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    deny: set[str] = set()
    allow: set[str] = set()
    max_calls: List[int] = []

    for result in scan_results:
        rules = result.get("rules") or {}
        for item in rules.get("DENY", []):
            if isinstance(item, str) and item.strip():
                deny.add(item.strip())
        for item in rules.get("ALLOW", []):
            if isinstance(item, str) and item.strip():
                allow.add(item.strip())
        m = rules.get("MAX_CALLS_PER_MIN")
        if isinstance(m, int) and m > 0:
            max_calls.append(m)

    return {
        "deny_patterns": sorted(deny),
        "allow_patterns": sorted(allow),
        "max_calls_per_min": min(max_calls) if max_calls else 10,
    }


def normalize_vulns(file_path: Path, scan_result: Dict[str, Any]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for vuln in scan_result.get("vulnerabilities", []) or []:
        normalized.append(
            {
                "severity": vuln.get("severity", "medium"),
                "type": vuln.get("type", "Unknown vulnerability"),
                "description": vuln.get("description", "No description provided"),
                "location": f"{file_path.name}: {vuln.get('location', 'unknown')}",
                "fix": vuln.get("fix", "No fix provided"),
            }
        )
    return normalized


def run_campaign(base_url: str, api_key: str, anthropic_api_key: str, agent_name: str, agent_id: str | None) -> Dict[str, Any]:
    resolved_agent_id = ensure_agent_id(base_url, api_key, agent_name, agent_id)

    files = agent_source_files()
    for f in files:
        if not f.exists():
            raise RuntimeError(f"Required file not found: {f}")

    scans: List[Dict[str, Any]] = []
    raw_scan_results: List[Dict[str, Any]] = []
    findings: List[Dict[str, Any]] = []

    for file_path in files:
        result = alcatraz_scan(str(file_path), anthropic_api_key=anthropic_api_key)
        raw_scan_results.append(result)
        scans.append(
            {
                "file": str(file_path.relative_to(ROOT)),
                "risk_score": result.get("risk_score", 0),
                "vulnerability_count": len(result.get("vulnerabilities", []) or []),
            }
        )
        findings.extend(normalize_vulns(file_path, result))

    highest_risk = max((int(item.get("risk_score", 0)) for item in scans), default=0)
    summary = (
        f"Automated red-team campaign completed on {len(files)} files. "
        f"Highest risk score: {highest_risk}/100."
    )

    findings_response = http_json(
        "POST",
        base_url,
        "/api/findings",
        body={
            "agent_id": resolved_agent_id,
            "summary": summary,
            "vulnerabilities": findings,
        },
        bearer=api_key,
    )

    guardrails_payload = aggregate_rules(raw_scan_results)
    guardrails_response = http_json(
        "POST",
        base_url,
        "/api/guardrails",
        body={"agent_id": resolved_agent_id, **guardrails_payload},
        bearer=api_key,
    )

    analyze_post = http_json(
        "POST",
        base_url,
        "/api/analyze",
        body={"agent_id": resolved_agent_id},
    )

    analyze_get = http_json(
        "GET",
        base_url,
        f"/api/analyze?agent_id={resolved_agent_id}",
    )
    requests_get = http_json(
        "GET",
        base_url,
        f"/api/requests?agent_id={resolved_agent_id}&limit=200",
    )
    findings_get = http_json(
        "GET",
        base_url,
        f"/api/findings?agent_id={resolved_agent_id}",
    )
    guardrails_get = http_json(
        "GET",
        base_url,
        f"/api/guardrails?agent_id={resolved_agent_id}",
    )

    return {
        "agent_id": resolved_agent_id,
        "scan_summary": scans,
        "findings_upsert": findings_response,
        "guardrails_upsert": guardrails_response,
        "analyze_post": analyze_post,
        "analyze_latest": analyze_get,
        "requests": requests_get,
        "findings": findings_get,
        "guardrails": guardrails_get,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Alcatraz CLI campaign against HireIntOS")
    parser.add_argument("--base-url", default=os.getenv("ALCATRAZ_URL", "http://localhost:3000"))
    parser.add_argument("--api-key", default=os.getenv("ALCATRAZ_API_KEY"))
    parser.add_argument("--anthropic-api-key", default=os.getenv("ANTHROPIC_API_KEY"))
    parser.add_argument("--agent-name", default=os.getenv("ALCATRAZ_AGENT_NAME", "HireIntOS ADK Agents"))
    parser.add_argument("--agent-id", default=os.getenv("ALCATRAZ_AGENT_ID"))
    parser.add_argument("--output", default="alcatraz_campaign_report.json")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not args.api_key:
        raise SystemExit("Missing Alcatraz API key. Set --api-key or ALCATRAZ_API_KEY.")
    if not args.anthropic_api_key:
        raise SystemExit("Missing Anthropic API key. Set --anthropic-api-key or ANTHROPIC_API_KEY.")

    result = run_campaign(
        base_url=args.base_url,
        api_key=args.api_key,
        anthropic_api_key=args.anthropic_api_key,
        agent_name=args.agent_name,
        agent_id=args.agent_id,
    )

    output_path = Path(args.output)
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"\nSaved report to {output_path}")
    print(f"Use this agent id in HireIntOS backend env: ALCATRAZ_AGENT_ID={result['agent_id']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
