-- HUBpool V4A — multi-organization / configurable HUB foundation
-- Safe migration for the existing V3/V4 pilot database.
-- Existing users, schedules and requests are preserved.
-- Existing users are attached to one seeded pilot organization/HUB.
-- The oldest existing profile becomes the pilot organization owner.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (char_length(slug) between 2 and 80),
  join_code text not null unique check (char_length(join_code) between 4 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hubs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  public_label text not null default '',
  destination_input text not null default '',
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  active_hub_id uuid references public.hubs(id) on delete set null,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- Add V4 route-cache columns if the earlier V4 migration was not run yet.
alter table public.cached_matches
  add column if not exists owner_driver_detour_minutes integer check (owner_driver_detour_minutes >= 0),
  add column if not exists candidate_driver_detour_minutes integer check (candidate_driver_detour_minutes >= 0);

-- Tenant/HUB ownership for commute and request data.
alter table public.commute_profiles add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.commute_profiles add column if not exists hub_id uuid references public.hubs(id) on delete restrict;
alter table public.commute_directory add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.commute_directory add column if not exists hub_id uuid references public.hubs(id) on delete restrict;
alter table public.cached_matches add column if not exists hub_id uuid references public.hubs(id) on delete cascade;
alter table public.carpool_requests add column if not exists hub_id uuid references public.hubs(id) on delete restrict;

-- Seed the first tenant/HUB for the current proof of concept.
-- destination_input intentionally starts blank: configure the real office destination from Admin before enabling Google Routes.
insert into public.organizations (name, slug, join_code)
values ('MSC Cruises', 'msc-cruises', 'MSC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)))
on conflict (slug) do update set name = excluded.name;

insert into public.hubs (organization_id, name, public_label, destination_input, is_default, is_active)
select id, 'Valencia Excellence Hub', 'Valencia', '', true, true
from public.organizations
where slug = 'msc-cruises'
on conflict (organization_id, name) do nothing;

-- Ensure only one default HUB for the seeded organization.
update public.hubs h
set is_default = (h.name = 'Valencia Excellence Hub')
where h.organization_id = (select id from public.organizations where slug = 'msc-cruises');

-- Attach all existing pilot users to the seeded organization/HUB.
insert into public.organization_members (organization_id, user_id, role, active_hub_id)
select
  o.id,
  p.id,
  'member',
  h.id
from public.profiles p
cross join public.organizations o
join public.hubs h on h.organization_id = o.id and h.is_default = true
where o.slug = 'msc-cruises'
on conflict (organization_id, user_id) do update set active_hub_id = excluded.active_hub_id;

-- The oldest existing pilot profile becomes owner so the current project can edit its HUB immediately.
with first_user as (
  select id from public.profiles order by created_at asc limit 1
), pilot_org as (
  select id from public.organizations where slug = 'msc-cruises'
)
update public.organization_members om
set role = 'owner', updated_at = now()
from first_user, pilot_org
where om.organization_id = pilot_org.id and om.user_id = first_user.id;

-- Backfill existing rows into the seeded tenant/HUB.
update public.commute_profiles cp
set organization_id = o.id, hub_id = h.id
from public.organizations o
join public.hubs h on h.organization_id = o.id and h.is_default = true
where o.slug = 'msc-cruises' and (cp.organization_id is null or cp.hub_id is null);

update public.commute_directory cd
set organization_id = o.id, hub_id = h.id
from public.organizations o
join public.hubs h on h.organization_id = o.id and h.is_default = true
where o.slug = 'msc-cruises' and (cd.organization_id is null or cd.hub_id is null);

update public.carpool_requests cr
set hub_id = h.id
from public.organizations o
join public.hubs h on h.organization_id = o.id and h.is_default = true
where o.slug = 'msc-cruises' and cr.hub_id is null;

-- Any old geographic cache was created before a DB-owned HUB destination existed.
-- Invalidate it rather than risk using stale destination data. No Google calls happen here.
update public.commute_profiles
set route_duration_seconds = null,
    route_distance_meters = null,
    route_polyline = null,
    route_origin_snapshot = null,
    route_calculated_at = null,
    updated_at = now();

delete from public.cached_matches;

-- Existing commute/directory/request rows can now require tenant ownership.
alter table public.commute_profiles alter column organization_id set not null;
alter table public.commute_profiles alter column hub_id set not null;
alter table public.commute_directory alter column organization_id set not null;
alter table public.commute_directory alter column hub_id set not null;
alter table public.carpool_requests alter column hub_id set not null;

create index if not exists commute_profiles_hub_idx on public.commute_profiles(hub_id);
create index if not exists commute_directory_hub_idx on public.commute_directory(hub_id);
create index if not exists organization_members_user_idx on public.organization_members(user_id);
create index if not exists organization_members_hub_idx on public.organization_members(active_hub_id);
create index if not exists hubs_organization_idx on public.hubs(organization_id);
create index if not exists carpool_requests_hub_idx on public.carpool_requests(hub_id);
create index if not exists cached_matches_hub_idx on public.cached_matches(hub_id);

-- Security-definer helpers avoid recursive RLS checks while keeping tenant rules centralized.
create or replace function public.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id and om.user_id = auth.uid()
  );
$$;

create or replace function public.is_organization_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner','admin')
  );
