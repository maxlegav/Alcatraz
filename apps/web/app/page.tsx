import { supabaseAdmin } from '@/lib/supabase/server';
import DashboardClient from './_components/DashboardClient';
import type { AgentStat, FeedEntry } from './_components/types';

// Always fetch fresh data — this page is a live dashboard
export const dynamic = 'force-dynamic';

async function getServerData(): Promise<{
  agentStats: AgentStat[];
  agentNameMap: Record<string, string>;
  initialFeed: FeedEntry[];
}> {
  const [agentsRes, statsRes, feedRes] = await Promise.all([
    supabaseAdmin.from('agents').select('id, name').order('name'),
    // Fetch all rows for accurate aggregate stats (payload not needed here)
    supabaseAdmin.from('requests').select('agent_id, status, created_at'),
    // Fetch last 50 rows with full fields for the live feed
    supabaseAdmin
      .from('requests')
      .select('id, agent_id, tool_name, status, severity, payload, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const agents = agentsRes.data ?? [];
  const allStats = statsRes.data ?? [];
  const initialFeed = (feedRes.data ?? []) as FeedEntry[];

  const agentNameMap = Object.fromEntries(agents.map(a => [a.id, a.name]));

  const agentStats: AgentStat[] = agents.map(agent => {
    const agentReqs = allStats.filter(r => r.agent_id === agent.id);
    const lastActive = agentReqs.reduce<string | null>((max, r) =>
      !max || r.created_at > max ? r.created_at : max, null
    );
    return {
      id: agent.id,
      name: agent.name,
      totalCalls: agentReqs.length,
      blockedCalls: agentReqs.filter(r => r.status === 'BLOCKED').length,
      lastActive,
    };
  });

  return { agentStats, agentNameMap, initialFeed };
}

export default async function Page() {
  const data = await getServerData();
  return <DashboardClient {...data} />;
}
