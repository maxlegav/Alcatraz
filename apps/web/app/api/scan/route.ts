import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const PROMPT = `Tu es un expert en cybersécurité spécialisé dans les agents IA.
Analyse ce code d'agent IA et identifie toutes les vulnérabilités.

CODE À ANALYSER :
{code}

Réponds UNIQUEMENT en JSON avec ce format exact :
{
  "vulnerabilities": [
    {
      "severity": "critical|high|medium|low",
      "type": "nom de la vulnérabilité",
      "description": "ce qui peut arriver",
      "location": "où dans le code",
      "fix": "comment corriger"
    }
  ],
  "rules": {
    "DENY": ["liste des outils/actions à bloquer"],
    "ALLOW": ["liste des outils autorisés"],
    "MAX_CALLS_PER_MIN": 10
  },
  "risk_score": 0
}`;

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!apiKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("id")
    .eq("api_key", apiKey)
    .single();

  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: PROMPT.replace("{code}", code) }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Failed to parse scan result", raw: text }, { status: 500 });
  }

  const { error } = await supabaseAdmin.from("scans").insert({
    agent_id: agent.id,
    vulnerabilities: parsed.vulnerabilities,
    rules_generated: parsed.rules,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(parsed, { status: 201 });
}
