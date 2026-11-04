-- Background generation jobs: one row per document being written, advanced one stage at a time.
-- Only the server (service role) reads or writes this table. It holds the full text of locked
-- previews while they are being written, so users get no direct access to it at all.
create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  action_type text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  preview_mode boolean not null default false,
  stage_index integer not null default 0,
  stage_count integer not null,
  stage_label text,
  attempts integer not null default 0,
  continuation boolean not null default false,
  input jsonb not null default '{}'::jsonb,
  research_notes text,
  document_text text not null default '',
  clarity_note text,
  result jsonb,
  document_id text,
  error text,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generation_jobs_user_created_idx
  on public.generation_jobs (user_id, created_at desc);

-- Row level security on, with no policies: signed-in users and visitors cannot read or change rows.
alter table public.generation_jobs enable row level security;
revoke all on public.generation_jobs from anon, authenticated;

-- Reference check written for the customer, kept out of the document itself.
alter table public.generation_jobs add column if not exists verification_note text;
