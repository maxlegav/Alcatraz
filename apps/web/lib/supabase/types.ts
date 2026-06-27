export type LogStatus = "ALLOWED" | "BLOCKED";
export type Severity = "critical" | "high" | "medium" | "low";

export interface Log {
  id: string;
  agent_id: string;
  tool_name: string;
  status: LogStatus;
  severity: Severity | null;
  payload: Record<string, unknown> | null;
  timestamp: string;
}

export interface Vulnerability {
  severity: Severity;
  type: string;
  description: string;
  location: string;
  fix: string;
}

export interface Scan {
  id: string;
  agent_id: string;
  vulnerabilities: Vulnerability[];
  rules_generated: Record<string, unknown>;
  created_at: string;
}
