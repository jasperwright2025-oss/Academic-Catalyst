-- Level-based pricing (10 Nov 2026).
-- Single purchases now add credits for one academic level. The older columns
-- (proposals_remaining, dissertations_remaining, data_simulations_remaining) keep their meaning:
-- credits from subscriptions and earlier purchases, valid for any level.
-- credits_version is raised on every credit change, so two updates cannot overwrite each other.

alter table public.subscriptions
  add column if not exists proposals_undergraduate integer not null default 0,
  add column if not exists proposals_masters integer not null default 0,
  add column if not exists proposals_phd integer not null default 0,
  add column if not exists dissertations_undergraduate integer not null default 0,
  add column if not exists dissertations_masters integer not null default 0,
  add column if not exists dissertations_phd integer not null default 0,
  add column if not exists simulations_undergraduate integer not null default 0,
  add column if not exists simulations_masters integer not null default 0,
  add column if not exists simulations_phd integer not null default 0,
  add column if not exists credits_version integer not null default 0;

alter table public.documents
  add column if not exists academic_level text
    check (academic_level is null or academic_level in ('undergraduate', 'masters', 'phd'));

-- documents.academic_level is for display only: users may edit their own document rows.
-- The level that decides which credit unlocks a preview is kept with the locked copy,
-- which only the server can read.
alter table public.document_secrets
  add column if not exists academic_level text
    check (academic_level is null or academic_level in ('undergraduate', 'masters', 'phd'));
