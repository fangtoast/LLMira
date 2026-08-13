create table if not exists recent_messages (
  id text primary key,
  conversation_id text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  server_updated_at text not null,
  cached_at text not null
);

create index if not exists recent_messages_conversation_idx
  on recent_messages(conversation_id, server_updated_at desc);

create table if not exists offline_drafts (
  id text primary key,
  workspace_id text not null,
  conversation_id text,
  content text not null,
  updated_at text not null
);

create table if not exists outbox (
  id text primary key,
  workspace_id text not null,
  operation text not null,
  payload_json text not null,
  idempotency_key text not null unique,
  attempts integer not null default 0,
  last_error text,
  created_at text not null
);

create index if not exists outbox_created_idx on outbox(created_at, id);
