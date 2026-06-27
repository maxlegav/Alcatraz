import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';

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

/**
 * POST /api/redteam
 * Runs a Claude-powered red team scan on the demo agent source code.
 * Returns { vulnerabilities, rules, risk_score }
 */
export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  // Demo agent source is at <repo-root>/demo/langchain/research_agent.py
  // process.cwd() in Next.js dev = apps/web/
  const agentPath = join(process.cwd(), '..', '..', 'demo', 'langchain', 'research_agent.py');
  let code: string;
  try {
    code = readFileSync(agentPath, 'utf-8');
  } catch {
    return NextResponse.json({ error: 'Demo agent source not found at ' + agentPath }, { status: 500 });
  }

  const userContent =
    'Analyze this AI agent code for security vulnerabilities.\n\nCODE:\n' +
    code +
    '\n\n' +
    INSTRUCTIONS;

  const client = new Anthropic({ apiKey });
  let text = '';
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
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
