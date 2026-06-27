import type { AgentStat, FeedEntry } from './types';

type FetchLike = (input: string) => Promise<Response>;

type AgentsResponse = { agents?: AgentStat[] };
type RequestsResponse = { requests?: FeedEntry[] };

export async function loadDashboardSnapshot(fetchImpl: FetchLike = fetch) {
  const [agentsRes, requestsRes] = await Promise.all([
    fetchImpl('/api/agents'),
    fetchImpl('/api/requests?limit=50'),
  ]);

  if (!agentsRes.ok) {
    throw new Error('Failed to load dashboard agents');
  }

  if (!requestsRes.ok) {
    throw new Error('Failed to load dashboard requests');
  }

  const agentsJson = (await agentsRes.json()) as AgentsResponse;
  const requestsJson = (await requestsRes.json()) as RequestsResponse;

  const agentStats = agentsJson.agents ?? [];
  const feed = requestsJson.requests ?? [];
  const agentNameMap = Object.fromEntries(agentStats.map((agent) => [agent.id, agent.name]));

  return { agentStats, feed, agentNameMap };
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
