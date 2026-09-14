-- Hall of Fame: a simple site-wide record of past season winners, predating
-- this app (you've been running this draft since Survivor 48). Not scoped to
-- any single league — it's shared history for the whole group.
-- Run this in the Supabase SQL editor after 0002_scoring.sql.
-- (Remember: the SQL editor runs as the `authenticated` role by default —
-- run `reset role;` first if you hit "must be owner of table" errors.)

create table hall_of_fame (
  id uuid primary key default gen_random_uuid(),
  season text not null unique,
  winner_profile_id uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table hall_of_fame enable row level security;

create policy "hall of fame is viewable by any authenticated user"
  on hall_of_fame for select
  to authenticated
  using (true);

-- Same trust level as episode scoring: any league owner can manage it,
-- since there's no other natural "admin" role in this app.
create policy "league owners can manage hall of fame entries"
  on hall_of_fame for all
  to authenticated
  using (exists (select 1 from leagues where owner_id = auth.uid()))
  with check (exists (select 1 from leagues where owner_id = auth.uid()));
