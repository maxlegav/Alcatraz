'use client';

import React, { useState, useEffect } from 'react';

// ─── Icons ────────────────────────────────────────────────────────────────────

function AgentIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
      <rect x="8" y="10" width="16" height="12" rx="6" fill="#1e293b" opacity="0.9" />
      <circle cx="13" cy="16" r="1.4" fill="#fff" />
      <circle cx="19" cy="16" r="1.4" fill="#fff" />
      <path d="M13 20c1 .9 2.1 1.3 3 1.3s2-.4 3-1.3" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="1.4" />
      <path d="M16 6v4" fill="none" stroke="#4f8ff7" strokeLinecap="round" strokeWidth="2" />
      <circle cx="16" cy="5" r="1.5" fill="#8b5cf6" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
      <path d="M16 7.5c-4.7 0-8.5 3.9-8.5 8.6 0 3.8 2.4 7 5.8 8.1.4.1.6-.2.6-.5v-2c-2.4.5-2.9-1-2.9-1-.4-1-.9-1.3-.9-1.3-.7-.5 0-.5 0-.5.8.1 1.3.8 1.3.8.7 1.2 1.9.8 2.4.6.1-.5.3-.8.5-1-1.9-.2-3.9-.9-3.9-4.2 0-.9.3-1.7.8-2.3 0-.2-.4-1.1.1-2.2 0 0 .7-.2 2.3.9a7.7 7.7 0 0 1 4.2 0c1.6-1.1 2.3-.9 2.3-.9.5 1.1.1 2 .1 2.2.5.6.8 1.4.8 2.3 0 3.2-2 4-3.9 4.2.3.3.6.8.6 1.5v2.8c0 .3.2.6.6.5A8.56 8.56 0 0 0 24.5 16c0-4.7-3.8-8.5-8.5-8.5Z" fill="currentColor" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
      <ellipse cx="16" cy="10" rx="8" ry="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10v10c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5V10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 15c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
      <rect x="6" y="9" width="20" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.5 12.5 7.5 5 7.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
      <path d="M6 12.5A2.5 2.5 0 0 1 8.5 10H13l2 2h8.5A2.5 2.5 0 0 1 26 14.5v7A2.5 2.5 0 0 1 23.5 24h-15A2.5 2.5 0 0 1 6 21.5v-9Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function HumanIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
      <circle cx="16" cy="11" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 25c.8-4.6 3.5-7.2 7.5-7.2s6.7 2.6 7.5 7.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M21.6 8.5 24 6.2M10.4 8.5 8 6.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" opacity="0.45" />
    </svg>
  );
}

function ShieldIcon({ active = false }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 56 56" className="h-11 w-11" aria-hidden="true">
      <defs>
        <linearGradient id="shield-grad" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor={active ? '#7c3aed' : '#8b5cf6'} />
          <stop offset="100%" stopColor={active ? '#2563eb' : '#4f8ff7'} />
        </linearGradient>
      </defs>
      <path d="M28 6 42 11v13c0 9.5-6 18.2-14 21-8-2.8-14-11.5-14-21V11L28 6Z" fill="url(#shield-grad)" />
      <path d="M22 29.5 27 34l8-11" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
    </svg>
  );
}

// ─── Types & Constants ────────────────────────────────────────────────────────

type ResultType = 'approved' | 'blocked' | 'human';
type Phase = 'idle' | 'sending' | 'evaluating' | 'resolving' | 'showing';

interface ScenarioItem {
  agent: string;
  service: string | null;
  result: ResultType;
  call: string;
}

const SCENARIOS: ScenarioItem[] = [
  { agent: 'ops',     service: 'github',     result: 'approved', call: 'push_commit()' },
  { agent: 'support', service: null,          result: 'blocked',  call: 'drop_table("users")' },
  { agent: 'finance', service: null,          result: 'human',    call: 'wire_transfer()' },
  { agent: 'qa',      service: 'filesystem',  result: 'approved', call: 'read_logs()' },
];

