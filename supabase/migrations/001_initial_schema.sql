-- Agents registered with Alcatraz
create table agents (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  api_key text not null unique,
  rules jsonb not null default '{}',
  created_at timestamptz default now()
);

-- Runtime action logs (realtime enabled)
create table logs (
  id uuid default gen_random_uuid() primary key,
  agent_id text not null,
  tool_name text not null,
  status text not null check (status in ('ALLOWED', 'BLOCKED')),
  severity text check (severity in ('critical', 'high', 'medium', 'low')),
  payload jsonb,
  timestamp timestamptz default now()
);

-- Red team scan reports
create table scans (
  id uuid default gen_random_uuid() primary key,
  agent_id text not null,
  vulnerabilities jsonb not null default '[]',
  rules_generated jsonb not null default '{}',
  created_at timestamptz default now()
);

-- Index for dashboard queries
create index logs_agent_id_idx on logs(agent_id);
create index logs_timestamp_idx on logs(timestamp desc);
create index scans_agent_id_idx on scans(agent_id);

-- Enable realtime on logs table
alter publication supabase_realtime add table logs;
