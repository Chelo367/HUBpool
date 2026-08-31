-- HUBpool MVP database schema
-- V2: adds private phone details + weekly schedules without changing the one-time route-cache model.
-- Run this in a new Supabase project's SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Private route source + cached Google result. A schedule/contact edit should never alter these cache fields.
create table if not exists public.commute_profiles (
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

-- Coarse fields that are safe to use in the coworker matching directory.
create table if not exists public.commute_directory (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  public_area text not null,
  role text not null check (role in ('driver','passenger','either')),
  available_seats integer not null default 0 check (available_seats between 0 and 8),
  max_detour_minutes integer not null default 10 check (max_detour_minutes between 0 and 30),
  updated_at timestamptz not null default now()
);

-- Materialized route compatibility. Rebuild only after route/matching-profile changes, never on a timer.
create table if not exists public.cached_matches (
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

create table if not exists public.carpool_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> target_user_id)
);

-- Contact details are intentionally separate from the public profile.
-- RLS reveals a phone number only to its owner or a coworker connected by an accepted carpool request.
create table if not exists public.contact_details (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone_number text not null default '',
  updated_at timestamptz not null default now()
);

-- Shift schedule is deliberately separate from route caching.
-- Users can update this every week with ZERO Google Maps calls.
create table if not exists public.weekly_commute_schedules (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  enabled boolean not null default false,
  arrive_by time,
  leave_at time,
  updated_at timestamptz not null default now(),
  primary key (user_id, day_of_week)
);

create index if not exists cached_matches_owner_idx on public.cached_matches(owner_user_id);
create index if not exists cached_matches_candidate_idx on public.cached_matches(candidate_user_id);
create index if not exists carpool_requests_requester_idx on public.carpool_requests(requester_id);
create index if not exists carpool_requests_target_idx on public.carpool_requests(target_user_id);
create index if not exists weekly_schedules_user_idx on public.weekly_commute_schedules(user_id);

alter table public.profiles enable row level security;
alter table public.commute_profiles enable row level security;
alter table public.commute_directory enable row level security;
alter table public.cached_matches enable row level security;
alter table public.carpool_requests enable row level security;
alter table public.contact_details enable row level security;
alter table public.weekly_commute_schedules enable row level security;

-- Identity row.
create policy "profiles own row select" on public.profiles for select using (auth.uid() = id);
create policy "profiles own row insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles own row update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Exact/private route origin belongs only to the owner.
create policy "commute own row select" on public.commute_profiles for select using (auth.uid() = user_id);
create policy "commute own row insert" on public.commute_profiles for insert with check (auth.uid() = user_id);
create policy "commute own row update" on public.commute_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "commute own row delete" on public.commute_profiles for delete using (auth.uid() = user_id);

-- Safe coworker directory: authenticated colleagues see only coarse/public commute fields.
create policy "directory authenticated select" on public.commute_directory for select to authenticated using (true);
create policy "directory own insert" on public.commute_directory for insert to authenticated with check (auth.uid() = user_id);
create policy "directory own update" on public.commute_directory for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "directory own delete" on public.commute_directory for delete to authenticated using (auth.uid() = user_id);

-- Cached match rows are generated by trusted server code and are visible only to their owner.
create policy "matches own rows select" on public.cached_matches for select using (auth.uid() = owner_user_id);

-- Carpool requests are visible to participants. Creation must be by requester.
create policy "requests participants select" on public.carpool_requests for select using (auth.uid() = requester_id or auth.uid() = target_user_id);
create policy "requests requester insert" on public.carpool_requests for insert with check (auth.uid() = requester_id);
create policy "requests participants update" on public.carpool_requests for update using (auth.uid() = requester_id or auth.uid() = target_user_id);

-- Phone: owner always sees it. The other user sees it only after an accepted request exists between them.
create policy "contact owner or accepted connection select" on public.contact_details
for select using (
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
create policy "contact own insert" on public.contact_details for insert with check (auth.uid() = user_id);
create policy "contact own update" on public.contact_details for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Schedule: owner + users who have a cached route match with this coworker may see it.
-- This lets schedule compatibility change independently from Maps routing.
create policy "schedule owner or matched coworker select" on public.weekly_commute_schedules
for select using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.cached_matches cm
    where cm.owner_user_id = auth.uid()
      and cm.candidate_user_id = weekly_commute_schedules.user_id
  )
  or exists (
    select 1
    from public.cached_matches cm
    where cm.candidate_user_id = auth.uid()
      and cm.owner_user_id = weekly_commute_schedules.user_id
  )
);
create policy "schedule own insert" on public.weekly_commute_schedules for insert with check (auth.uid() = user_id);
create policy "schedule own update" on public.weekly_commute_schedules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "schedule own delete" on public.weekly_commute_schedules for delete using (auth.uid() = user_id);

comment on table public.cached_matches is 'Materialized route compatibility. Rebuilt only when relevant commute fields change; never on a timer.';
comment on table public.weekly_commute_schedules is 'Mutable weekly availability. Updating it does not trigger Google route calculation.';
comment on table public.contact_details is 'Private contact data revealed only to the owner and accepted carpool connections.';
