-- Help requests from customers. Saved by the server; customers can read their own.
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  email text,
  topic text not null default 'other',
  message text not null,
  page text,
  error_text text,
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved')),
  notes text,
  emailed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_requests_status_created_idx on public.support_requests (status, created_at desc);
create index if not exists support_requests_user_created_idx on public.support_requests (user_id, created_at desc);
alter table public.support_requests enable row level security;
create policy "support_requests: owner reads" on public.support_requests for select using (auth.uid() = user_id);
revoke insert, update, delete on public.support_requests from anon, authenticated;
