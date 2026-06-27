export type RequestStatus = "ALLOWED" | "BLOCKED";
export type Severity = "critical" | "high" | "medium" | "low";

// ------------------------------------------------------------------
// users
// ------------------------------------------------------------------
export interface User {
  id: string;
  email: string;
  created_at: string;
}

// ------------------------------------------------------------------
// api_keys — many per user
// ------------------------------------------------------------------
export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key: string;
  created_at: string;
  last_used_at: string | null;
}

// ------------------------------------------------------------------
// agents
// version is bumped by the user when the agent changes.
// (id, version) is the logical key referenced by guardrails & findings.
// ------------------------------------------------------------------
export interface Agent {
  id: string;
  user_id: string;
  name: string;
  version: number;
  created_at: string;
}

export interface AgentWithStats extends Agent {
  totalCalls: number;
  blockedCalls: number;
  lastActive: string | null;
}

// Shapes used by the demo dataset and the live dashboard feed.
// `Log` is the intercepted tool-call record as seen by the feed (no agent_version,
// uses `timestamp` instead of `created_at` for display convenience).
export interface Log {
  id: string;
  agent_id: string;
  tool_name: string;
  status: RequestStatus;
  severity: Severity | null;
  payload: Record<string, unknown> | null;
  timestamp: string;
}

// `Scan` is a red-team run result as stored by the demo dataset.
export interface Scan {
  id: string;
  agent_id: string;
  vulnerabilities: Vulnerability[];
  rules_generated: {
    DENY: string[];
    ALLOW: string[];
    MAX_CALLS_PER_MIN: number;
  };
  created_at: string;
}

// ------------------------------------------------------------------
// guardrails — security rules for a specific (agent_id, agent_version)
// ------------------------------------------------------------------
export interface Guardrail {
  id: string;
  agent_id: string;
  agent_version: number;
  deny_patterns: string[];
  allow_patterns: string[];
  max_calls_per_min: number | null;
  created_at: string;
}

// ------------------------------------------------------------------
// findings — pen-test summary for a specific (agent_id, agent_version)
// ------------------------------------------------------------------
export interface Vulnerability {
  severity: Severity;
  type: string;
  description: string;
  location: string;
  fix: string;
}

export interface Finding {
  id: string;
  agent_id: string;
  agent_version: number;
  vulnerabilities: Vulnerability[];
  summary: string | null;
  created_at: string;
}

// ------------------------------------------------------------------
// requests — every intercepted tool-call event
// ------------------------------------------------------------------
export interface Request {
  id: string;
  agent_id: string;
  agent_version: number;
  tool_name: string;
  status: RequestStatus;
  severity: Severity | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

// ------------------------------------------------------------------
// hitl_requests — pending human-in-the-loop approvals
// ------------------------------------------------------------------
export type HitlStatus = 'pending' | 'approved' | 'denied';

export interface HitlRequest {
  id: string;
  agent_id: string;
  tool_name: string;
  tool_input: string;
  status: HitlStatus;
  created_at: string;
  decided_at: string | null;
}

// ------------------------------------------------------------------
// insights — pattern analysis results per (agent_id, agent_version)
// ------------------------------------------------------------------
export type SuggestionType =
  | 'prompt_injection'
  | 'tool_redesign'
  | 'data_provision'
  | 'other';

export interface Pattern {
  tool_name: string;
  blocked_count: number;
  severity: Severity | null;
  description: string;
  suggestion: string;
  suggestion_type: SuggestionType;
  example_payloads: Record<string, unknown>[];
}

export interface Insight {
  id: string;
  agent_id: string;
  agent_version: number;
  patterns: Pattern[];
  summary: string | null;
  triggered_by: 'manual' | 'scheduled';
  created_at: string;
}
