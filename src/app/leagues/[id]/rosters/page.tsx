import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ResultsEditor from "@/components/ResultsEditor";

export default async function RostersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: league } = await supabase.from("leagues").select("*").eq("id", id).single();
  if (!league) notFound();

  const { data: rosterRows } = await supabase.from("rosters").select("*").eq("league_id", id);

  const byMember = new Map<
    string,
    { displayName: string; totalPoints: number; picks: NonNullable<typeof rosterRows> }
  >();
  for (const row of rosterRows ?? []) {
    if (!byMember.has(row.profile_id)) {
      byMember.set(row.profile_id, { displayName: row.display_name, totalPoints: 0, picks: [] });
    }
    const group = byMember.get(row.profile_id)!;
    group.picks.push(row);
    group.totalPoints += row.points;
  }

  const standings = [...byMember.values()].sort((a, b) => b.totalPoints - a.totalPoints);

  const isOwner = league.owner_id === user?.id;
  const { data: seasonPlayers } = isOwner
    ? await supabase
        .from("players")
        .select("id, name, placement")
        .eq("season", league.season)
        .order("name", { ascending: true })
    : { data: null };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{league.name} — Rosters</h1>
          <p className="text-neutral-600 text-sm">{league.season}</p>
        </div>
        <Link href={`/leagues/${league.id}`} className="text-sm underline">
          ← Back to league
        </Link>
      </div>

      {standings.length === 0 ? (
        <p className="text-neutral-600">No picks have been made yet.</p>
      ) : (
        <div>
          <h2 className="font-semibold mb-2">Standings</h2>
          <ol className="border border-neutral-200 rounded-lg bg-white divide-y divide-neutral-200 max-w-md">
            {standings.map((group, i) => (
              <li key={group.displayName} className="flex items-center justify-between px-4 py-2.5">
                <span>
                  <span className="text-neutral-400 mr-2">#{i + 1}</span>
                  {group.displayName}
                </span>
                <span className="font-semibold">{group.totalPoints} pts</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {standings.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {standings.map((group) => (
            <div key={group.displayName} className="border border-neutral-200 rounded-lg bg-white p-4">
              <h2 className="font-semibold mb-2">{group.displayName}</h2>
              <ul className="space-y-1">
                {group.picks
                  .sort((a, b) => a.pick_number - b.pick_number)
                  .map((pick) => (
                    <li key={pick.player_id} className="text-sm flex justify-between">
                      <span>{pick.player_name}</span>
                      <span className="text-neutral-400">
                        {pick.placement ? `${pick.points} pts` : "—"}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {isOwner && seasonPlayers && (
        <div>
          <h2 className="font-semibold mb-2">Manage results</h2>
          <ResultsEditor leagueId={league.id} players={seasonPlayers} />
        </div>
      )}
    </div>
  );
}