$$;

create or replace function public.current_commute_hub_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cp.hub_id
  from public.commute_profiles cp
  where cp.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.shares_commute_hub(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.commute_profiles mine
    join public.commute_profiles theirs on theirs.user_id = p_other_user_id
    where mine.user_id = auth.uid() and mine.hub_id = theirs.hub_id
  );
$$;

grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.is_organization_admin(uuid) to authenticated;
grant execute on function public.current_commute_hub_id() to authenticated;
grant execute on function public.shares_commute_hub(uuid) to authenticated;

-- Join an organization using an invite/join code. The code is an onboarding gate, not an authentication secret.
create or replace function public.join_organization_by_code(p_code text)
returns table (
  organization_id uuid,
  organization_name text,
  organization_slug text,
  member_role text,
  hub_id uuid,
  hub_name text,
  hub_public_label text,
  hub_destination_configured boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
  v_hub public.hubs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_org
  from public.organizations
  where upper(join_code) = upper(trim(p_code))
  limit 1;

  if v_org.id is null then
    raise exception 'Invalid organization code';
  end if;

  select * into v_hub
  from public.hubs
  where organization_id = v_org.id and is_active = true
  order by is_default desc, created_at asc
  limit 1;

  if v_hub.id is null then
    raise exception 'This organization has no active HUB';
  end if;

  insert into public.organization_members (organization_id, user_id, role, active_hub_id)
  values (
    v_org.id,
    auth.uid(),
    case when exists (select 1 from public.organization_members om where om.organization_id = v_org.id) then 'member' else 'owner' end,
    v_hub.id
  )
  on conflict (organization_id, user_id)
  do update set active_hub_id = excluded.active_hub_id, updated_at = now();

  return query select
    v_org.id,
    v_org.name,
    v_org.slug,
    coalesce((select om.role from public.organization_members om where om.organization_id = v_org.id and om.user_id = auth.uid()), 'member'),
    v_hub.id,
    v_hub.name,
    v_hub.public_label,
    char_length(trim(v_hub.destination_input)) > 0;
end;
$$;

grant execute on function public.join_organization_by_code(text) to authenticated;

-- If an admin changes the central destination, all geographic cache for that HUB becomes stale.
-- It is invalidated automatically, but NO Google request is triggered by this database update.
create or replace function public.invalidate_hub_route_cache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if trim(coalesce(old.destination_input, '')) is distinct from trim(coalesce(new.destination_input, '')) then
    update public.commute_profiles
    set route_duration_seconds = null,
        route_distance_meters = null,
        route_polyline = null,
        route_origin_snapshot = null,
        route_calculated_at = null,
        updated_at = now()
    where hub_id = new.id;

    delete from public.cached_matches where hub_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists hubs_invalidate_route_cache on public.hubs;
create trigger hubs_invalidate_route_cache
after update of destination_input on public.hubs
for each row execute function public.invalidate_hub_route_cache();

-- RLS for the new tenant tables.
alter table public.organizations enable row level security;
alter table public.hubs enable row level security;
alter table public.organization_members enable row level security;

drop policy if exists "organizations member select" on public.organizations;
create policy "organizations member select"
on public.organizations for select to authenticated
using (public.is_organization_member(id));

drop policy if exists "organizations admin update" on public.organizations;
create policy "organizations admin update"
on public.organizations for update to authenticated
using (public.is_organization_admin(id))
with check (public.is_organization_admin(id));

drop policy if exists "hubs organization member select" on public.hubs;
create policy "hubs organization member select"
on public.hubs for select to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists "hubs organization admin update" on public.hubs;
create policy "hubs organization admin update"
on public.hubs for update to authenticated
using (public.is_organization_admin(organization_id))
with check (public.is_organization_admin(organization_id));

drop policy if exists "members own or admin select" on public.organization_members;
create policy "members own or admin select"
on public.organization_members for select to authenticated
using (user_id = auth.uid() or public.is_organization_admin(organization_id));

-- Replace the V3 global directory/schedule visibility with same-HUB visibility.
drop policy if exists "directory authenticated select" on public.commute_directory;
drop policy if exists "directory same hub select" on public.commute_directory;
create policy "directory same hub select"
on public.commute_directory for select to authenticated
using (user_id = auth.uid() or hub_id = public.current_commute_hub_id());

drop policy if exists "schedule authenticated select" on public.weekly_commute_schedules;
drop policy if exists "schedule same hub select" on public.weekly_commute_schedules;
create policy "schedule same hub select"
on public.weekly_commute_schedules for select to authenticated
using (user_id = auth.uid() or public.shares_commute_hub(user_id));

-- Existing own-row write policies remain, but require the user's assigned organization/HUB.
drop policy if exists "commute own row insert" on public.commute_profiles;
create policy "commute own row insert"
on public.commute_profiles for insert to authenticated
with check (
  auth.uid() = user_id
  and public.is_organization_member(organization_id)
  and exists (
    select 1 from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = commute_profiles.organization_id
      and om.active_hub_id = commute_profiles.hub_id
  )
);

drop policy if exists "commute own row update" on public.commute_profiles;
create policy "commute own row update"
on public.commute_profiles for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and public.is_organization_member(organization_id)
  and exists (
    select 1 from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = commute_profiles.organization_id
      and om.active_hub_id = commute_profiles.hub_id
  )
);

