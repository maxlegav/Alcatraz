-- ============================================================
-- 004 — Human-in-the-loop (HITL) requests
--
-- When the SDK needs operator approval for a REVIEW-listed tool,
-- it inserts a row here and polls for the decision.
-- The dashboard subscribes via Realtime and shows Approve/Deny.
-- ============================================================

create table hitl_requests (
  id           uuid        default gen_random_uuid() primary key,
  agent_id     uuid        not null references agents(id) on delete cascade,
  tool_name    text        not null,
  tool_input   text        not null default '',
  status       text        not null default 'pending'
                           check (status in ('pending', 'approved', 'denied')),
  created_at   timestamptz default now(),
  decided_at   timestamptz
);

create index hitl_requests_agent_id_idx on hitl_requests(agent_id);
create index hitl_requests_status_idx   on hitl_requests(status) where status = 'pending';

alter table hitl_requests enable row level security;

create policy "hitl_requests: owner"
  on hitl_requests for all
  using (agent_id in (select id from agents where user_id = auth.uid()));

-- Enable realtime so dashboard gets instant HITL notifications
alter publication supabase_realtime add table hitl_requests;
