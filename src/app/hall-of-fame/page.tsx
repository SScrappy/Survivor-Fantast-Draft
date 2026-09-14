import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HallOfFameForm from "@/components/HallOfFameForm";
import DeleteHallOfFameButton from "@/components/DeleteHallOfFameButton";

function seasonSortKey(season: string): number {
  const match = season.match(/(\d+)(?!.*\d)/);
  return match ? Number(match[1]) : -Infinity;
}

export default async function HallOfFamePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: entries } = await supabase
    .from("hall_of_fame")
    .select("id, season, winner_profile_id, created_at");

  const winnerIds = [...new Set((entries ?? []).map((e) => e.winner_profile_id))];
  const { data: winnerProfiles } = winnerIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", winnerIds)
    : { data: [] };
  const nameById = new Map((winnerProfiles ?? []).map((p) => [p.id, p.display_name]));

  const sorted = [...(entries ?? [])].sort(
    (a, b) => seasonSortKey(b.season) - seasonSortKey(a.season)
  );

  const { data: ownedLeague } = await supabase
    .from("leagues")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  const isOwner = Boolean(ownedLeague);

  const { data: allProfiles } = isOwner
    ? await supabase.from("profiles").select("id, display_name").order("display_name")
    : { data: null };

  return (
    <div className="space-y-8 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold">🏆 Hall of Fame</h1>
        <p className="text-neutral-600 text-sm">Past season winners.</p>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="text-neutral-600">No winners recorded yet.</p>
      ) : (
        <ol className="border border-neutral-200 rounded-lg bg-white divide-y divide-neutral-200">
          {sorted.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between px-4 py-3">
              <span>
                <span className="font-medium">{entry.season}</span>
                <span className="text-neutral-500"> — won by </span>
                <span className="font-medium">{nameById.get(entry.winner_profile_id) ?? "Unknown"}</span>
              </span>
              {isOwner && <DeleteHallOfFameButton id={entry.id} />}
            </li>
          ))}
        </ol>
      )}

      {isOwner && allProfiles && (
        <div>
          <h2 className="font-semibold mb-2">Add a winner</h2>
          <HallOfFameForm profiles={allProfiles} />
        </div>
      )}
    </div>
  );
}
