-- Survivor Fantasy Draft — initial schema
-- Run this in the Supabase SQL editor, or via `supabase db push` if using the CLI.

-- ============================================================================
-- Extensions
-- ============================================================================
create extension if not exists "pgcrypto";

-- ============================================================================
-- profiles
-- ============================================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles are viewable by any authenticated user"
  on profiles for select
  to authenticated
  using (true);

create policy "users can update their own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create a profile row whenever a new auth user signs up.
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- leagues (columns only — RLS policies below reference league_members, so
-- both tables are created first and policies come after)
-- ============================================================================
create table leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles(id) on delete cascade,
  season text not null default 'Survivor 51',
  num_drafters int not null check (num_drafters between 2 and 20),
  num_rounds int not null check (num_rounds between 1 and 30),
  status text not null default 'pending' check (status in ('pending', 'live', 'complete')),
  invite_code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  created_at timestamptz not null default now()
);

create index leagues_owner_id_idx on leagues (owner_id);

alter table leagues enable row level security;

-- ============================================================================
-- league_members (columns only — policies below)
-- ============================================================================
create table league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  draft_position int check (draft_position > 0),
  joined_at timestamptz not null default now(),
  unique (league_id, profile_id),
  unique (league_id, draft_position)
);

create index league_members_league_id_idx on league_members (league_id);
create index league_members_profile_id_idx on league_members (profile_id);

alter table league_members enable row level security;

-- A plain "exists (select 1 from league_members ...)" inside league_members'
-- own SELECT policy is self-referential and Postgres rejects it as infinite
-- recursion. Routing every membership check through a SECURITY DEFINER
-- function bypasses RLS for the inner lookup and breaks the cycle.
create function is_league_member(p_league_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from league_members
    where league_id = p_league_id and profile_id = auth.uid()
  );
$$;

grant execute on function is_league_member(uuid) to authenticated;

-- ============================================================================
-- leagues policies (league_members now exists)
-- ============================================================================
create policy "members and owner can view their leagues"
  on leagues for select
  to authenticated
  using (owner_id = auth.uid() or is_league_member(id));

create policy "any authenticated user can create a league"
  on leagues for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "owner can update their league"
  on leagues for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner can delete their league"
  on leagues for delete
  to authenticated
  using (owner_id = auth.uid());

-- Lookup a league by invite code without needing prior membership (used by the
-- "join a league" flow). Only exposes non-sensitive fields.
create function find_league_by_code(p_code text)
returns table (
  id uuid,
  name text,
  season text,
  status text,
  num_drafters int,
  num_rounds int,
  member_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    l.id, l.name, l.season, l.status, l.num_drafters, l.num_rounds,
    (select count(*) from league_members lm where lm.league_id = l.id) as member_count
  from leagues l
  where l.invite_code = p_code;
$$;

grant execute on function find_league_by_code(text) to authenticated;

-- ============================================================================
-- league_members policies
-- ============================================================================
create policy "members can view their league's roster of members"
  on league_members for select
  to authenticated
  using (is_league_member(league_id));

-- A joining user has no prior SELECT visibility into the leagues row (that's
-- exactly what membership grants), so the "is this league pending" check
-- below also has to bypass leagues' own RLS via a SECURITY DEFINER function.
create function is_league_open_to_join(p_league_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from leagues where id = p_league_id and status = 'pending');
$$;

grant execute on function is_league_open_to_join(uuid) to authenticated;

create policy "a user can join a pending league as themselves"
  on league_members for insert
  to authenticated
  with check (profile_id = auth.uid() and is_league_open_to_join(league_id));

create policy "league owner can update member draft positions"
  on league_members for update
  to authenticated
  using (
    exists (select 1 from leagues l where l.id = league_id and l.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from leagues l where l.id = league_id and l.owner_id = auth.uid())
  );

create policy "a member can leave, or the owner can remove a member, while pending"
  on league_members for delete
  to authenticated
  using (
    (profile_id = auth.uid() or exists (
      select 1 from leagues l where l.id = league_id and l.owner_id = auth.uid()
    ))
    and exists (select 1 from leagues l where l.id = league_id and l.status = 'pending')
  );

-- Enforce league capacity on join. SECURITY DEFINER because a joining user
-- has no RLS visibility into `leagues` yet — same reasoning as
-- is_league_open_to_join above.
create function enforce_league_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num_drafters int;
  v_current_count int;
begin
  select num_drafters into v_num_drafters from leagues where id = new.league_id;
  select count(*) into v_current_count from league_members where league_id = new.league_id;

  if v_current_count >= v_num_drafters then
    raise exception 'This league is already full.';
  end if;

  return new;
end;
$$;

create trigger league_members_capacity_check
  before insert on league_members
  for each row execute function enforce_league_capacity();

-- Assign the whole draft order in one atomic statement (swapping two members'
-- positions in separate statements would trip the unique constraint above).
-- p_assignments: jsonb array of {"member_id": uuid, "position": int}.
-- Runs as the caller, so the "league owner can update member draft positions"
-- RLS policy still applies.
create function set_draft_order(p_league_id uuid, p_assignments jsonb)
returns void
language plpgsql
security invoker
as $$
begin
  update league_members lm
  set draft_position = (elem ->> 'position')::int
  from jsonb_array_elements(p_assignments) as elem
  where lm.league_id = p_league_id
    and lm.id = (elem ->> 'member_id')::uuid;
end;
$$;

grant execute on function set_draft_order(uuid, jsonb) to authenticated;

-- Validate the draft can actually start: league is full and draft positions
-- form a complete 1..num_drafters permutation.
create function enforce_draft_start()
returns trigger
language plpgsql
as $$
declare
  v_member_count int;
  v_positions_count int;
begin
  if new.status = 'live' and old.status = 'pending' then
    select count(*) into v_member_count from league_members where league_id = new.id;

    if v_member_count <> new.num_drafters then
      raise exception 'League must have exactly % drafters before starting (has %).',
        new.num_drafters, v_member_count;
    end if;

    select count(distinct draft_position) into v_positions_count
    from league_members
    where league_id = new.id and draft_position between 1 and new.num_drafters;

    if v_positions_count <> new.num_drafters then
      raise exception 'Draft order must be fully set (positions 1..%) before starting.',
        new.num_drafters;
    end if;
  end if;

  return new;
end;
$$;

create trigger leagues_enforce_draft_start
  before update on leagues
  for each row execute function enforce_draft_start();

-- ============================================================================
-- players (the draftable castaway pool)
-- ============================================================================
create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season text not null,
  tribe text,
  photo_url text,
  bio text,
  created_at timestamptz not null default now()
);