const PHASE_MS: Record<Phase, number> = {
  idle:       600,
  sending:    1500,
  evaluating: 700,
  resolving:  1300,
  showing:    2600,
};

const PACKET_COLOR: Record<ResultType, string> = {
  approved: '#6366f1',
  blocked:  '#ef4444',
  human:    '#f59e0b',
};

const BADGE_TEXT: Record<ResultType, string> = {
  approved: 'approved by Alcatraz',
  blocked:  'blocked',
  human:    'human in the loop',
};

const BADGE_CLASS: Record<ResultType, string> = {
  approved: 'border-blue-100 text-blue-600',
  blocked:  'border-rose-100 text-rose-500',
  human:    'border-amber-100 text-amber-600',
};

// ─── Layout ───────────────────────────────────────────────────────────────────
// Container: 580w × 540h  (svg viewBox matches)
// Nodes are 56×56 boxes; center = left+28, top+28

const AGENT_NODES = [
  { id: 'ops',     label: 'Ops',     top: 52,  left: 20  },  // center (48, 80)
  { id: 'support', label: 'Support', top: 174, left: 4   },  // center (32, 202)
  { id: 'finance', label: 'Finance', top: 294, left: 20  },  // center (48, 322)
  { id: 'qa',      label: 'QA',      top: 410, left: 56  },  // center (84, 438)
];

const SERVICE_NODES = [
  { id: 'github',     label: 'GitHub',     top: 52,  left: 432, Icon: GithubIcon   }, // center (460, 80)
  { id: 'database',   label: 'Database',   top: 172, left: 454, Icon: DatabaseIcon }, // center (482, 200)
  { id: 'email',      label: 'Email',      top: 294, left: 440, Icon: EmailIcon    }, // center (468, 322)
  { id: 'filesystem', label: 'Filesystem', top: 410, left: 406, Icon: FolderIcon   }, // center (434, 438)
];

const HUMAN_NODE = { id: 'reviewer', label: 'Reviewer', top: 360, left: 246 };

// Shield center: (274, 242), box 80×80 at left=234,top=202
const SHIELD = { left: 234, top: 202, size: 80 };
const SX = 274;
const SY = 242;

// ─── SVG paths (cubic bezier, agent/service centers → shield center) ──────────

const AGENT_PATH: Record<string, string> = {
  ops:     `M48,80  C168,82  242,176 ${SX},${SY}`,
  support: `M32,202 C155,208 218,232 ${SX},${SY}`,
  finance: `M48,322 C168,312 232,284 ${SX},${SY}`,
  qa:      `M84,438 C188,408 242,344 ${SX},${SY}`,
};

const SERVICE_PATH: Record<string, string> = {
  github:     `M${SX},${SY} C306,184 398,130 460,80`,
  database:   `M${SX},${SY} C352,232 414,212 482,200`,
  email:      `M${SX},${SY} C348,282 410,306 468,322`,
  filesystem: `M${SX},${SY} C322,336 390,412 434,438`,
};

const HUMAN_PATH = `M${SX},${SY} C274,282 274,332 274,388`;

// Call-label anchor (right edge of agent node + 8px gap)
const CALL_POS: Record<string, { top: number; left: number }> = {
  ops:     { top: 66,  left: 82  },
  support: { top: 188, left: 66  },
  finance: { top: 308, left: 82  },
  qa:      { top: 424, left: 118 },
};

// Result badge position (to the right of shield)
const BADGE_POS: Record<ResultType, { top: number; left: number }> = {
  approved: { top: 178, left: 304 },
  blocked:  { top: 248, left: 298 },
  human:    { top: 288, left: 292 },
};

// ─── AssetNode ────────────────────────────────────────────────────────────────

