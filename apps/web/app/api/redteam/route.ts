import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

const FF_SCAN_PROJECT = process.env.FF_SCAN_PROJECT === 'true';

const SYSTEM =
  'You are a cybersecurity expert specializing in AI agents. Respond ONLY with valid JSON, no markdown fences.';

const INSTRUCTIONS = `
Return ONLY valid JSON with this exact shape:
{
  "vulnerabilities": [
    {
      "severity": "critical|high|medium|low",
      "cvss_score": 9.8,
      "cwe_id": "CWE-78",
      "owasp_llm": "LLM01:2025 Prompt Injection",
      "type": "vulnerability name",
      "description": "what can happen",
      "location": "where in the code",
      "fix": "how to fix"
    }
  ],
  "rules": {
    "DENY": ["tools/actions to block unconditionally"],
    "REVIEW": ["tools requiring human approval before execution"],
    "ALLOW": ["tools that are safe to run automatically"],
    "MAX_CALLS_PER_MIN": 10
  },
  "risk_score": 75
}

Focus on:
1. Sensitive file access (.env, /etc, API keys) → CWE-22, CWE-200
2. Bash/system command execution → CWE-78, CWE-77
3. Environment variable reading → CWE-200, CWE-312
4. HTTP exfiltration / external URLs → CWE-918, CWE-359
5. Prompt injection vectors → CWE-1336, LLM01
6. Missing input validation → CWE-20
`;

const INSTRUCTIONS_HR = `
Return ONLY valid JSON with this exact shape:
{
  "vulnerabilities": [
    {
      "severity": "critical|high|medium|low",
      "cvss_score": 9.8,
      "cwe_id": "CWE-78",
      "owasp_llm": "LLM01:2025 Prompt Injection",
      "type": "vulnerability name",
      "description": "what can happen",
      "location": "where in the code",
      "fix": "how to fix"
    }
  ],
  "rules": {
    "DENY": ["tools/actions to block unconditionally"],
    "REVIEW": ["tools requiring human approval before execution"],
    "ALLOW": ["tools that are safe to run automatically"],
    "MAX_CALLS_PER_MIN": 10
  },
  "risk_score": 75
}

Perform a comprehensive OWASP LLM Top 10 red team analysis. Target 8–12 vulnerabilities covering:
1. Sensitive file access (.env, /etc, API keys) → CWE-22, CWE-200
2. Bash/system command execution → CWE-78, CWE-77
3. Environment variable reading → CWE-200, CWE-312
4. HTTP exfiltration / external URLs → CWE-918, CWE-359
5. Prompt injection vectors → CWE-1336, LLM01
6. Missing input validation → CWE-20
7. Multi-agent data flow risks (agent A passes untrusted data to agent B without sanitisation) → LLM09
8. PII handling and GDPR compliance issues (candidate data stored/logged unencrypted) → CWE-359
9. Prompt injection via CV content (attacker-controlled resume triggers downstream actions) → CWE-1336, LLM01
10. Excessive agency (agent attempts to send bulk emails or take irreversible bulk actions) → LLM08
11. Insecure inter-agent trust (evaluation agent trusts parser output blindly, no verification) → LLM09
12. Credential theft via environment variable access → CWE-200
13. Mass data exfiltration attempts (bulk candidate PII sent to external endpoint) → CWE-918
14. Rate limiting bypass (no throttle on bulk processing, DoS risk) → LLM04
`;

/** Read a file relative to the repo root (process.cwd() = apps/web/ in Next.js dev) */
function readRepoFile(...segments: string[]): string | null {
  try {
    return readFileSync(join(process.cwd(), '..', '..', ...segments), 'utf-8');
  } catch {
    return null;
  }
}

/**
 * POST /api/redteam
 * Runs a Claude-powered red team scan on the demo agent source code.
 * Accepts optional ?demo=hr to scan the multi-agent HR recruitment pipeline.
 * Returns { vulnerabilities, rules, risk_score }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  const demo = req.nextUrl.searchParams.get('demo');
  let userContent: string;

  if (demo === 'hr') {
    // ── HR multi-agent pipeline scan ──────────────────────────────────────────
    const orchestrator = readRepoFile('demo', 'hr_recruitment', 'orchestrator.py');
    const bobChen      = readRepoFile('demo', 'hr_recruitment', 'cvs', 'bob_chen.txt');
    const dianaPerez   = readRepoFile('demo', 'hr_recruitment', 'cvs', 'diana_perez.txt');
    const aliceMartin  = readRepoFile('demo', 'hr_recruitment', 'cvs', 'alice_martin.txt');

    // Collect whichever CV files exist
    const cvSamples = [
      bobChen    ? `=== CANDIDATE: Bob Chen (injection attempt) ===\n${bobChen}`       : null,
      dianaPerez ? `=== CANDIDATE: Diana Perez (path traversal) ===\n${dianaPerez}`   : null,
      aliceMartin ? `=== CANDIDATE: Alice Martin (baseline) ===\n${aliceMartin}`      : null,
    ].filter(Boolean).join('\n\n');

    if (!orchestrator && !cvSamples) {
      return NextResponse.json(
        { error: 'HR demo source not found — expected demo/hr_recruitment/orchestrator.py and/or CVs' },
        { status: 500 },
      );
    }

    userContent =
      'Analyze this multi-agent HR recruitment pipeline (3 AI agents) for security vulnerabilities.\n\n' +
      (orchestrator
        ? `=== AGENT 1: CV Parser / Orchestrator Agent ===\n${orchestrator}\n\n`
        : '') +
      (cvSamples
        ? `=== CANDIDATE DATA SAMPLES (inputs to Agent 1) ===\n${cvSamples}\n\n`
        : '') +
      INSTRUCTIONS_HR;
  } else if (FF_SCAN_PROJECT) {
    // ── Project scan: all .py files in demo/langchain/ ────────────────────────
    const demoDir = join(process.cwd(), '..', '..', 'demo', 'langchain');
    let files: string[] = [];
    try {
      files = readdirSync(demoDir)
        .filter(f => extname(f) === '.py')
        .sort();
    } catch {
      return NextResponse.json({ error: 'Demo langchain directory not found at ' + demoDir }, { status: 500 });
    }

    const fileBlocks = files
      .map(fname => {
        try {
          const code = readFileSync(join(demoDir, fname), 'utf-8');
          return `=== FILE: demo/langchain/${fname} ===\n${code}`;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .join('\n\n');

    if (!fileBlocks) {
      return NextResponse.json({ error: 'No readable Python files found in demo/langchain/' }, { status: 500 });
    }

    userContent =
      `Analyze this multi-agent project (${files.length} agent files) for security vulnerabilities.\n\n` +
      fileBlocks +
      '\n\n' +
      INSTRUCTIONS;
  } else {
    // ── Default: research agent scan ──────────────────────────────────────────
    const agentPath = join(process.cwd(), '..', '..', 'demo', 'langchain', 'research_agent.py');
    let code: string;
    try {
      code = readFileSync(agentPath, 'utf-8');
    } catch {
      return NextResponse.json({ error: 'Demo agent source not found at ' + agentPath }, { status: 500 });
    }

    userContent =
      'Analyze this AI agent code for security vulnerabilities.\n\nCODE:\n' +
      code +
      '\n\n' +
      INSTRUCTIONS;
  }

  const client = new Anthropic({ apiKey });
  let text = '';
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    });
    text = message.content[0]?.type === 'text' ? message.content[0].text : '';
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Claude API error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Strip markdown fences if present
  if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
  else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

  try {
    const result = JSON.parse(text);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to parse scan result', raw: text }, { status: 500 });
  }
}
