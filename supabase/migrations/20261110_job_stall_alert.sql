-- When the sweep emailed an alert about this job being stuck (sent once per job).
alter table public.generation_jobs add column if not exists stall_alerted_at timestamptz;
