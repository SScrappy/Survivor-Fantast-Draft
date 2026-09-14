-- Seeds the `players` table with the Survivor 51 cast (premieres 2026-09-23).
-- Cast + hometowns per Wikipedia as of 2026-09-14; starting tribes hadn't
-- been announced yet, so `tribe` is left null — fill it in once the premiere
-- airs by running an UPDATE, or re-seed for a future season by swapping the
-- `season` value and VALUES list below.
--
-- Run this in the Supabase SQL editor (or `supabase db execute -f ...`)
-- AFTER 0001_init.sql has been applied. Safe to re-run: it upserts on
-- (name, season).

alter table players add constraint players_name_season_unique unique (name, season);

insert into players (name, season, tribe, bio) values
  ('Rob Antonson', 'Survivor 51', null, 'Age 40, Cumberland, Rhode Island'),
  ('Brady Booker', 'Survivor 51', null, 'Age 27, Knoxville, Tennessee'),
  ('Patt Cannaday', 'Survivor 51', null, 'Age 33, Washington, D.C.'),
  ('Linnea Capobianco', 'Survivor 51', null, 'Age 25, Jersey City, New Jersey'),
  ('Cristian Chavez', 'Survivor 51', null, 'Age 26, Salt Lake City, Utah'),
  ('Sharonda Cox', 'Survivor 51', null, 'Age 34, Richmond, Kentucky'),
  ('Jenna Doore', 'Survivor 51', null, 'Age 30, Toledo, Ohio'),
  ('Kristin Flickinger', 'Survivor 51', null, 'Age 49, Santa Barbara, California'),
  ('Ori Jean-Charles', 'Survivor 51', null, 'Age 27, Spring Valley, New York'),
  ('Lewis Kelly', 'Survivor 51', null, 'Age 28, Corozal, Puerto Rico'),
  ('Danny Kilby', 'Survivor 51', null, 'Age 30, London, Ontario'),
  ('Carter Krull', 'Survivor 51', null, 'Age 24, Sioux Falls, South Dakota'),
  ('Alexis Levine', 'Survivor 51', null, 'Age 34, Atlanta, Georgia'),
  ('Angelica "Jelly" Loblack', 'Survivor 51', null, 'Age 29, Bloomington, Indiana'),
  ('Eric Macksoud', 'Survivor 51', null, 'Age 34, Windsor Locks, Connecticut'),
  ('Maggie Nestor', 'Survivor 51', null, 'Age 40, Charles Town, West Virginia'),
  ('Thien An Nguyen', 'Survivor 51', null, 'Age 24, Fort Worth, Texas'),
  ('Mike Pinsky', 'Survivor 51', null, 'Age 32, New York City, New York'),
  ('Aaliyah Puglia', 'Survivor 51', null, 'Age 24, Providence, Rhode Island'),
  ('Ana Sani', 'Survivor 51', null, 'Age 34, Toronto, Ontario'),
  ('Devin Way', 'Survivor 51', null, 'Age 33, Los Angeles, California')
on conflict (name, season) do nothing;
