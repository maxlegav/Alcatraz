import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { fetchAndAnalyze } from '@/lib/analyze';
import type { Insight } from '@/lib/supabase/types';

// ── Same-origin guard ──────────────────────────────────────────────────────────
// These are internal dashboard routes — no API key, just Origin check.
// Direct server-to-server calls (no Origin header) are also allowed so the
// cron route can reuse fetchAndAnalyze without going through HTTP.
function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser call — allow (cron, server actions)
  const host = req.headers.get('host') ?? '';
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// ── Recurring detection ────────────────────────────────────────────────────────
async function recurringToolNames(agentId: string, latestId: string): Promise<string[]> {
  // Fetch the two most recent insights for this agent
  const { data } = await supabaseAdmin
    .from('insights')
    .select('id, patterns')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(2);

  if (!data || data.length < 2) return [];

  const [latest, previous] = data as { id: string; patterns: { tool_name: string }[] }[];
  if (latest.id !== latestId) return []; // safety: latest must be the one we just wrote

  const prevTools = new Set(previous.patterns.map(p => p.tool_name));
  return latest.patterns
    .map(p => p.tool_name)
    .filter(t => prevTools.has(t));
}

// ── GET /api/analyze?agent_id=<uuid> ──────────────────────────────────────────
// Returns the latest insight for an agent plus any recurring tool names.
export async function GET(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const agentId = req.nextUrl.searchParams.get('agent_id');
  if (!agentId) {
    return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
  }

  const { data: insight, error } = await supabaseAdmin
    .from('insights')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!insight) {
    return NextResponse.json({ insight: null, recurring_tool_names: [] });
  }

  const recurring = await recurringToolNames(agentId, (insight as Insight).id);
  return NextResponse.json({ insight, recurring_tool_names: recurring });
}

// ── POST /api/analyze ──────────────────────────────────────────────────────────
// Triggers an on-demand analysis run for a given agent.
// Body: { agent_id: string }
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { agent_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { agent_id } = body;
  if (!agent_id) {
    return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
  }

  // Verify agent exists
  const { data: agent, error: agentErr } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('id', agent_id)
    .maybeSingle();

  if (agentErr || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  try {
    const insight = await fetchAndAnalyze(agent_id, 'manual');
    const recurring = await recurringToolNames(agent_id, insight.id);
    return NextResponse.json({ insight, recurring_tool_names: recurring });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
