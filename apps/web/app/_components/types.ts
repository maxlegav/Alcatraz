// Shared types for the dashboard (used by both the Server Component and DashboardClient)

export type AgentStat = {
  id: string;
  name: string;
  totalCalls: number;
  blockedCalls: number;
  lastActive: string | null;
};

export type FeedEntry = {
  id: string;
  agent_id: string;
  tool_name: string;
  status: 'ALLOWED' | 'BLOCKED';
  severity: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};
