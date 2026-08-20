-- Rate limiting for the public signup endpoint.
--
-- Without this, anyone can drive the endpoint in a loop and cause Online
-- Provenance to email invitations at Tribal nation staff repeatedly. That is
-- abuse of real people's inboxes and reputational damage to the project, so
-- it is treated as a security control rather than a nicety.
--
-- Run after auth-schema.sql.

create table if not exists signup_attempts (
  id         bigserial primary key,
  email      text not null,
  ip_hash    text,                       -- hashed, never the raw address
  created_at timestamptz not null default now()
);
create index if not exists idx_signup_attempts_email on signup_attempts(lower(email), created_at desc);
create index if not exists idx_signup_attempts_ip on signup_attempts(ip_hash, created_at desc);

alter table signup_attempts enable row level security;
-- No policies: only the service role (the signup route) may touch this.
-- Anonymous and signed-in users get nothing, which is the intent.

-- Keep the table small and stop it becoming a log of who tried to sign up.
create or replace function prune_signup_attempts() returns void
  language sql security definer set search_path = public as $$
  delete from signup_attempts where created_at < now() - interval '24 hours'
$$;
