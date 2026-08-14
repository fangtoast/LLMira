-- LLMira personal chat core, provider catalog, search settings and resumable turn events.
-- Author: fangtoast <fangtoast@foxmail.com>
-- Copyright (c) 2026 fangtoast. All rights reserved.

alter table provider_profiles add column if not exists execution_mode text not null default 'server' check (execution_mode in ('device', 'server'));
alter table provider_profiles add column if not exists scan_status text not null default 'never' check (scan_status in ('never', 'scanning', 'ready', 'failed'));
alter table provider_profiles add column if not exists last_scanned_at timestamptz;
alter table provider_profiles add column if not exists scan_error text;

create table if not exists provider_models (
  provider_id uuid not null references provider_profiles(id) on delete cascade,
  model_id text not null,
  display_name text not null,
  capabilities jsonb not null default '{}'::jsonb,
  context_window integer,
  owned_by text,
  source text not null default 'rule' check (source in ('upstream', 'rule', 'manual')),
  updated_at timestamptz not null default now(),
  primary key (provider_id, model_id)
);
create index if not exists provider_models_updated_idx on provider_models(provider_id, updated_at desc, model_id);

alter table conversations add column if not exists provider_id uuid references provider_profiles(id) on delete set null;
alter table conversations add column if not exists system_prompt text;
alter table conversations add column if not exists summary text;

alter table messages add column if not exists status text not null default 'completed' check (status in ('queued', 'streaming', 'completed', 'partial', 'failed', 'cancelled'));
alter table messages add column if not exists actual_provider_id uuid references provider_profiles(id) on delete set null;
alter table messages add column if not exists actual_model_id text;
alter table messages add column if not exists usage jsonb;
alter table messages add column if not exists citations jsonb not null default '[]'::jsonb;
alter table messages add column if not exists error_message text;

create table if not exists chat_turns (
  id uuid primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_message_id uuid not null references messages(id) on delete cascade,
  assistant_message_id uuid references messages(id) on delete set null,
  provider_id uuid references provider_profiles(id) on delete set null,
  model_id text not null,
  generation_settings jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_turns_conversation_updated_idx on chat_turns(conversation_id, updated_at desc, id desc);

create table if not exists chat_turn_events (
  id uuid primary key,
  turn_id uuid not null references chat_turns(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(turn_id, sequence)
);
create index if not exists chat_turn_events_stream_idx on chat_turn_events(turn_id, sequence);

create table if not exists search_profiles (
  id uuid primary key,
  owner_user_id uuid not null references users(id) on delete cascade,
  name text not null,
  provider text not null check (provider in ('searxng', 'tavily', 'brave')),
  base_url text,
  encrypted_secret text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists search_profiles_owner_updated_idx on search_profiles(owner_user_id, updated_at desc, id desc);

alter table provider_models enable row level security;
alter table chat_turns enable row level security;
alter table chat_turn_events enable row level security;
alter table search_profiles enable row level security;

create policy provider_models_access on provider_models for all using (
  exists (select 1 from provider_profiles p where p.id = provider_id and p.organization_id in (select organization_id from organization_members where user_id = app_user_id()))
);
create policy chat_turns_access on chat_turns for all using (
  exists (select 1 from conversations c where c.id = conversation_id and can_access_workspace(c.workspace_id))
);
create policy chat_turn_events_access on chat_turn_events for all using (
  exists (select 1 from chat_turns t join conversations c on c.id = t.conversation_id where t.id = turn_id and can_access_workspace(c.workspace_id))
);
create policy search_profiles_owner on search_profiles for all using (owner_user_id = app_user_id()) with check (owner_user_id = app_user_id());

alter table provider_models force row level security;
alter table chat_turns force row level security;
alter table chat_turn_events force row level security;
alter table search_profiles force row level security;
