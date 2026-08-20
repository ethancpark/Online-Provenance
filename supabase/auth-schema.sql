-- Online Provenance — accounts, roles, and row-level security.
-- Paste into the Supabase SQL editor and Run. Safe to re-run.
--
-- Design notes:
--  * Passwords are NEVER stored here. Supabase Auth (auth.users) owns
--    credentials, hashing, sessions and rate limiting.
--  * Every table below has RLS enabled and denies by default. A nation's
--    users can only ever see their own nation's rows.
--  * The audit log is the NATION'S record of what its own staff did, not
--    analytics on users. That distinction is deliberate.

-- ---------------------------------------------------------------- roles
do $$ begin
  create type user_role as enum ('lab_admin', 'tribal_admin', 'tribal_staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_status as enum ('invited', 'active', 'suspended');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------- profiles
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text,
  job_title    text,
  role         user_role not null default 'tribal_staff',
  tribe_id     uuid references tribes(id) on delete restrict,
  status       account_status not null default 'invited',
  invited_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  -- a tribal user must belong to a nation; a lab admin must not
  constraint tribe_required_for_tribal_roles
    check ((role = 'lab_admin' and tribe_id is null) or (role <> 'lab_admin' and tribe_id is not null))
);
create index if not exists idx_profiles_tribe on profiles(tribe_id);

-- -------------------------------------------------------- tribe_domains
-- Email domains that may be used to claim an account for a nation.
create table if not exists tribe_domains (
  id         uuid primary key default gen_random_uuid(),
  tribe_id   uuid not null references tribes(id) on delete cascade,
  domain     text not null,
  source     text,
  created_at timestamptz not null default now(),
  unique (tribe_id, domain)
);
create index if not exists idx_tribe_domains_domain on tribe_domains(lower(domain));

-- ------------------------------------------------------------ audit_log
create table if not exists audit_log (
  id          bigserial primary key,
  actor_id    uuid references profiles(id) on delete set null,
  tribe_id    uuid references tribes(id) on delete cascade,
  action      text not null,          -- 'viewed_listing' | 'opened_notice' | ...
  target_type text,                   -- 'listing' | 'match' | 'tribe'
  target_id   text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_tribe_time on audit_log(tribe_id, created_at desc);

-- =========================================================== helpers ===
-- SECURITY DEFINER so policies can read the caller's own profile without
-- recursing through the profiles policies themselves.
create or replace function auth_role() returns user_role
  language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function auth_tribe() returns uuid
  language sql stable security definer set search_path = public as $$
  select tribe_id from profiles where id = auth.uid()
$$;

create or replace function is_lab_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'lab_admin' from profiles where id = auth.uid()), false)
$$;

-- =============================================================== RLS ===
alter table profiles      enable row level security;
alter table tribe_domains enable row level security;
alter table audit_log     enable row level security;
alter table tribes        enable row level security;
alter table listings      enable row level security;
alter table matches       enable row level security;
alter table reference_assets enable row level security;

-- profiles: you see yourself; a tribal_admin sees their nation's people;
-- lab admins see everyone. Nobody can change their own role or nation.
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select using (
  id = auth.uid()
  or is_lab_admin()
  or (auth_role() = 'tribal_admin' and tribe_id = auth_tribe())
);

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = auth_role() and tribe_id is not distinct from auth_tribe());

drop policy if exists profiles_admin_write on profiles;
create policy profiles_admin_write on profiles for all
  using (is_lab_admin()) with check (is_lab_admin());

-- tribe_domains: readable by signed-in users, writable only by lab admins.
drop policy if exists domains_read on tribe_domains;
create policy domains_read on tribe_domains for select using (auth.uid() is not null);
drop policy if exists domains_admin on tribe_domains;
create policy domains_admin on tribe_domains for all
  using (is_lab_admin()) with check (is_lab_admin());

-- audit_log: a nation reads its OWN trail. Inserts are attributed to the
-- acting user. Nobody can update or delete — an audit trail you can edit
-- is not an audit trail.
drop policy if exists audit_read_own_nation on audit_log;
create policy audit_read_own_nation on audit_log for select using (
  is_lab_admin() or (tribe_id = auth_tribe() and auth_tribe() is not null)
);
drop policy if exists audit_insert on audit_log;
create policy audit_insert on audit_log for insert with check (actor_id = auth.uid());

-- Public monitoring data stays publicly readable (the dashboard is a public
-- record). Writes are service_role only — the scan pipeline bypasses RLS.
drop policy if exists tribes_public_read on tribes;
create policy tribes_public_read on tribes for select using (true);
drop policy if exists refassets_public_read on reference_assets;
create policy refassets_public_read on reference_assets for select using (true);
drop policy if exists listings_public_read on listings;
create policy listings_public_read on listings for select using (true);
drop policy if exists matches_public_read on matches;
create policy matches_public_read on matches for select using (true);
