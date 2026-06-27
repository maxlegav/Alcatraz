-- ============================================================
-- Alcatraz — LangChain Demo Agent Setup
--
-- Run this in the Supabase SQL editor (service role bypasses RLS).
--
-- Prerequisites:
--   1. Run migrations 001, 002, 003 first.
--   2. Create an account in the web app (http://localhost:3000)
--      so your auth.users + public.users row exists.
--   3. Replace <YOUR_USER_ID> with your actual UUID:
--         SELECT id FROM public.users LIMIT 1;
-- ============================================================

DO $$
DECLARE
  v_user_id  uuid := 'd836a139-6b91-4974-8977-0981fd1dbb1a'; -- ← replace with your user id
  v_agent_id uuid := 'b0000001-demo-cafe-beef-dead-c0de0001';
  v_api_key  text := 'ak_demo_research_agent_001';
BEGIN

  -- ── 1. API Key ──────────────────────────────────────────────
  -- Used as ALCATRAZ_AGENT_KEY in .env.local
  INSERT INTO api_keys (user_id, name, key)
  VALUES (v_user_id, 'LangChain Demo', v_api_key)
  ON CONFLICT (key) DO NOTHING;

  -- ── 2. Agent ────────────────────────────────────────────────
  -- UUID used as ALCATRAZ_AGENT_ID in .env.local
  INSERT INTO agents (id, name, user_id, version)
  VALUES (v_agent_id, 'Research Agent (LangChain Demo)', v_user_id, 1)
  ON CONFLICT (id) DO NOTHING;

  -- ── 3. Guardrails ───────────────────────────────────────────
  -- Must match the RULES dict in demo/langchain/research_agent.py:
  --   DENY:   bash_executor, env_reader
  --   ALLOW:  web_search, read_internal_doc, write_report
  --   REVIEW: database_query, send_report (handled locally by SDK — no server guardrail)
  INSERT INTO guardrails (agent_id, agent_version, deny_patterns, allow_patterns, max_calls_per_min)
  VALUES (
    v_agent_id,
    1,
    ARRAY['bash_executor', 'env_reader'],
    ARRAY['web_search', 'read_internal_doc', 'write_report', 'database_query', 'send_report'],
    10
  )
  ON CONFLICT (agent_id, agent_version) DO NOTHING;

END $$;

-- ── Verify ────────────────────────────────────────────────────
SELECT 'api_keys' as tbl, key, name FROM api_keys WHERE key = 'ak_demo_research_agent_001'
UNION ALL
SELECT 'agents',  id::text, name FROM agents WHERE id = 'b0000001-demo-cafe-beef-dead-c0de0001'::uuid
UNION ALL
SELECT 'guardrails', agent_id::text, array_to_string(deny_patterns, ', ')
FROM guardrails WHERE agent_id = 'b0000001-demo-cafe-beef-dead-c0de0001'::uuid;
