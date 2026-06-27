import { loadDashboardSnapshot, upsertRealtimeAgentStats } from './dashboard-data';

describe('loadDashboardSnapshot', () => {
  it('loads agents and requests, then derives the agent name map', async () => {
    const fetchMock = jest
      .fn<Promise<Response>, [string]>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            agents: [
              {
                id: 'agent-1',
                name: 'Agent One',
                totalCalls: 3,
                blockedCalls: 1,
                lastActive: '2026-06-27T10:00:00Z',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            requests: [
              {
                id: 'req-1',
                agent_id: 'agent-1',
                tool_name: 'bash_exec',
                status: 'BLOCKED',
                severity: 'high',
                payload: { command: 'rm -rf /' },
                created_at: '2026-06-27T10:00:00Z',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const snapshot = await loadDashboardSnapshot(fetchMock);

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/agents');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/requests?limit=50');
    expect(snapshot.agentStats).toEqual([
      {
        id: 'agent-1',
        name: 'Agent One',
        totalCalls: 3,
        blockedCalls: 1,
        lastActive: '2026-06-27T10:00:00Z',
      },
    ]);
    expect(snapshot.feed).toHaveLength(1);
    expect(snapshot.agentNameMap).toEqual({ 'agent-1': 'Agent One' });
  });

  it('throws when an endpoint response is unsuccessful', async () => {
    const fetchMock = jest
      .fn<Promise<Response>, [string]>()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }));

    await expect(loadDashboardSnapshot(fetchMock)).rejects.toThrow(
      'Failed to load dashboard agents',
    );
  });

  it('updates existing agent stats when a realtime request arrives', () => {
    const next = upsertRealtimeAgentStats(
      [
        {
          id: 'agent-1',
          name: 'Agent One',
          totalCalls: 3,
          blockedCalls: 1,
          lastActive: '2026-06-27T10:00:00Z',
        },
      ],
      {
        id: 'req-2',
        agent_id: 'agent-1',
        tool_name: 'web_search',
        status: 'BLOCKED',
        severity: 'medium',
        payload: null,
        created_at: '2026-06-27T11:00:00Z',
      },
    );

    expect(next).toEqual([
      {
        id: 'agent-1',
        name: 'Agent One',
        totalCalls: 4,
        blockedCalls: 2,
        lastActive: '2026-06-27T11:00:00Z',
      },
    ]);
  });

  it('creates a placeholder agent entry for unseen realtime agents', () => {
    const next = upsertRealtimeAgentStats(
      [],
      {
        id: 'req-3',
        agent_id: 'agent-9',
        tool_name: 'api_call',
        status: 'ALLOWED',
        severity: null,
        payload: null,
        created_at: '2026-06-27T12:00:00Z',
      },
    );

    expect(next).toEqual([
      {
        id: 'agent-9',
        name: 'agent-9',
        version: undefined,
        totalCalls: 1,
        blockedCalls: 0,
        lastActive: '2026-06-27T12:00:00Z',
        latestInsight: null,
      },
    ]);
  });
});
