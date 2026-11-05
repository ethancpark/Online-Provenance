-- Weekly listings report — opt-in, per account.
--
-- Run after monthly-email-follow.sql. Safe to re-run.
--
-- Same shape as the monthly digest: the choice lives on the person's own
-- profile row, defaults to OFF, and profiles_update_self already lets them
-- flip it for themselves and nobody else.
--
-- Accounts with no nation of their own (lab_admin) reuse
-- monthly_email_tribe_id as the nation they follow. A second foreign key to
-- tribes on profiles would add nothing and make PostgREST embeds ambiguous
-- in yet another way.

alter table profiles
  add column if not exists weekly_report boolean not null default false;

-- When the last report actually went out. Windows the next one, so a retry
-- never repeats listings and a missed week leaves no gap.
alter table profiles
  add column if not exists weekly_report_last_sent_at timestamptz;

create index if not exists idx_profiles_weekly_report
  on profiles(weekly_report) where weekly_report;
