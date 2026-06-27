create table insights (
  id            uuid default gen_random_uuid() primary key,
  agent_id      uuid not null references agents(id) on delete cascade,
  agent_version int  not null,
  patterns      jsonb not null default '[]',
  summary       text,
  triggered_by  text not null check (triggered_by in ('manual', 'scheduled')),
  created_at    timestamptz default now()
);

create index insights_agent_id_idx   on insights(agent_id);
create index insights_created_at_idx on insights(created_at desc);

alter table insights enable row level security;

create policy "insights: owner"
  on insights for all
  using (agent_id in (select id from agents where user_id = auth.uid()));
