-- HUBpool V3 database schema
-- Shared accounts, commute profiles, weekly schedules, coworker directory,
-- carpool requests, and private phone reveal after acceptance.
-- Google route matching remains a separate cached layer for the next milestone.
-- Run this in a NEW Supabase project's SQL Editor.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exact/private commute data. Only its owner can read it.
create table public.commute_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  origin_input text not null,
  public_area text not null,
  privacy_level text not null check (privacy_level in ('exact','postcode','town','meeting_point')),
  role text not null check (role in ('driver','passenger','either')),
  available_seats integer not null default 0 check (available_seats between 0 and 8),
  max_detour_minutes integer not null default 10 check (max_detour_minutes between 0 and 30),
  route_duration_seconds integer,
  route_distance_meters integer,
  route_polyline text,
  route_origin_snapshot text,
  route_calculated_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Safe fields shown in the coworker directory.
-- The private origin and phone number deliberately do not live here.
create table public.commute_directory (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  public_area text not null,
  role text not null check (role in ('driver','passenger','either')),
  available_seats integer not null default 0 check (available_seats between 0 and 8),
  max_detour_minutes integer not null default 10 check (max_detour_minutes between 0 and 30),
  updated_at timestamptz not null default now()
);

-- Private contact details. RLS reveals a phone number only after an accepted connection.
create table public.contact_details (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone_number text not null default '',
  updated_at timestamptz not null default now()
);

-- Weekly schedules are mutable and have no relationship to Google route billing.
create table public.weekly_commute_schedules (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  enabled boolean not null default false,
  arrive_by time,
  leave_at time,
  updated_at timestamptz not null default now(),
  primary key (user_id, day_of_week)
);

-- Materialized route compatibility for the Google-powered milestone.
-- These rows will be rebuilt only when a routing origin changes.
create table public.cached_matches (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  candidate_user_id uuid not null references public.profiles(id) on delete cascade,
  recommended_driver_id uuid not null references public.profiles(id) on delete cascade,
  detour_minutes integer not null check (detour_minutes >= 0),
  route_compatibility integer not null check (route_compatibility between 0 and 100),
  label text not null check (label in ('Excellent','Good','Possible')),
  cached_at timestamptz not null default now(),
  unique (owner_user_id, candidate_user_id),
  check (owner_user_id <> candidate_user_id)
);

create table public.carpool_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> target_user_id)
);

create index cached_matches_owner_idx on public.cached_matches(owner_user_id);
create index cached_matches_candidate_idx on public.cached_matches(candidate_user_id);
create index carpool_requests_requester_idx on public.carpool_requests(requester_id);
create index carpool_requests_target_idx on public.carpool_requests(target_user_id);
create index weekly_schedules_user_idx on public.weekly_commute_schedules(user_id);

alter table public.profiles enable row level security;
alter table public.commute_profiles enable row level security;
alter table public.commute_directory enable row level security;
alter table public.contact_details enable row level security;
alter table public.weekly_commute_schedules enable row level security;
alter table public.cached_matches enable row level security;
alter table public.carpool_requests enable row level security;

-- Private identity/profile row.
create policy "profiles own row select"
on public.profiles for select to authenticated
using (auth.uid() = id);

create policy "profiles own row insert"
on public.profiles for insert to authenticated
with check (auth.uid() = id);

create policy "profiles own row update"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Private route origin belongs only to the owner.
create policy "commute own row select"
on public.commute_profiles for select to authenticated
using (auth.uid() = user_id);

create policy "commute own row insert"
on public.commute_profiles for insert to authenticated
with check (auth.uid() = user_id);

create policy "commute own row update"
on public.commute_profiles for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "commute own row delete"
on public.commute_profiles for delete to authenticated
using (auth.uid() = user_id);

-- Authenticated HUBpool users can see only the safe coworker directory fields.
create policy "directory authenticated select"
on public.commute_directory for select to authenticated
using (true);

create policy "directory own insert"
on public.commute_directory for insert to authenticated
with check (auth.uid() = user_id);

create policy "directory own update"
on public.commute_directory for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "directory own delete"
on public.commute_directory for delete to authenticated
using (auth.uid() = user_id);

-- Contact: owner always sees it. A coworker sees it only after an accepted request exists between them.
create policy "contact owner or accepted connection select"
on public.contact_details for select to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.carpool_requests cr
    where cr.status = 'accepted'
      and (
        (cr.requester_id = auth.uid() and cr.target_user_id = contact_details.user_id)
        or (cr.target_user_id = auth.uid() and cr.requester_id = contact_details.user_id)
      )
  )
);

create policy "contact own insert"
on public.contact_details for insert to authenticated
with check (auth.uid() = user_id);

create policy "contact own update"
on public.contact_details for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- V3 pilot: weekly shift data is visible only to authenticated HUBpool users.
-- This is what lets two real users compare schedules before Google route matching is connected.
create policy "schedule authenticated select"
on public.weekly_commute_schedules for select to authenticated
using (true);

create policy "schedule own insert"
on public.weekly_commute_schedules for insert to authenticated
with check (auth.uid() = user_id);

create policy "schedule own update"
on public.weekly_commute_schedules for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "schedule own delete"
on public.weekly_commute_schedules for delete to authenticated
using (auth.uid() = user_id);

-- Cached route matches are read-only to the browser. Trusted server code will populate them later.
create policy "matches own rows select"
on public.cached_matches for select to authenticated
using (auth.uid() = owner_user_id);

-- Requests are visible to both participants.
create policy "requests participants select"
on public.carpool_requests for select to authenticated
using (auth.uid() = requester_id or auth.uid() = target_user_id);

create policy "requests requester insert"
on public.carpool_requests for insert to authenticated
with check (auth.uid() = requester_id);

-- Only the recipient can accept or decline a request.
create policy "requests target update"
on public.carpool_requests for update to authenticated
using (auth.uid() = target_user_id)
with check (auth.uid() = target_user_id);

-- The sender may withdraw a request by deleting it.
create policy "requests requester delete"
on public.carpool_requests for delete to authenticated
using (auth.uid() = requester_id);

comment on table public.commute_profiles is 'Private commute origin and cached route fields. Route recalculation is triggered only when origin_input changes.';
comment on table public.commute_directory is 'Coworker-safe directory fields visible to authenticated HUBpool users.';
comment on table public.weekly_commute_schedules is 'Mutable weekly availability. Updating it never triggers Google route calculation.';
comment on table public.contact_details is 'Private phone data revealed only to owner or accepted carpool connection.';
comment on table public.cached_matches is 'Future Google route compatibility cache. Never rebuilt on a schedule.';
