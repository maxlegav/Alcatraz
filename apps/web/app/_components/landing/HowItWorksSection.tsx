'use client';

import React, { useEffect, useRef, useState } from 'react';

// ─── Scene metadata ───────────────────────────────────────────────────────────

type Scene = { title: string; caption: string };

const SCENES: Scene[] = [
  {
    title: 'A red team fully scans and pentests the agent.',
    caption:
      'Multiple attack agents probe prompt injection, file access, tool abuse, and data exfiltration at the same time.',
  },
  {
    title: 'Guardrails are created with an agent-readable summary.',
    caption:
      'The attack graph condenses into concrete allow, deny, and approval rules with a reviewable explanation.',
  },
  {
    title: 'A live log tail shows allowed, blocked, and human-reviewed calls.',
    caption:
      'The generated rules become runtime enforcement, with every tool call evaluated in real time.',
  },
];

const SCENE_MS = 6200;

// ─── RedTeamAsset ─────────────────────────────────────────────────────────────

const ATTACKERS = [
  { id: 'a', label: 'Prompt injection',    x: 108, y: 64,  begin: '0s'    },
  { id: 'b', label: 'Tool abuse',          x: 792, y: 64,  begin: '0.4s'  },
  { id: 'c', label: 'Command injection',   x: 52,  y: 215, begin: '0.8s'  },
  { id: 'd', label: 'Data exfiltration',   x: 192, y: 368, begin: '1.2s'  },
  { id: 'e', label: 'File escape',         x: 740, y: 368, begin: '1.6s'  },
];

const CX = 450;
const CY = 216;

function attackPath(ax: number, ay: number) {
  const mx = (ax + CX) / 2;
  const my = (ay + CY) / 2 + (ay < CY ? -18 : 18);
  return `M${ax},${ay} Q${mx},${my} ${CX},${CY}`;
}

