"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createLeague(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const season = String(formData.get("season") || "Survivor 51").trim();
  const numDrafters = Number(formData.get("numDrafters"));
  const numRounds = Number(formData.get("numRounds"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: league, error } = await supabase
    .from("leagues")
    .insert({
      name,
      season,
      num_drafters: numDrafters,
      num_rounds: numRounds,
      owner_id: user!.id,
    })
    .select("id")
    .single();

  if (error || !league) {
    redirect(`/leagues/new?error=${encodeURIComponent(error?.message ?? "Could not create league")}`);
  }

  // Owner is automatically the first drafter in their own league.
  await supabase.from("league_members").insert({
    league_id: league.id,
    profile_id: user!.id,
  });

  redirect(`/leagues/${league.id}`);
}

export async function joinLeagueByCode(formData: FormData) {
  const code = String(formData.get("code") || "")
    .trim()
    .toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: matches, error: lookupError } = await supabase.rpc("find_league_by_code", {
    p_code: code,
  });

  const league = matches?.[0];

  if (lookupError || !league) {
    redirect(`/dashboard?error=${encodeURIComponent("No league found with that invite code")}`);
  }

  if (league!.status !== "pending") {
    redirect(`/dashboard?error=${encodeURIComponent("That league's draft has already started")}`);
  }

  if (league!.member_count >= league!.num_drafters) {
    redirect(`/dashboard?error=${encodeURIComponent("That league is already full")}`);
  }

  const { error: joinError } = await supabase.from("league_members").insert({
    league_id: league!.id,
    profile_id: user!.id,
  });

  if (joinError) {
    redirect(`/dashboard?error=${encodeURIComponent(joinError.message)}`);
  }

  redirect(`/leagues/${league!.id}`);
}

export async function randomizeDraftOrder(leagueId: string) {
  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId);

  if (error || !members) return;

  const shuffled = [...members].sort(() => Math.random() - 0.5);
  const assignments = shuffled.map((m, i) => ({ member_id: m.id, position: i + 1 }));

  await supabase.rpc("set_draft_order", {
    p_league_id: leagueId,
    p_assignments: assignments,
  });

  revalidatePath(`/leagues/${leagueId}`);
}

export async function setDraftOrder(leagueId: string, assignments: { member_id: string; position: number }[]) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_draft_order", {
    p_league_id: leagueId,
    p_assignments: assignments,
  });

  revalidatePath(`/leagues/${leagueId}`);
  return { error: error?.message ?? null };
}

export async function startDraft(leagueId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("leagues")
    .update({ status: "live" })
    .eq("id", leagueId);

  if (error) {
    redirect(`/leagues/${leagueId}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/leagues/${leagueId}/draft`);
}

export async function setPlayerPlacement(leagueId: string, playerId: string, placement: number | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_player_placement", {
    p_player_id: playerId,
    p_placement: placement,
  });

  revalidatePath(`/leagues/${leagueId}/rosters`);
  return { error: error?.message ?? null };
}
