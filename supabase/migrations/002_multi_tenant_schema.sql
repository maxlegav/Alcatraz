-- ============================================================
-- 002 — Multi-tenant schema
--
-- users:      one row per auth user
-- api_keys:   many per user; used to authenticate agent requests
-- agents:     per user, versioned; (id, version) is the logical key
-- guardrails: security rules for a specific (agent_id, agent_version)
-- findings:   pen-test summary for a specific (agent_id, agent_version)
-- requests:   every tool-call event intercepted for an agent
--
-- Old tables (logs, scans) left intact — drop once migrated.
-- ============================================================

-- ----------------------------------------------------------
-- users
-- ----------------------------------------------------------
create table users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------
-- api_keys
-- Many per user. The key value is generated server-side and
-- stored hashed in production; plain text here for simplicity.
-- name lets users label keys ("prod", "staging", etc.)
-- ----------------------------------------------------------
create table api_keys (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid not null references users(id) on delete cascade,
  name       text not null,
  key        text not null unique default gen_random_uuid()::text,
  created_at timestamptz default now(),
  last_used_at timestamptz
);

-- Auto-create user row on sign-up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ----------------------------------------------------------
-- agents
-- version is bumped by the user when the agent changes.
-- api_key removed — auth now happens at the user level.
-- ----------------------------------------------------------
alter table agents
  add column user_id  uuid references users(id) on delete cascade,
  add column version  int not null default 1,
  drop column if exists rules,
  drop column if exists api_key;

create index api_keys_user_id_idx on api_keys(user_id);
create index api_keys_key_idx     on api_keys(key);

create index agents_user_id_idx on agents(user_id);

-- ----------------------------------------------------------
-- guardrails
-- One set of rules per (agent_id, agent_version).
-- ----------------------------------------------------------
create table guardrails (
  id                uuid    default gen_random_uuid() primary key,
  agent_id          uuid    not null references agents(id) on delete cascade,
  agent_version     int     not null,
  deny_patterns     text[]  not null default '{}',
  allow_patterns    text[]  not null default '{}',
  max_calls_per_min int,
  created_at        timestamptz default now(),

  unique(agent_id, agent_version)
);

create index guardrails_agent_id_idx on guardrails(agent_id);

-- ----------------------------------------------------------
-- findings
-- Pen-test summary for a specific (agent_id, agent_version).
-- Not dependent on guardrails — produced independently.
-- ----------------------------------------------------------
create table findings (
  id              uuid  default gen_random_uuid() primary key,
  agent_id        uuid  not null references agents(id) on delete cascade,
  agent_version   int   not null,
  vulnerabilities jsonb not null default '[]',
  summary         text,
  created_at      timestamptz default now(),

  unique(agent_id, agent_version)
);

create index findings_agent_id_idx on findings(agent_id);

-- ----------------------------------------------------------
-- requests
-- Every tool-call event intercepted, regardless of version.
-- ----------------------------------------------------------
create table requests (
  id            uuid default gen_random_uuid() primary key,
  agent_id      uuid not null references agents(id) on delete cascade,
  agent_version int  not null,
  tool_name     text not null,
  status        text not null check (status in ('ALLOWED', 'BLOCKED')),
  severity      text check (severity in ('critical', 'high', 'medium', 'low')),
  payload       jsonb,
  created_at    timestamptz default now()
);

create index requests_agent_id_idx   on requests(agent_id);
create index requests_created_at_idx on requests(created_at desc);

alter publication supabase_realtime add table requests;

-- ----------------------------------------------------------
-- Row-Level Security
-- ----------------------------------------------------------
alter table users      enable row level security;
alter table api_keys   enable row level security;
alter table agents     enable row level security;
alter table guardrails enable row level security;
alter table findings   enable row level security;
alter table requests   enable row level security;

create policy "users: self"
  on users for all
  using (auth.uid() = id);

create policy "api_keys: owner"
  on api_keys for all
  using (user_id = auth.uid());

create policy "agents: owner"
  on agents for all
  using (user_id = auth.uid());

create policy "guardrails: owner"
  on guardrails for all
  using (agent_id in (select id from agents where user_id = auth.uid()));

create policy "findings: owner"
  on findings for all
  using (agent_id in (select id from agents where user_id = auth.uid()));

create policy "requests: owner"
  on requests for all
  using (agent_id in (select id from agents where user_id = auth.uid()));

-- API routes use service role key — bypasses RLS automatically.
