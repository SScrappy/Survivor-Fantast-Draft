import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DraftBoard from "@/components/DraftBoard";

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: league } = await supabase.from("leagues").select("*").eq("id", id).single();
  if (!league) notFound();

  const { data: memberRows } = await supabase
    .from("league_members")
    .select("id, profile_id, draft_position")
    .eq("league_id", id)
    .order("draft_position", { ascending: true });

  const profileIds = (memberRows ?? []).map((m) => m.profile_id);
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", profileIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const members = (memberRows ?? []).map((m) => ({
    id: m.id,
    profileId: m.profile_id,
    displayName: nameById.get(m.profile_id) ?? "Unknown",
    draftPosition: m.draft_position ?? 0,
  }));

  const { data: players } = await supabase
    .from("players")
    .select("id, name, season, tribe, photo_url, bio, placement, created_at")
    .eq("season", league.season)
    .order("name", { ascending: true });

  const { data: picks } = await supabase
    .from("picks")
    .select("id, league_id, round, pick_number, profile_id, player_id, created_at")
    .eq("league_id", id)
    .order("pick_number", { ascending: true });

  return (
    <DraftBoard
      league={{
        id: league.id,
        status: league.status,
        numDrafters: league.num_drafters,
        numRounds: league.num_rounds,
        season: league.season,
        name: league.name,
      }}
      members={members}
      players={players ?? []}
      initialPicks={picks ?? []}
      currentUserId={user!.id}
    />
  );
}
