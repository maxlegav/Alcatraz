import { NextResponse } from "next/server";

const AGENT_SERVER = process.env.AGENT_SERVER_URL ?? "http://localhost:8001";

/**
 * POST /api/run
 * Proxies to the local Python agent server (alcatraz.serve on port 8001).
 * Starts the research agent demo in the background — all output goes to dashboard.
 */
export async function POST() {
  try {
    const res = await fetch(`${AGENT_SERVER}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // short timeout — the server responds immediately, agent runs in background
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : 409 });
  } catch {
    return NextResponse.json(
      {
        error: "Agent server offline",
        hint: "Run: python -m alcatraz.serve",
      },
      { status: 503 }
    );
  }
}

/**
 * GET /api/run
 * Returns whether the agent server is online and if an agent is currently running.
 */
export async function GET() {
  try {
    const res = await fetch(`${AGENT_SERVER}/status`, {
      signal: AbortSignal.timeout(2000),
    });
    const data = await res.json();
    return NextResponse.json({ online: true, ...data });
  } catch {
    return NextResponse.json({ online: false, running: false });
  }
}
