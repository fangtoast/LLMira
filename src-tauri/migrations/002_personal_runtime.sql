create table if not exists provider_profiles (
  id text primary key,
  name text not null,
  protocol text not null default 'openai_compatible',
  base_url text not null,
  execution_mode text not null default 'device',
  scan_status text not null default 'never',
  last_scanned_at text,
  scan_error text,
  created_at text not null,
  updated_at text not null
);

create table if not exists provider_models (
  provider_id text not null references provider_profiles(id) on delete cascade,
  model_id text not null,
  name text not null,
  capabilities_json text not null,
  context_window integer,
  source text not null,
  scanned_at text not null,
  primary key (provider_id, model_id)
);

create table if not exists personal_conversations (
  id text primary key,
  title text not null,
  default_provider_id text,
  default_model_id text,
  system_prompt text,
  rolling_summary text,
  created_at text not null,
  updated_at text not null
);

create index if not exists personal_conversations_updated_idx
  on personal_conversations(updated_at desc, id);

create table if not exists personal_messages (
  id text primary key,
  conversation_id text not null references personal_conversations(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  content_json text not null,
  status text not null,
  provider_id text,
  model_id text,
  usage_json text,
  citations_json text,
  error_summary text,
  created_at text not null
);

create index if not exists personal_messages_cursor_idx
  on personal_messages(conversation_id, created_at, id);

create table if not exists image_history (
  id text primary key,
  provider_id text not null,
  model_id text not null,
  prompt text not null,
  settings_json text not null,
  image_uri text not null,
  created_at text not null
);

create table if not exists search_profiles (
  id text primary key,
  adapter text not null check (adapter in ('searxng', 'tavily', 'brave')),
  base_url text,
  enabled integer not null default 0,
  updated_at text not null
);

create table if not exists device_outbox (
  id text primary key,
  entity_type text not null,
  entity_id text not null,
  operation text not null,
  payload_json text not null,
  idempotency_key text not null unique,
  attempts integer not null default 0,
  last_error text,
  created_at text not null
);

create index if not exists device_outbox_created_idx on device_outbox(created_at, id);