create index players_season_idx on players (season);

alter table players enable row level security;

create policy "players are viewable by any authenticated user"
  on players for select
  to authenticated
  using (true);

-- No insert/update/delete policies for regular users — the pool is seeded via
-- the SQL editor / service-role key. See supabase/seed/players_survivor51.sql.

-- ============================================================================
-- picks
-- ============================================================================
create table picks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  round int not null,
  pick_number int not null,
  profile_id uuid not null references profiles(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (league_id, pick_number),
  unique (league_id, player_id)
);

create index picks_league_id_idx on picks (league_id);

alter table picks enable row level security;

create policy "members can view picks in their leagues"
  on picks for select
  to authenticated
  using (is_league_member(league_id));

-- Clients only need to supply league_id + player_id. round, pick_number and
-- profile_id are computed server-side by the trigger below, which is also
-- what enforces "is it actually your turn" and snake draft order.
create policy "a league member can attempt to make a pick"
  on picks for insert
  to authenticated
  with check (is_league_member(league_id));

-- SECURITY DEFINER: `select ... for update` against an RLS-protected table
-- requires the row to satisfy that table's UPDATE policy too (not just
-- SELECT), and a non-owner drafter fails leagues' owner-only UPDATE policy.
-- This function only reads/validates and never writes `leagues` itself, so
-- bypassing RLS here is safe — the picks INSERT is still gated by picks' own
-- RLS policy independently of this trigger.
create function enforce_draft_turn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league leagues%rowtype;
  v_picks_made int;
  v_round int;
  v_pos_in_round int;
  v_expected_position int;
  v_caller_position int;
begin
  -- Serialize concurrent picks for this league.
  select * into v_league from leagues where id = new.league_id for update;

  if v_league.status <> 'live' then
    raise exception 'This draft is not currently live.';
  end if;

  select count(*) into v_picks_made from picks where league_id = new.league_id;

  if v_picks_made >= v_league.num_drafters * v_league.num_rounds then
    raise exception 'The draft is already complete.';
  end if;

  v_round := (v_picks_made / v_league.num_drafters) + 1;
  v_pos_in_round := (v_picks_made % v_league.num_drafters) + 1;

  -- Snake order: odd rounds go 1..D, even rounds go D..1.
  if v_round % 2 = 1 then
    v_expected_position := v_pos_in_round;
  else
    v_expected_position := v_league.num_drafters - v_pos_in_round + 1;
  end if;

  select draft_position into v_caller_position
  from league_members
  where league_id = new.league_id and profile_id = auth.uid();

  if v_caller_position is null then
    raise exception 'You are not a member of this league.';
  end if;

  if v_caller_position <> v_expected_position then
    raise exception 'It is not your turn to pick.';
  end if;

  if exists (
    select 1 from players p
    where p.id = new.player_id and p.season <> v_league.season
  ) then
    raise exception 'That player is not part of this league''s season.';
  end if;

  new.round := v_round;
  new.pick_number := v_picks_made + 1;
  new.profile_id := auth.uid();

  return new;
end;
$$;

create trigger picks_enforce_turn
  before insert on picks
  for each row execute function enforce_draft_turn();

-- Mark the league complete once the last pick has been made. SECURITY
-- DEFINER because the final pick is often made by a non-owner drafter, who
-- otherwise can't satisfy leagues' owner-only UPDATE policy.
create function maybe_complete_draft()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num_drafters int;
  v_num_rounds int;
  v_picks_made int;
begin
  select num_drafters, num_rounds into v_num_drafters, v_num_rounds
  from leagues where id = new.league_id;

  select count(*) into v_picks_made from picks where league_id = new.league_id;

  if v_picks_made >= v_num_drafters * v_num_rounds then
    update leagues set status = 'complete' where id = new.league_id;
  end if;

  return new;
end;
$$;

create trigger picks_maybe_complete_draft
  after insert on picks
  for each row execute function maybe_complete_draft();

-- ============================================================================
-- rosters (a security_invoker view — respects the caller's RLS on `picks`)
-- ============================================================================
create view rosters
with (security_invoker = true)
as
select
  p.league_id,
  p.profile_id,
  pr.display_name,
  p.round,
  p.pick_number,
  pl.id as player_id,
  pl.name as player_name,
  pl.tribe,
  pl.photo_url
from picks p
join profiles pr on pr.id = p.profile_id
join players pl on pl.id = p.player_id
order by p.league_id, p.profile_id, p.pick_number;

-- ============================================================================
-- Realtime — broadcast new picks (and league status flips) to subscribers.
-- RLS above still applies: a client only receives rows it's allowed to SELECT.
-- ============================================================================
alter publication supabase_realtime add table picks;
alter publication supabase_realtime add table leagues;
alter publication supabase_realtime add table league_members;
