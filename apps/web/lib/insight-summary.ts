import type { Insight, Pattern, Severity, SuggestionType } from './supabase/types';

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export type TopPatternSummary = {
  tool_name: string;
  blocked_count: number;
  severity: Severity | null;
  suggestion: string;
  suggestion_type: SuggestionType;
};

export type InsightSummary = {
  created_at: string;
  summary: string | null;
  recurring_tool_names: string[];
  pattern_count: number;
  top_pattern: TopPatternSummary | null;
};

export function getRecurringToolNames(
  latestPatterns: Pattern[],
  previousPatterns: Pattern[],
): string[] {
  const previousToolNames = new Set(previousPatterns.map((pattern) => pattern.tool_name));
  return latestPatterns
    .map((pattern) => pattern.tool_name)
    .filter((toolName) => previousToolNames.has(toolName));
}

export function pickTopPattern(patterns: Pattern[]): TopPatternSummary | null {
  if (patterns.length === 0) {
    return null;
  }

  const top = [...patterns].sort((left, right) => {
    const severityDelta =
      (SEVERITY_RANK[right.severity ?? 'low'] ?? 0) -
      (SEVERITY_RANK[left.severity ?? 'low'] ?? 0);

    if (severityDelta !== 0) {
      return severityDelta;
    }

    return right.blocked_count - left.blocked_count;
  })[0];

  return {
    tool_name: top.tool_name,
    blocked_count: top.blocked_count,
    severity: top.severity,
    suggestion: top.suggestion,
    suggestion_type: top.suggestion_type,
  };
}

export function buildInsightSummary(
  latest: Insight | null,
  previous: Insight | null,
): InsightSummary | null {
  if (!latest) {
    return null;
  }

  return {
    created_at: latest.created_at,
    summary: latest.summary,
    recurring_tool_names: getRecurringToolNames(
      latest.patterns,
      previous?.patterns ?? [],
    ),
    pattern_count: latest.patterns.length,
    top_pattern: pickTopPattern(latest.patterns),
  };
}
