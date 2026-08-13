-- @project LLMira
-- @file infra/postgres/migrations/001_team_platform.sql
-- @author fangtoast <fangtoast@foxmail.com>
-- @date 2026-08-13
-- @description 单组织团队版基础数据模型、索引与 RLS 策略。

create extension if not exists vector;
create extension if not exists pg_trgm;

create type organization_role as enum ('org_admin', 'member');
create type workspace_role as enum ('workspace_owner', 'editor', 'viewer');
create type agent_run_status as enum ('queued', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled');
create type tool_risk as enum ('read', 'write', 'external_side_effect', 'irreversible');
create type approval_status as enum ('pending', 'approved', 'rejected', 'expired');
create type document_status as enum ('queued', 'processing', 'ready', 'failed');

create table organizations (
  id uuid primary key,
  name text not null check (char_length(name) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key,
  email text not null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  password_hash text not null,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index users_email_lower_uq on users (lower(email));

create table organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role organization_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on organization_members(user_id, organization_id);

create table workspaces (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create index workspaces_org_updated_idx on workspaces(organization_id, updated_at desc, id desc);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on workspace_members(user_id, workspace_id);

create table refresh_sessions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  rotated_from_id uuid references refresh_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index refresh_sessions_user_active_idx on refresh_sessions(user_id, expires_at desc) where revoked_at is null;

create table invitations (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete cascade,
  email text not null,
  role workspace_role not null default 'viewer',
  token_hash text not null unique,
  invited_by uuid not null references users(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index invitations_org_email_idx on invitations(organization_id, lower(email), created_at desc);

create table provider_profiles (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete cascade,
  owner_user_id uuid references users(id) on delete cascade,
  name text not null,
  base_url text not null,
  provider_type text not null default 'openai_compatible' check (provider_type = 'openai_compatible'),
  scope text not null check (scope in ('team', 'personal')),
  encrypted_secret text,
  model_preset jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'team' and owner_user_id is null) or (scope = 'personal' and owner_user_id is not null))
);
create index provider_profiles_resolution_idx on provider_profiles(organization_id, owner_user_id, enabled, updated_at desc);

create table mcp_servers (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  transport text not null check (transport in ('streamable_http', 'stdio_container')),
  endpoint text,
  container_image text,
  default_risk tool_risk not null default 'read',
  allowed_domains text[] not null default '{}',
  timeout_ms integer not null default 30000 check (timeout_ms between 1000 and 300000),
  output_limit_bytes integer not null default 1048576 check (output_limit_bytes between 1024 and 10485760),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((transport = 'streamable_http' and endpoint is not null) or (transport = 'stdio_container' and container_image is not null))
);
create index mcp_servers_workspace_updated_idx on mcp_servers(workspace_id, updated_at desc, id desc);

create table knowledge_documents (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 262144000),
  status document_status not null default 'queued',
  source_type text not null check (source_type in ('upload', 'url')),
  source_url text,
  object_key text,
  chunk_count integer not null default 0 check (chunk_count >= 0),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index knowledge_documents_workspace_updated_idx on knowledge_documents(workspace_id, updated_at desc, id desc);
create index knowledge_documents_processing_idx on knowledge_documents(status, created_at) where status in ('queued', 'processing');

create table knowledge_chunks (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  document_id uuid not null references knowledge_documents(id) on delete cascade,
  ordinal integer not null check (ordinal >= 0),
  page integer,
  section text,
  content text not null,
  search_vector tsvector generated always as (to_tsvector('simple', content)) stored,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique(document_id, ordinal)
);
create index knowledge_chunks_document_idx on knowledge_chunks(document_id, ordinal);
create index knowledge_chunks_workspace_idx on knowledge_chunks(workspace_id, document_id);
create index knowledge_chunks_fts_idx on knowledge_chunks using gin(search_vector);
create index knowledge_chunks_embedding_idx on knowledge_chunks using hnsw(embedding vector_cosine_ops) where embedding is not null;

create table model_comparisons (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  requested_by uuid not null references users(id),
  prompt text not null,
  models jsonb not null,
  created_at timestamptz not null default now()
);
create index model_comparisons_workspace_created_idx on model_comparisons(workspace_id, created_at desc, id desc);

create table agent_runs (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  requested_by uuid not null references users(id),
  client_request_id text,
  comparison_id uuid references model_comparisons(id) on delete set null,
  title text not null,
  prompt text not null,
  status agent_run_status not null default 'queued',
  model text,
  tools jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index agent_runs_request_id_uq on agent_runs(requested_by, client_request_id) where client_request_id is not null;
create index agent_runs_workspace_updated_idx on agent_runs(workspace_id, updated_at desc, id desc);
create index agent_runs_queue_idx on agent_runs(status, created_at) where status in ('queued', 'running', 'waiting_approval');

create table run_events (
  id uuid primary key,
  run_id uuid not null references agent_runs(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(run_id, sequence)
);
create index run_events_stream_idx on run_events(run_id, sequence);

create table approval_requests (
  id uuid primary key,
  run_id uuid not null references agent_runs(id) on delete cascade,
  tool_name text not null,
  risk tool_risk not null check (risk <> 'read'),
  summary text not null,
  redacted_arguments jsonb not null default '{}'::jsonb,
  status approval_status not null default 'pending',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references users(id)
);
create index approval_requests_pending_idx on approval_requests(status, requested_at) where status = 'pending';
create index approval_requests_run_idx on approval_requests(run_id, requested_at desc);

create table scheduled_tasks (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_by uuid not null references users(id),
  name text not null,
  cron_expression text not null,
  timezone text not null default 'Asia/Shanghai',
  prompt text not null,
  enabled boolean not null default true,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scheduled_tasks_due_idx on scheduled_tasks(enabled, next_run_at) where enabled = true;

create table audit_logs (
  id uuid primary key,
  workspace_id uuid references workspaces(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  redacted_input jsonb not null default '{}'::jsonb,
  result_summary text,
  created_at timestamptz not null default now()
);
create index audit_logs_workspace_created_idx on audit_logs(workspace_id, created_at desc, id desc);

create table conversations (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  owner_user_id uuid not null references users(id) on delete cascade,
  title text not null,
  model text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index conversations_workspace_updated_idx on conversations(workspace_id, updated_at desc, id desc);
create index conversations_owner_updated_idx on conversations(owner_user_id, updated_at desc, id desc);

create table messages (
  id uuid primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  content jsonb not null,
  created_at timestamptz not null default now()
);
create index messages_conversation_created_idx on messages(conversation_id, created_at, id);

create table migration_imports (
  id uuid primary key,
  import_id text not null,
  user_id uuid not null references users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  imported_count integer not null check (imported_count >= 0),
  created_at timestamptz not null default now(),
  unique(user_id, import_id)
);

create or replace function app_user_id() returns uuid
language sql stable
as $$ select nullif(current_setting('app.current_user_id', true), '')::uuid $$;

create or replace function can_access_workspace(target_workspace_id uuid, accepted_roles workspace_role[] default null)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from workspaces w
    join organization_members om on om.organization_id = w.organization_id and om.user_id = app_user_id()
    left join workspace_members wm on wm.workspace_id = w.id and wm.user_id = app_user_id()
    where w.id = target_workspace_id
      and (
        om.role = 'org_admin'
        or (wm.user_id is not null and (accepted_roles is null or wm.role = any(accepted_roles)))
      )
  )
$$;

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table provider_profiles enable row level security;
alter table mcp_servers enable row level security;
alter table knowledge_documents enable row level security;
alter table knowledge_chunks enable row level security;
alter table agent_runs enable row level security;
alter table model_comparisons enable row level security;
alter table run_events enable row level security;
alter table approval_requests enable row level security;
alter table scheduled_tasks enable row level security;
alter table audit_logs enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

create policy workspaces_select on workspaces for select using (can_access_workspace(id));
create policy workspace_members_select on workspace_members for select using (can_access_workspace(workspace_id));
create policy provider_profiles_select on provider_profiles for select using (
  (
    workspace_id is null
    and organization_id in (select organization_id from organization_members where user_id = app_user_id())
    and (scope = 'team' or owner_user_id = app_user_id())
  )
  or (
    workspace_id is not null
    and can_access_workspace(workspace_id)
    and (scope = 'team' or owner_user_id = app_user_id())
  )
);
create policy provider_profiles_insert on provider_profiles for insert with check (
  (scope = 'personal' and owner_user_id = app_user_id())
  or (
    scope = 'team'
    and exists (
      select 1 from organization_members
      where organization_id = provider_profiles.organization_id
        and user_id = app_user_id()
        and role = 'org_admin'
    )
  )
);
create policy provider_profiles_update on provider_profiles for update using (
  (scope = 'personal' and owner_user_id = app_user_id())
  or (
    scope = 'team'
    and exists (
      select 1 from organization_members
      where organization_id = provider_profiles.organization_id
        and user_id = app_user_id()
        and role = 'org_admin'
    )
  )
) with check (
  (scope = 'personal' and owner_user_id = app_user_id())
  or (
    scope = 'team'
    and exists (
      select 1 from organization_members
      where organization_id = provider_profiles.organization_id
        and user_id = app_user_id()
        and role = 'org_admin'
    )
  )
);
create policy provider_profiles_delete on provider_profiles for delete using (
  (scope = 'personal' and owner_user_id = app_user_id())
  or (
    scope = 'team'
    and exists (
      select 1 from organization_members
      where organization_id = provider_profiles.organization_id
        and user_id = app_user_id()
        and role = 'org_admin'
    )
  )
);
create policy mcp_servers_select on mcp_servers for select using (can_access_workspace(workspace_id));
create policy mcp_servers_write on mcp_servers for all using (
  can_access_workspace(workspace_id, array['workspace_owner']::workspace_role[])
) with check (
  can_access_workspace(workspace_id, array['workspace_owner']::workspace_role[])
);
create policy knowledge_documents_access on knowledge_documents for all using (can_access_workspace(workspace_id));
create policy knowledge_chunks_access on knowledge_chunks for all using (can_access_workspace(workspace_id));
create policy agent_runs_access on agent_runs for all using (can_access_workspace(workspace_id));
create policy model_comparisons_access on model_comparisons for all using (can_access_workspace(workspace_id));
create policy run_events_access on run_events for all using (exists (select 1 from agent_runs r where r.id = run_id and can_access_workspace(r.workspace_id)));
create policy approval_requests_access on approval_requests for all using (exists (select 1 from agent_runs r where r.id = run_id and can_access_workspace(r.workspace_id)));
create policy scheduled_tasks_access on scheduled_tasks for all using (can_access_workspace(workspace_id));
create policy audit_logs_select on audit_logs for select using (
  workspace_id is null
  or can_access_workspace(workspace_id, array['workspace_owner']::workspace_role[])
);
create policy audit_logs_insert on audit_logs for insert with check (
  actor_user_id = app_user_id()
  and (workspace_id is null or can_access_workspace(workspace_id))
);
create policy conversations_access on conversations for all using (can_access_workspace(workspace_id));
create policy messages_access on messages for all using (exists (select 1 from conversations c where c.id = conversation_id and can_access_workspace(c.workspace_id)));

alter table workspaces force row level security;
alter table workspace_members force row level security;
alter table provider_profiles force row level security;
alter table mcp_servers force row level security;
alter table knowledge_documents force row level security;
alter table knowledge_chunks force row level security;
alter table agent_runs force row level security;
alter table model_comparisons force row level security;
alter table run_events force row level security;
alter table approval_requests force row level security;
alter table scheduled_tasks force row level security;
alter table audit_logs force row level security;
alter table conversations force row level security;
alter table messages force row level security;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'llmira_app') then
    create role llmira_app nologin noinherit;
  end if;
end
$$;

grant llmira_app to current_user;
grant usage on schema public to llmira_app;
grant select, insert, update, delete on all tables in schema public to llmira_app;
grant usage, select on all sequences in schema public to llmira_app;
grant execute on function app_user_id() to llmira_app;
grant execute on function can_access_workspace(uuid, workspace_role[]) to llmira_app;

comment on function app_user_id is 'API must set app.current_user_id inside each transaction when using a non-owner runtime role.';