drop policy if exists "directory own insert" on public.commute_directory;
create policy "directory own insert"
on public.commute_directory for insert to authenticated
with check (auth.uid() = user_id and hub_id = public.current_commute_hub_id());

drop policy if exists "directory own update" on public.commute_directory;
create policy "directory own update"
on public.commute_directory for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and hub_id = public.current_commute_hub_id());

-- Requests must stay inside the sender's active HUB.
drop policy if exists "requests requester insert" on public.carpool_requests;
create policy "requests requester insert"
on public.carpool_requests for insert to authenticated
with check (
  auth.uid() = requester_id
  and hub_id = public.current_commute_hub_id()
  and public.shares_commute_hub(target_user_id)
);

comment on table public.organizations is 'HUBpool SaaS tenants. MSC Cruises is seeded only as the first pilot tenant.';
comment on table public.hubs is 'Organization-owned central commute destinations. destination_input replaces the old global HUB_DESTINATION environment variable.';
comment on table public.organization_members is 'User membership and active HUB assignment inside an organization.';
comment on column public.hubs.destination_input is 'Private routing destination used by the server for Google Routes. Editable by organization admins.';

-- The SQL Editor result shows the pilot join code. Copy it somewhere appropriate for your pilot team.
select name, slug, join_code
from public.organizations
where slug = 'msc-cruises';