function AssetNode({
  top, left, label, active, children, visible = true,
}: {
  top: number; left: number; label: string; active: boolean; children: React.ReactNode; visible?: boolean;
}) {
  return (
    <div
      className={[
        'absolute transition-all duration-500 ease-in-out',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
      ].join(' ')}
      style={{ top, left }}
    >
      <div
        className={[
          'flex h-14 w-14 items-center justify-center rounded-[17px] border bg-white/92 text-slate-600 backdrop-blur-sm',
          'shadow-[0_4px_20px_rgba(41,72,152,0.07)] transition-all duration-400',
          active
            ? 'border-violet-200/80 shadow-[0_6px_28px_rgba(99,91,255,0.18)]'
            : 'border-white/80',
        ].join(' ')}
      >
        {children}
      </div>
      <p className="mt-1.5 text-center text-[9.5px] font-medium tracking-wide text-slate-400">
        {label}
      </p>
    </div>
  );
}

// ─── PathTrail ───────────────────────────────────────────────────────────────

function PathTrail({ d, color, dur }: { d: string; color: string; dur: string }) {
  return (
    <g opacity="0">
      <animate attributeName="opacity" from="0" to="1" dur="0.35s" fill="freeze" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset="1" opacity="0.6">
        <animate attributeName="stroke-dashoffset" from="1" to="0" dur={dur} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.42 0 0.58 1" />
      </path>
    </g>
  );
}

// ─── HeroAsset ────────────────────────────────────────────────────────────────

