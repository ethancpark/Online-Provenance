-- Monthly email digest — opt-in, per account.
--
-- Run after auth-schema.sql. Safe to re-run.
--
-- Opting in is a choice the person makes and can undo, so it lives on their own
-- profile row and defaults to OFF. The existing profiles_update_self policy
-- already lets someone change their own row without touching role or tribe_id,
-- so a user can flip this themselves and cannot flip anyone else's.

alter table profiles
  add column if not exists monthly_email boolean not null default false;

-- When the last digest actually went out. Used to window the next one, so a
-- retry or a re-run never sends the same listings twice and never skips a gap.
alter table profiles
  add column if not exists monthly_email_last_sent_at timestamptz;

-- The sender reads every subscriber in one query.
create index if not exists idx_profiles_monthly_email
  on profiles(monthly_email) where monthly_email;
