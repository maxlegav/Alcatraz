import { triggerAgentAnalysis } from './analyze-action';

describe('triggerAgentAnalysis', () => {
  it('posts the agent id to the analyze route and returns the payload', async () => {
    const fetchMock = jest.fn<Promise<Response>, [string, RequestInit | undefined]>()
      .mockResolvedValue(
        new Response(JSON.stringify({ insight: { id: 'insight-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const result = await triggerAgentAnalysis('agent-123', fetchMock);

    expect(fetchMock).toHaveBeenCalledWith('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: 'agent-123' }),
    });
    expect(result).toEqual({ insight: { id: 'insight-1' } });
  });

  it('throws the API error message when the request fails', async () => {
    const fetchMock = jest.fn<Promise<Response>, [string, RequestInit | undefined]>()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await expect(triggerAgentAnalysis('agent-123', fetchMock)).rejects.toThrow('Forbidden');
  });
});