function RedTeamAsset() {
  return (
    <div className="relative h-full overflow-hidden">
      {/* Grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(139,92,246,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.08) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          WebkitMaskImage:
            'radial-gradient(ellipse 78% 78% at 50% 50%, black 20%, transparent 72%)',
          maskImage:
            'radial-gradient(ellipse 78% 78% at 50% 50%, black 20%, transparent 72%)',
        }}
      />
      {/* Centre glow over grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 44% at 50% 46%, rgba(238,233,255,0.40) 0%, transparent 70%)',
        }}
      />

      {/* SVG: paths + packets */}
      <svg
        viewBox="0 0 900 430"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="brand-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#4f8ff7" />
          </linearGradient>
          {ATTACKERS.map((a) => (
            <path key={a.id} id={`rt-path-${a.id}`} d={attackPath(a.x, a.y)} />
          ))}
        </defs>

        {/* Baseline paths */}
        {ATTACKERS.map((a) => (
          <path
            key={a.id}
            d={attackPath(a.x, a.y)}
            fill="none"
            stroke="rgba(139,92,246,0.13)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ))}

        {/* Animated attack packets */}
        {ATTACKERS.map((a) => (
          <g key={a.id}>
            <circle r="8" fill="#8b5cf6" opacity="0.12">
              <animateMotion dur="1.7s" begin={a.begin} repeatCount="indefinite">
                <mpath href={`#rt-path-${a.id}`} />
              </animateMotion>
            </circle>
            <circle r="4" fill="url(#brand-grad)" opacity="0.9">
              <animateMotion dur="1.7s" begin={a.begin} repeatCount="indefinite">
                <mpath href={`#rt-path-${a.id}`} />
              </animateMotion>
            </circle>
          </g>
        ))}
      </svg>

      {/* Attacker labels */}
      {ATTACKERS.map((a) => {
        const pctLeft = ((a.x - 54) / 900) * 100;
        const pctTop  = ((a.y - 14) / 430) * 100;
        return (
          <div
            key={a.id}
            className="absolute z-10 flex items-center gap-1.5"
            style={{ left: `${pctLeft}%`, top: `${pctTop}%` }}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
            <span className="text-[10px] font-medium tracking-[-0.01em] text-slate-500">{a.label}</span>
          </div>
        );
      })}

      {/* Central "Your Agent" node */}
      <div
        className="absolute z-20"
        style={{
          left: `${((CX - 54) / 900) * 100}%`,
          top:  `${((CY - 54) / 430) * 100}%`,
          width: 108,
          height: 108,
        }}
      >
        {/* Animated glow ring */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: 26,
            boxShadow: '0 0 0 2px rgba(139,92,246,0.45), 0 0 28px rgba(139,92,246,0.25)',
            animation: 'agent-pulse 2.4s ease-in-out infinite',
          }}
        />
        {/* Card */}
        <div
          className="relative flex h-full w-full flex-col items-center justify-center gap-1.5"
          style={{
            borderRadius: 24,
            background: 'linear-gradient(145deg, #ffffff 0%, #f5f3ff 100%)',
            border: '1.5px solid rgba(139,92,246,0.35)',
            boxShadow: '0 8px 32px rgba(99,91,255,0.14), inset 0 1px 0 rgba(255,255,255,0.9)',
          }}
        >
          {/* Agent icon: crosshair/target */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="4.5" stroke="rgba(109,40,217,0.7)" strokeWidth="1.4"/>
            <line x1="10" y1="1.5" x2="10" y2="5.5" stroke="rgba(109,40,217,0.45)" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="10" y1="14.5" x2="10" y2="18.5" stroke="rgba(109,40,217,0.45)" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="1.5" y1="10" x2="5.5" y2="10" stroke="rgba(109,40,217,0.45)" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="14.5" y1="10" x2="18.5" y2="10" stroke="rgba(109,40,217,0.45)" strokeWidth="1.4" strokeLinecap="round"/>
            <circle cx="10" cy="10" r="1.8" fill="rgba(109,40,217,0.8)"/>
          </svg>
          <span className="relative text-center text-[9px] font-semibold uppercase tracking-[0.17em] text-violet-700/80">
            Your<br />Agent
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2">
        {['12 attacks', '5 findings', '0 prod impact'].map((s) => (
          <div
            key={s}
            className="rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-[10px] font-medium tracking-[-0.01em] text-slate-500 shadow-sm backdrop-blur-sm"
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GuardrailsAsset ──────────────────────────────────────────────────────────

const RULES: [string, string, string][] = [
  ['DENY',   'read_file',      '/etc, .env, secrets'],
  ['DENY',   'web_search',     'customer PII'],
  ['REVIEW', 'wire_transfer',  'amount > $500'],
  ['ALLOW',  'read_logs',      'workspace only'],
];

const FINDINGS = [
  'Injection through tool output',
  'Unrestricted file reads',
  'External leakage of PII',
];

function GuardrailsAsset() {
  return (
    <div className="relative h-full overflow-hidden rounded-xl border border-slate-200/80 bg-[#fafbff] shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28"
        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(37,99,235,0.10), transparent 60%)' }}
      />
      <div className="grid h-full gap-4 p-5 md:grid-cols-[0.95fr_1.05fr]">
        {/* Left: scan summary */}
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-600">Scan summary</p>
            <h3 className="mt-3 text-base font-semibold tracking-[-0.02em] text-slate-950">
              Attack graph compressed into policy
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            {FINDINGS.map((f, i) => (
              <div
                key={f}
                className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5"
                style={{ animation: `row-in 400ms cubic-bezier(0.16,1,0.3,1) ${120 + i * 90}ms both` }}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                <span className="text-xs font-medium text-slate-700">{f}</span>
              </div>
            ))}
          </div>
          <div
            className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3"
            style={{ animation: `row-in 400ms cubic-bezier(0.16,1,0.3,1) ${120 + FINDINGS.length * 90}ms both` }}
          >
            <p className="text-xs font-semibold text-emerald-700">Generated policy ready for review</p>
          </div>
        </div>

        {/* Right: code panel */}
        <div className="flex flex-col gap-0 rounded-xl border border-slate-900 bg-slate-950 p-4 shadow-xl">
          <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
            <span className="font-mono text-xs text-slate-400">guardrails.yaml</span>
            <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
              synthesized
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {RULES.map(([action, tool, condition], i) => (
              <div
                key={`${action}-${tool}`}
                className="grid grid-cols-[60px_1fr] gap-3 rounded-md border border-white/8 bg-white/[0.03] px-3 py-2 font-mono text-xs"
                style={{ animation: `row-in 400ms cubic-bezier(0.16,1,0.3,1) ${180 + i * 80}ms both` }}
              >
                <span
                  className={
                    action === 'ALLOW' ? 'text-emerald-300' :
                    action === 'REVIEW' ? 'text-amber-300' : 'text-rose-300'
                  }
                >
                  {action}
                </span>
                <span className="text-slate-300">
                  {tool} <span className="text-slate-500">when</span> {condition}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LiveLogAsset ─────────────────────────────────────────────────────────────

const LOGS: [string, string, string, string][] = [
  ['10:42:31', 'read_file("invoices/q4.csv")',  'ALLOWED',     'text-emerald-600 bg-emerald-50 border-emerald-100'],
  ['10:42:32', 'web_search("invoice template")', 'ALLOWED',    'text-emerald-600 bg-emerald-50 border-emerald-100'],
  ['10:42:33', 'read_file("/etc/passwd")',        'BLOCKED',    'text-rose-600 bg-rose-50 border-rose-100'],
  ['10:42:34', 'wire_transfer("$8,200")',         'HUMAN',      'text-amber-600 bg-amber-50 border-amber-100'],
  ['10:42:36', 'write_file("report.pdf")',        'ALLOWED',    'text-emerald-600 bg-emerald-50 border-emerald-100'],
  ['10:42:37', 'delete_file("config.yaml")',      'BLOCKED',    'text-rose-600 bg-rose-50 border-rose-100'],
];

function LiveLogAsset() {
  return (
    <div className="relative h-full overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
      <div
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(99,102,241,0.5), transparent)' }}
      />
      <div className="flex h-full flex-col p-5">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Live enforcement
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-950">invoice-bot production</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-600">3 allowed</span>
            <span className="rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-600">2 blocked</span>
            <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-600">1 review</span>
          </div>
        </div>

        {/* Log rows */}
        <div className="mt-4 flex flex-1 flex-col gap-2 overflow-hidden">
          {LOGS.map(([time, call, status, tone], i) => (
            <div
              key={`${time}-${call}`}
              className="grid grid-cols-[70px_1fr_auto] items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 font-mono text-xs"
              style={{ animation: `row-in 380ms cubic-bezier(0.16,1,0.3,1) ${100 + i * 75}ms both` }}
            >
              <span className="text-slate-400">{time}</span>
              <span className="truncate text-slate-700">{call}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${tone}`}>
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Scene cross-fade hook ────────────────────────────────────────────────────

function useSceneCrossFade(active: number) {
  const [incoming, setIncoming] = useState(active);
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active === incoming) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setOutgoing(incoming);
    setIncoming(active);
    timerRef.current = setTimeout(() => setOutgoing(null), 560);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return { incoming, outgoing };
}

// ─── Asset components indexed by scene ───────────────────────────────────────

const ASSETS = [RedTeamAsset, GuardrailsAsset, LiveLogAsset];

// ─── HowItWorksSection ───────────────────────────────────────────────────────

export function HowItWorksSection() {
  const [active, setActive] = useState(0);
  const { incoming, outgoing } = useSceneCrossFade(active);

  useEffect(() => {
    const t = setTimeout(
      () => setActive((c) => (c + 1) % SCENES.length),
      SCENE_MS,
    );
    return () => clearTimeout(t);
  }, [active]);

  const IncomingAsset = ASSETS[incoming];
  const OutgoingAsset = outgoing !== null ? ASSETS[outgoing] : null;

  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
          See it{' '}
          <span
            style={{
              background: 'linear-gradient(90deg, #7c3aed 0%, #4f8ff7 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            in action
          </span>
        </h2>
      </div>

      <div className="mx-auto mt-10 max-w-5xl">
        {/* Scene copy */}
        <div className="mb-6 min-h-[88px] text-center">
          <div key={active} className="scene-copy-enter">
            <p className="text-xl font-semibold tracking-[-0.04em] text-slate-800 sm:text-2xl">
              {SCENES[active].title}
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-[1rem] leading-[1.75] tracking-[-0.02em] text-[#5b6b98]">
              {SCENES[active].caption}
            </p>
          </div>
        </div>

        {/* Stage with cross-fade */}
        <div className="relative h-[540px] sm:h-[470px]">
          {OutgoingAsset && (
            <div
              key={`out-${outgoing}`}
              className="absolute inset-0"
              style={{ animation: 'scene-out 520ms cubic-bezier(0.4,0,1,1) forwards' }}
            >
              <OutgoingAsset />
            </div>
          )}
          <div
            key={`in-${incoming}`}
            className="absolute inset-0"
            style={{ animation: 'scene-in 560ms cubic-bezier(0.16,1,0.3,1) forwards' }}
          >
            <IncomingAsset />
          </div>
        </div>

        {/* Progress dots */}
        <div className="mt-6 flex justify-center gap-2" aria-label="How it works progress">
          {SCENES.map((scene, i) => (
            <button
              key={scene.title}
              type="button"
              aria-label={`Show scene ${i + 1}`}
              onClick={() => setActive(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                active === i ? 'w-8 bg-blue-600' : 'w-2 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes scene-in {
          from { opacity: 0; transform: scale(1.016) translateY(6px); filter: blur(3px); }
          to   { opacity: 1; transform: scale(1)     translateY(0);   filter: blur(0);   }
        }
        @keyframes scene-out {
          from { opacity: 1; transform: scale(1)     translateY(0);    filter: blur(0);   }
          to   { opacity: 0; transform: scale(0.984) translateY(-6px); filter: blur(3px); }
        }
        @keyframes scene-copy-enter {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes row-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes agent-pulse {
          0%, 100% { opacity: 0.7; box-shadow: 0 0 0 2px rgba(139,92,246,0.45), 0 0 20px rgba(139,92,246,0.20); }
          50%       { opacity: 1;   box-shadow: 0 0 0 3px rgba(139,92,246,0.60), 0 0 36px rgba(139,92,246,0.35); }
        }
        .scene-copy-enter {
          animation: scene-copy-enter 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </section>
  );
}
