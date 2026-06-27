import { groupRequests } from './analyze';
import type { Request } from './supabase/types';

const BASE: Request = {
  id: '1',
  agent_id: 'agent-1',
  agent_version: 1,
  tool_name: 'read_file',
  status: 'BLOCKED',
  severity: 'medium',
  payload: { path: '/etc/passwd' },
  created_at: '2024-01-01T00:00:00Z',
};

describe('groupRequests', () => {
  it('returns empty array for empty input', () => {
    expect(groupRequests([])).toHaveLength(0);
  });

  it('ignores ALLOWED requests', () => {
    expect(groupRequests([{ ...BASE, status: 'ALLOWED' }])).toHaveLength(0);
  });

  it('groups blocked requests by tool_name', () => {
    const groups = groupRequests([
      { ...BASE, id: '1', tool_name: 'read_file' },
      { ...BASE, id: '2', tool_name: 'read_file' },
      { ...BASE, id: '3', tool_name: 'exec_shell', severity: 'critical' },
    ]);
    expect(groups).toHaveLength(2);
    const fileGroup = groups.find(g => g.tool_name === 'read_file')!;
    expect(fileGroup.blocked_count).toBe(2);
  });

  it('promotes to the worst severity seen in the group', () => {
    const groups = groupRequests([
      { ...BASE, id: '1', severity: 'low' },
      { ...BASE, id: '2', severity: 'critical' },
      { ...BASE, id: '3', severity: 'medium' },
    ]);
    expect(groups[0].worst_severity).toBe('critical');
  });

  it('collects up to 3 example payloads per group', () => {
    const requests = [1, 2, 3, 4].map(i => ({
      ...BASE,
      id: String(i),
      payload: { path: `/path/${i}` },
    }));
    const groups = groupRequests(requests);
    expect(groups[0].example_payloads).toHaveLength(3);
  });

  it('omits null payloads from example_payloads', () => {
    const groups = groupRequests([{ ...BASE, payload: null }]);
    expect(groups[0].example_payloads).toHaveLength(0);
  });

  it('sorts groups by blocked_count descending', () => {
    const groups = groupRequests([
      { ...BASE, tool_name: 'a', id: '1' },
      { ...BASE, tool_name: 'b', id: '2' },
      { ...BASE, tool_name: 'b', id: '3' },
      { ...BASE, tool_name: 'b', id: '4' },
    ]);
    expect(groups[0].tool_name).toBe('b');
    expect(groups[0].blocked_count).toBe(3);
    expect(groups[1].tool_name).toBe('a');
  });

  it('breaks count ties by severity descending', () => {
    const groups = groupRequests([
      { ...BASE, tool_name: 'low_sev',  id: '1', severity: 'low'      },
      { ...BASE, tool_name: 'high_sev', id: '2', severity: 'critical'  },
    ]);
    expect(groups[0].tool_name).toBe('high_sev');
  });

  it('mixes ALLOWED and BLOCKED — only counts BLOCKED', () => {
    const groups = groupRequests([
      { ...BASE, id: '1', status: 'BLOCKED' },
      { ...BASE, id: '2', status: 'ALLOWED' },
      { ...BASE, id: '3', status: 'BLOCKED' },
    ]);
    expect(groups[0].blocked_count).toBe(2);
  });
});
