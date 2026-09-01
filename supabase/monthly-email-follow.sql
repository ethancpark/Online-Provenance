-- Let an account with no nation of its own follow one for the digest.
--
-- Run after monthly-email.sql. Safe to re-run.
--
-- A lab_admin has tribe_id null by schema constraint (a lab admin does not
-- belong to a nation), but the digest is per-nation, so the cron skipped those
-- accounts entirely. The toggle switched on and nothing ever arrived — and
-- since lab_admin is the only account that exists today, that made the whole
-- feature untestable.
--
-- This column is only consulted when tribe_id is null, so a tribal user cannot
-- use it to redirect their digest to another nation: their own tribe_id always
-- wins.
alter table profiles
  add column if not exists monthly_email_tribe_id uuid references tribes(id) on delete set null;