export function HeroAsset() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');

  const scenario = SCENARIOS[idx];

  useEffect(() => {
    const NEXT: Record<Phase, Phase> = {
      idle: 'sending',
      sending: 'evaluating',
      evaluating: 'resolving',
      resolving: 'showing',
      showing: 'idle',
    };
    const t = setTimeout(() => {
      if (phase === 'showing') setIdx((i) => (i + 1) % SCENARIOS.length);
      setPhase((p) => NEXT[p]);
    }, PHASE_MS[phase]);
    return () => clearTimeout(t);
  }, [phase]);

  const color = PACKET_COLOR[scenario.result];

  // When packet is in flight toward shield (stays frozen there during evaluating)
  const outboundVisible = phase === 'sending' || phase === 'evaluating';
  // When result packet is in flight toward service
  const inboundVisible = (phase === 'resolving' || phase === 'showing') && !!scenario.service;
  const humanRouteVisible = (phase === 'resolving' || phase === 'showing') && scenario.result === 'human';
  const reviewerVisible = humanRouteVisible;
  // Shield pulsing
  const shieldActive = phase === 'evaluating' || phase === 'resolving' || phase === 'showing';
  // Badge visible
  const badgeVisible = phase === 'showing';

  return (
    <div className="relative mx-auto h-[540px] w-full max-w-[580px] select-none">

      {/* ── Backgrounds ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_56%_56%_at_50%_46%,rgba(255,255,255,1),rgba(255,255,255,0.65)_48%,transparent_72%)]" />
      <div
        className="pointer-events-none absolute inset-x-[10%] top-[3%] h-[94%] [background-image:radial-gradient(circle,rgba(99,102,241,0.18)_1.5px,transparent_1.5px)] [background-size:16px_16px]"
        style={{
          WebkitMaskImage: 'radial-gradient(ellipse 84% 84% at 50% 50%, black 20%, transparent 75%)',
          maskImage: 'radial-gradient(ellipse 84% 84% at 50% 50%, black 20%, transparent 75%)',
        }}
      />
      <div className="pointer-events-none absolute left-[18%] top-[20%] h-[56%] w-[64%] rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.10),transparent_68%)] blur-3xl" />

      {/* ── SVG: paths + packets ── */}
      <svg
        viewBox="0 0 580 540"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        {/* Path definitions for mpath references */}
        <defs>
          {Object.entries(AGENT_PATH).map(([id, d]) => (
            <path key={id} id={`hap-${id}`} d={d} />
          ))}
          {Object.entries(SERVICE_PATH).map(([id, d]) => (
            <path key={id} id={`hsp-${id}`} d={d} />
          ))}
          <path id="hhp-reviewer" d={HUMAN_PATH} />
        </defs>

        {/* All paths — faint baseline network */}
        {Object.entries(AGENT_PATH).map(([id, d]) => (
          <path key={id} d={d} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="1.5" strokeLinecap="round" />
        ))}
        {Object.entries(SERVICE_PATH).map(([id, d]) => (
          <path key={id} d={d} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="1.5" strokeLinecap="round" />
        ))}
        <path
          d={HUMAN_PATH}
          fill="none"
          stroke="rgba(148,163,184,0.16)"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="transition-opacity duration-300 ease-out"
          opacity={reviewerVisible ? 1 : 0}
        />

        {/* Active agent path — progressive fill */}
        {outboundVisible && (
          <g key={`trail-out-${idx}`}>
            <PathTrail d={AGENT_PATH[scenario.agent]} color={color} dur="0.8s" />
          </g>
        )}

        {/* Active service path — progressive fill */}
        {inboundVisible && scenario.service && (
          <g key={`trail-in-${idx}`}>
            <PathTrail d={SERVICE_PATH[scenario.service]} color={color} dur="0.8s" />
          </g>
        )}

        {/* Active human review route — progressive fill */}
        {humanRouteVisible && (
          <g key={`trail-human-${idx}`}>
            <PathTrail d={HUMAN_PATH} color={color} dur="0.8s" />
          </g>
        )}

      </svg>

      {/* ── Call label: appears next to active agent while sending ── */}
      <div
        className={[
          'absolute z-10 rounded-full border border-slate-200 bg-white/96 px-2.5 py-1 font-mono text-[9px] font-medium text-slate-500 shadow-sm backdrop-blur-sm',
          'transition-all duration-300 ease-out',
          phase === 'sending' ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
        ].join(' ')}
        style={CALL_POS[scenario.agent]}
      >
        {scenario.call}
      </div>

      {/* ── Agent nodes ── */}
      {AGENT_NODES.map((node) => (
        <AssetNode
          key={node.id}
          top={node.top}
          left={node.left}
          label={node.label}
          active={phase !== 'idle' && phase !== 'showing' && scenario.agent === node.id}
        >
          <AgentIcon />
        </AssetNode>
      ))}

      {/* ── Service nodes ── */}
      {SERVICE_NODES.map((node) => {
        const Icon = node.Icon;
        return (
          <AssetNode
            key={node.id}
            top={node.top}
            left={node.left}
            label={node.label}
            active={inboundVisible && scenario.service === node.id}
          >
            <Icon />
          </AssetNode>
        );
      })}

      {/* ── Human review node ── */}
      <AssetNode
        top={HUMAN_NODE.top}
        left={HUMAN_NODE.left}
        label={HUMAN_NODE.label}
        active={humanRouteVisible}
        visible={reviewerVisible}
      >
        <HumanIcon />
      </AssetNode>

      {/* ── Alcatraz shield ── */}
      <div
        className={[
          'absolute flex items-center justify-center rounded-[24px] border backdrop-blur-sm transition-all duration-500',
          shieldActive
            ? 'border-violet-200/70 bg-white shadow-[0_16px_56px_rgba(99,91,255,0.26),0_4px_16px_rgba(99,91,255,0.14)]'
            : 'border-white/70 bg-white/96 shadow-[0_12px_40px_rgba(87,102,241,0.12)]',
        ].join(' ')}
        style={{ left: SHIELD.left, top: SHIELD.top, width: SHIELD.size, height: SHIELD.size }}
      >
        <ShieldIcon active={shieldActive} />
      </div>

      {/* ── Result badge ── */}
      <div
        className={[
          'absolute z-10 rounded-full border bg-white/96 px-3 py-1.5 text-[10.5px] font-semibold shadow-sm backdrop-blur-sm',
          'transition-all duration-300 ease-out',
          badgeVisible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
          BADGE_CLASS[scenario.result],
        ].join(' ')}
        style={BADGE_POS[scenario.result]}
      >
        {BADGE_TEXT[scenario.result]}
      </div>

      <style jsx>{`
        @keyframes hero-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
