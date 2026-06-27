import type { AgentStat, FeedEntry } from './types';

type FetchLike = (input: string) => Promise<Response>;

type AgentsResponse = { agents?: AgentStat[] };
type RequestsResponse = { requests?: FeedEntry[] };

export async function loadDashboardSnapshot(fetchImpl: FetchLike = fetch) {
  const agentsRes = await fetchImpl('/api/agents');

  if (!agentsRes.ok) {
    throw new Error('Failed to load dashboard agents');
  }

  const agentsJson = (await agentsRes.json()) as AgentsResponse;

  // Start all stats at zero — only accumulate from the current live session
  const agentStats: AgentStat[] = (agentsJson.agents ?? []).map((agent) => ({
    ...agent,
    totalCalls: 0,
    blockedCalls: 0,
    lastActive: null,
    latestInsight: null,
  }));

  const agentNameMap = Object.fromEntries(agentStats.map((agent) => [agent.id, agent.name]));

  return { agentStats, feed: [] as FeedEntry[], agentNameMap };
}

export const loadDashboardData = loadDashboardSnapshot;

export function upsertRealtimeAgentStats(agentStats: AgentStat[], entry: FeedEntry): AgentStat[] {
  const existing = agentStats.find((agent) => agent.id === entry.agent_id);

  if (!existing) {
    return [
      {
        id: entry.agent_id,
        name: entry.agent_id,
        version: undefined,
        totalCalls: 1,
        blockedCalls: entry.status === 'BLOCKED' ? 1 : 0,
        lastActive: entry.created_at,
        latestInsight: null,
      },
      ...agentStats,
    ];
  }

  return agentStats.map((agent) => {
    if (agent.id !== entry.agent_id) {
      return agent;
    }

    return {
      ...agent,
      totalCalls: agent.totalCalls + 1,
      blockedCalls: agent.blockedCalls + (entry.status === 'BLOCKED' ? 1 : 0),
      lastActive: entry.created_at,
    };
  });
}
