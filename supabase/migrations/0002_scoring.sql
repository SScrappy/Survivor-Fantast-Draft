-- Placement-based scoring: each castaway's final placement is their point
-- value (1st boot = 1 point, ..., winner = however many castaways were in
-- the season's pool). A roster's score is the sum of its picks' placements.
-- Run this in the Supabase SQL editor after 0001_init.sql.

alter table players add column placement int check (placement > 0);

-- One castaway per placement per season (e.g. only one "1st voted out").
alter table players add constraint players_season_placement_unique unique (season, placement);

-- Any owner of a league in a given season can record that season's results —
-- results are shared across every league drafting the same season, so this
-- intentionally isn't scoped to a single league. SECURITY DEFINER because it
-- writes to `players`, which has no general UPDATE policy for regular users;
-- the ownership check below is the actual authorization gate.
create function set_player_placement(p_player_id uuid, p_placement int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season text;
begin
  select season into v_season from players where id = p_player_id;

  if v_season is null then
    raise exception 'Player not found.';
  end if;

  if not exists (
    select 1 from leagues where leagues.season = v_season and leagues.owner_id = auth.uid()
  ) then
    raise exception 'Only an owner of a league in this season can record results.';
  end if;

  update players set placement = p_placement where id = p_player_id;
end;
$$;

grant execute on function set_player_placement(uuid, int) to authenticated;

-- Extend rosters with each pick's placement/points so league standings can
-- be computed without a separate query.
create or replace view rosters
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
  pl.photo_url,
  pl.placement,
  coalesce(pl.placement, 0) as points
from picks p
join profiles pr on pr.id = p.profile_id
join players pl on pl.id = p.player_id
order by p.league_id, p.profile_id, p.pick_number;
