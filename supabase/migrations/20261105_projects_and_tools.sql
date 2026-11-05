-- Projects: one research project per row, holding the work from each tool and the documents.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  topic text,
  level text,
  institution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_user_updated_idx on public.projects (user_id, updated_at desc);

alter table public.projects enable row level security;
create policy "projects: owner reads" on public.projects for select using (auth.uid() = user_id);
create policy "projects: owner creates" on public.projects for insert with check (auth.uid() = user_id);
create policy "projects: owner edits" on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects: owner deletes" on public.projects for delete using (auth.uid() = user_id);

-- Tool runs: each use of a tool and its result. Counting this month's runs gives the free-use limit,
-- so users can read their own runs but only the server can add or remove them.
create table if not exists public.tool_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  tool text not null check (tool in ('topic_validator', 'smart_objectives', 'literature_review', 'methodology')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  created_at timestamptz not null default now()
);
create index if not exists tool_runs_user_tool_created_idx on public.tool_runs (user_id, tool, created_at desc);
create index if not exists tool_runs_project_idx on public.tool_runs (project_id, created_at desc);

alter table public.tool_runs enable row level security;
create policy "tool_runs: owner reads" on public.tool_runs for select using (auth.uid() = user_id);
revoke insert, update, delete on public.tool_runs from anon, authenticated;

-- Documents can belong to a project.
alter table public.documents add column if not exists project_id uuid references public.projects(id) on delete set null;
