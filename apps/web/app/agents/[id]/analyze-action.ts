type AnalyzeFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export async function triggerAgentAnalysis(
  agentId: string,
  fetchImpl: AnalyzeFetch = fetch,
) {
  const response = await fetchImpl('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId }),
  });

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(
      typeof payload.error === 'string' ? payload.error : 'Analysis failed',
    );
  }

  return payload;
}
