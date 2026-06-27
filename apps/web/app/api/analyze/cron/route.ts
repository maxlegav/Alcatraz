import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { fetchAndAnalyze } from '@/lib/analyze';

// ── POST /api/analyze/cron ─────────────────────────────────────────────────────
// Triggered daily by Vercel Cron. Protected by CRON_SECRET bearer token.
// Iterates all agents and runs a scheduled analysis for each.
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: agents, error } = await supabaseAdmin
    .from('agents')
    .select('id, name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { agent_id: string; status: 'ok' | 'error'; message?: string }[] = [];

  for (const agent of agents ?? []) {
    try {
      await fetchAndAnalyze(agent.id, 'scheduled');
      results.push({ agent_id: agent.id, status: 'ok' });
    } catch (err) {
      results.push({
        agent_id: agent.id,
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ results });
}
