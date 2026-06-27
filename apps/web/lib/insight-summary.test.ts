import { buildInsightSummary, getRecurringToolNames, pickTopPattern } from './insight-summary';
import type { Insight, Pattern } from './supabase/types';

function pattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    tool_name: 'env_read',
    blocked_count: 1,
    severity: 'medium',
    description: 'Reads environment variables repeatedly.',
    suggestion: 'Inject the required variable into prompt context.',
    suggestion_type: 'prompt_injection',
    example_payloads: [],
    ...overrides,
  };
}

function insight(id: string, patterns: Pattern[]): Insight {
  return {
    id,
    agent_id: 'agent-1',
    agent_version: 2,
    patterns,
    summary: 'Summary text',
    triggered_by: 'manual',
    created_at: '2026-06-27T12:00:00Z',
  };
}

describe('getRecurringToolNames', () => {
  it('returns tools present in both analyses in latest-order order', () => {
    const latest = [pattern({ tool_name: 'env_read' }), pattern({ tool_name: 'shell_exec' })];
    const previous = [pattern({ tool_name: 'shell_exec' }), pattern({ tool_name: 'db_write' })];

    expect(getRecurringToolNames(latest, previous)).toEqual(['shell_exec']);
  });
});

describe('pickTopPattern', () => {
  it('prefers highest severity before blocked count', () => {
    const chosen = pickTopPattern([
      pattern({ tool_name: 'env_read', severity: 'high', blocked_count: 10 }),
      pattern({ tool_name: 'shell_exec', severity: 'critical', blocked_count: 1 }),
      pattern({ tool_name: 'web_fetch', severity: 'critical', blocked_count: 3 }),
    ]);

    expect(chosen?.tool_name).toBe('web_fetch');
  });

  it('returns null for an empty pattern list', () => {
    expect(pickTopPattern([])).toBeNull();
  });
});

describe('buildInsightSummary', () => {
  it('builds dashboard-ready summary fields from the latest two insights', () => {
    const latest = insight('latest', [
      pattern({ tool_name: 'shell_exec', severity: 'critical', blocked_count: 3 }),
      pattern({ tool_name: 'env_read', severity: 'medium', blocked_count: 5 }),
    ]);
    const previous = insight('previous', [
      pattern({ tool_name: 'shell_exec', severity: 'high', blocked_count: 2 }),
    ]);

    expect(buildInsightSummary(latest, previous)).toEqual({
      created_at: '2026-06-27T12:00:00Z',
      summary: 'Summary text',
      recurring_tool_names: ['shell_exec'],
      pattern_count: 2,
      top_pattern: {
        tool_name: 'shell_exec',
        blocked_count: 3,
        severity: 'critical',
        suggestion: 'Inject the required variable into prompt context.',
        suggestion_type: 'prompt_injection',
      },
    });
  });

  it('returns null when there is no latest insight', () => {
    expect(buildInsightSummary(null, null)).toBeNull();
  });
});
