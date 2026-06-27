import type { AgentWithStats, Log } from "@/lib/supabase/types";

export type HealthStatus = "healthy" | "drift" | "failed" | "idle";

export interface AgentHealth {
  status: HealthStatus;
  /** Badge label shown to the user */
  label: string;
  /** Short risk tag: LOW / MED / HIGH */
  risk: string;
  /** Block rate as a percentage number, e.g. 10.7 */
  blockRate: number;
  /** Tailwind text-color token for the accent */
  tone: "secondary" | "tertiary" | "error" | "outline";
  isActive: boolean;
}

const ACTIVE_WINDOW_MS = 300_000; // 5 min

export function deriveHealth(
  agent: AgentWithStats,
  now: number = Date.now()
): AgentHealth {
  const blockRate =
    agent.totalCalls > 0 ? (agent.blockedCalls / agent.totalCalls) * 100 : 0;
  const isActive = agent.lastActive
    ? now - new Date(agent.lastActive).getTime() < ACTIVE_WINDOW_MS
    : false;

  if (agent.totalCalls === 0) {
    return {
      status: "idle",
      label: "Idle",
      risk: "—",
      blockRate,
      tone: "outline",
      isActive,
    };
  }
  if (blockRate > 10) {
    return {
      status: "failed",
      label: "Critical",
      risk: "HIGH",
      blockRate,
      tone: "error",
      isActive,
    };
  }
  if (blockRate > 3) {
    return {
      status: "drift",
      label: "Elevated",
      risk: "MED",
      blockRate,
      tone: "tertiary",
      isActive,
    };
  }
  return {
    status: "healthy",
    label: "Healthy",
    risk: "LOW",
    blockRate,
    tone: "secondary",
    isActive,
  };
}

export function formatTimeAgo(
  ts: string | null,
  now: number = Date.now()
): string {
  if (!ts) return "never";
  const diff = now - new Date(ts).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** 12 hourly buckets (oldest → newest) of call volume for a sparkline. */
export function hourlyBuckets(
  logs: Log[],
  now: number = Date.now(),
  buckets = 12
): number[] {
  const out = new Array(buckets).fill(0);
  for (const log of logs) {
    const hrs = Math.floor((now - new Date(log.timestamp).getTime()) / 3_600_000);
    if (hrs >= 0 && hrs < buckets) out[buckets - 1 - hrs]++;
  }
  return out;
}

/** Distribute logs across `slots` evenly over the trailing `windowMs`. */
export function recentActivity(
  logs: Log[],
  now: number = Date.now(),
  slots = 6,
  windowMs = 3_600_000
): number[] {
  const out = new Array(slots).fill(0);
  const slotMs = windowMs / slots;
  for (const log of logs) {
    const age = now - new Date(log.timestamp).getTime();
    if (age < 0) continue;
    const idx = Math.min(slots - 1, slots - 1 - Math.floor(age / slotMs));
    if (idx >= 0) out[idx]++;
  }
  return out;
}

/** A short, human-readable description of a log for the live feed. */
export function describeLog(log: Log): string {
  const p = log.payload ?? {};
  const detail =
    (p.command as string) ??
    (p.url as string) ??
    (p.path as string) ??
    (p.table as string) ??
    (p.key as string) ??
    null;
  const verb = log.status === "BLOCKED" ? "Blocked" : "Allowed";
  return detail ? `${verb} ${log.tool_name} · ${detail}` : `${verb} ${log.tool_name}`;
}
